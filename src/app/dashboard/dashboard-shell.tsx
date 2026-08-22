import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from './actions';

export type AppRole = 'admin' | 'teacher' | 'parent' | 'student';
const roleLabel: Record<AppRole, string> = { admin: '관리자', teacher: '선생님', parent: '부모님', student: '학생' };
const menus: Record<AppRole, { icon: string; label: string; href: string }[]> = {
  admin: [{ icon: '⌂', label: '홈', href: '/dashboard' }, { icon: '♙', label: '학생명단관리', href: '/dashboard/students' }, { icon: '◎', label: '계정·가족연결', href: '/dashboard/relationships' }, { icon: '✓', label: '출석관리', href: '/dashboard/attendance' }, { icon: '◆', label: '드림보석', href: '/dashboard/points' }, { icon: '▤', label: '가입승인', href: '/dashboard/accounts' }],
  teacher: [{ icon: '⌂', label: '홈', href: '/dashboard' }, { icon: '♙', label: '담당 학생', href: '/dashboard/attendance' }, { icon: '✓', label: '출석등록', href: '/dashboard/attendance' }, { icon: '◆', label: '보석 지급', href: '/dashboard/points' }, { icon: '☎', label: '연락처', href: '/dashboard#contacts' }],
  parent: [{ icon: '⌂', label: '홈', href: '/dashboard' }, { icon: '♥', label: '우리아이', href: '/dashboard#children' }, { icon: '▤', label: '공지사항', href: '/dashboard#notices' }, { icon: '☎', label: '선생님 정보', href: '/dashboard#teacher' }, { icon: '◌', label: '문의하기', href: '/dashboard#inquiry' }],
  student: [{ icon: '⌂', label: '홈', href: '/dashboard' }, { icon: '▦', label: 'QR 출석', href: '/dashboard/check-in' }, { icon: '✓', label: '내 출석', href: '/dashboard#attendance' }, { icon: '◆', label: '내 보석', href: '/dashboard#points' }, { icon: '▤', label: '공지사항', href: '/dashboard#notices' }],
};

export function DashboardShell({ profile, activeHref = '/dashboard', children }: { profile: { full_name: string; role: AppRole }; activeHref?: string; children: ReactNode }) {
  const items = menus[profile.role];
  return <main className="site-shell operation-shell">
    <header className="topbar">
      <Link href="/dashboard" className="brand student-home-brand" aria-label="내 홈으로"><span className="text-brand-mark">†</span><div><small>청주신흥교회</small><strong>드림 어린이부</strong><small>{roleLabel[profile.role]} 운영 홈</small></div></Link>
      <div className="operation-profile"><Link href="/dashboard" className="profile-button"><span className="avatar">{profile.full_name.slice(0, 1)}</span><span className="profile-copy"><b>{profile.full_name}</b><small>{roleLabel[profile.role]} 계정</small></span></Link><form action={signOut}><button type="submit">로그아웃</button></form></div>
    </header>
    <div className="layout"><aside className="sidebar" aria-label={`${roleLabel[profile.role]} 메뉴`}><nav>{items.map((item) => <Link key={item.label} className={activeHref === item.href ? 'active' : ''} href={item.href}><span>{item.icon}</span>{item.label}</Link>)}</nav><div className="sunday-card"><span>로그인 계정</span><strong>{profile.full_name} {roleLabel[profile.role]}</strong><small>계정 권한에 허용된 정보만 안전하게 표시됩니다.</small></div></aside><section className="content operation-content">{children}</section></div>
    <nav className="mobile-nav operation-mobile-nav" aria-label="모바일 메뉴">{items.slice(0, 5).map((item, index) => index === 2 ? <Link key={item.label} className="operation-mobile-main" href={item.href} aria-label={item.label}>{item.icon}</Link> : <Link key={item.label} className={activeHref === item.href ? 'active' : ''} href={item.href}><span>{item.icon}</span>{item.label}</Link>)}</nav>
  </main>;
}
