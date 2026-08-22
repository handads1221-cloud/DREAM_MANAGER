'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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
    const message = error.message.toLowerCase().includes('registered')
      ? '이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정해 주세요.'
      : '가입 신청을 완료하지 못했습니다. 입력 내용을 확인해 주세요.';
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }

  redirect(`/login?message=${encodeURIComponent('가입 신청이 접수되었습니다. 이메일 인증 후 관리자 승인을 기다려 주세요.')}`);
}
