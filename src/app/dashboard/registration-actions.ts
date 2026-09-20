'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function resubmitRegistration() {
  const supabase = await createClient();
  const { error } = await supabase.rpc('resubmit_registration');
  if (error) redirect(`/dashboard?error=${encodeURIComponent(`재신청하지 못했습니다. (${error.message})`)}`);
  revalidatePath('/dashboard');
  redirect(`/dashboard?message=${encodeURIComponent('가입 신청을 다시 접수했습니다.')}`);
}
