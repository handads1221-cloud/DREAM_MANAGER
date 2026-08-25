import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { AppIcon, type AppIconName } from '@/components/app-icon';
import { signOut } from './actions';

export type AppRole = 'admin' | 'teacher' | 'parent' | 'student';
const DREAM_BAND_URL = 'https://band.us/band/6987073';
const roleLabel: Record<AppRole, string> = { admin: '관리자', teacher: '선생님', parent: '부모님', student: '학생' };
type MenuItem = { icon: AppIconName; label: string; href: string };
const menus: Record<AppRole, MenuItem[]> = {
  admin: [{ icon: 'home', label: '홈', href: '/dashboard' }, { icon: 'students', label: '학생명단관리', href: '/dashboard/students' }, { icon: 'relationships', label: '계정·가족연결', href: '/dashboard/relationships' }, { icon: 'attendance', label: '출석관리', href: '/dashboard/attendance' }, { icon: 'calendar', label: '계획표', href: '/dashboard/plans' }, { icon: 'gem', label: '드림보석', href: '/dashboard/points' }, { icon: 'notice', label: '공지게시판', href: '/dashboard/notices' }, { icon: 'accounts', label: '가입승인', href: '/dashboard/accounts' }],
  teacher: [{ icon: 'home', label: '홈', href: '/dashboard' }, { icon: 'students', label: '전체 학생', href: '/dashboard/attendance' }, { icon: 'attendance', label: '출석등록', href: '/dashboard/attendance' }, { icon: 'calendar', label: '계획표', href: '/dashboard/plans' }, { icon: 'gem', label: '보석 관리', href: '/dashboard/points' }, { icon: 'notice', label: '공지게시판', href: '/dashboard/notices' }, { icon: 'contact', label: '연락처', href: '/dashboard#contacts' }],
  parent: [{ icon: 'home', label: '홈', href: '/dashboard' }, { icon: 'child', label: '우리아이', href: '/dashboard#children' }, { icon: 'notice', label: '공지게시판', href: '/dashboard/notices' }, { icon: 'teacher', label: '선생님 정보', href: '/dashboard#teacher' }, { icon: 'inquiry', label: '문의하기', href: '/dashboard#inquiry' }],
  student: [{ icon: 'home', label: '홈', href: '/dashboard' }, { icon: 'qr', label: 'QR 출석', href: '/dashboard/check-in' }, { icon: 'attendance', label: '내 출석', href: '/dashboard#attendance' }, { icon: 'gem', label: '내 보석', href: '/dashboard#points' }, { icon: 'notice', label: '공지게시판', href: '/dashboard/notices' }],
};
const mobileMenus: Record<AppRole, MenuItem[]> = {
  admin: [menus.admin[0], menus.admin[1], menus.admin[3], menus.admin[4], menus.admin[7]],
  teacher: [menus.teacher[0], menus.teacher[2], menus.teacher[3], menus.teacher[4], menus.teacher[5]],
  parent: menus.parent,
  student: [menus.student[0], menus.student[1], menus.student[4]],
};

export function DashboardShell({ profile, activeHref = '/dashboard', children }: { profile: { full_name: string; role: AppRole }; activeHref?: string; children: ReactNode }) {
  const items = menus[profile.role];
  return <main className="site-shell operation-shell">
    <header className="topbar">
      <Link href="/dashboard" className="brand student-home-brand" aria-label="내 홈으로"><Image className="church-brand-mark" src="/shinheung-church-mark.png" alt="청주신흥교회" width={48} height={48} priority/><div><small>청주신흥교회</small><strong>드림 어린이부</strong><small>{roleLabel[profile.role]} 운영 홈</small></div></Link>
      <div className="operation-profile"><Link href="/dashboard" className="profile-button"><span className="avatar">{profile.full_name.slice(0, 1)}</span><span className="profile-copy"><b>{profile.full_name}</b><small>{roleLabel[profile.role]} 계정</small></span></Link><form action={signOut}><button type="submit">로그아웃</button></form></div>
    </header>
    <div className="layout"><aside className="sidebar" aria-label={`${roleLabel[profile.role]} 메뉴`}><nav>{items.map((item) => <Link key={item.label} className={activeHref === item.href ? 'active' : ''} href={item.href}><span><AppIcon name={item.icon}/></span>{item.label}</Link>)}</nav><div className="sidebar-footer"><a className="band-shortcut" href={DREAM_BAND_URL} target="_blank" rel="noopener noreferrer" aria-label="드림어린이부 네이버밴드 새 창으로 열기"><b>B</b><span><strong>드림어린이부 밴드</strong><small>네이버밴드 바로가기 ↗</small></span></a><div className="sunday-card"><span>로그인 계정</span><strong>{profile.full_name} {roleLabel[profile.role]}</strong><small>계정 권한에 허용된 정보만 안전하게 표시됩니다.</small></div></div></aside><section className="content operation-content">{children}</section></div>
    <a className="mobile-band-shortcut" href={DREAM_BAND_URL} target="_blank" rel="noopener noreferrer" aria-label="드림어린이부 네이버밴드 새 창으로 열기"><b>B</b><span>밴드</span></a>
    <nav className={`mobile-nav operation-mobile-nav ${profile.role === 'student' ? 'student-mobile-nav' : ''}`} aria-label={`${roleLabel[profile.role]} 모바일 바로가기`}>{mobileMenus[profile.role].map((item) => <Link key={item.label} className={activeHref === item.href ? 'active' : ''} href={item.href} aria-label={item.label}><span><AppIcon name={item.icon}/></span><small>{item.label.replace('게시판', '')}</small></Link>)}</nav>
  </main>;
}
