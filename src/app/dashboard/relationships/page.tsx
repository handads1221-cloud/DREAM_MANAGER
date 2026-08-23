import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../dashboard-shell';
import { RelationshipDirectory } from './relationship-directory';

export default async function RelationshipsPage({ searchParams }: PageProps<'/dashboard/relationships'>) {
  const params = await searchParams;
  const message = typeof params.message === 'string' ? params.message : '';
  const error = typeof params.error === 'string' ? params.error : '';
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle();
  if (!profile || profile.role !== 'admin' || !profile.is_active) redirect('/dashboard');
  const [{ data: students }, { data: accounts }, { data: roles }, { data: guardians }, { data: assignments }] = await Promise.all([
    supabase.from('students').select('id, full_name, grade, class_name, profile_id, photo_path').eq('is_active', true).order('grade').order('full_name'),
    supabase.from('profiles').select('id, full_name, email, phone, photo_path').eq('is_active', true).order('full_name'),
    supabase.from('user_roles').select('user_id, role').in('role', ['student', 'parent', 'teacher']),
    supabase.from('student_guardians').select('student_id, parent_id, relationship'),
    supabase.from('teacher_assignments').select('teacher_id, grade, class_name').eq('school_year', new Date().getFullYear()),
  ]);
  const photoPaths = [...new Set([...(students ?? []).map((item) => item.photo_path), ...(accounts ?? []).map((item) => item.photo_path)].filter((path): path is string => Boolean(path)))];
  const { data: signedPhotos } = photoPaths.length ? await supabase.storage.from('face-photos').createSignedUrls(photoPaths, 3600) : { data: [] };
  const photoUrlByPath = new Map<string, string>();
  for (const photo of signedPhotos ?? []) if (photo.path && photo.signedUrl) photoUrlByPath.set(photo.path, photo.signedUrl);
  const guardianByStudent = new Map<string, { parent_id: string; relationship: string }[]>();
  for (const item of guardians ?? []) guardianByStudent.set(item.student_id, [...(guardianByStudent.get(item.student_id) ?? []), { parent_id: item.parent_id, relationship: item.relationship }]);
  const studentRows = (students ?? []).map((student) => ({ ...student, photo_url: student.photo_path ? photoUrlByPath.get(student.photo_path) ?? null : null, guardians: guardianByStudent.get(student.id) ?? [] }));
  const roleIds = (role: string) => new Set((roles ?? []).filter((item) => item.role === role).map((item) => item.user_id));
  const studentIds = roleIds('student'); const parentIds = roleIds('parent'); const teacherIds = roleIds('teacher');
  const mapAccount = (account: NonNullable<typeof accounts>[number]) => ({ id: account.id, full_name: account.full_name, email: account.email, phone: account.phone, photo_url: account.photo_path ? photoUrlByPath.get(account.photo_path) ?? null : null });
  const studentAccounts = (accounts ?? []).filter((account) => studentIds.has(account.id)).map(mapAccount);
  const parents = (accounts ?? []).filter((account) => parentIds.has(account.id)).map(mapAccount);
  const assignmentsByTeacher = new Map<string, { grade: number; class_name: string }[]>();
  for (const item of assignments ?? []) assignmentsByTeacher.set(item.teacher_id, [...(assignmentsByTeacher.get(item.teacher_id) ?? []), { grade: item.grade, class_name: item.class_name }]);
  const teachers = (accounts ?? []).filter((account) => teacherIds.has(account.id)).map((account) => ({ ...mapAccount(account), assignments: assignmentsByTeacher.get(account.id) ?? [] }));
  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/relationships">
    <div className="module-heading"><div><p className="eyebrow">RELATIONSHIPS</p><h1>계정·가족·담당 연결</h1><span>명단에서 사람을 선택해 학생계정, 부모–자녀, 담임반을 간편하게 연결합니다.</span></div></div>
    {message && <p className="form-alert success account-feedback">{message}</p>}{error && <p className="form-alert error account-feedback">{error}</p>}
    <RelationshipDirectory students={studentRows} studentAccounts={studentAccounts} parents={parents} teachers={teachers} />
  </DashboardShell>;
}
