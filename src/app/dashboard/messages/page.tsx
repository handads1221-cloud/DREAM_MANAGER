import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../dashboard-shell';
import { createInquiry, sendInquiryMessage, updateInquiryStatus } from './actions';

const statusLabel: Record<string, string> = { open: '답변 대기', answered: '답변 완료', closed: '종료' };

export default async function MessagesPage({ searchParams }: PageProps<'/dashboard/messages'>) {
  const params = await searchParams;
  const selectedId = typeof params.id === 'string' ? params.id : null;
  const feedback = typeof params.message === 'string' ? params.message : null;
  const errorMessage = typeof params.error === 'string' ? params.error : null;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims?.sub) redirect('/login');
  const userId = authData.claims.sub;
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active, account_status').eq('id', userId).maybeSingle();
  if (!profile?.is_active || profile.account_status === 'withdrawn' || !['admin', 'parent'].includes(profile.role)) redirect('/dashboard');
  const role = profile.role as AppRole;

  let inquiryQuery = supabase.from('inquiries').select('id, parent_id, subject, status, assigned_admin_id, created_at, updated_at').order('updated_at', { ascending: false });
  if (role === 'parent') inquiryQuery = inquiryQuery.eq('parent_id', userId);
  const { data: inquiries } = await inquiryQuery;
  const rows = inquiries ?? [];
  const inquiryIds = rows.map((inquiry) => inquiry.id);
  const { data: allMessages } = inquiryIds.length
    ? await supabase.from('inquiry_messages').select('id, inquiry_id, sender_id, body, created_at').in('inquiry_id', inquiryIds).order('created_at', { ascending: false })
    : { data: [] };
  const selected = rows.find((inquiry) => inquiry.id === selectedId) ?? rows[0] ?? null;
  const selectedMessages = (allMessages ?? []).filter((message) => message.inquiry_id === selected?.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const parentIds = [...new Set(rows.map((inquiry) => inquiry.parent_id))];
  const senderIds = [...new Set(selectedMessages.map((message) => message.sender_id))];
  const profileIds = [...new Set([...parentIds, ...senderIds])];
  const { data: people } = profileIds.length ? await supabase.from('profiles').select('id, full_name, role').in('id', profileIds) : { data: [] };
  const personById = new Map((people ?? []).map((person) => [person.id, person]));
  const lastMessageByInquiry = new Map<string, NonNullable<typeof allMessages>[number]>();
  for (const message of allMessages ?? []) if (!lastMessageByInquiry.has(message.inquiry_id)) lastMessageByInquiry.set(message.inquiry_id, message);
  const waitingCount = rows.filter((inquiry) => inquiry.status === 'open').length;

  return <DashboardShell profile={{ full_name: profile.full_name, role }} activeHref="/dashboard/messages">
    <div className="message-page-heading"><div><p className="eyebrow">{role === 'admin' ? 'ADMIN MESSAGE BOX' : 'CONTACT ADMIN'}</p><h1>{role === 'admin' ? '메시지함' : '문의하기'}</h1><span>{role === 'admin' ? '부모님 문의를 확인하고 대화 형식으로 답변합니다.' : '관리자에게 문의하고 답변 내용을 확인할 수 있습니다.'}</span></div><strong>{role === 'admin' ? `${waitingCount}건 답변 대기` : `${rows.length}건 문의`}</strong></div>
    {feedback && <p className="form-alert success">{feedback}</p>}{errorMessage && <p className="form-alert error">{errorMessage}</p>}

    {role === 'parent' && <details className="message-new-inquiry" open={rows.length === 0}><summary>새 문의 작성</summary><form action={createInquiry}><label>문의 제목<input name="subject" maxLength={100} placeholder="문의 제목을 입력해 주세요" required /></label><label>문의 내용<textarea name="body" rows={5} maxLength={3000} placeholder="관리자에게 전달할 내용을 자세히 입력해 주세요" required /></label><button type="submit">문의 보내기</button></form></details>}

    <div className="message-box-layout">
      <aside className="message-thread-list">
        <div><h2>{role === 'admin' ? '전체 문의' : '나의 문의'}</h2><span>{rows.length}건</span></div>
        {rows.map((inquiry) => { const last = lastMessageByInquiry.get(inquiry.id); const parent = personById.get(inquiry.parent_id); return <Link key={inquiry.id} href={`/dashboard/messages?id=${inquiry.id}`} className={selected?.id === inquiry.id ? 'active' : ''}><div><b>{inquiry.subject}</b><i className={`status-${inquiry.status}`}>{statusLabel[inquiry.status]}</i></div>{role === 'admin' && <strong>{parent?.full_name ?? '부모 계정'}</strong>}<p>{last?.body ?? '등록된 메시지가 없습니다.'}</p><time>{new Date(last?.created_at ?? inquiry.created_at).toLocaleString('ko-KR')}</time></Link>; })}
        {rows.length === 0 && <div className="message-list-empty">아직 등록된 문의가 없습니다.</div>}
      </aside>

      <section className="message-conversation">
        {selected ? <><header><div><span>{role === 'admin' ? `${personById.get(selected.parent_id)?.full_name ?? '부모 계정'}님의 문의` : '관리자 문의'}</span><h2>{selected.subject}</h2><time>{new Date(selected.created_at).toLocaleString('ko-KR')}</time></div><i className={`status-${selected.status}`}>{statusLabel[selected.status]}</i></header>
          <div className="message-bubbles">{selectedMessages.map((message) => { const mine = message.sender_id === userId; const sender = personById.get(message.sender_id); return <article key={message.id} className={mine ? 'mine' : ''}><small>{mine ? '나' : `${sender?.full_name ?? '상대방'}${sender?.role === 'admin' ? ' 관리자' : ''}`}</small><p>{message.body}</p><time>{new Date(message.created_at).toLocaleString('ko-KR')}</time></article>; })}{selectedMessages.length === 0 && <p className="message-conversation-empty">등록된 대화 내용이 없습니다.</p>}</div>
          <div className="message-reply-area">{selected.status !== 'closed' ? <form action={sendInquiryMessage}><input type="hidden" name="inquiry_id" value={selected.id}/><textarea name="body" rows={3} maxLength={3000} placeholder={role === 'admin' ? '부모님께 보낼 답변을 입력해 주세요' : '추가 문의 내용을 입력해 주세요'} required/><button type="submit">{role === 'admin' ? '답변 보내기' : '메시지 보내기'}</button></form> : <p>종료된 문의입니다.</p>}
            {role === 'admin' && <form action={updateInquiryStatus} className="message-status-actions"><input type="hidden" name="inquiry_id" value={selected.id}/>{selected.status === 'closed' ? <button type="submit" name="status" value="open">문의 다시 열기</button> : <button type="submit" name="status" value="closed">문의 종료</button>}</form>}
          </div>
        </> : <div className="message-conversation-empty full">{role === 'parent' ? '새 문의를 작성해 주세요.' : '접수된 문의가 없습니다.'}</div>}
      </section>
    </div>
  </DashboardShell>;
}
