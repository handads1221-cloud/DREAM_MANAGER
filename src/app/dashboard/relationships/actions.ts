'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function adminClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', data.claims.sub).maybeSingle();
  return profile?.role === 'admin' && profile.is_active ? supabase : null;
}

export async function linkStudentAccount(formData: FormData) {
  const supabase = await adminClient(); if (!supabase) return;
  const studentId = String(formData.get('student_id') ?? '');
  const profileId = String(formData.get('profile_id') ?? '') || null;
  if (profileId) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', profileId).maybeSingle();
    if (profile?.role !== 'student') return;
  }
  await supabase.from('students').update({ profile_id: profileId }).eq('id', studentId);
  revalidatePath('/dashboard/relationships');
}

export async function linkParent(formData: FormData) {
  const supabase = await adminClient(); if (!supabase) return;
  const studentId = String(formData.get('student_id') ?? '');
  const parentId = String(formData.get('parent_id') ?? '');
  const relationship = String(formData.get('relationship') ?? '').trim() || '보호자';
  const { data: parent } = await supabase.from('profiles').select('role').eq('id', parentId).maybeSingle();
  if (parent?.role !== 'parent') return;
  await supabase.from('student_guardians').upsert({ student_id: studentId, parent_id: parentId, relationship, is_primary: true });
  await supabase.from('students').update({ primary_parent_id: parentId }).eq('id', studentId);
  revalidatePath('/dashboard/relationships');
}

export async function assignTeacher(formData: FormData) {
  const supabase = await adminClient(); if (!supabase) return;
  const teacherId = String(formData.get('teacher_id') ?? '');
  const grade = Number(formData.get('grade'));
  const className = String(formData.get('class_name') ?? '').trim() || '전체';
  const { data: teacher } = await supabase.from('profiles').select('role').eq('id', teacherId).maybeSingle();
  if (teacher?.role !== 'teacher' || grade < 1 || grade > 6) return;
  await supabase.from('teacher_assignments').upsert({ teacher_id: teacherId, grade, class_name: className, school_year: new Date().getFullYear() });
  revalidatePath('/dashboard/relationships');
}
