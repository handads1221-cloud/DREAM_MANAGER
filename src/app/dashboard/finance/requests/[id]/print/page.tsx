import Image from 'next/image';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PrintButton } from './print-button';

const statusLabels: Record<string, string> = { pending: '접수 대기', reviewing: '확인 중', approved: '승인', rejected: '반려', paid: '지급 완료' };

export default async function PaymentRequestPrintPage({ params }: PageProps<'/dashboard/finance/requests/[id]/print'>) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('full_name,role,is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || !['teacher', 'accountant', 'admin'].includes(profile.role)) redirect('/dashboard');

  const { data: request } = await supabase.from('payment_requests').select('id,requester_id,category,amount,bank_account,memo,status,review_note,created_at,reviewed_at,reviewed_by').eq('id', id).maybeSingle();
  if (!request) notFound();
  const [{ data: requester }, { data: reviewer }, { data: receipts }] = await Promise.all([
    supabase.from('profiles').select('full_name,phone').eq('id', request.requester_id).maybeSingle(),
    request.reviewed_by ? supabase.from('profiles').select('full_name').eq('id', request.reviewed_by).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('payment_request_receipts').select('id,storage_path,original_name').eq('payment_request_id', request.id).order('created_at'),
  ]);
  const signedReceipts = await Promise.all((receipts ?? []).map(async (receipt) => {
    const { data } = await supabase.storage.from('finance-receipts').createSignedUrl(receipt.storage_path, 1800);
    return { ...receipt, url: data?.signedUrl ?? null };
  }));
  const requestedAt = new Date(request.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const reviewedAt = request.reviewed_at ? new Date(request.reviewed_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-';

  return <main className="payment-document-page">
    <div className="payment-document-toolbar"><Link href="/dashboard/finance/requests">← 결제요청으로</Link><span>인쇄 화면에서 대상을 ‘PDF로 저장’으로 선택하세요.</span><PrintButton/></div>
    <article className="payment-document">
      <header><div><p>청주신흥교회 드림어린이부</p><h1>결제 요청서</h1></div><strong>{statusLabels[request.status] ?? request.status}</strong></header>
      <section className="payment-document-meta"><div><span>문서번호</span><b>DR-{request.id.slice(0, 8).toUpperCase()}</b></div><div><span>요청일시</span><b>{requestedAt}</b></div></section>
      <section className="payment-document-table">
        <div><span>요청자</span><b>{requester?.full_name ?? '-'}</b></div><div><span>연락처</span><b>{requester?.phone ?? '-'}</b></div>
        <div><span>비목</span><b>{request.category}</b></div><div><span>요청 금액</span><strong>{Number(request.amount).toLocaleString()}원</strong></div>
        <div className="wide"><span>입금 계좌</span><b>{request.bank_account}</b></div><div className="wide"><span>요청 내용</span><p>{request.memo || '기재 내용 없음'}</p></div>
        <div><span>처리 담당자</span><b>{reviewer?.full_name ?? '-'}</b></div><div><span>처리 일시</span><b>{reviewedAt}</b></div>
        <div className="wide"><span>처리 메모</span><p>{request.review_note || '기재 내용 없음'}</p></div>
      </section>
      <section className="payment-document-receipts"><div><h2>첨부 영수증</h2><span>{signedReceipts.length}장</span></div>{signedReceipts.length ? signedReceipts.map((receipt, index) => <figure key={receipt.id}><figcaption>영수증 {index + 1} · {receipt.original_name}</figcaption>{receipt.url ? <Image src={receipt.url} alt={`첨부 영수증 ${index + 1}`} width={1000} height={1400} sizes="(max-width: 800px) 100vw, 760px" unoptimized/> : <p>이미지를 불러오지 못했습니다.</p>}</figure>) : <p className="payment-document-empty">첨부된 영수증이 없습니다.</p>}</section>
      <footer>본 문서는 DREAM MANAGER에 등록된 결제요청 정보를 기준으로 출력되었습니다.</footer>
    </article>
  </main>;
}
