import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../dashboard-shell';
import { addLedgerEntry } from './actions';
import { LedgerRowActions } from './ledger-row-actions';

const categories = ['주정헌금', '십일조', '감사헌금', '선교헌금', '교회재정', '행사비', '식비', '물품비', '기타'];
type LedgerRow = { id: string; transaction_date: string; entry_type: string; category: string; amount: number; memo: string | null };

function withRunningBalances(rows: LedgerRow[]) {
  let runningBalance = 0;
  return rows.map((row) => {
    runningBalance += row.entry_type === 'income' ? Number(row.amount) : -Number(row.amount);
    return { ...row, runningBalance };
  });
}

export default async function FinancePage({ searchParams }: PageProps<'/dashboard/finance'>) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('full_name,role,is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || !['admin', 'accountant'].includes(profile.role)) redirect('/dashboard');

  const today = new Date().toISOString().slice(0, 10);
  const defaultFrom = `${today.slice(0, 7)}-01`;
  const from = typeof params.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.from) ? params.from : defaultFrom;
  const to = typeof params.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.to) ? params.to : today;
  const { data } = await supabase.from('finance_ledger').select('id,transaction_date,entry_type,category,amount,memo').is('cancelled_at', null).order('transaction_date', { ascending: true }).order('created_at', { ascending: true });
  const all = withRunningBalances((data ?? []) as LedgerRow[]);
  const balance = all.at(-1)?.runningBalance ?? 0;
  const rows = all.filter((row) => row.transaction_date >= from && row.transaction_date <= to).reverse();

  return <DashboardShell profile={{ full_name: profile.full_name, role: profile.role as AppRole }} activeHref="/dashboard/finance">
    <div className="module-heading finance-heading">
      <div><p className="eyebrow">FINANCE LEDGER</p><h1>회계장부</h1><span>수입·지출과 현재 잔액을 확인합니다.</span></div>
      <div className="finance-heading-actions"><strong>{balance.toLocaleString()}원</strong><Link href="/dashboard/finance/requests">결제요청 관리 →</Link></div>
    </div>
    {typeof params.message === 'string' ? <p className="form-alert success">{params.message}</p> : null}
    {typeof params.error === 'string' ? <p className="form-alert error">{params.error}</p> : null}
    <div className="finance-tools">
      <form className="finance-date-filter"><label>시작일<input aria-label="조회 시작일" type="date" name="from" defaultValue={from}/></label><label>종료일<input aria-label="조회 종료일" type="date" name="to" defaultValue={to}/></label><button>기간 조회</button></form>
      <details><summary>수입·지출 등록</summary><form action={addLedgerEntry}>
        <input aria-label="거래 일자" type="date" name="transaction_date" defaultValue={new Date().toISOString().slice(0, 10)} required/>
        <select aria-label="거래 유형" name="entry_type"><option value="income">수입</option><option value="expense">지출</option></select>
        <select aria-label="비목" name="category">{categories.map((category) => <option key={category}>{category}</option>)}</select>
        <input aria-label="금액" name="amount" type="number" min="1" placeholder="금액" required/>
        <input aria-label="메모" name="memo" placeholder="메모(선택)"/><button>등록</button>
      </form></details>
    </div>
    <div className="finance-table">
      <div className="finance-row head"><b>일자</b><b>유형</b><b>비목</b><b>금액</b><b>잔액</b><b>메모 수정</b><b>삭제</b></div>
      {rows.map((row) => <div className="finance-row" key={row.id}><span>{row.transaction_date}</span><b className={row.entry_type}>{row.entry_type === 'income' ? '수입' : '지출'}</b><span>{row.category}</span><strong>{row.entry_type === 'income' ? '+' : '-'}{Number(row.amount).toLocaleString()}원</strong><strong>{row.runningBalance.toLocaleString()}원</strong><LedgerRowActions id={row.id} memo={row.memo}/></div>)}
      {rows.length === 0 ? <p className="finance-empty">선택한 기간에 등록된 장부 내역이 없습니다.</p> : null}
    </div>
  </DashboardShell>;
}
