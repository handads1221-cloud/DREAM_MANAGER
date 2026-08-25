'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

export type BulkAttendanceResult = { ok: true; action: 'present' | 'cancel'; studentIds: string[]; message: string } | { ok: false; message: string };

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function updateBulkAttendance(formData: FormData): Promise<BulkAttendanceResult> {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); const userId = data?.claims?.sub;
  if (!userId) return { ok: false, message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || !['admin', 'teacher'].includes(profile.role)) return { ok: false, message: '출석관리 권한이 없습니다.' };
  let eventId = String(formData.get('event_id') ?? ''); const serviceDate = String(formData.get('service_date') ?? ''); const action = String(formData.get('attendance_action') ?? '');
  const studentIds = [...new Set(formData.getAll('student_ids').map(String).filter(Boolean))];
  if (!isValidDate(serviceDate) || studentIds.length === 0) return { ok: false, message: '날짜와 처리할 학생을 확인해 주세요.' };
  if (!eventId && action === 'present') {
    if (profile.role !== 'admin') return { ok: false, message: '아직 출석 회차가 없는 날짜입니다. 관리자에게 해당 날짜의 첫 출석 등록을 요청해 주세요.' };
    const qrTokenHash = createHash('sha256').update(`manual-attendance:${serviceDate}`).digest('hex');
    const { data: created, error: createError } = await supabase.from('attendance_events').insert({ service_date: serviceDate, title: '주일예배', qr_token_hash: qrTokenHash, opens_at: `${serviceDate}T00:00:00+09:00`, closes_at: `${serviceDate}T23:59:59+09:00`, created_by: userId }).select('id').single();
    if (createError) {
      const { data: existing } = await supabase.from('attendance_events').select('id').eq('service_date', serviceDate).maybeSingle();
      if (!existing) return { ok: false, message: `출석 날짜를 준비하지 못했습니다. (${createError.message})` };
      eventId = existing.id;
    } else eventId = created.id;
  }
  if (!eventId && action === 'cancel') return { ok: true, action: 'cancel', studentIds, message: '해당 날짜에 취소할 출석 기록이 없습니다.' };
  if (action === 'cancel') {
    const { error } = await supabase.from('attendance_records').delete().eq('event_id', eventId).in('student_id', studentIds);
    if (error) return { ok: false, message: `출석을 취소하지 못했습니다. (${error.message})` };
  } else if (action === 'present') {
    const rows = studentIds.map((studentId) => ({ event_id: eventId, student_id: studentId, status: 'present', method: 'teacher', checked_by: userId }));
    const { error } = await supabase.from('attendance_records').upsert(rows, { onConflict: 'event_id,student_id' });
    if (error) return { ok: false, message: `출석을 등록하지 못했습니다. (${error.message})` };
  } else return { ok: false, message: '올바르지 않은 출석 처리 요청입니다.' };
  revalidatePath('/dashboard/attendance');
  revalidatePath('/dashboard');
  return { ok: true, action, studentIds, message: action === 'present' ? `${studentIds.length}명의 출석을 등록했습니다.` : `${studentIds.length}명의 출석을 취소했습니다.` };
}

export async function submitQr(formData: FormData) {
  const token = String(formData.get('token') ?? ''); const supabase = await createClient(); const { data, error } = await supabase.rpc('submit_qr_attendance', { raw_token: token });
  const rawError = error?.message.toLowerCase() ?? '';
  const message = !error ? String(data ?? '출석이 완료되었습니다.')
    : rawError.includes('student profile not linked') ? '학생 계정이 학생 명단에 연결되지 않았습니다. 관리자에게 학생계정 연결을 요청해 주세요.'
    : rawError.includes('student account required') ? '학생 계정으로 로그인해야 QR 출석을 할 수 있습니다.'
    : rawError.includes('invalid daily qr') ? '오늘 날짜의 출석 QR이 아닙니다. 관리자 화면의 당일 QR을 다시 촬영해 주세요.'
    : '출석 처리 중 오류가 발생했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.';
  redirect(`/dashboard/check-in?message=${encodeURIComponent(message)}&success=${error ? '0' : '1'}`);
}
