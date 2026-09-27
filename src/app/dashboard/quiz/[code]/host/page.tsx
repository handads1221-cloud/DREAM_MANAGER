import QRCode from 'qrcode';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { QuizHost } from './quiz-host';

export default async function QuizHostPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard');
  const { data: room } = await supabase.from('quiz_rooms').select('id,room_code,state,current_question_index,question_started_at,quiz_sets(id,title,description)').eq('room_code', code).maybeSingle();
  if (!room) redirect('/dashboard/quiz');
  const quiz = Array.isArray(room.quiz_sets) ? room.quiz_sets[0] : room.quiz_sets;
  if (!quiz) redirect('/dashboard/quiz');
  const { data: questions } = await supabase.from('quiz_questions').select('id,prompt,position,duration_seconds,quiz_options(id,label,position,is_correct)').eq('quiz_id', quiz.id).order('position');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dream-manager.vercel.app';
  const joinUrl = `${siteUrl}/quiz?code=${code}`;
  const qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 420, margin: 1, color: { dark: '#123d53', light: '#ffffff' } });
  return <QuizHost room={{ id: room.id, code, state: room.state, currentQuestionIndex: room.current_question_index, questionStartedAt: room.question_started_at }} quiz={{ title: quiz.title, description: quiz.description, questions: (questions ?? []).map((question) => ({ id: question.id, prompt: question.prompt, position: question.position, durationSeconds: question.duration_seconds, options: [...(question.quiz_options ?? [])].sort((a, b) => a.position - b.position).map((option) => ({ id: option.id, label: option.label, position: option.position, isCorrect: option.is_correct })) })) }} joinUrl={joinUrl} qrDataUrl={qrDataUrl}/>;
}
