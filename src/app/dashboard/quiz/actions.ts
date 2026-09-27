'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type QuizDraft = {
  title: string;
  description: string;
  questions: { prompt: string; durationSeconds: number; options: string[]; correctIndex: number }[];
};

async function requireStaff() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) throw new Error('로그인이 필요합니다.');
  const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || !['admin', 'teacher'].includes(profile.role)) throw new Error('퀴즈를 관리할 권한이 없습니다.');
  return { supabase, userId };
}

export async function saveQuiz(draft: QuizDraft) {
  const { supabase, userId } = await requireStaff();
  const title = draft.title.trim();
  const questions = draft.questions.filter((question) => question.prompt.trim());
  if (!title || questions.length === 0) throw new Error('제목과 한 개 이상의 문제를 입력해 주세요.');
  if (questions.some((question) => question.options.filter((option) => option.trim()).length < 2)) throw new Error('각 문제에는 두 개 이상의 보기가 필요합니다.');

  const { data: quiz, error: quizError } = await supabase.from('quiz_sets').insert({ title, description: draft.description.trim(), created_by: userId }).select('id').single();
  if (quizError) throw new Error(quizError.message);
  try {
    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const cleanOptions = question.options.map((option) => option.trim()).filter(Boolean);
      const correctLabel = question.options[question.correctIndex]?.trim();
      const { data: savedQuestion, error: questionError } = await supabase.from('quiz_questions').insert({ quiz_id: quiz.id, position: index, prompt: question.prompt.trim(), duration_seconds: question.durationSeconds }).select('id').single();
      if (questionError) throw questionError;
      const { error: optionsError } = await supabase.from('quiz_options').insert(cleanOptions.map((label, optionIndex) => ({ question_id: savedQuestion.id, position: optionIndex, label, is_correct: label === correctLabel })));
      if (optionsError) throw optionsError;
    }
  } catch (error) {
    await supabase.from('quiz_sets').delete().eq('id', quiz.id);
    throw new Error(error instanceof Error ? error.message : '퀴즈 저장 중 오류가 발생했습니다.');
  }
  revalidatePath('/dashboard/quiz');
  return quiz.id;
}

export async function deleteQuiz(quizId: string) {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from('quiz_sets').delete().eq('id', quizId);
  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/quiz');
}

export async function createLiveRoom(quizId: string) {
  const { supabase, userId } = await requireStaff();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomCode = String(Math.floor(100000 + Math.random() * 900000));
    const { error } = await supabase.from('quiz_rooms').insert({ quiz_id: quizId, room_code: roomCode, host_id: userId });
    if (!error) return roomCode;
    if (error.code !== '23505') throw new Error(error.message);
  }
  throw new Error('참여코드 생성에 실패했습니다. 다시 시도해 주세요.');
}
