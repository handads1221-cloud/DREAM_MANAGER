import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../dashboard-shell';
import { approveRegistration, rejectRegistration, restoreAccount, setAccountPassword, updateAccountRole, withdrawAccount } from './actions';

const roleLabel: Record<string, string> = { admin: '관리자', teacher: '선생님', parent: '부모님', student: '학생' };

export default async function AccountsPage({ searchParams }: PageProps<'/dashboard/accounts'>) {
  const params = await searchParams;
  const message = typeof params.message === 'string' ? params.message : null;
  const errorMessage = typeof params.error === 'string' ? params.error : null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/login');
  const currentUserId = data.claims.sub;
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', currentUserId).maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');

  const [{ data: requests }, { data: accounts }] = await Promise.all([
    supabase.from('registration_requests').select('user_id, email, full_name, phone, address, note, status, requested_at').order('requested_at', { ascending: false }),
    supabase.from('profiles').select('id, email, full_name, role, phone, is_active, account_status, withdrawn_at, withdrawal_note').order('full_name'),
  ]);
  const requestRows = requests ?? [];
  const pending = requestRows.filter((request) => request.status === 'pending');
  const reviewed = requestRows.filter((request) => request.status !== 'pending');
  const activeAccounts = (accounts ?? []).filter((account) => account.account_status !== 'withdrawn' && account.is_active);
  const withdrawnAccounts = (accounts ?? []).filter((account) => account.account_status === 'withdrawn' || !account.is_active);

  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/accounts">
    <div className="account-page-heading"><div><p className="eyebrow">ACCOUNT MANAGEMENT</p><h1>가입·계정관리</h1><span>가입 승인, 권한 변경, 비밀번호 재설정과 탈퇴 계정을 관리합니다.</span></div><strong>승인 대기 {pending.length}건</strong></div>
    {message && <p className="form-alert success account-feedback">{message}</p>}
    {errorMessage && <p className="form-alert error account-feedback">{errorMessage}</p>}

    <section className="approval-section"><h2>가입 승인 대기</h2>{pending.length === 0 ? <div className="account-empty">현재 승인 대기 중인 가입 신청이 없습니다.</div> : <div className="approval-list">{pending.map((request) => <article key={request.user_id} className="approval-card"><div className="approval-person"><span>{request.full_name.slice(0, 1)}</span><div><h3>{request.full_name}</h3><p>{request.email}</p></div></div><dl><div><dt>연락처</dt><dd>{request.phone || '미입력'}</dd></div><div><dt>주소</dt><dd>{request.address || '미입력'}</dd></div>{request.note && <div><dt>비고</dt><dd>{request.note}</dd></div>}</dl><div className="approval-actions"><form action={approveRegistration}><input type="hidden" name="user_id" value={request.user_id} /><select name="role" aria-label={`${request.full_name} 권한`} defaultValue="parent"><option value="parent">부모님</option><option value="student">학생</option><option value="teacher">선생님</option></select><button type="submit">승인하고 권한 부여</button></form><form action={rejectRegistration}><input type="hidden" name="user_id" value={request.user_id} /><button type="submit" className="reject">반려</button></form></div></article>)}</div>}</section>

    <section className="account-management-section"><div className="section-title-row"><div><h2>활성 계정</h2><p>권한과 비밀번호를 관리합니다.</p></div><b>{activeAccounts.length}개</b></div><div className="managed-account-list">{activeAccounts.map((account) => <article key={account.id} className="managed-account-card"><div className="managed-account-person"><span>{account.full_name.slice(0, 1)}</span><div><h3>{account.full_name}</h3><p>{account.email ?? '이메일 정보 없음'} · {account.phone || '연락처 미입력'}</p></div><b className={`account-role ${account.role}`}>{roleLabel[account.role] ?? account.role}</b></div><div className="managed-account-actions"><form action={updateAccountRole}><input type="hidden" name="user_id" value={account.id} /><select name="role" defaultValue={account.role} aria-label={`${account.full_name} 권한 변경`} disabled={account.id === currentUserId}><option value="parent">부모님</option><option value="student">학생</option><option value="teacher">선생님</option><option value="admin">관리자</option></select><button type="submit" disabled={account.id === currentUserId}>권한 변경</button></form>{account.id !== currentUserId && <details className="password-admin"><summary>비밀번호 직접 변경</summary><form action={setAccountPassword}><input type="hidden" name="user_id" value={account.id} /><label><span>새 비밀번호</span><input name="new_password" type="password" minLength={8} autoComplete="new-password" placeholder="8자 이상" required /></label><label><span>새 비밀번호 확인</span><input name="new_password_confirm" type="password" minLength={8} autoComplete="new-password" placeholder="한 번 더 입력" required /></label><p>메일은 발송되지 않으며 변경 즉시 기존 로그인 세션이 종료됩니다.</p><button type="submit">새 비밀번호 적용</button></form></details>}{account.id !== currentUserId && <details className="withdraw-account"><summary>탈퇴 처리</summary><form action={withdrawAccount}><input type="hidden" name="user_id" value={account.id} /><input name="withdrawal_note" maxLength={200} placeholder="탈퇴 사유 (선택)" /><p>로그인만 차단되며 기존 출석·보석·관계 데이터는 삭제되지 않습니다.</p><button type="submit">탈퇴 계정으로 전환</button></form></details>}</div></article>)}{activeAccounts.length === 0 && <div className="account-empty">활성 계정이 없습니다.</div>}</div></section>

    <section className="account-management-section withdrawn"><div className="section-title-row"><div><h2>탈퇴 계정</h2><p>데이터는 보존되며 로그인만 차단된 계정입니다.</p></div><b>{withdrawnAccounts.length}개</b></div><div className="managed-account-list">{withdrawnAccounts.map((account) => <article key={account.id} className="managed-account-card withdrawn"><div className="managed-account-person"><span>{account.full_name.slice(0, 1)}</span><div><h3>{account.full_name}</h3><p>{account.email ?? '이메일 정보 없음'} · {roleLabel[account.role] ?? account.role}</p><small>{account.withdrawn_at ? `${new Date(account.withdrawn_at).toLocaleDateString('ko-KR')} 탈퇴` : '비활성 계정'}{account.withdrawal_note ? ` · ${account.withdrawal_note}` : ''}</small></div><b className="account-role withdrawn">로그인 차단</b></div><form action={restoreAccount} className="restore-account-form"><input type="hidden" name="user_id" value={account.id} /><button type="submit">계정 복구</button></form></article>)}{withdrawnAccounts.length === 0 && <div className="account-empty">탈퇴 처리된 계정이 없습니다.</div>}</div></section>

    <section className="reviewed-section"><h2>가입 처리 내역</h2><div className="reviewed-list">{reviewed.slice(0, 20).map((request) => <div key={request.user_id}><span>{request.full_name} · {request.email}</span><b className={request.status}>{request.status === 'approved' ? '승인 완료' : '반려'}</b></div>)}{reviewed.length === 0 && <p>처리된 가입 신청이 없습니다.</p>}</div></section>
  </DashboardShell>;
}
