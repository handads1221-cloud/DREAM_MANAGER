'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const allowedRoles = new Set(['parent', 'student', 'teacher']);

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
