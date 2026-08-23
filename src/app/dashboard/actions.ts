'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function switchActiveRole(formData: FormData) {
  const role = String(formData.get('role') ?? '');
  if (!['admin', 'teacher', 'parent', 'student'].includes(role)) redirect('/dashboard');
  const supabase = await createClient();
  const { error } = await supabase.rpc('switch_active_role', { selected_role: role });
  if (error) redirect(`/dashboard?role_error=${encodeURIComponent('부여되지 않은 역할로는 전환할 수 없습니다.')}`);
  redirect('/dashboard');
}
