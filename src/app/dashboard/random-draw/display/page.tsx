import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RandomDrawDisplay } from './random-draw-display';

export default async function RandomDrawDisplayPage({ searchParams }: PageProps<'/dashboard/random-draw/display'>) {
  const { config: configParam = '' } = await searchParams;
  const config = Array.isArray(configParam) ? configParam[0] ?? '' : configParam;
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect('/login');
  const userId = claimsData.claims.sub;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [{ data: profile }, { data: students }, { data: todayResults }] = await Promise.all([
    supabase.from('profiles').select('role, is_active').eq('id', userId).maybeSingle(),
    supabase.from('students').select('id, full_name, grade, photo_path').eq('is_active', true).order('grade').order('full_name'),
    supabase.from('random_draw_results').select('student_id').eq('draw_date', today),
  ]);
  if (!profile?.is_active || profile.role !== 'admin') redirect('/dashboard');
  const photoPaths = [...new Set((students ?? []).map((student) => student.photo_path).filter((path): path is string => Boolean(path)))];
  const { data: signedPhotos } = photoPaths.length ? await supabase.storage.from('face-photos').createSignedUrls(photoPaths, 3600) : { data: [] };
  const photoByPath = new Map<string, string>();
  for (const photo of signedPhotos ?? []) if (photo.path && photo.signedUrl) photoByPath.set(photo.path, photo.signedUrl);
  const drawStudents = (students ?? []).map((student) => ({ id: student.id, fullName: student.full_name, grade: student.grade, photoUrl: student.photo_path ? photoByPath.get(student.photo_path) ?? null : null }));
  return <RandomDrawDisplay configKey={config} students={drawStudents} todayWinnerIds={(todayResults ?? []).map((result) => result.student_id)}/>;
}
