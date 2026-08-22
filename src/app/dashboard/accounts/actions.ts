'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowedRoles = new Set(['parent', 'student', 'teacher', 'admin']);

function accountsRedirect(type: 'message' | 'error', message: string): never {
  redirect(`/dashboard/accounts?${type}=${encodeURIComponent(message)}`);
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', userId).maybeSingle();
  return profile?.role === 'admin' && profile.is_active ? { supabase, userId } : null;
}

export async function approveRegistration(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!allowedRoles.has(role)) return;

  const { data: request } = await admin.supabase.from('registration_requests').select('full_name, phone, address, note, status').eq('user_id', userId).eq('status', 'pending').maybeSingle();
  if (!request) return;

  const { error } = await admin.supabase.from('profiles').upsert({ id: userId, role, full_name: request.full_name, phone: request.phone, address: request.address, note: request.note, is_active: true }, { onConflict: 'id' });
  if (error) return;
  await admin.supabase.from('registration_requests').update({ status: 'approved', reviewed_by: admin.userId, reviewed_at: new Date().toISOString() }).eq('user_id', userId);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/accounts');
}

export async function rejectRegistration(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const userId = String(formData.get('user_id') ?? '');
  await admin.supabase.from('registration_requests').update({ status: 'rejected', reviewed_by: admin.userId, reviewed_at: new Date().toISOString() }).eq('user_id', userId).eq('status', 'pending');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/accounts');
}

export async function updateAccountRole(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const userId = String(formData.get('user_id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!userId || !allowedRoles.has(role)) accountsRedirect('error', '변경할 권한을 확인해 주세요.');
  if (userId === admin.userId) accountsRedirect('error', '현재 로그인한 관리자 자신의 권한은 이 화면에서 변경할 수 없습니다.');

  const { error } = await admin.supabase.from('profiles').update({ role }).eq('id', userId);
  if (error) accountsRedirect('error', `권한을 변경하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/accounts');
  revalidatePath('/dashboard');
  accountsRedirect('message', '계정 권한을 변경했습니다.');
}

export async function sendAccountPasswordReset(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const userId = String(formData.get('user_id') ?? '');
  const { data: request } = await admin.supabase.from('registration_requests').select('email').eq('user_id', userId).maybeSingle();
  if (!request?.email) accountsRedirect('error', '재설정 메일을 받을 이메일을 찾지 못했습니다.');

  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin') ?? 'https://dream-manager.vercel.app';
  const { error } = await admin.supabase.auth.resetPasswordForEmail(request.email, { redirectTo: `${origin}/auth/confirm?next=/reset-password` });
  if (error) accountsRedirect('error', `비밀번호 재설정 메일을 보내지 못했습니다. (${error.message})`);
  accountsRedirect('message', `${request.email} 주소로 비밀번호 재설정 메일을 보냈습니다.`);
}

export async function withdrawAccount(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const userId = String(formData.get('user_id') ?? '');
  const note = String(formData.get('withdrawal_note') ?? '').trim().slice(0, 200);
  if (!userId) accountsRedirect('error', '탈퇴 처리할 계정을 확인할 수 없습니다.');
  if (userId === admin.userId) accountsRedirect('error', '현재 로그인한 관리자 계정은 탈퇴 처리할 수 없습니다.');

  const { error } = await admin.supabase.from('profiles').update({
    is_active: false,
    account_status: 'withdrawn',
    withdrawn_at: new Date().toISOString(),
    withdrawn_by: admin.userId,
    withdrawal_note: note || null,
  }).eq('id', userId);
  if (error) accountsRedirect('error', `탈퇴 처리하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/accounts');
  revalidatePath('/dashboard');
  accountsRedirect('message', '로그인을 차단하고 탈퇴 계정으로 전환했습니다. 기존 데이터는 보존됩니다.');
}

export async function restoreAccount(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const userId = String(formData.get('user_id') ?? '');
  if (!userId) accountsRedirect('error', '복구할 계정을 확인할 수 없습니다.');

  const { error } = await admin.supabase.from('profiles').update({
    is_active: true,
    account_status: 'active',
    withdrawn_at: null,
    withdrawn_by: null,
    withdrawal_note: null,
  }).eq('id', userId);
  if (error) accountsRedirect('error', `계정을 복구하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/accounts');
  revalidatePath('/dashboard');
  accountsRedirect('message', '탈퇴 계정을 활성 계정으로 복구했습니다.');
}
