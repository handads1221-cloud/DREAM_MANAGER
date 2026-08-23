import { redirect } from 'next/navigation'; import { createClient } from '@/lib/supabase/server'; import { DashboardShell, type AppRole } from '../dashboard-shell'; import { PointsManager } from './points-manager';

export default async function PointsPage() {
  const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); if (!data?.claims?.sub) redirect('/login'); const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle(); if (!profile || !['admin','teacher'].includes(profile.role) || !profile.is_active) redirect('/dashboard');
  const [{ data: balances }, { data: transactions }] = await Promise.all([supabase.from('student_point_balances').select('student_id, full_name, grade, class_name, balance').order('grade').order('full_name'), supabase.from('point_transactions').select('id, student_id, amount, reason, created_at').order('created_at', { ascending: false }).limit(30)]); const nameMap = new Map((balances ?? []).map(s => [s.student_id, s.full_name])); const total = (balances ?? []).reduce((sum, student) => sum + Number(student.balance), 0);
  return <DashboardShell profile={{ full_name: profile.full_name, role: profile.role as AppRole }} activeHref="/dashboard/points"><div className="module-heading"><div><p className="eyebrow">DREAM GEM</p><h1>드림보석 관리</h1><span>학생에게 보석을 지급하거나 차감하고 전체 잔액을 확인합니다.</span></div><strong className="gem-heading-total">전체 {total}개</strong></div>
    <PointsManager initialBalances={(balances ?? []).map((student) => ({ ...student, balance: Number(student.balance) }))} />
    <section className="point-history"><h2>최근 지급 내역</h2>{(transactions ?? []).map(t => <div key={t.id}><span><b>{nameMap.get(t.student_id) ?? '학생'}</b> · {t.reason}</span><strong className={t.amount > 0 ? 'plus' : 'minus'}>{t.amount > 0 ? '+' : ''}{t.amount}</strong></div>)}</section>
  </DashboardShell>;
}
