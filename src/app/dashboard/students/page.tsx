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
  const [{ data: profile }, { data: students, error: studentsError }, { data: guardianLinks }, { data: accounts }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, is_active').eq('id', userId).maybeSingle(),
    supabase
      .from('students')
      .select('id, full_name, grade, class_name, phone, address, school_name, birth_date, primary_parent_id, note, is_active, photo_path')
      .eq('is_active', true)
      .order('grade')
      .order('full_name'),
    supabase.from('student_guardians').select('student_id, parent_id, relationship'),
    supabase.from('profiles').select('id, full_name').eq('is_active', true),
  ]);

  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');

  const photoPaths = [...new Set((students ?? []).map((student) => student.photo_path).filter((path): path is string => Boolean(path)))];
  const { data: signedPhotos } = photoPaths.length ? await supabase.storage.from('face-photos').createSignedUrls(photoPaths, 3600) : { data: [] };
  const photoByPath = new Map<string, string>();
  for (const photo of signedPhotos ?? []) if (photo.path && photo.signedUrl) photoByPath.set(photo.path, photo.signedUrl);
  const accountName = new Map((accounts ?? []).map((account) => [account.id, account.full_name]));
  const guardiansByStudent = new Map<string, { name: string; relationship: string }[]>();
  for (const link of guardianLinks ?? []) {
    const name = accountName.get(link.parent_id);
    if (name) guardiansByStudent.set(link.student_id, [...(guardiansByStudent.get(link.student_id) ?? []), { name, relationship: link.relationship }]);
  }
  const studentsWithPhotos = ((students ?? []) as Student[]).map((student) => ({ ...student, photo_url: student.photo_path ? photoByPath.get(student.photo_path) ?? null : null, guardians: guardiansByStudent.get(student.id) ?? [] }));

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
