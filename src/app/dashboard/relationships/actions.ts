'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function relationshipRedirect(kind: 'message' | 'error', message: string): never {
  redirect(`/dashboard/relationships?${kind}=${encodeURIComponent(message)}`);
}

async function adminClient() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) return null;
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', data.claims.sub).maybeSingle();
  return profile?.role === 'admin' && profile.is_active ? supabase : null;
}

export async function linkStudentAccount(formData: FormData) {
  const supabase = await adminClient(); if (!supabase) relationshipRedirect('error', '관리자 권한이 필요합니다.');
  const studentId = String(formData.get('student_id') ?? '');
  const profileId = String(formData.get('profile_id') ?? '') || null;
  if (profileId) {
    const { data: assignedRole } = await supabase.from('user_roles').select('role').eq('user_id', profileId).eq('role', 'student').maybeSingle();
    if (!assignedRole) relationshipRedirect('error', '학생 권한 계정만 연결할 수 있습니다.');
  }
  const { data: student } = await supabase.from('students').select('full_name').eq('id', studentId).maybeSingle();
  if (!student) relationshipRedirect('error', '연결할 학생을 찾을 수 없습니다.');
  const { error } = await supabase.from('students').update({ profile_id: profileId }).eq('id', studentId);
  if (error) relationshipRedirect('error', error.code === '23505' ? '이 계정은 이미 다른 학생에게 연결되어 있습니다.' : `학생 계정을 연결하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/relationships');
  relationshipRedirect('message', profileId ? `${student.full_name} 학생의 로그인 계정을 연결했습니다.` : `${student.full_name} 학생의 계정 연결을 해제했습니다.`);
}

export async function createAndLinkStudent(formData: FormData) {
  const supabase = await adminClient(); if (!supabase) relationshipRedirect('error', '관리자 권한이 필요합니다.');
  const profileId = String(formData.get('profile_id') ?? '');
  const grade = Number(formData.get('grade'));
  if (!profileId || !Number.isInteger(grade) || grade < 1 || grade > 6) relationshipRedirect('error', '학생 계정과 학년을 확인해 주세요.');
  const [{ data: profile }, { data: assignedRole }] = await Promise.all([supabase.from('profiles').select('full_name').eq('id', profileId).maybeSingle(), supabase.from('user_roles').select('role').eq('user_id', profileId).eq('role', 'student').maybeSingle()]);
  if (!profile || !assignedRole) relationshipRedirect('error', '학생 권한 계정을 찾을 수 없습니다.');
  const { error } = await supabase.from('students').insert({ full_name: profile.full_name, grade, profile_id: profileId, is_active: true });
  if (error) relationshipRedirect('error', error.code === '23505' ? '이미 학생 명단에 연결된 계정입니다.' : `학생 명단을 생성하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/relationships');
  revalidatePath('/dashboard/students');
  relationshipRedirect('message', `${profile.full_name} 학생을 ${grade}학년 명단에 추가하고 계정을 연결했습니다.`);
}

export async function linkParent(formData: FormData) {
  const supabase = await adminClient(); if (!supabase) relationshipRedirect('error', '관리자 권한이 필요합니다.');
  const studentId = String(formData.get('student_id') ?? '');
  const parentId = String(formData.get('parent_id') ?? '');
  const relationship = String(formData.get('relationship') ?? '').trim();
  if (!['부', '모', '조부', '조모'].includes(relationship)) relationshipRedirect('error', '자녀와의 관계를 부, 모, 조부, 조모 중에서 선택해 주세요.');
  const { data: parentRole } = await supabase.from('user_roles').select('role').eq('user_id', parentId).eq('role', 'parent').maybeSingle();
  if (!parentRole) relationshipRedirect('error', '부모 권한 계정을 찾을 수 없습니다.');
  const { data: student } = await supabase.from('students').select('full_name').eq('id', studentId).eq('is_active', true).maybeSingle();
  if (!student) relationshipRedirect('error', '연결할 학생을 찾을 수 없습니다.');
  const { error } = await supabase.from('student_guardians').upsert({ student_id: studentId, parent_id: parentId, relationship, is_primary: true });
  if (error) relationshipRedirect('error', `자녀를 연결하지 못했습니다. (${error.message})`);
  await supabase.from('students').update({ primary_parent_id: parentId }).eq('id', studentId).is('primary_parent_id', null);
  revalidatePath('/dashboard/relationships');
  relationshipRedirect('message', `${student.full_name} 학생을 부모 계정에 연결했습니다.`);
}

export async function assignTeacher(formData: FormData) {
  const supabase = await adminClient(); if (!supabase) relationshipRedirect('error', '관리자 권한이 필요합니다.');
  const teacherId = String(formData.get('teacher_id') ?? '');
  const grade = Number(formData.get('grade'));
  const className = String(formData.get('class_name') ?? '').trim() || '전체';
  const { data: teacherRole } = await supabase.from('user_roles').select('role').eq('user_id', teacherId).eq('role', 'teacher').maybeSingle();
  if (!teacherRole || grade < 1 || grade > 6) relationshipRedirect('error', '선생님 계정과 학년을 확인해 주세요.');
  const { data: teacher } = await supabase.from('profiles').select('full_name').eq('id', teacherId).maybeSingle();
  const { error } = await supabase.from('teacher_assignments').upsert({ teacher_id: teacherId, grade, class_name: className, school_year: new Date().getFullYear() });
  if (error) relationshipRedirect('error', `담임반을 연결하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/relationships');
  relationshipRedirect('message', `${teacher?.full_name ?? '선생님'}을 ${grade}학년 ${className}에 연결했습니다.`);
}

export async function updateParentProfile(formData: FormData) {
  const supabase = await adminClient(); if (!supabase) relationshipRedirect('error', '관리자 권한이 필요합니다.');
  const parentId = String(formData.get('parent_id') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim() || null;
  if (!parentId || !fullName || fullName.length > 50) relationshipRedirect('error', '부모님 이름을 확인해 주세요.');
  const { data: parentRole } = await supabase.from('user_roles').select('role').eq('user_id', parentId).eq('role', 'parent').maybeSingle();
  if (!parentRole) relationshipRedirect('error', '부모 권한 계정을 찾을 수 없습니다.');
  const { error } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', parentId);
  if (error) relationshipRedirect('error', `부모 정보를 수정하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/relationships');
  relationshipRedirect('message', `${fullName} 부모님의 정보를 저장했습니다.`);
}

export async function uploadRelationshipPhoto(formData: FormData) {
  const supabase = await adminClient(); if (!supabase) relationshipRedirect('error', '관리자 권한이 필요합니다.');
  const targetId = String(formData.get('target_id') ?? '');
  const targetKind = String(formData.get('target_kind') ?? '');
  const photo = formData.get('photo');
  if (!['student', 'teacher'].includes(targetKind) || !(photo instanceof File) || photo.size === 0) relationshipRedirect('error', '사진과 대상을 확인해 주세요.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) relationshipRedirect('error', '사진은 JPG, PNG, WEBP 형식만 등록할 수 있습니다.');
  if (photo.size > 5 * 1024 * 1024) relationshipRedirect('error', '사진은 5MB 이하로 선택해 주세요.');
  const table = targetKind === 'student' ? 'students' : 'profiles';
  if (targetKind === 'teacher') {
    const { data: role } = await supabase.from('user_roles').select('role').eq('user_id', targetId).eq('role', 'teacher').maybeSingle();
    if (!role) relationshipRedirect('error', '선생님 권한 계정을 찾을 수 없습니다.');
  }
  const { data: target } = await supabase.from(table).select('full_name').eq('id', targetId).maybeSingle();
  if (!target) relationshipRedirect('error', '사진을 등록할 대상을 찾을 수 없습니다.');
  const path = `${targetKind === 'student' ? 'students' : 'teachers'}/${targetId}/face`;
  const { error: uploadError } = await supabase.storage.from('face-photos').upload(path, photo, { upsert: true, contentType: photo.type });
  if (uploadError) relationshipRedirect('error', `사진을 저장하지 못했습니다. (${uploadError.message})`);
  const { error } = await supabase.from(table).update({ photo_path: path }).eq('id', targetId);
  if (error) relationshipRedirect('error', `사진 정보를 저장하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/relationships'); revalidatePath('/dashboard/students'); revalidatePath('/dashboard/accounts');
  relationshipRedirect('message', `${target.full_name}님의 프로필 사진을 저장했습니다.`);
}
