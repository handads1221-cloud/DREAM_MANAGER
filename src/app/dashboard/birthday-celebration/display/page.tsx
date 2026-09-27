import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BirthdayCelebrationDisplay } from './birthday-celebration-display';
import type { BirthdayPerson } from '../birthday-celebration-manager';

type SharedBirthday = { person_id: string; full_name: string; person_type: 'student' | 'teacher'; month_day: string };

export default async function BirthdayCelebrationDisplayPage({ searchParams }: PageProps<'/dashboard/birthday-celebration/display'>) {
  const params = await searchParams;
  const rawMonths = Array.isArray(params.months) ? params.months[0] : params.months;
  const months = [...new Set(String(rawMonths ?? '').split(',').map(Number).filter((month) => Number.isInteger(month) && month >= 1 && month <= 12))].sort((a, b) => a - b);
  if (!months.length) redirect('/dashboard/birthday-celebration');
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect('/login');
  const [{ data: profile }, { data: birthdays }] = await Promise.all([
    supabase.from('profiles').select('role, is_active').eq('id', claimsData.claims.sub).maybeSingle(),
    supabase.rpc('get_shared_birthdays'),
  ]);
  if (!profile?.is_active || profile.role !== 'admin') redirect('/dashboard');
  const people: BirthdayPerson[] = ((birthdays ?? []) as SharedBirthday[]).filter((person) => months.includes(Number(person.month_day.slice(0, 2)))).sort((a, b) => a.month_day.localeCompare(b.month_day) || a.full_name.localeCompare(b.full_name, 'ko')).map((person) => ({ id: person.person_id, fullName: person.full_name, personType: person.person_type, monthDay: person.month_day }));
  if (!people.length) redirect('/dashboard/birthday-celebration');
  return <BirthdayCelebrationDisplay people={people} months={months}/>;
}
