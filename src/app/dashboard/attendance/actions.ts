'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function saveAttendance(formData: FormData) {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) return;
  const eventId = String(formData.get('event_id') ?? ''); const studentId = String(formData.get('student_id') ?? ''); const status = String(formData.get('status') ?? 'present');
  if (!['present','late','excused','absent'].includes(status)) return;
  await supabase.from('attendance_records').upsert({ event_id: eventId, student_id: studentId, status, method: 'teacher', checked_by: data.claims.sub }, { onConflict: 'event_id,student_id' });
  revalidatePath('/dashboard/attendance');
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
