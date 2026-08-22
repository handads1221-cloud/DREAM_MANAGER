import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../dashboard-shell';
import { approveRegistration, rejectRegistration } from './actions';

export default async function AccountsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');
  const { data: requests } = await supabase.from('registration_requests').select('user_id, email, full_name, phone, address, note, status, requested_at').order('requested_at', { ascending: false });
  const pending = (requests ?? []).filter((request) => request.status === 'pending');
  const reviewed = (requests ?? []).filter((request) => request.status !== 'pending');

  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/accounts">
    <div className="account-page-heading"><div><p className="eyebrow">ACCOUNT APPROVAL</p><h1>가입·계정관리</h1><span>가입자의 정보를 확인하고 부모·학생·선생님 권한을 부여합니다.</span></div><strong>승인 대기 {pending.length}건</strong></div>
    <section className="approval-section"><h2>가입 승인 대기</h2>{pending.length === 0 ? <div className="account-empty">현재 승인 대기 중인 가입 신청이 없습니다.</div> : <div className="approval-list">{pending.map((request) => <article key={request.user_id} className="approval-card"><div className="approval-person"><span>{request.full_name.slice(0, 1)}</span><div><h3>{request.full_name}</h3><p>{request.email}</p></div></div><dl><div><dt>연락처</dt><dd>{request.phone || '미입력'}</dd></div><div><dt>주소</dt><dd>{request.address || '미입력'}</dd></div>{request.note && <div><dt>비고</dt><dd>{request.note}</dd></div>}</dl><div className="approval-actions"><form action={approveRegistration}><input type="hidden" name="user_id" value={request.user_id} /><select name="role" aria-label={`${request.full_name} 권한`} defaultValue="parent"><option value="parent">부모님</option><option value="student">학생</option><option value="teacher">선생님</option></select><button type="submit">승인하고 권한 부여</button></form><form action={rejectRegistration}><input type="hidden" name="user_id" value={request.user_id} /><button type="submit" className="reject">반려</button></form></div></article>)}</div>}</section>
    <section className="reviewed-section"><h2>처리 내역</h2><div className="reviewed-list">{reviewed.slice(0, 20).map((request) => <div key={request.user_id}><span>{request.full_name} · {request.email}</span><b className={request.status}>{request.status === 'approved' ? '승인 완료' : '반려'}</b></div>)}{reviewed.length === 0 && <p>처리된 가입 신청이 없습니다.</p>}</div></section>
  </DashboardShell>;
}
