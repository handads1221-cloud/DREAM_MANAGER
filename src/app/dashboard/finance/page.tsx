import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../dashboard-shell';
import { addLedgerEntry } from './actions';

export default async function FinancePage({ searchParams }: PageProps<'/dashboard/finance'>) {
  const params = await searchParams; const supabase = await createClient(); const { data: claims } = await supabase.auth.getClaims(); const userId = claims?.claims?.sub;
  if (!userId) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name,role,is_active').eq('id', userId).maybeSingle();
  if (!profile?.is_active || !['admin','accountant'].includes(profile.role)) redirect('/dashboard');
  const month = typeof params.month === 'string' ? params.month : new Date().toISOString().slice(0,7); const from = `${month}-01`; const to = new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 1).toISOString().slice(0,10);
  const { data } = await supabase.from('finance_ledger').select('id,transaction_date,entry_type,category,amount,memo').order('transaction_date',{ascending:false});
  const all=data??[], rows=all.filter(r=>r.transaction_date>=from&&r.transaction_date<to), balance=all.reduce((n,r)=>n+(r.entry_type==='income'?Number(r.amount):-Number(r.amount)),0);
  return <DashboardShell profile={{full_name:profile.full_name,role:profile.role as AppRole}} activeHref="/dashboard/finance"><div className="module-heading"><div><p className="eyebrow">FINANCE LEDGER</p><h1>회계장부</h1><span>수입·지출과 현재 잔액을 확인합니다.</span></div><strong>{balance.toLocaleString()}원</strong></div>{typeof params.message==='string'?<p className="form-alert success">{params.message}</p>:null}{typeof params.error==='string'?<p className="form-alert error">{params.error}</p>:null}<div className="finance-tools"><form><input type="month" name="month" defaultValue={month}/><button>조회</button></form>{profile.role==='accountant'?<details><summary>수입·지출 등록</summary><form action={addLedgerEntry}><input type="date" name="transaction_date" defaultValue={new Date().toISOString().slice(0,10)} required/><select name="entry_type"><option value="income">수입</option><option value="expense">지출</option></select><select name="category">{['주정헌금','십일조','감사헌금','선교헌금','교회재정','행사비','식비','물품비','기타'].map(x=><option key={x}>{x}</option>)}</select><input name="amount" type="number" min="1" placeholder="금액" required/><input name="memo" placeholder="메모(선택)"/><button>등록</button></form></details>:null}</div><div className="finance-table"><div className="finance-row head"><b>일자</b><b>유형</b><b>비목</b><b>금액</b><b>메모</b></div>{rows.map(r=><div className="finance-row" key={r.id}><span>{r.transaction_date}</span><b className={r.entry_type}>{r.entry_type==='income'?'수입':'지출'}</b><span>{r.category}</span><strong>{r.entry_type==='income'?'+':'-'}{Number(r.amount).toLocaleString()}원</strong><span>{r.memo||'-'}</span></div>)}</div></DashboardShell>;
}
