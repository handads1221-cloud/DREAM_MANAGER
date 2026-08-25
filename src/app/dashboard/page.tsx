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

function BirthdayCard({ month, title, people }: { month: number; title: string; people: { name: string; role: string; date: string }[] }) {
  return <article className="birthday-card"><div><p className="eyebrow">{month}월</p><h2>{title}</h2><b>{people.length}명</b></div><div className="birthday-list">{people.map((person) => <span key={`${person.role}-${person.name}-${person.date}`}><i>{person.role}</i><strong>{person.name}</strong><small>{Number(person.date.slice(5,7))}월 {Number(person.date.slice(8,10))}일</small></span>)}{people.length === 0 && <p>등록된 생일자가 없습니다.</p>}</div></article>;
}

function AttendanceChart({ weeks }: { weeks: { date: string; count: number; current: boolean }[] }) {
  const max = Math.max(...weeks.map((item) => item.count), 1);
  return <article className="attendance-chart-card"><div><p className="eyebrow">ATTENDANCE TREND</p><h2>최근 4주 출석</h2></div><div className="attendance-bars">{weeks.map((week) => <div key={week.date} className={week.current ? 'current' : ''}><strong>{week.count}명</strong><span><i style={{ height: `${Math.max(week.count ? 12 : 4, (week.count / max) * 100)}%` }} /></span><small>{Number(week.date.slice(5,7))}/{Number(week.date.slice(8,10))}{week.current ? ' 이번주' : ''}</small></div>)}{weeks.length === 0 && <p>출석 기록이 없습니다.</p>}</div></article>;
}

function UpcomingPlans({ plans }: { plans: { id: string; schedule_date: string; schedule_time: string | null; title: string }[] }) {
  return <section className="upcoming-plans-card"><Link href="/dashboard/plans" className="upcoming-plans-heading"><div><p className="eyebrow">UPCOMING PLAN</p><h2>다가오는 일정</h2></div><span>계획표 보기 →</span></Link><div className="upcoming-plans-list">{plans.map((plan) => <Link key={plan.id} href="/dashboard/plans"><time><b>{Number(plan.schedule_date.slice(5,7))}월 {Number(plan.schedule_date.slice(8,10))}일</b><small>{plan.schedule_time ? plan.schedule_time.slice(0,5) : '시간 미정'}</small></time><strong>{plan.title}</strong><i>›</i></Link>)}{plans.length === 0 && <p>등록된 다가오는 일정이 없습니다.</p>}</div></section>;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  const userId = data.claims.sub;
  const [{ data: profile }, { data: assignedRoleRows }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, grade, class_name, is_active, account_status').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ]);

  if (!profile || !profile.is_active) {
    const { data: request } = await supabase.from('registration_requests').select('full_name, status').eq('user_id', userId).maybeSingle();
    const withdrawn = profile?.account_status === 'withdrawn';
    return <main className="pending-account-page"><section><span className="modal-icon">✦</span><p className="eyebrow">{withdrawn ? 'ACCOUNT WITHDRAWN' : 'ACCOUNT REVIEW'}</p><h1>{withdrawn ? '탈퇴 처리된 계정입니다' : `${request?.full_name ?? '가입자'}님의 가입 신청을 확인 중입니다`}</h1><p>{withdrawn ? '로그인이 차단된 계정입니다. 다시 이용하려면 관리자에게 계정 복구를 요청해 주세요.' : request?.status === 'rejected' ? '가입 신청이 반려되었습니다. 관리자에게 문의해 주세요.' : '이메일 인증은 완료되었습니다. 관리자가 계정의 역할을 승인하면 해당 홈 화면이 자동으로 열립니다.'}</p><div className="pending-actions"><form action={signOut}><button type="submit">로그아웃</button></form></div></section></main>;
  }

  const role = profile.role as AppRole;
  const assignedRoles = (assignedRoleRows ?? []).map((row) => row.role as AppRole);
  const copy = roleCopy[role];
  let stats: { label: string; value: string; href: string; tone: string; detail?: string }[];
  let adminOverview: null | { weeks: { date: string; count: number; current: boolean }[]; upcomingPlans: { id: string; schedule_date: string; schedule_time: string | null; title: string }[]; previousMonth: number; currentMonth: number; previousBirthdays: { name: string; role: string; date: string }[]; currentBirthdays: { name: string; role: string; date: string }[] } = null;
  if (role === 'admin') {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    const currentMonth = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(new Date()));
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const [{ count: studentCount }, { data: events }, { data: studentBirthdays }, { data: teacherRoles }, { data: upcomingPlans }] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('attendance_events').select('id, service_date').lte('service_date', today).order('service_date', { ascending: false }).limit(4),
      supabase.from('students').select('full_name, birth_date').eq('is_active', true).not('birth_date', 'is', null),
      supabase.from('user_roles').select('user_id').eq('role', 'teacher'),
      supabase.from('weekly_plans').select('id,schedule_date,schedule_time,title').gte('schedule_date', today).order('schedule_date').order('schedule_time').limit(5),
    ]);
    const eventIds = (events ?? []).map((event) => event.id);
    const teacherIds = (teacherRoles ?? []).map((item) => item.user_id);
    const [{ data: attendanceRows }, { data: teacherBirthdays }] = await Promise.all([
      eventIds.length ? supabase.from('attendance_records').select('event_id').in('event_id', eventIds).in('status', ['present','late']) : Promise.resolve({ data: [] }),
      teacherIds.length ? supabase.from('profiles').select('full_name, birth_date').in('id', teacherIds).eq('is_active', true).not('birth_date', 'is', null) : Promise.resolve({ data: [] }),
    ]);
    const attendanceByEvent = new Map<string, number>();
    for (const row of attendanceRows ?? []) attendanceByEvent.set(row.event_id, (attendanceByEvent.get(row.event_id) ?? 0) + 1);
    const weeks = [...(events ?? [])].reverse().map((event, index, all) => ({ date: event.service_date, count: attendanceByEvent.get(event.id) ?? 0, current: index === all.length - 1 }));
    const people = [...(studentBirthdays ?? []).map((item) => ({ name: item.full_name, role: '학생', date: item.birth_date! })), ...(teacherBirthdays ?? []).map((item) => ({ name: item.full_name, role: '선생님', date: item.birth_date! }))];
    const inMonth = (month: number) => people.filter((person) => Number(person.date.slice(5, 7)) === month).sort((a, b) => a.date.slice(5).localeCompare(b.date.slice(5)));
    const latest = weeks.at(-1);
    stats = [{ label: '재학생', value: `${studentCount ?? 0}명`, href: '/dashboard/students', tone: 'mint' }, { label: '이번 주 출석', value: `${latest?.count ?? 0}명`, detail: latest ? `${Number(latest.date.slice(5,7))}월 ${Number(latest.date.slice(8,10))}일` : '예배일 미등록', href: '/dashboard/attendance', tone: 'pink' }];
    adminOverview = { weeks, upcomingPlans: upcomingPlans ?? [], previousMonth, currentMonth, previousBirthdays: inMonth(previousMonth), currentBirthdays: inMonth(currentMonth) };
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
    <div className="operation-welcome"><div><p>{copy.eyebrow}</p><h1>{profile.full_name}님, 반가워요</h1><span>{copy.description}</span></div>{role === 'admin' ? <Link className="home-qr-button" href="/dashboard/attendance/qr?display=1" target="_blank"><b>오늘의 출석 QR</b><small>새 화면으로 열기 →</small></Link> : <div className={`role-home-badge ${role}`}>{copy.title}</div>}</div>
    {adminOverview ? <><section className="admin-summary-grid"><div className="operation-stat-grid admin-compact-stats">{stats.map((stat) => <Link key={stat.label} href={stat.href} className={`operation-stat ${stat.tone}`}><span>{stat.label}</span><strong>{stat.value}</strong>{stat.detail && <b>{stat.detail}</b>}<small>자세히 보기 →</small></Link>)}</div><AttendanceChart weeks={adminOverview.weeks}/></section><UpcomingPlans plans={adminOverview.upcomingPlans}/><div className="birthday-month-grid"><BirthdayCard month={adminOverview.previousMonth} title="지난달 생일자" people={adminOverview.previousBirthdays}/><BirthdayCard month={adminOverview.currentMonth} title="이번 달 생일자" people={adminOverview.currentBirthdays}/></div></> : <section className="operation-stat-grid">{stats.map((stat) => <Link key={stat.label} href={stat.href} className={`operation-stat ${stat.tone}`}><span>{stat.label}</span><strong>{stat.value}</strong><small>자세히 보기 →</small></Link>)}</section>}
    <section className="role-home-panel"><div><p className="eyebrow">QUICK START</p><h2>{copy.title}</h2><span>현재 계정 권한에 맞는 기능만 표시됩니다.</span></div><div className="role-quick-links">
      {role === 'admin' && <><Link href="/dashboard/accounts">가입 승인</Link><Link href="/dashboard/relationships">계정·가족·담당 연결</Link><Link href="/dashboard/students">학생명단관리</Link><Link href="/dashboard/attendance">출석·QR 관리</Link><Link href="/dashboard/plans">주차별 계획표</Link><Link href="/dashboard/points">드림보석 관리</Link><Link href="/dashboard/notices">공지게시판 관리</Link></>}
      {role === 'teacher' && <><Link href="/dashboard/attendance">대리 출석등록</Link><Link href="/dashboard/plans">주차별 계획표</Link><Link href="/dashboard/points">드림보석 지급</Link><Link href="/dashboard/notices">공지게시판</Link><Link href="#contacts">학생·부모 연락처</Link></>}
      {role === 'parent' && <><Link href="#children">우리아이 정보</Link><Link href="/dashboard/notices">공지게시판</Link><Link href="#inquiry">관리자 문의</Link></>}
      {role === 'student' && <><Link href="/dashboard/check-in">QR 출석</Link><Link href="/dashboard/notices">공지게시판</Link><Link href="#attendance">내 출석현황</Link><Link href="#points">내 보석</Link></>}
    </div></section>
  </DashboardShell>;
}
