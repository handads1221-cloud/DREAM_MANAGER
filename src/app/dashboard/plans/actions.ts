'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function plansRedirect(type: 'message'|'error', text: string): never { redirect(`/dashboard/plans?${type}=${encodeURIComponent(text)}`); }
async function requireStaff() {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id',userId).maybeSingle();
  return profile?.is_active && ['admin','teacher'].includes(profile.role) ? { supabase,userId } : null;
}
function fields(formData: FormData) {
  const date = String(formData.get('schedule_date') ?? ''); const time = String(formData.get('schedule_time') ?? '').trim(); const title = String(formData.get('title') ?? '').trim(); const details = String(formData.get('details') ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) plansRedirect('error','일정 날짜를 선택해 주세요.');
  if (time && !/^\d{2}:\d{2}$/.test(time)) plansRedirect('error','일정 시간을 확인해 주세요.');
  if (!title || title.length > 120) plansRedirect('error','제목을 1자 이상 120자 이하로 입력해 주세요.');
  if (details.length > 5000) plansRedirect('error','상세내용은 5,000자 이하로 입력해 주세요.');
  return { schedule_date: date, schedule_time: time || null, title, details };
}
export async function createPlan(formData: FormData) {
  const staff = await requireStaff(); if (!staff) plansRedirect('error','관리자 또는 선생님만 일정을 등록할 수 있습니다.');
  const { error } = await staff.supabase.from('weekly_plans').insert({ ...fields(formData), created_by: staff.userId, updated_by: staff.userId });
  if (error) plansRedirect('error',`일정을 등록하지 못했습니다. (${error.message})`); revalidatePath('/dashboard/plans'); plansRedirect('message','새 일정을 등록했습니다.');
}
export async function updatePlan(formData: FormData) {
  const staff = await requireStaff(); if (!staff) plansRedirect('error','관리자 또는 선생님만 일정을 수정할 수 있습니다.');
  const id = String(formData.get('id') ?? ''); if (!id) plansRedirect('error','수정할 일정을 확인할 수 없습니다.');
  const { error } = await staff.supabase.from('weekly_plans').update({ ...fields(formData), updated_by: staff.userId, updated_at: new Date().toISOString() }).eq('id',id);
  if (error) plansRedirect('error',`일정을 수정하지 못했습니다. (${error.message})`); revalidatePath('/dashboard/plans'); plansRedirect('message','일정을 수정했습니다.');
}
export async function deletePlan(formData: FormData) {
  const staff = await requireStaff(); if (!staff) plansRedirect('error','관리자 또는 선생님만 일정을 삭제할 수 있습니다.');
  const id = String(formData.get('id') ?? ''); if (!id) plansRedirect('error','삭제할 일정을 확인할 수 없습니다.');
  const { error } = await staff.supabase.from('weekly_plans').delete().eq('id',id);
  if (error) plansRedirect('error',`일정을 삭제하지 못했습니다. (${error.message})`); revalidatePath('/dashboard/plans'); plansRedirect('message','일정을 삭제했습니다.');
}
