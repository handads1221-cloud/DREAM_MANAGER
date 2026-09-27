import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../dashboard-shell';
import { QuizStudio } from './quiz-studio';

export default async function QuizPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect('/login');
  const [{ data: profile }, { data: quizzes }] = await Promise.all([
    supabase.from('profiles').select('full_name,role,is_active').eq('id', userId).maybeSingle(),
    supabase.from('quiz_sets').select('id,title,description,created_at,quiz_questions(id)').order('created_at', { ascending: false }),
  ]);
  if (!profile?.is_active || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard');
  return <DashboardShell profile={{ full_name: profile.full_name, role: profile.role as AppRole }} activeHref="/dashboard/quiz">
    <QuizStudio quizzes={(quizzes ?? []).map((quiz) => ({ id: quiz.id, title: quiz.title, description: quiz.description, createdAt: quiz.created_at, questionCount: quiz.quiz_questions?.length ?? 0 }))}/>
  </DashboardShell>;
}
