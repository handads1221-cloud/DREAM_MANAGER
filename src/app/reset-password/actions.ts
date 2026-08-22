'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('password_confirm') ?? '');
  if (password.length < 8) redirect(`/reset-password?error=${encodeURIComponent('비밀번호는 문자 종류와 관계없이 8자 이상 입력해 주세요.')}`);
  if (password !== confirm) redirect(`/reset-password?error=${encodeURIComponent('비밀번호 확인이 일치하지 않습니다.')}`);

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect(`/login?error=${encodeURIComponent('재설정 링크가 만료되었거나 올바르지 않습니다. 새 링크를 요청해 주세요.')}`);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect(`/reset-password?error=${encodeURIComponent(`비밀번호를 변경하지 못했습니다. (${error.message})`)}`);
  await supabase.auth.signOut();
  redirect(`/login?message=${encodeURIComponent('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.')}`);
}
