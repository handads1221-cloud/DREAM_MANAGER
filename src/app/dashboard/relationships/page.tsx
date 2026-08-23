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
  const signedUrl = async (path: string | null) => path ? (await supabase.storage.from('face-photos').createSignedUrl(path, 3600)).data?.signedUrl ?? null : null;
  const studentRows = await Promise.all((students ?? []).map(async (student) => ({ ...student, photo_url: await signedUrl(student.photo_path), guardians: (guardians ?? []).filter((item) => item.student_id === student.id).map(({ parent_id, relationship }) => ({ parent_id, relationship })) })));
  const roleIds = (role: string) => new Set((roles ?? []).filter((item) => item.role === role).map((item) => item.user_id));
  const studentIds = roleIds('student'); const parentIds = roleIds('parent'); const teacherIds = roleIds('teacher');
  const mapAccount = async (account: NonNullable<typeof accounts>[number]) => ({ id: account.id, full_name: account.full_name, email: account.email, phone: account.phone, photo_url: await signedUrl(account.photo_path) });
  const studentAccounts = await Promise.all((accounts ?? []).filter((account) => studentIds.has(account.id)).map(mapAccount));
  const parents = await Promise.all((accounts ?? []).filter((account) => parentIds.has(account.id)).map(mapAccount));
  const teachers = await Promise.all((accounts ?? []).filter((account) => teacherIds.has(account.id)).map(async (account) => ({ ...(await mapAccount(account)), assignments: (assignments ?? []).filter((item) => item.teacher_id === account.id).map(({ grade, class_name }) => ({ grade, class_name })) })));
  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/relationships">
    <div className="module-heading"><div><p className="eyebrow">RELATIONSHIPS</p><h1>계정·가족·담당 연결</h1><span>명단에서 사람을 선택해 학생계정, 부모–자녀, 담임반을 간편하게 연결합니다.</span></div></div>
    {message && <p className="form-alert success account-feedback">{message}</p>}{error && <p className="form-alert error account-feedback">{error}</p>}
    <RelationshipDirectory students={studentRows} studentAccounts={studentAccounts} parents={parents} teachers={teachers} />
  </DashboardShell>;
}
