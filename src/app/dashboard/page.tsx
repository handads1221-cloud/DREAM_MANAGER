import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from './dashboard-shell';
import { signOut } from './actions';

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
  const { data: profile } = await supabase.from('profiles').select('full_name, role, grade, class_name, is_active').eq('id', userId).maybeSingle();

  if (!profile || !profile.is_active) {
    const { data: request } = await supabase.from('registration_requests').select('full_name, status').eq('user_id', userId).maybeSingle();
    return <main className="pending-account-page"><section><span className="modal-icon">✦</span><p className="eyebrow">ACCOUNT REVIEW</p><h1>{request?.full_name ?? '가입자'}님의 가입 신청을 확인 중입니다</h1><p>{request?.status === 'rejected' ? '가입 신청이 반려되었습니다. 관리자에게 문의해 주세요.' : '이메일 인증은 완료되었습니다. 관리자가 계정의 역할을 승인하면 해당 홈 화면이 자동으로 열립니다.'}</p><div className="pending-actions"><form action={signOut}><button type="submit">로그아웃</button></form></div></section></main>;
  }

  const role = profile.role as AppRole;
  const copy = roleCopy[role];
  let stats: { label: string; value: string; href: string; tone: string }[];
  if (role === 'admin') {
    const [{ count: studentCount }, { count: pendingCount }, { count: accountCount }] = await Promise.all([
      supabase.from('students').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('registration_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    stats = [{ label: '재학생', value: `${studentCount ?? 0}명`, href: '/dashboard/students', tone: 'mint' }, { label: '가입 승인 대기', value: `${pendingCount ?? 0}건`, href: '/dashboard/accounts', tone: 'yellow' }, { label: '활성 계정', value: `${accountCount ?? 0}개`, href: '/dashboard/accounts', tone: 'blue' }, { label: '오늘 출석', value: '0명', href: '/dashboard#attendance', tone: 'pink' }];
  } else if (role === 'teacher') {
    stats = [{ label: '담당 학생', value: '배정 전', href: '#students', tone: 'mint' }, { label: '오늘 출석', value: '0명', href: '#attendance', tone: 'blue' }, { label: '오늘 지급 보석', value: '0개', href: '#points', tone: 'yellow' }];
  } else if (role === 'parent') {
    stats = [{ label: '연결된 자녀', value: '연결 전', href: '#children', tone: 'mint' }, { label: '새 공지', value: '0건', href: '#notices', tone: 'blue' }, { label: '문의 답변', value: '0건', href: '#inquiry', tone: 'yellow' }];
  } else {
    const { data: student } = await supabase.from('students').select('grade').eq('profile_id', userId).maybeSingle();
    stats = [{ label: '학생 정보', value: student ? `${student.grade}학년` : '연결 전', href: '/dashboard', tone: 'mint' }, { label: '내 보석', value: '0개', href: '#points', tone: 'yellow' }, { label: '이번 달 출석', value: '0회', href: '#attendance', tone: 'blue' }];
  }

  return <DashboardShell profile={{ full_name: profile.full_name, role }}>
    <div className="operation-welcome"><div><p>{copy.eyebrow}</p><h1>{profile.full_name}님, 반가워요</h1><span>{copy.description}</span></div><div className={`role-home-badge ${role}`}>{copy.title}</div></div>
    <section className="operation-stat-grid">{stats.map((stat) => <Link key={stat.label} href={stat.href} className={`operation-stat ${stat.tone}`}><span>{stat.label}</span><strong>{stat.value}</strong><small>자세히 보기 →</small></Link>)}</section>
    <section className="role-home-panel"><div><p className="eyebrow">QUICK START</p><h2>{copy.title}</h2><span>현재 계정 권한에 맞는 기능만 표시됩니다.</span></div><div className="role-quick-links">
      {role === 'admin' && <><Link href="/dashboard/accounts">가입 승인 및 계정관리</Link><Link href="/dashboard/students">학생명단관리</Link></>}
      {role === 'teacher' && <><Link href="#attendance">대리 출석등록</Link><Link href="#points">드림보석 지급</Link><Link href="#contacts">학생·부모 연락처</Link></>}
      {role === 'parent' && <><Link href="#children">우리아이 정보</Link><Link href="#notices">공지사항</Link><Link href="#inquiry">관리자 문의</Link></>}
      {role === 'student' && <><Link href="#qr">QR 출석</Link><Link href="#attendance">내 출석현황</Link><Link href="#points">내 보석</Link></>}
    </div></section>
  </DashboardShell>;
}
