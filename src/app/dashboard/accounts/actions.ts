'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const allowedRoles = new Set(['parent', 'student', 'teacher', 'accountant', 'admin']);

function selectedRoles(formData: FormData) {
  return [...new Set(formData.getAll('roles').map(String).filter((role) => allowedRoles.has(role)))];
}

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
  const roles = selectedRoles(formData);
  if (roles.length === 0) accountsRedirect('error', '권한을 한 개 이상 선택해 주세요.');
  const { error } = await admin.supabase.rpc('admin_approve_registration', { target_user_id: userId, selected_roles: roles });
  if (error) accountsRedirect('error', `가입 승인을 완료하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/accounts');
  accountsRedirect('message', '가입 승인과 권한 부여를 완료했습니다. 이제 가입한 비밀번호로 로그인할 수 있습니다.');
}

export async function rejectRegistration(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const userId = String(formData.get('user_id') ?? '');
  const reason = String(formData.get('rejection_reason') ?? '').trim().slice(0, 300);
  if (!reason) accountsRedirect('error', '반려 사유를 입력해 주세요.');
  const { error } = await admin.supabase.rpc('admin_reject_registration', { target_user_id: userId, reason });
  if (error) accountsRedirect('error', `가입 신청을 반려하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/accounts');
  accountsRedirect('message', '가입 신청을 반려하고 사유를 저장했습니다.');
}

export async function createTeacherInvite(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const code = String(formData.get('invite_code') ?? '').trim();
  const label = String(formData.get('invite_label') ?? '').trim().slice(0, 60);
  if (code.length < 6) accountsRedirect('error', '선생님 초대코드는 6자 이상 입력해 주세요.');
  const { error } = await admin.supabase.rpc('admin_create_teacher_invite', { raw_code: code, invite_label: label || null });
  if (error) accountsRedirect('error', '초대코드를 만들지 못했습니다. 이미 사용 중인 코드인지 확인해 주세요.');
  revalidatePath('/dashboard/accounts');
  accountsRedirect('message', `선생님 1회용 초대코드 “${code}”를 만들었습니다. 가입할 선생님에게 전달해 주세요.`);
}

export async function updateAccountRole(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const userId = String(formData.get('user_id') ?? '');
  const roles = selectedRoles(formData);
  if (!userId || roles.length === 0) accountsRedirect('error', '변경할 권한을 한 개 이상 선택해 주세요.');
  if (userId === admin.userId) accountsRedirect('error', '현재 로그인한 관리자 자신의 권한은 이 화면에서 변경할 수 없습니다.');

  const { error } = await admin.supabase.rpc('admin_set_user_roles', { target_user_id: userId, selected_roles: roles });
  if (error) accountsRedirect('error', `권한을 변경하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/accounts');
  revalidatePath('/dashboard');
  accountsRedirect('message', '계정의 복수 권한을 변경했습니다.');
}

export async function updateAccountProfile(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const userId = String(formData.get('user_id') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim().slice(0, 30);
  const address = String(formData.get('address') ?? '').trim().slice(0, 300);
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  if (!userId || !fullName) accountsRedirect('error', '계정 이름은 반드시 입력해 주세요.');
  const { error } = await admin.supabase.from('profiles').update({ full_name: fullName, phone: phone || null, address: address || null, note: note || null }).eq('id', userId);
  if (error) accountsRedirect('error', `계정 정보를 수정하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/accounts');
  revalidatePath('/dashboard');
  accountsRedirect('message', `${fullName}님의 계정 정보를 수정했습니다.`);
}

export async function updateTeacherPhoto(formData: FormData) {
  const admin = await requireAdmin(); if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const userId = String(formData.get('user_id') ?? ''); const photo = formData.get('photo');
  const [{ data: teacher }, { data: teacherRole }] = await Promise.all([
    admin.supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    admin.supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'teacher').maybeSingle(),
  ]);
  if (!teacher || !teacherRole) accountsRedirect('error', '선생님 권한이 있는 계정만 얼굴 사진을 등록할 수 있습니다.');
  if (!(photo instanceof File) || photo.size === 0 || !['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024) accountsRedirect('error', 'JPG, PNG, WEBP 사진을 5MB 이하로 선택해 주세요.');
  const path = `teachers/${userId}/face`; const { error: uploadError } = await admin.supabase.storage.from('face-photos').upload(path, photo, { upsert: true, contentType: photo.type });
  if (uploadError) accountsRedirect('error', `사진을 업로드하지 못했습니다. (${uploadError.message})`);
  const { error } = await admin.supabase.from('profiles').update({ photo_path: path }).eq('id', userId); if (error) accountsRedirect('error', `사진 정보를 저장하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/accounts'); accountsRedirect('message', `${teacher.full_name} 선생님의 얼굴 사진을 저장했습니다.`);
}

export async function updateTeacherBirthDate(formData: FormData) {
  const admin = await requireAdmin(); if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const userId = String(formData.get('user_id') ?? '');
  const birthDate = String(formData.get('birth_date') ?? '').trim() || null;
  const { data: teacherRole } = await admin.supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'teacher').maybeSingle();
  if (!teacherRole) accountsRedirect('error', '선생님 권한이 있는 계정만 생년월일을 등록할 수 있습니다.');
  if (birthDate && (birthDate < '1900-01-01' || birthDate > new Date().toISOString().slice(0, 10))) accountsRedirect('error', '생년월일을 올바르게 입력해 주세요.');
  const { data: teacher, error } = await admin.supabase.from('profiles').update({ birth_date: birthDate }).eq('id', userId).select('full_name').single();
  if (error) accountsRedirect('error', `생년월일을 저장하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/accounts'); revalidatePath('/dashboard');
  accountsRedirect('message', `${teacher.full_name} 선생님의 생년월일을 저장했습니다.`);
}

export async function setAccountPassword(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) accountsRedirect('error', '관리자 권한을 확인할 수 없습니다.');
  const userId = String(formData.get('user_id') ?? '');
  const password = String(formData.get('new_password') ?? '');
  const passwordConfirm = String(formData.get('new_password_confirm') ?? '');
  if (!userId) accountsRedirect('error', '비밀번호를 변경할 계정을 확인할 수 없습니다.');
  if (userId === admin.userId) accountsRedirect('error', '현재 로그인한 관리자 자신의 비밀번호는 로그인 화면의 비밀번호 변경 절차를 이용해 주세요.');
  if (password.length < 8) accountsRedirect('error', '새 비밀번호는 문자 종류와 관계없이 8자 이상 입력해 주세요.');
  if (new TextEncoder().encode(password).length > 72) accountsRedirect('error', '새 비밀번호가 너무 깁니다. 한글을 포함하면 더 짧게 입력해 주세요.');
  if (password !== passwordConfirm) accountsRedirect('error', '새 비밀번호 확인이 일치하지 않습니다.');

  const { error } = await admin.supabase.rpc('admin_set_user_password', { target_user_id: userId, new_password: password });
  if (error) accountsRedirect('error', `비밀번호를 변경하지 못했습니다. (${error.message})`);
  accountsRedirect('message', '새 비밀번호를 적용하고 해당 계정의 기존 로그인 세션을 종료했습니다.');
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
