'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { CreateStudentResult, DeleteStudentResult, Student, UpdateStudentResult } from './types';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const valueOrNull = (value: FormDataEntryValue | null) => {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
};

async function getAdminClient() {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return null;
  const { data: profile } = await supabase.from('profiles').select('role, is_active').eq('id', userId).maybeSingle();
  return profile?.role === 'admin' && profile.is_active ? supabase : null;
}

function studentValues(formData: FormData) {
  return {
    full_name: String(formData.get('full_name') ?? '').trim(),
    grade: Number(formData.get('grade')),
    class_name: valueOrNull(formData.get('class_name')),
    phone: valueOrNull(formData.get('phone')),
    address: valueOrNull(formData.get('address')),
    school_name: valueOrNull(formData.get('school_name')),
    birth_date: valueOrNull(formData.get('birth_date')),
    gender: valueOrNull(formData.get('gender')),
    primary_parent_id: valueOrNull(formData.get('primary_parent_id')),
    note: valueOrNull(formData.get('note')),
  };
}

function validateStudent(values: ReturnType<typeof studentValues>) {
  if (!values.full_name || values.full_name.length > 50) return '이름은 1~50자로 입력해 주세요.';
  if (!Number.isInteger(values.grade) || values.grade < 1 || values.grade > 6) return '학년은 1~6학년 중에서 선택해 주세요.';
  if (values.birth_date && (values.birth_date < '1900-01-01' || values.birth_date > new Date().toISOString().slice(0, 10))) return '생년월일을 올바르게 입력해 주세요.';
  if (values.gender && !['male','female'].includes(values.gender)) return '성별은 남 또는 여 중에서 선택해 주세요.';
  if (values.primary_parent_id && !uuidPattern.test(values.primary_parent_id)) return '부모 계정 ID는 UUID 형식이어야 합니다.';
  return null;
}

function validatePhoto(photo: FormDataEntryValue | null) {
  if (!(photo instanceof File) || photo.size === 0) return null;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) return '얼굴 사진은 JPG, PNG, WEBP 형식만 등록할 수 있습니다.';
  if (photo.size > 5 * 1024 * 1024) return '얼굴 사진은 5MB 이하로 선택해 주세요.';
  return null;
}

async function saveStudentPhoto(supabase: NonNullable<Awaited<ReturnType<typeof getAdminClient>>>, studentId: string, photo: FormDataEntryValue | null) {
  if (!(photo instanceof File) || photo.size === 0) return { path: null, url: null, error: null };
  const path = `students/${studentId}/face`;
  const { error } = await supabase.storage.from('face-photos').upload(path, photo, { upsert: true, contentType: photo.type });
  if (error) return { path: null, url: null, error: `얼굴 사진을 저장하지 못했습니다. (${error.message})` };
  const { error: updateError } = await supabase.from('students').update({ photo_path: path }).eq('id', studentId);
  if (updateError) return { path: null, url: null, error: `얼굴 사진 정보를 저장하지 못했습니다. (${updateError.message})` };
  const { data: signed } = await supabase.storage.from('face-photos').createSignedUrl(path, 3600);
  return { path, url: signed?.signedUrl ?? null, error: null };
}

export async function createStudent(formData: FormData): Promise<CreateStudentResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, message: '관리자 권한이 필요하거나 로그인이 만료되었습니다.' };
  const values = studentValues(formData); const validation = validateStudent(values);
  if (validation) return { ok: false, message: validation };
  const photo = formData.get('photo'); const photoValidation = validatePhoto(photo);
  if (photoValidation) return { ok: false, message: photoValidation };
  const { data, error } = await supabase.from('students').insert({ ...values, is_active: true }).select('id, full_name, grade, class_name, phone, address, school_name, birth_date, gender, primary_parent_id, note, is_active, photo_path').single();
  if (error) return { ok: false, message: error.code === '23503' ? '연결할 부모 계정을 찾을 수 없습니다.' : `학생을 추가하지 못했습니다. (${error.message})` };
  const savedPhoto = await saveStudentPhoto(supabase, data.id, photo);
  const student = { ...data, photo_path: savedPhoto.path ?? data.photo_path, photo_url: savedPhoto.url } as Student;
  revalidatePath('/dashboard/students');
  revalidatePath('/dashboard/relationships');
  return { ok: true, student, message: savedPhoto.error ? `${values.full_name} 학생은 추가했지만 ${savedPhoto.error}` : `${values.full_name} 학생을 ${values.grade}학년 명단에 추가했습니다.` };
}

export async function deleteStudent(formData: FormData): Promise<DeleteStudentResult> {
  const supabase = await getAdminClient();
  if (!supabase) return { ok: false, message: '관리자 권한이 필요하거나 로그인이 만료되었습니다.' };
  const id = String(formData.get('id') ?? '');
  if (!uuidPattern.test(id)) return { ok: false, message: '학생 식별정보가 올바르지 않습니다.' };
  const { data, error } = await supabase.from('students').update({ is_active: false, profile_id: null }).eq('id', id).select('full_name').single();
  if (error) return { ok: false, message: `학생을 명단에서 삭제하지 못했습니다. (${error.message})` };
  revalidatePath('/dashboard/students');
  revalidatePath('/dashboard/relationships');
  return { ok: true, id, message: `${data.full_name} 학생을 현재 명단에서 삭제했습니다. 기존 출석·보석 기록은 보존됩니다.` };
}

export async function updateStudent(formData: FormData): Promise<UpdateStudentResult> {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return { ok: false, message: '로그인이 만료되었습니다. 다시 로그인해 주세요.' };

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', userId)
    .maybeSingle();

  if (!adminProfile || adminProfile.role !== 'admin' || !adminProfile.is_active) {
    return { ok: false, message: '관리자만 학생 정보를 수정할 수 있습니다.' };
  }

  const id = String(formData.get('id') ?? '');
  const photo = formData.get('photo');
  const fullName = String(formData.get('full_name') ?? '').trim();
  const grade = Number(formData.get('grade'));
  const primaryParentId = valueOrNull(formData.get('primary_parent_id'));
  const birthDate = valueOrNull(formData.get('birth_date'));
  const gender = valueOrNull(formData.get('gender'));

  if (!uuidPattern.test(id)) return { ok: false, message: '학생 식별정보가 올바르지 않습니다.' };
  if (!fullName || fullName.length > 50) return { ok: false, message: '이름은 1~50자로 입력해 주세요.' };
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) return { ok: false, message: '학년은 1~6학년 중에서 선택해 주세요.' };
  if (primaryParentId && !uuidPattern.test(primaryParentId)) {
    return { ok: false, message: '부모 계정 ID는 UUID 형식이어야 합니다.' };
  }
  if (birthDate && (birthDate < '1900-01-01' || birthDate > new Date().toISOString().slice(0, 10))) return { ok: false, message: '생년월일을 올바르게 입력해 주세요.' };
  if (gender && !['male','female'].includes(gender)) return { ok: false, message: '성별은 남 또는 여 중에서 선택해 주세요.' };
  const photoValidation = validatePhoto(photo);
  if (photoValidation) return { ok: false, message: photoValidation };

  const updates = {
    full_name: fullName,
    grade,
    class_name: valueOrNull(formData.get('class_name')),
    phone: valueOrNull(formData.get('phone')),
    address: valueOrNull(formData.get('address')),
    school_name: valueOrNull(formData.get('school_name')),
    birth_date: birthDate,
    gender,
    primary_parent_id: primaryParentId,
    note: valueOrNull(formData.get('note')),
    is_active: formData.get('is_active') === 'on',
  };

  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select('id, full_name, grade, class_name, phone, address, school_name, birth_date, gender, primary_parent_id, note, is_active, photo_path')
    .single();

  if (error) {
    return { ok: false, message: error.code === '23503' ? '연결할 부모 계정을 찾을 수 없습니다.' : '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  const savedPhoto = await saveStudentPhoto(supabase, id, photo);
  let photoUrl: string | null = null;
  const photoPath = savedPhoto.path ?? data.photo_path;
  if (photoPath && !savedPhoto.url) {
    const { data: signed } = await supabase.storage.from('face-photos').createSignedUrl(photoPath, 3600);
    photoUrl = signed?.signedUrl ?? null;
  }
  revalidatePath('/dashboard/students');
  return { ok: true, student: { ...data, photo_path: photoPath, photo_url: savedPhoto.url ?? photoUrl } as Student, message: savedPhoto.error ? `학생 정보는 저장했지만 ${savedPhoto.error}` : `${fullName} 학생 정보를 저장했습니다.` };
}
