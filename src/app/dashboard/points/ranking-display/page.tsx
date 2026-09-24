import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { GemRankingDisplay, type DisplayRankGroup } from './ranking-display';

export default async function GemRankingDisplayPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect('/login');

  const [{ data: profile }, { data: balances }, { data: students }] = await Promise.all([
    supabase.from('profiles').select('role,is_active').eq('id', userId).maybeSingle(),
    supabase.from('student_point_balances').select('student_id,full_name,grade,balance'),
    supabase.from('students').select('id,gender,photo_path').eq('is_active', true),
  ]);
  if (!profile?.is_active || profile.role !== 'admin') redirect('/dashboard');

  const details = new Map((students ?? []).map((student) => [student.id, student]));
  const sorted = (balances ?? [])
    .map((student) => ({
      id: student.student_id,
      name: student.full_name,
      grade: student.grade,
      balance: Number(student.balance),
      gender: details.get(student.student_id)?.gender === 'female' ? 'female' as const : 'male' as const,
      photoPath: details.get(student.student_id)?.photo_path ?? null,
    }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'ko') || a.grade - b.grade);

  const topBalances = [...new Set(sorted.map((student) => student.balance))].slice(0, 3);
  const finalists = sorted.filter((student) => topBalances.includes(student.balance));
  const photoPaths = [...new Set(finalists.map((student) => student.photoPath).filter((path): path is string => Boolean(path)))];
  const { data: signedPhotos } = photoPaths.length ? await supabase.storage.from('face-photos').createSignedUrls(photoPaths, 3600) : { data: [] };
  const photoUrls = new Map<string, string>();
  for (const photo of signedPhotos ?? []) if (photo.path && photo.signedUrl) photoUrls.set(photo.path, photo.signedUrl);

  const groups: DisplayRankGroup[] = topBalances.map((balance, index) => ({
    rank: index + 1,
    balance,
    students: finalists.filter((student) => student.balance === balance).map((student) => ({
      id: student.id,
      name: student.name,
      grade: student.grade,
      gender: student.gender,
      photoUrl: student.photoPath ? photoUrls.get(student.photoPath) ?? null : null,
    })),
  }));

  return <GemRankingDisplay groups={groups}/>;
}
