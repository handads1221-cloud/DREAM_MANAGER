import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../../dashboard-shell';
import { processPaymentRequest } from '../actions';
import { RequestForm } from './request-form';

const labels: Record<string, string> = { pending: '대기', reviewing: '확인중', approved: '승인', rejected: '반려', paid: '지급완료' };

export default async function Requests({ searchParams }: PageProps<'/dashboard/finance/requests'>) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('full_name,role,is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || !['teacher', 'accountant', 'admin'].includes(profile.role)) redirect('/dashboard');

  let requestQuery = supabase.from('payment_requests').select('id,requester_id,category,amount,bank_account,memo,status,review_note,created_at').order('created_at', { ascending: false });
  if (profile.role === 'teacher') requestQuery = requestQuery.eq('requester_id', userId);
  const { data: rows } = await requestQuery;
  const requests = rows ?? [];
  const requesterIds = [...new Set(requests.map((row) => row.requester_id))];
  const requestIds = requests.map((row) => row.id);
  const [{ data: people }, { data: receiptRows }] = await Promise.all([
    requesterIds.length ? supabase.from('profiles').select('id,full_name').in('id', requesterIds) : Promise.resolve({ data: [] }),
    requestIds.length ? supabase.from('payment_request_receipts').select('id,payment_request_id,storage_path,original_name').in('payment_request_id', requestIds).order('created_at') : Promise.resolve({ data: [] }),
  ]);
  const names = new Map((people ?? []).map((person) => [person.id, person.full_name]));
  const signedReceipts = await Promise.all((receiptRows ?? []).map(async (receipt) => {
    const { data } = await supabase.storage.from('finance-receipts').createSignedUrl(receipt.storage_path, 600);
    return { ...receipt, url: data?.signedUrl ?? null };
  }));
  const receiptsByRequest = new Map<string, typeof signedReceipts>();
  for (const receipt of signedReceipts) {
    const list = receiptsByRequest.get(receipt.payment_request_id) ?? [];
    list.push(receipt);
    receiptsByRequest.set(receipt.payment_request_id, list);
  }
  const canProcess = ['admin', 'accountant'].includes(profile.role);

  return <DashboardShell profile={{ full_name: profile.full_name, role: profile.role as AppRole }} activeHref="/dashboard/finance/requests">
    <div className="module-heading"><div><p className="eyebrow">PAYMENT REQUEST</p><h1>{profile.role === 'teacher' ? '결제요청' : '결제요청 관리'}</h1></div></div>
    {typeof params.message === 'string' ? <p className="form-alert success">{params.message}</p> : null}
    {typeof params.error === 'string' ? <p className="form-alert error">{params.error}</p> : null}
    {profile.role === 'teacher' ? <RequestForm/> : null}
    <div className="payment-list">{requests.map((request) => <article key={request.id}>
      <div><b>{request.category}</b><strong>{Number(request.amount).toLocaleString()}원</strong><span>{names.get(request.requester_id)} · {new Date(request.created_at).toLocaleDateString('ko-KR')}</span><em>{labels[request.status]}</em></div>
      <p>계좌 {request.bank_account}</p>{request.memo ? <p>{request.memo}</p> : null}{request.review_note ? <p>처리메모: {request.review_note}</p> : null}
      <div className="receipt-links"><b>첨부 영수증</b>{(receiptsByRequest.get(request.id) ?? []).map((receipt, index) => receipt.url ? <a key={receipt.id} href={receipt.url} target="_blank" rel="noopener noreferrer">영수증 {index + 1} 보기 ↗</a> : <span key={receipt.id}>{receipt.original_name} 불러오기 실패</span>)}{!receiptsByRequest.get(request.id)?.length ? <span>첨부 없음</span> : null}</div>
      {canProcess && request.status !== 'paid' ? <form action={processPaymentRequest}><input type="hidden" name="request_id" value={request.id}/><select aria-label="처리 상태" name="status" defaultValue={request.status}><option value="reviewing">확인중</option><option value="approved">승인</option><option value="rejected">반려</option><option value="paid">지급완료·장부차감</option></select><input aria-label="처리 메모" name="review_note" placeholder="처리 메모"/><button>상태 변경</button></form> : null}
    </article>)}</div>
  </DashboardShell>;
}
