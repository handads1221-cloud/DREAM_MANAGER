'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function getSignUpErrorMessage(error: { code?: string; message: string }) {
  const code = error.code ?? '';
  const detail = error.message.toLowerCase();

  if (code === 'user_already_exists' || detail.includes('already registered') || detail.includes('already exists')) {
    return '이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정해 주세요.';
  }
  if (code === 'email_address_invalid' || detail.includes('invalid email')) {
    return '사용할 수 없는 이메일 주소입니다. 이메일 주소를 다시 확인해 주세요.';
  }
  if (code === 'weak_password' || detail.includes('password') && detail.includes('weak')) {
    return '비밀번호가 너무 짧습니다. 문자 종류와 관계없이 8자 이상 입력해 주세요.';
  }
  if (code === 'over_email_send_rate_limit' || detail.includes('email rate limit')) {
    return '인증 이메일을 너무 자주 요청했습니다. 잠시 후 다시 신청해 주세요.';
  }
  if (code === 'over_request_rate_limit' || code === 'too_many_requests' || detail.includes('too many requests')) {
    return '가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (code === 'signup_disabled' || code === 'email_provider_disabled') {
    return '현재 이메일 가입이 일시 중지되어 있습니다. 관리자에게 문의해 주세요.';
  }
  if (code === 'captcha_failed') {
    return '보안 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.';
  }
  if (code === 'validation_failed') {
    return '입력값을 확인해 주세요. 이메일 형식과 비밀번호 길이가 올바르지 않을 수 있습니다.';
  }
  if (detail.includes('error sending confirmation email') || detail.includes('failed to send')) {
    return '인증 이메일을 보내지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.';
  }

  return `가입 신청을 완료하지 못했습니다. (${error.code ?? error.message})`;
}

export async function signUp(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const fullName = String(formData.get('full_name') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const passwordConfirm = String(formData.get('password_confirm') ?? '');
  const phone = String(formData.get('phone') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();

  if (!email || !email.includes('@')) redirect(`/signup?error=${encodeURIComponent('올바른 이메일 주소를 입력해 주세요.')}`);
  if (!fullName || fullName.length > 50) redirect(`/signup?error=${encodeURIComponent('이름은 1~50자로 입력해 주세요.')}`);
  if (password.length < 8) redirect(`/signup?error=${encodeURIComponent('비밀번호는 8자 이상으로 설정해 주세요.')}`);
  if (password !== passwordConfirm) redirect(`/signup?error=${encodeURIComponent('비밀번호 확인이 일치하지 않습니다.')}`);

  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin') ?? 'https://dream-manager.vercel.app';
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
      data: { full_name: fullName, phone, address, note },
    },
  });

  if (error) {
    const message = getSignUpErrorMessage(error);
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }

  redirect(`/login?message=${encodeURIComponent('가입 신청이 접수되었습니다. 이메일 인증 후 관리자 승인을 기다려 주세요.')}`);
}
