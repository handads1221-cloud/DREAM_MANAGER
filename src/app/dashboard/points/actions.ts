'use server';

import { revalidatePath } from 'next/cache'; import { createClient } from '@/lib/supabase/server';
export type QuickPointResult = { ok: true; studentId: string; amount: number; message: string } | { ok: false; message: string };
export type ChatPointResult = { ok: true; changes: { studentId: string; name: string; amount: number }[]; message: string } | { ok: false; message: string };
type ParsedChatCommand = { names: string[]; quantity: number; action: '지급' | '차감' };

function parseChatPointCommand(message: string): { ok: true; command: ParsedChatCommand } | { ok: false; message: string } {
  if (!message.includes('보석')) return { ok: false, message: "'보석'이라는 단어가 없습니다. 예: 김하늘 보석 2개 지급" };
  const markerIndex = message.indexOf('보석');
  const namesText = message.slice(0, markerIndex).trim();
  if (!namesText) return { ok: false, message: '학생 이름이 없습니다. 보석 앞에 등록된 학생 이름을 정확히 입력해 주세요.' };
  const actionMatch = message.match(/(지급|추가|차감)$/);
  if (!actionMatch) return { ok: false, message: "명령 끝에 '지급' 또는 '차감'을 입력해 주세요. 예: 김하늘 보석 2개 지급" };
  const actionText = actionMatch[1];
  const quantityText = message.slice(markerIndex + 2, actionMatch.index).trim();
  if (!quantityText) return { ok: false, message: '보석 수량이 없습니다. 보석 뒤에 숫자를 입력해 주세요. 예: 보석 2개 지급' };
  const quantityMatch = quantityText.match(/^(\d+)\s*개?$/);
  if (!quantityMatch) return { ok: false, message: `수량 '${quantityText}'을 이해하지 못했습니다. 숫자로 입력해 주세요. 예: 보석 2개 지급` };
  const quantity = Number(quantityMatch[1]);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { ok: false, message: '보석 수량은 1개부터 999개까지 입력해 주세요.' };
  const names = [...new Set(namesText.split(/[\s,，]+/).map((name) => name.trim()).filter(Boolean))];
  if (!names.length || names.length > 50) return { ok: false, message: '한 번에 1명부터 50명까지 처리할 수 있습니다.' };
  return { ok: true, command: { names, quantity, action: actionText === '차감' ? '차감' : '지급' } };
}
export async function awardQuickPoint(formData: FormData): Promise<QuickPointResult> {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); const userId = data?.claims?.sub;
  if (!userId) return { ok: false, message: '로그인이 만료되었습니다.' };
  const studentId = String(formData.get('student_id') ?? ''); const amount = Number(formData.get('amount'));
  const isQuickAmount = [-5, -1, 1].includes(amount);
  const isCustomAward = Number.isInteger(amount) && amount >= 1 && amount <= 999;
  if (!studentId || (!isQuickAmount && !isCustomAward)) return { ok: false, message: '보석 수량은 1개부터 999개까지 입력해 주세요.' };
  const { error } = await supabase.from('point_transactions').insert({ student_id: studentId, amount, reason: amount > 0 ? '보석 추가' : '보석 차감', awarded_by: userId });
  if (error) return { ok: false, message: `보석을 변경하지 못했습니다. (${error.message})` };
  revalidatePath('/dashboard/points'); revalidatePath('/dashboard');
  const quantity = Math.abs(amount);
  return { ok: true, studentId, amount, message: amount > 0 ? `보석 ${quantity}개를 추가했습니다.` : `보석 ${quantity}개를 차감했습니다.` };
}

export async function awardPointsFromChat(rawMessage: string): Promise<ChatPointResult> {
  const message = rawMessage.trim().replace(/[()]/g, '').replace(/\s+/g, ' ');
  if (!message || message.length > 500) return { ok: false, message: '명령은 500자 이내로 입력해 주세요.' };

  const parsed = parseChatPointCommand(message);
  if (!parsed.ok) return parsed;
  const { names, quantity, action } = parsed.command;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { ok: false, message: '로그인이 만료되었습니다.' };

  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || !['admin', 'teacher'].includes(profile.role)) return { ok: false, message: '보석을 변경할 권한이 없습니다.' };

  const { data: matchedStudents, error: studentError } = await supabase.from('students').select('id, full_name').eq('is_active', true).in('full_name', names);
  if (studentError) return { ok: false, message: `학생 명단을 확인하지 못했습니다. (${studentError.message})` };

  const matchesByName = new Map<string, { id: string; full_name: string }[]>();
  for (const student of matchedStudents ?? []) matchesByName.set(student.full_name, [...(matchesByName.get(student.full_name) ?? []), student]);
  const missing = names.filter((name) => !matchesByName.has(name));
  if (missing.length) return { ok: false, message: `${missing.join(', ')} 이름이 등록 명단과 정확히 일치하지 않습니다. 이름은 자동 교정하거나 부분일치로 처리하지 않으니 명단의 이름을 그대로 입력해 주세요.` };
  const duplicates = names.filter((name) => (matchesByName.get(name)?.length ?? 0) > 1);
  if (duplicates.length) return { ok: false, message: `${duplicates.join(', ')} 학생은 동명이인이 있어 챗봇으로 처리할 수 없습니다. 명단의 버튼을 이용해 주세요.` };

  const amount = action === '차감' ? -quantity : quantity;
  const students = names.map((name) => matchesByName.get(name)![0]);
  const { error } = await supabase.from('point_transactions').insert(students.map((student) => ({ student_id: student.id, amount, reason: action === '차감' ? '보석 챗봇 차감' : '보석 챗봇 지급', awarded_by: userId })));
  if (error) return { ok: false, message: `보석을 처리하지 못했습니다. (${error.message})` };

  revalidatePath('/dashboard/points'); revalidatePath('/dashboard'); revalidatePath('/dashboard/points/statistics');
  return { ok: true, changes: students.map((student) => ({ studentId: student.id, name: student.full_name, amount })), message: `${names.join(', ')} 학생에게 보석 ${quantity}개가 ${action}되었습니다.` };
}
