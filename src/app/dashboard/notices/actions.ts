'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

async function getActiveAccount() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase.from('profiles').select('role, is_active, account_status').eq('id', userId).maybeSingle();
  if (!profile?.is_active || profile.account_status === 'withdrawn') return null;
  return { supabase, userId, role: profile.role };
}

function noticeRedirect(type: 'message' | 'error', message: string, id?: string): never {
  const query = new URLSearchParams({ [type]: message });
  if (id) query.set('id', id);
  redirect(`/dashboard/notices?${query.toString()}`);
}

function noticeInput(formData: FormData) {
  return {
    title: String(formData.get('title') ?? '').trim(),
    body: String(formData.get('body') ?? '').trim(),
    is_pinned: formData.get('is_pinned') === 'on',
    published_at: formData.get('is_published') === 'on' ? new Date().toISOString() : null,
  };
}

export async function createNotice(formData: FormData) {
  const account = await getActiveAccount();
  if (!account || account.role !== 'admin') noticeRedirect('error', '관리자 권한이 필요합니다.');
  const input = noticeInput(formData);
  if (!input.title || input.title.length > 100) noticeRedirect('error', '제목은 1~100자로 입력해 주세요.');
  if (!input.body || input.body.length > 10000) noticeRedirect('error', '내용은 1~10,000자로 입력해 주세요.');
  const { data, error } = await account.supabase.from('notices').insert({ ...input, created_by: account.userId }).select('id').single();
  if (error) noticeRedirect('error', `공지를 저장하지 못했습니다. (${error.message})`);
  revalidatePath('/dashboard/notices');
  noticeRedirect('message', input.published_at ? '공지를 게시했습니다.' : '공지를 임시저장했습니다.', data.id);
}

export async function updateNotice(formData: FormData) {
  const account = await getActiveAccount();
  if (!account || account.role !== 'admin') noticeRedirect('error', '관리자 권한이 필요합니다.');
  const id = String(formData.get('notice_id') ?? '');
  const input = noticeInput(formData);
  if (!id || !input.title || input.title.length > 100) noticeRedirect('error', '공지 제목을 확인해 주세요.', id);
  if (!input.body || input.body.length > 10000) noticeRedirect('error', '공지 내용을 확인해 주세요.', id);
  const { error } = await account.supabase.from('notices').update(input).eq('id', id);
  if (error) noticeRedirect('error', `공지를 수정하지 못했습니다. (${error.message})`, id);
  revalidatePath('/dashboard/notices');
  noticeRedirect('message', '공지 내용을 수정했습니다.', id);
}

export async function deleteNotice(formData: FormData) {
  const account = await getActiveAccount();
  if (!account || account.role !== 'admin') noticeRedirect('error', '관리자 권한이 필요합니다.');
  const id = String(formData.get('notice_id') ?? '');
  const { error } = await account.supabase.from('notices').delete().eq('id', id);
  if (error) noticeRedirect('error', `공지를 삭제하지 못했습니다. (${error.message})`, id);
  revalidatePath('/dashboard/notices');
  noticeRedirect('message', '공지를 삭제했습니다.');
}

export async function recordNoticeView(noticeId: string) {
  const account = await getActiveAccount();
  if (!account || !noticeId) return;
  await account.supabase.rpc('record_notice_view', { target_notice_id: noticeId });
}
