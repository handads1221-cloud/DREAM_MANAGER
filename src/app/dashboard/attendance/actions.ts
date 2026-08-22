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
  const message = error ? '오늘 날짜의 출석 QR이 아닙니다. 관리자 화면의 당일 QR을 다시 촬영해 주세요.' : String(data ?? '출석이 완료되었습니다.');
  redirect(`/dashboard/check-in?message=${encodeURIComponent(message)}&success=${error ? '0' : '1'}`);
}
