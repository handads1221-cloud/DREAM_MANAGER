import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../../dashboard-shell';
import { GemStatistics, type GemRankingStudent } from './gem-statistics';

export default async function GemStatisticsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  const [{ data: profile }, { data: balances, error }, { data: students }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, is_active').eq('id', userId).maybeSingle(),
    supabase.from('student_point_balances').select('student_id, full_name, grade, balance'),
    supabase.from('students').select('id, photo_path').eq('is_active', true),
  ]);
  if (!profile?.is_active || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard');

  const photoPathById = new Map((students ?? []).map((student) => [student.id, student.photo_path]));
  const photoPaths = [...new Set((students ?? []).map((student) => student.photo_path).filter((path): path is string => Boolean(path)))];
  const { data: signedPhotos } = photoPaths.length ? await supabase.storage.from('face-photos').createSignedUrls(photoPaths, 3600) : { data: [] };
  const photoUrlByPath = new Map<string, string>();
  for (const photo of signedPhotos ?? []) if (photo.path && photo.signedUrl) photoUrlByPath.set(photo.path, photo.signedUrl);
  const rankingStudents: GemRankingStudent[] = (balances ?? []).map((student) => {
    const path = photoPathById.get(student.student_id);
    return { id: student.student_id, name: student.full_name, grade: student.grade, balance: Number(student.balance), photoUrl: path ? photoUrlByPath.get(path) ?? null : null };
  });

  return <DashboardShell profile={{ full_name: profile.full_name, role: profile.role as AppRole }} activeHref="/dashboard/points">
    <Link href="/dashboard/points" className="back-home-button"><span aria-hidden="true">←</span> 드림보석관리로</Link>
    <div className="module-heading"><div><p className="eyebrow">GEM STATISTICS</p><h1>보석 통계</h1><span>학생별 보유 보석 순위와 학년별 현황을 확인합니다.</span></div></div>
    {error ? <p className="form-alert error">보석 통계를 불러오지 못했습니다. {error.message}</p> : <GemStatistics students={rankingStudents}/>} 
  </DashboardShell>;
}
