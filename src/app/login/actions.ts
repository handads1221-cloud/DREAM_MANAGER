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
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (userId) {
    const { data: profile } = await supabase.from('profiles').select('is_active, account_status').eq('id', userId).maybeSingle();
    if (profile?.account_status === 'withdrawn' || profile && !profile.is_active) {
      await supabase.auth.signOut();
      redirect(`/login?error=${encodeURIComponent('탈퇴 처리된 계정입니다. 다시 이용하려면 관리자에게 계정 복구를 요청해 주세요.')}`);
    }
  }
  redirect('/dashboard');
}
