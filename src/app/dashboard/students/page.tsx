import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StudentManager } from './student-manager';
import type { Student } from './types';
import { DashboardShell } from '../dashboard-shell';

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
    <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/students">
          <Link href="/dashboard" className="back-home-button"><span aria-hidden="true">←</span> 홈으로</Link>
          <div className="student-page-intro">
            <div><p>STUDENT DIRECTORY</p><h1>학생명단관리</h1><span>드림어린이부 1~6학년 학생 정보를 확인하고 관리합니다.</span></div>
            <strong>전체 {students?.length ?? 0}명</strong>
          </div>

          {studentsError ? (
            <div className="student-load-error">학생 명단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
          ) : (
            <StudentManager initialStudents={(students ?? []) as Student[]} />
          )}
    </DashboardShell>
  );
}
