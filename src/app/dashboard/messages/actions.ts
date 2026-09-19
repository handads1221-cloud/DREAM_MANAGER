'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type InquiryRole = 'admin' | 'parent';

async function requireInquiryUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('role, is_active, account_status').eq('id', userId).maybeSingle();
  if (!profile?.is_active || profile.account_status === 'withdrawn' || !['admin', 'parent'].includes(profile.role)) redirect('/dashboard');
  return { supabase, userId, role: profile.role as InquiryRole };
}

function messageRedirect(kind: 'message' | 'error', text: string, inquiryId?: string): never {
  const params = new URLSearchParams({ [kind]: text });
  if (inquiryId) params.set('id', inquiryId);
  redirect(`/dashboard/messages?${params.toString()}`);
}

export async function createInquiry(formData: FormData) {
  const { supabase, userId, role } = await requireInquiryUser();
  if (role !== 'parent') messageRedirect('error', '부모 계정에서만 새 문의를 작성할 수 있습니다.');
  const subject = String(formData.get('subject') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (subject.length < 2 || subject.length > 100) messageRedirect('error', '문의 제목은 2자 이상 100자 이하로 입력해 주세요.');
  if (body.length < 2 || body.length > 3000) messageRedirect('error', '문의 내용은 2자 이상 3,000자 이하로 입력해 주세요.');

  const { data: inquiry, error: inquiryError } = await supabase.from('inquiries').insert({ parent_id: userId, subject }).select('id').single();
  if (inquiryError || !inquiry) messageRedirect('error', `문의를 등록하지 못했습니다. (${inquiryError?.message ?? '문의 생성 실패'})`);
  const { error: messageError } = await supabase.from('inquiry_messages').insert({ inquiry_id: inquiry.id, sender_id: userId, body });
  if (messageError) messageRedirect('error', `문의 내용 저장에 실패했습니다. (${messageError.message})`, inquiry.id);
  revalidatePath('/dashboard/messages');
  revalidatePath('/dashboard');
  messageRedirect('message', '문의가 등록되었습니다. 관리자 답변은 이 화면에서 확인할 수 있습니다.', inquiry.id);
}

export async function sendInquiryMessage(formData: FormData) {
  const { supabase, userId, role } = await requireInquiryUser();
  const inquiryId = String(formData.get('inquiry_id') ?? '');
  const body = String(formData.get('body') ?? '').trim();
  if (!inquiryId) messageRedirect('error', '문의 대화를 찾을 수 없습니다.');
  if (body.length < 1 || body.length > 3000) messageRedirect('error', '메시지는 1자 이상 3,000자 이하로 입력해 주세요.', inquiryId);
  const { data: inquiry } = await supabase.from('inquiries').select('id, status').eq('id', inquiryId).maybeSingle();
  if (!inquiry) messageRedirect('error', '열람 권한이 없거나 존재하지 않는 문의입니다.');
  if (inquiry.status === 'closed' && role === 'parent') messageRedirect('error', '종료된 문의에는 메시지를 추가할 수 없습니다.', inquiryId);

  const { error } = await supabase.from('inquiry_messages').insert({ inquiry_id: inquiryId, sender_id: userId, body });
  if (error) messageRedirect('error', `메시지를 보내지 못했습니다. (${error.message})`, inquiryId);
  if (role === 'admin') await supabase.from('inquiries').update({ status: 'answered', assigned_admin_id: userId }).eq('id', inquiryId);
  revalidatePath('/dashboard/messages');
  messageRedirect('message', role === 'admin' ? '답변을 보냈습니다.' : '추가 메시지를 보냈습니다.', inquiryId);
}

export async function updateInquiryStatus(formData: FormData) {
  const { supabase, userId, role } = await requireInquiryUser();
  if (role !== 'admin') messageRedirect('error', '관리자만 문의 상태를 변경할 수 있습니다.');
  const inquiryId = String(formData.get('inquiry_id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!inquiryId || !['open', 'answered', 'closed'].includes(status)) messageRedirect('error', '변경할 문의 상태가 올바르지 않습니다.', inquiryId || undefined);
  const { error } = await supabase.from('inquiries').update({ status, assigned_admin_id: userId }).eq('id', inquiryId);
  if (error) messageRedirect('error', `문의 상태를 변경하지 못했습니다. (${error.message})`, inquiryId);
  revalidatePath('/dashboard/messages');
  messageRedirect('message', status === 'closed' ? '문의를 종료했습니다.' : '문의 상태를 변경했습니다.', inquiryId);
}
