'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signIn(formData: FormData) {
  const loginId = String(formData.get('loginId') ?? '').trim();
  const email = loginId.includes('@')
    ? loginId.toLowerCase()
    : `${loginId.toLowerCase()}@dream-manager.local`;
  const password = String(formData.get('password') ?? '');
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) redirect(`/login?error=${encodeURIComponent('이메일 또는 비밀번호를 확인해 주세요.')}`);
  redirect('/dashboard');
}

export async function sendResetLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email);
  redirect(`/login?message=${encodeURIComponent('비밀번호 재설정 메일을 확인해 주세요.')}`);
}
