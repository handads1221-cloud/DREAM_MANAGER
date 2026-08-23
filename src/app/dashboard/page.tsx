import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from './dashboard-shell';
import { signOut, switchActiveRole } from './actions';

const roleCopy: Record<AppRole, { eyebrow: string; title: string; description: string }> = {
  admin: { eyebrow: 'ADMIN HOME', title: '드림어린이부 운영을 한눈에', description: '가입 승인, 학생명단, 출석과 보석 현황을 관리합니다.' },
  teacher: { eyebrow: 'TEACHER HOME', title: '아이들의 오늘을 함께 기록해요', description: '담당 학생의 출석과 보석, 연락처를 빠르게 확인합니다.' },
  parent: { eyebrow: 'PARENT HOME', title: '우리 아이의 소식을 확인하세요', description: '연결된 자녀의 출석과 보석, 공지와 선생님 정보를 확인합니다.' },
  student: { eyebrow: 'STUDENT HOME', title: '오늘도 반짝이는 하루!', description: '내 출석과 보석을 확인하고 QR로 출석할 수 있습니다.' },
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  const userId = data.claims.sub;
  const { data: profile } = await supabase.from('profiles').select('full_name, role, grade, class_name, is_active, account_status').eq('id', userId).maybeSingle();

  if (!profile || !profile.is_active) {
    const { data: request } = await supabase.from('registration_requests').select('full_name, status').eq('user_id', userId).maybeSingle();
    const withdrawn = profile?.account_status === 'withdrawn';
    return <main className="pending-account-page"><section><span className="modal-icon">✦</span><p className="eyebrow">{withdrawn ? 'ACCOUNT WITHDRAWN' : 'ACCOUNT REVIEW'}</p><h1>{withdrawn ? '탈퇴 처리된 계정입니다' : `${request?.full_name ?? '가입자'}님의 가입 신청을 확인 중입니다`}</h1><p>{withdrawn ? '로그인이 차단된 계정입니다. 다시 이용하려면 관리자에게 계정 복구를 요청해 주세요.' : request?.status === 'rejected' ? '가입 신청이 반려되었습니다. 관리자에게 문의해 주세요.' : '이메일 인증은 완료되었습니다. 관리자가 계정의 역할을 승인하면 해당 홈 화면이 자동으로 열립니다.'}</p><div className="pending-actions"><form action={signOut}><button type="submit">로그아웃</button></form></div></section></main>;
  }

  const role = profile.role as AppRole;
  const { data: assignedRoleRows } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  const assignedRoles = (assignedRoleRows ?? []).map((row) => row.role as AppRole);
  const copy = roleCopy[role];
  let stats: { label: string; value: string; href: string; tone: string }[];
  if (role === 'admin') {
    const [{ count: studentCount }, { count: pendingCount }, { count: accountCount }, { data: recentEvent }] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('registration_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('attendance_events').select('id').order('service_date', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const { count: attendanceCount } = recentEvent ? await supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('event_id', recentEvent.id).in('status', ['present','late']) : { count: 0 };
    stats = [{ label: '재학생', value: `${studentCount ?? 0}명`, href: '/dashboard/students', tone: 'mint' }, { label: '가입 승인 대기', value: `${pendingCount ?? 0}건`, href: '/dashboard/accounts', tone: 'yellow' }, { label: '활성 계정', value: `${accountCount ?? 0}개`, href: '/dashboard/relationships', tone: 'blue' }, { label: '이번 주 출석', value: `${attendanceCount ?? 0}명`, href: '/dashboard/attendance', tone: 'pink' }];
  } else if (role === 'teacher') {
    const [{ count: assignedCount }, { count: awardedCount }] = await Promise.all([supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true), supabase.from('point_transactions').select('*', { count: 'exact', head: true }).eq('awarded_by', userId)]);
    stats = [{ label: '담당 학생', value: `${assignedCount ?? 0}명`, href: '/dashboard/attendance', tone: 'mint' }, { label: '출석 등록', value: '명단 열기', href: '/dashboard/attendance', tone: 'blue' }, { label: '보석 지급 내역', value: `${awardedCount ?? 0}건`, href: '/dashboard/points', tone: 'yellow' }];
  } else if (role === 'parent') {
    const { data: children } = await supabase.from('students').select('id').eq('is_active', true); const childIds = (children ?? []).map(child => child.id);
    const [{ count: attendanceCount }, { data: balances }, { count: inquiryCount }] = await Promise.all([childIds.length ? supabase.from('attendance_records').select('*', { count: 'exact', head: true }).in('student_id', childIds).in('status', ['present','late']) : Promise.resolve({ count: 0 }), childIds.length ? supabase.from('student_point_balances').select('balance').in('student_id', childIds) : Promise.resolve({ data: [] }), supabase.from('inquiries').select('*', { count: 'exact', head: true }).eq('parent_id', userId)]);
    const balance = (balances ?? []).reduce((sum, item) => sum + Number(item.balance), 0);
    stats = [{ label: '연결된 자녀', value: `${childIds.length}명`, href: '#children', tone: 'mint' }, { label: '자녀 출석 기록', value: `${attendanceCount ?? 0}회`, href: '#attendance', tone: 'blue' }, { label: '자녀 보석 합계', value: `${balance}개`, href: '#points', tone: 'yellow' }, { label: '문의', value: `${inquiryCount ?? 0}건`, href: '#inquiry', tone: 'pink' }];
  } else {
    const { data: student } = await supabase.from('students').select('id, grade').eq('profile_id', userId).maybeSingle();
    const [{ data: balance }, { count: attendanceCount }] = student ? await Promise.all([supabase.from('student_point_balances').select('balance').eq('student_id', student.id).maybeSingle(), supabase.from('attendance_records').select('*', { count: 'exact', head: true }).eq('student_id', student.id).in('status', ['present','late'])]) : [{ data: null }, { count: 0 }];
    stats = [{ label: '학생 정보', value: student ? `${student.grade}학년` : '연결 전', href: '/dashboard', tone: 'mint' }, { label: '내 보석', value: `${balance?.balance ?? 0}개`, href: '#points', tone: 'yellow' }, { label: '누적 출석', value: `${attendanceCount ?? 0}회`, href: '#attendance', tone: 'blue' }];
  }

  return <DashboardShell profile={{ full_name: profile.full_name, role }}>
    {assignedRoles.length > 1 && <form action={switchActiveRole} className="role-switcher"><span>화면 전환</span>{assignedRoles.map((assignedRole) => <button key={assignedRole} type="submit" name="role" value={assignedRole} className={role === assignedRole ? 'active' : ''} disabled={role === assignedRole}>{assignedRole === 'admin' ? '관리자' : assignedRole === 'teacher' ? '선생님' : assignedRole === 'parent' ? '부모님' : '학생'}</button>)}</form>}
    <div className="operation-welcome"><div><p>{copy.eyebrow}</p><h1>{profile.full_name}님, 반가워요</h1><span>{copy.description}</span></div><div className={`role-home-badge ${role}`}>{copy.title}</div></div>
    <section className="operation-stat-grid">{stats.map((stat) => <Link key={stat.label} href={stat.href} className={`operation-stat ${stat.tone}`}><span>{stat.label}</span><strong>{stat.value}</strong><small>자세히 보기 →</small></Link>)}</section>
    <section className="role-home-panel"><div><p className="eyebrow">QUICK START</p><h2>{copy.title}</h2><span>현재 계정 권한에 맞는 기능만 표시됩니다.</span></div><div className="role-quick-links">
      {role === 'admin' && <><Link href="/dashboard/accounts">가입 승인</Link><Link href="/dashboard/relationships">계정·가족·담당 연결</Link><Link href="/dashboard/students">학생명단관리</Link><Link href="/dashboard/attendance">출석·QR 관리</Link><Link href="/dashboard/points">드림보석 관리</Link><Link href="/dashboard/notices">공지게시판 관리</Link></>}
      {role === 'teacher' && <><Link href="/dashboard/attendance">대리 출석등록</Link><Link href="/dashboard/points">드림보석 지급</Link><Link href="/dashboard/notices">공지게시판</Link><Link href="#contacts">학생·부모 연락처</Link></>}
      {role === 'parent' && <><Link href="#children">우리아이 정보</Link><Link href="/dashboard/notices">공지게시판</Link><Link href="#inquiry">관리자 문의</Link></>}
      {role === 'student' && <><Link href="/dashboard/check-in">QR 출석</Link><Link href="/dashboard/notices">공지게시판</Link><Link href="#attendance">내 출석현황</Link><Link href="#points">내 보석</Link></>}
    </div></section>
  </DashboardShell>;
}
