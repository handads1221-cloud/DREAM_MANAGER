import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../dashboard-shell';
import { approveRegistration, rejectRegistration, restoreAccount } from './actions';
import { ActiveAccountManager, type ManagedAccount } from './active-account-manager';

const roleLabel: Record<string, string> = { admin: '관리자', teacher: '선생님', parent: '부모님', student: '학생' };
const roleOrder = ['parent', 'student', 'teacher', 'admin'] as const;
const RoleChecks = ({ selected = ['parent'], disabled = false }: { selected?: string[]; disabled?: boolean }) => <fieldset className="role-checks"><legend>계정 권한 (복수 선택)</legend>{roleOrder.map((role) => <label key={role}><input type="checkbox" name="roles" value={role} defaultChecked={selected.includes(role)} disabled={disabled} />{roleLabel[role]}</label>)}</fieldset>;

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
  const [{ data: requests }, { data: accounts }, { data: assignedRoles }] = await Promise.all([
    supabase.from('registration_requests').select('user_id, email, full_name, phone, address, note, status, requested_at').order('requested_at', { ascending: false }),
    supabase.from('profiles').select('id, email, full_name, role, phone, address, note, birth_date, is_active, account_status, withdrawn_at, withdrawal_note, photo_path').order('full_name'),
    supabase.from('user_roles').select('user_id, role'),
  ]);
  const requestRows = requests ?? [];
  const pending = requestRows.filter((request) => request.status === 'pending');
  const reviewed = requestRows.filter((request) => request.status !== 'pending');
  const activeAccounts = (accounts ?? []).filter((account) => account.account_status !== 'withdrawn' && account.is_active);
  const withdrawnAccounts = (accounts ?? []).filter((account) => account.account_status === 'withdrawn' || !account.is_active);
  const rolesByUser = new Map<string, string[]>();
  for (const row of assignedRoles ?? []) rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role]);
  const teacherPhotos = new Map(await Promise.all(activeAccounts.filter((account) => rolesByUser.get(account.id)?.includes('teacher') && account.photo_path).map(async (account) => {
    const { data: signed } = await supabase.storage.from('face-photos').createSignedUrl(account.photo_path!, 3600);
    return [account.id, signed?.signedUrl ?? ''] as const;
  })));
  const managedAccounts: ManagedAccount[] = activeAccounts.map((account) => ({ ...account, roles: rolesByUser.get(account.id) ?? [account.role], photoUrl: teacherPhotos.get(account.id) || null }));

  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/accounts">
    <div className="account-page-heading"><div><p className="eyebrow">ACCOUNT MANAGEMENT</p><h1>가입·계정관리</h1><span>가입 승인, 권한 변경, 비밀번호 재설정과 탈퇴 계정을 관리합니다.</span></div><strong>승인 대기 {pending.length}건</strong></div>
    {message && <p className="form-alert success account-feedback">{message}</p>}{errorMessage && <p className="form-alert error account-feedback">{errorMessage}</p>}
    <section className="approval-section"><h2>가입 승인 대기</h2>{pending.length === 0 ? <div className="account-empty">현재 승인 대기 중인 가입 신청이 없습니다.</div> : <div className="approval-list">{pending.map((request) => <article key={request.user_id} className="approval-card">
      <div className="approval-person"><span>{request.full_name.slice(0, 1)}</span><div><h3>{request.full_name}</h3><p>{request.email}</p></div></div>
      <dl><div><dt>연락처</dt><dd>{request.phone || '미입력'}</dd></div><div><dt>주소</dt><dd>{request.address || '미입력'}</dd></div>{request.note && <div><dt>비고</dt><dd>{request.note}</dd></div>}</dl>
      <div className="approval-actions"><form action={approveRegistration}><input type="hidden" name="user_id" value={request.user_id} /><RoleChecks /><button type="submit">승인하고 권한 부여</button></form><form action={rejectRegistration}><input type="hidden" name="user_id" value={request.user_id} /><button type="submit" className="reject">반려</button></form></div>
    </article>)}</div>}</section>
    <section className="account-management-section"><div className="section-title-row"><div><h2>활성 계정</h2><p>계정을 선택하면 상세정보와 관리 기능이 열립니다.</p></div><b>{activeAccounts.length}개</b></div><ActiveAccountManager accounts={managedAccounts} currentUserId={currentUserId}/></section>
    <section className="account-management-section withdrawn"><div className="section-title-row"><div><h2>탈퇴 계정</h2><p>데이터는 보존되며 로그인만 차단된 계정입니다.</p></div><b>{withdrawnAccounts.length}개</b></div><div className="managed-account-list">{withdrawnAccounts.map((account) => <article key={account.id} className="managed-account-card withdrawn"><div className="managed-account-person"><span>{account.full_name.slice(0, 1)}</span><div><h3>{account.full_name}</h3><p>{account.email ?? '이메일 정보 없음'} · {roleLabel[account.role] ?? account.role}</p><small>{account.withdrawn_at ? `${new Date(account.withdrawn_at).toLocaleDateString('ko-KR')} 탈퇴` : '비활성 계정'}{account.withdrawal_note ? ` · ${account.withdrawal_note}` : ''}</small></div><b className="account-role withdrawn">로그인 차단</b></div><form action={restoreAccount} className="restore-account-form"><input type="hidden" name="user_id" value={account.id} /><button type="submit">계정 복구</button></form></article>)}{withdrawnAccounts.length === 0 && <div className="account-empty">탈퇴 처리된 계정이 없습니다.</div>}</div></section>
    <section className="reviewed-section"><h2>가입 처리 내역</h2><div className="reviewed-list">{reviewed.slice(0, 20).map((request) => <div key={request.user_id}><span>{request.full_name} · {request.email}</span><b className={request.status}>{request.status === 'approved' ? '승인 완료' : '반려'}</b></div>)}{reviewed.length === 0 && <p>처리된 가입 신청이 없습니다.</p>}</div></section>
  </DashboardShell>;
}
