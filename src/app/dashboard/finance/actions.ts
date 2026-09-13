'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const financeRoles = new Set(['admin', 'accountant']);

function go(path: string, type: 'message' | 'error', value: string): never {
  redirect(`${path}?${type}=${encodeURIComponent(value)}`);
}

async function getContext() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return null;
  const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id', id).maybeSingle();
  if (!profile?.is_active) return null;
  return { supabase, id, role: profile.role as string };
}

export async function addLedgerEntry(formData: FormData) {
  const context = await getContext();
  if (!context || !financeRoles.has(context.role)) go('/dashboard/finance', 'error', '관리자 또는 회계담당자만 등록할 수 있습니다.');
  const entryType = String(formData.get('entry_type'));
  const amount = Number(formData.get('amount'));
  const category = String(formData.get('category') ?? '').trim();
  const transactionDate = String(formData.get('transaction_date'));
  if (!['income', 'expense'].includes(entryType) || !category || !transactionDate || !Number.isSafeInteger(amount) || amount <= 0) go('/dashboard/finance', 'error', '유형·비목·일자·금액을 확인해 주세요.');
  const { error } = await context.supabase.from('finance_ledger').insert({ transaction_date: transactionDate, entry_type: entryType, category, amount, memo: String(formData.get('memo') ?? '').trim() || null, created_by: context.id });
  if (error) go('/dashboard/finance', 'error', error.message);
  revalidatePath('/dashboard/finance');
  go('/dashboard/finance', 'message', '장부에 등록했습니다.');
}

export async function createPaymentRequest(formData: FormData) {
  const context = await getContext();
  if (!context || context.role !== 'teacher') go('/dashboard/finance/requests', 'error', '선생님 계정에서 요청해 주세요.');
  const files = formData.getAll('receipts').filter((value): value is File => value instanceof File && value.size > 0);
  const amount = Number(formData.get('amount'));
  if (files.length > 5 || files.some((file) => file.size > 4 * 1024 * 1024) || !Number.isSafeInteger(amount) || amount <= 0) go('/dashboard/finance/requests', 'error', '금액과 영수증(최대 5장, 각 4MB)을 확인해 주세요.');
  const { data: request, error } = await context.supabase.from('payment_requests').insert({ requester_id: context.id, category: String(formData.get('category')), amount, bank_account: String(formData.get('bank_account')), memo: String(formData.get('memo') ?? '') || null }).select('id').single();
  if (error || !request) go('/dashboard/finance/requests', 'error', error?.message ?? '요청 저장 실패');
  for (const [index, file] of files.entries()) {
    const path = `${context.id}/${request.id}/${index}-${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await context.supabase.storage.from('finance-receipts').upload(path, file, { contentType: file.type });
    if (uploadError) go('/dashboard/finance/requests', 'error', `영수증 업로드 실패: ${uploadError.message}`);
    const { error: receiptError } = await context.supabase.from('payment_request_receipts').insert({ payment_request_id: request.id, storage_path: path, original_name: file.name });
    if (receiptError) go('/dashboard/finance/requests', 'error', `영수증 정보 저장 실패: ${receiptError.message}`);
  }
  revalidatePath('/dashboard/finance/requests');
  go('/dashboard/finance/requests', 'message', '결제요청을 등록했습니다.');
}

export async function processPaymentRequest(formData: FormData) {
  const context = await getContext();
  if (!context || !financeRoles.has(context.role)) go('/dashboard/finance/requests', 'error', '관리자 또는 회계담당자만 처리할 수 있습니다.');
  const { error } = await context.supabase.rpc('process_payment_request', { target_request_id: String(formData.get('request_id')), next_status: String(formData.get('status')), note: String(formData.get('review_note') ?? '') });
  if (error) go('/dashboard/finance/requests', 'error', error.message);
  revalidatePath('/dashboard/finance');
  revalidatePath('/dashboard/finance/requests');
  go('/dashboard/finance/requests', 'message', '처리상태를 변경했습니다.');
}
