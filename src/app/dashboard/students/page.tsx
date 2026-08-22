import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudentManager } from './student-manager';
import type { Student } from './types';

export default async function StudentsPage() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect('/login');

  const userId = claimsData.claims.sub;
  const [{ data: profile }, { data: students, error: studentsError }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, is_active').eq('id', userId).maybeSingle(),
    supabase
      .from('students')
      .select('id, full_name, grade, class_name, phone, address, school_name, primary_parent_id, note, is_active')
      .order('grade')
      .order('full_name'),
  ]);

  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');

  return (
    <main className="site-shell student-page">
      <header className="topbar">
        <Link href="/" className="brand student-home-brand" aria-label="드림 어린이부 홈으로">
          <Image src="/church-logo.png" alt="청주신흥교회" className="church-logo" width={174} height={64} priority />
          <span className="brand-divider" />
          <div><strong>드림 어린이부</strong><small>함께 자라고, 함께 꿈꾸는 우리</small></div>
        </Link>
        <Link href="/dashboard" className="profile-button">
          <span className="avatar">{profile.full_name.slice(0, 1)}</span>
          <span className="profile-copy"><b>{profile.full_name}</b><small>관리자 계정</small></span>
          <span aria-hidden="true">⌄</span>
        </Link>
      </header>

      <div className="layout">
        <aside className="sidebar" aria-label="관리자 주요 메뉴">
          <nav>
            <Link href="/"><span>⌂</span>홈</Link>
            <Link href="/#attendance"><span>✓</span>출석</Link>
            <Link href="/#points"><span>◆</span>드림보석</Link>
            <Link className="active" href="/dashboard/students"><span>♙</span>학생명단관리</Link>
            <Link href="/#notice"><span>▤</span>공지사항</Link>
            <Link href="/#message"><span>◌</span>문의·메시지</Link>
          </nav>
          <div className="sunday-card">
            <span>드림 어린이부 관리</span>
            <strong>학생 55명</strong>
            <small>학년별 명단과 학생 상세정보를 안전하게 관리합니다.</small>
          </div>
        </aside>

        <section className="content student-page-content">
          <Link href="/" className="back-home-button"><span aria-hidden="true">←</span> 홈으로</Link>
          <div className="student-page-intro">
            <div><p>STUDENT DIRECTORY</p><h1>학생명단관리</h1><span>드림어린이부 1~6학년 학생 정보를 확인하고 관리합니다.</span></div>
            <strong>전체 {students?.length ?? 0}명</strong>
          </div>

          {studentsError ? (
            <div className="student-load-error">학생 명단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
          ) : (
            <StudentManager initialStudents={(students ?? []) as Student[]} />
          )}
        </section>
      </div>

      <nav className="mobile-nav student-mobile-nav" aria-label="모바일 관리자 메뉴">
        <Link href="/"><span>⌂</span>홈</Link>
        <Link href="/#attendance"><span>✓</span>출석</Link>
        <Link className="student-mobile-main active" href="/dashboard/students" aria-label="학생명단관리">♙</Link>
        <Link href="/#points"><span>◆</span>보석</Link>
        <Link href="/#notice"><span>▤</span>공지</Link>
      </nav>
    </main>
  );
}
