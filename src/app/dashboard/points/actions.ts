'use server';

import { revalidatePath } from 'next/cache'; import { createClient } from '@/lib/supabase/server';
export async function awardPoints(formData: FormData) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) return; const studentId = String(formData.get('student_id') ?? ''); const amount = Number(formData.get('amount')); const reason = String(formData.get('reason') ?? '').trim(); if (!studentId || !Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1000 || !reason) return;
  await supabase.from('point_transactions').insert({ student_id: studentId, amount, reason, awarded_by: data.claims.sub }); revalidatePath('/dashboard/points'); revalidatePath('/dashboard');
}
