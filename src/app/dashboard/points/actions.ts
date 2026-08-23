'use server';

import { revalidatePath } from 'next/cache'; import { createClient } from '@/lib/supabase/server';
export type QuickPointResult = { ok: true; studentId: string; amount: number; message: string } | { ok: false; message: string };
export async function awardQuickPoint(formData: FormData): Promise<QuickPointResult> {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); const userId = data?.claims?.sub;
  if (!userId) return { ok: false, message: '로그인이 만료되었습니다.' };
  const studentId = String(formData.get('student_id') ?? ''); const amount = Number(formData.get('amount'));
  if (!studentId || ![-1, 1].includes(amount)) return { ok: false, message: '올바르지 않은 보석 변경 요청입니다.' };
  const { error } = await supabase.from('point_transactions').insert({ student_id: studentId, amount, reason: amount > 0 ? '빠른 지급' : '빠른 차감', awarded_by: userId });
  if (error) return { ok: false, message: `보석을 변경하지 못했습니다. (${error.message})` };
  revalidatePath('/dashboard/points'); revalidatePath('/dashboard');
  return { ok: true, studentId, amount, message: amount > 0 ? '보석 1개를 지급했습니다.' : '보석 1개를 차감했습니다.' };
}
