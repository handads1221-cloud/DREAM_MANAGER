'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export type DrawResult =
  | { ok: true; winner: { id: string; fullName: string; grade: number }; message: string }
  | { ok: false; message: string };

export type ExclusionResult = { ok: boolean; message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getAdminContext() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || profile.role !== 'admin') return null;
  return { supabase, userId };
}

export async function setRandomDrawExclusion(studentId: string, excluded: boolean): Promise<ExclusionResult> {
  const context = await getAdminContext();
  if (!context) return { ok: false, message: '관리자 로그인 상태를 확인해 주세요.' };
  if (!uuidPattern.test(studentId)) return { ok: false, message: '저장할 학생을 확인하지 못했습니다.' };

  const query = excluded
    ? context.supabase.from('random_draw_exclusions').upsert({ user_id: context.userId, student_id: studentId }, { onConflict: 'user_id,student_id', ignoreDuplicates: true })
    : context.supabase.from('random_draw_exclusions').delete().eq('user_id', context.userId).eq('student_id', studentId);
  const { error } = await query;
  if (error) return { ok: false, message: `제외 설정을 저장하지 못했습니다. (${error.message})` };
  revalidatePath('/dashboard/random-draw');
  return { ok: true, message: excluded ? '제외 명단에 저장했습니다.' : '제외 명단에서 해제했습니다.' };
}

export async function clearRandomDrawExclusions(): Promise<ExclusionResult> {
  const context = await getAdminContext();
  if (!context) return { ok: false, message: '관리자 로그인 상태를 확인해 주세요.' };
  const { error } = await context.supabase.from('random_draw_exclusions').delete().eq('user_id', context.userId);
  if (error) return { ok: false, message: `제외 명단을 초기화하지 못했습니다. (${error.message})` };
  revalidatePath('/dashboard/random-draw');
  return { ok: true, message: '저장된 제외 명단을 모두 해제했습니다.' };
}

export async function drawRandomStudent(formData: FormData): Promise<DrawResult> {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { ok: false, message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || profile.role !== 'admin') return { ok: false, message: '관리자만 추첨할 수 있습니다.' };

  const gradeValue = String(formData.get('grade') ?? 'all');
  const grade = gradeValue === 'all' ? null : Number(gradeValue);
  if (grade !== null && (!Number.isInteger(grade) || grade < 1 || grade > 6)) {
    return { ok: false, message: '학년 선택을 확인해 주세요.' };
  }

  const excludedIds = formData.getAll('excluded_student_ids').map(String).filter(Boolean);
  const preventDuplicate = formData.get('prevent_duplicate') === 'true';
  const { data, error } = await supabase.rpc('draw_random_student', {
    target_grade: grade,
    excluded_student_ids: excludedIds,
    prevent_daily_duplicate: preventDuplicate,
  });

  if (error) {
    const noCandidate = error.message.includes('no eligible students');
    return { ok: false, message: noCandidate ? '조건에 맞는 추첨 가능 학생이 없습니다. 제외 명단이나 중복 방지 설정을 확인해 주세요.' : `추첨하지 못했습니다. (${error.message})` };
  }

  const winner = data?.[0];
  if (!winner) return { ok: false, message: '추첨 결과를 불러오지 못했습니다.' };
  revalidatePath('/dashboard/random-draw');
  return { ok: true, winner: { id: winner.student_id, fullName: winner.full_name, grade: winner.grade }, message: `${winner.full_name} 학생이 당첨되었습니다!` };
}
