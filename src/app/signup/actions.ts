'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { loginIdToAuthEmail, normalizeLoginId } from '@/lib/login-id';

export type SignupState = { error?: string };

function getSignUpErrorMessage(error: { code?: string; message: string }) {
  const code = error.code ?? '';
  const detail = error.message.toLowerCase();

  if (code === 'user_already_exists' || detail.includes('already registered') || detail.includes('already exists')) {
    return '이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.';
  }
  if (code === 'email_address_invalid' || detail.includes('invalid email')) {
    return '아이디를 처리하지 못했습니다. 다른 아이디를 입력해 주세요.';
  }
  if (code === 'weak_password' || detail.includes('password') && detail.includes('weak')) {
    return '비밀번호가 너무 짧습니다. 문자 종류와 관계없이 8자 이상 입력해 주세요.';
  }
  if (code === 'over_email_send_rate_limit' || detail.includes('email rate limit')) {
    return '가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (code === 'over_request_rate_limit' || code === 'too_many_requests' || detail.includes('too many requests')) {
    return '가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (code === 'signup_disabled' || code === 'email_provider_disabled') {
    return '현재 가입이 일시 중지되어 있습니다. 관리자에게 문의해 주세요.';
  }
  if (code === 'captcha_failed') {
    return '보안 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.';
  }
  if (code === 'validation_failed') {
    return '입력값을 확인해 주세요. 아이디와 비밀번호 길이를 다시 확인해 주세요.';
  }
  if (detail.includes('error sending confirmation email') || detail.includes('failed to send')) {
    return '가입 계정을 만들지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.';
  }

  return `가입 신청을 완료하지 못했습니다. (${error.code ?? error.message})`;
}

export async function signUp(_previousState: SignupState, formData: FormData): Promise<SignupState> {
  const loginId = normalizeLoginId(String(formData.get('login_id') ?? ''));
  const email = loginIdToAuthEmail(loginId);
  const fullName = String(formData.get('full_name') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('password_confirm') ?? '');
  const phone = String(formData.get('phone') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  const requestedRole = String(formData.get('requested_role') ?? 'unsure');
  const teacherInviteCode = String(formData.get('teacher_invite_code') ?? '').trim();

  if (loginId.length < 3 || loginId.length > 30 || /\s/.test(loginId)) return { error: '아이디는 공백 없이 3~30자로 입력해 주세요.' };
  if (!/^[가-힣]{2,10}$/.test(fullName)) return { error: '이름은 공백 없이 한글 2~10자로 입력해 주세요.' };
  if (password.length < 8) return { error: '비밀번호는 8자 이상으로 설정해 주세요.' };
  if (password !== passwordConfirm) return { error: '비밀번호 확인이 일치하지 않습니다.' };
  if (!['parent', 'student', 'teacher', 'accountant'].includes(requestedRole)) return { error: '가입 유형을 다시 선택해 주세요.' };
  if (requestedRole === 'teacher' && teacherInviteCode.length < 6) return { error: '관리자에게 받은 선생님 초대코드를 입력해 주세요.' };

  const supabase = await createClient();
  if (requestedRole === 'teacher') {
    const { data: validInvite, error: inviteCheckError } = await supabase.rpc('check_teacher_invite', { raw_code: teacherInviteCode });
    if (inviteCheckError || !validInvite) return { error: '선생님 초대코드가 올바르지 않거나 이미 사용되었습니다.' };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { login_id: loginId, full_name: fullName, phone, address, note, requested_role: requestedRole },
    },
  });

  if (error) {
    return { error: getSignUpErrorMessage(error) };
  }

  if (!data.user || data.user.identities?.length === 0) {
    return { error: '이미 사용 중인 아이디입니다. 다른 아이디를 입력해 주세요.' };
  }

  if (requestedRole === 'teacher') {
    const { error: inviteError } = await supabase.rpc('activate_teacher_signup', { target_user_id: data.user.id, raw_code: teacherInviteCode });
    if (inviteError) return { error: '선생님 초대코드가 올바르지 않거나 이미 사용되었습니다. 관리자에게 새 코드를 요청해 주세요.' };
  }

  // Email confirmation settings can create a temporary session immediately.
  // Clear only this device's session so a completed request always returns to login.
  if (data.session) await supabase.auth.signOut({ scope: 'local' });

  redirect(`/signup/complete?login_id=${encodeURIComponent(loginId)}&role=${encodeURIComponent(requestedRole)}`);
}
