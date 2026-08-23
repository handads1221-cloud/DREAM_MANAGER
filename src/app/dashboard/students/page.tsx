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
      .select('id, full_name, grade, class_name, phone, address, school_name, primary_parent_id, note, is_active, photo_path')
      .eq('is_active', true)
      .order('grade')
      .order('full_name'),
  ]);

  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');

  const studentsWithPhotos = await Promise.all(((students ?? []) as Student[]).map(async (student) => {
    if (!student.photo_path) return student;
    const { data: signed } = await supabase.storage.from('face-photos').createSignedUrl(student.photo_path, 3600);
    return { ...student, photo_url: signed?.signedUrl ?? null };
  }));

  return (
    <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/students">
          <Link href="/dashboard" className="back-home-button"><span aria-hidden="true">←</span> 홈으로</Link>
          {studentsError ? (
            <div className="student-load-error">학생 명단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
          ) : (
            <StudentManager initialStudents={studentsWithPhotos} />
          )}
    </DashboardShell>
  );
}
