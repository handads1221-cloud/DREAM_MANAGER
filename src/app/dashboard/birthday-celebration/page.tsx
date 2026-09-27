import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../dashboard-shell';
import { BirthdayCelebrationManager, type BirthdayPerson } from './birthday-celebration-manager';

type SharedBirthday = { person_id: string; full_name: string; person_type: 'student' | 'teacher'; month_day: string };

export default async function BirthdayCelebrationPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect('/login');
  const [{ data: profile }, { data: birthdays, error }] = await Promise.all([
    supabase.from('profiles').select('full_name, role, is_active').eq('id', claimsData.claims.sub).maybeSingle(),
    supabase.rpc('get_shared_birthdays'),
  ]);
  if (!profile?.is_active || profile.role !== 'admin') redirect('/dashboard');
  const people: BirthdayPerson[] = ((birthdays ?? []) as SharedBirthday[]).map((person) => ({ id: person.person_id, fullName: person.full_name, personType: person.person_type, monthDay: person.month_day }));
  const currentMonth = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(new Date()));
  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/birthday-celebration">
    <Link href="/dashboard" className="back-home-button"><span aria-hidden="true">←</span> 홈으로</Link>
    <div className="module-heading"><div><p className="eyebrow">BIRTHDAY CELEBRATION</p><h1>생일축하</h1><span>축하할 월을 선택하고 생일자 전체를 함께 축하해요.</span></div></div>
    {error ? <p className="form-alert error">생일자 명단을 불러오지 못했습니다. {error.message}</p> : <BirthdayCelebrationManager people={people} currentMonth={currentMonth}/>} 
  </DashboardShell>;
}
