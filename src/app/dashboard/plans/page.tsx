import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../dashboard-shell';
import { PlansCalendar, type Plan } from './plans-calendar';
import { getKoreanHolidays } from '@/lib/korean-holidays';

type SharedBirthday = { person_id:string; full_name:string; person_type:'student'|'teacher'; month_day:string };

export default async function PlansPage({ searchParams }: PageProps<'/dashboard/plans'>) {
  const params=await searchParams; const supabase=await createClient(); const {data}=await supabase.auth.getClaims(); if(!data?.claims?.sub) redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,role,is_active').eq('id',data.claims.sub).maybeSingle();
  if(!profile?.is_active || !['admin','teacher','parent','student'].includes(profile.role)) redirect('/dashboard');
  const canEdit=['admin','teacher'].includes(profile.role);
  const [{data:rows,error},{data:birthdays,error:birthdaysError}]=await Promise.all([
    supabase.from('weekly_plans').select('id,schedule_date,schedule_time,title,details,created_by,created_at,updated_at').order('schedule_date').order('schedule_time').limit(1000),
    supabase.rpc('get_shared_birthdays'),
  ]);
  const creatorIds=[...new Set((rows??[]).map(row=>row.created_by))];
  const {data:creators}=creatorIds.length?await supabase.from('profiles').select('id,full_name').in('id',creatorIds):{data:[]};
  const names=new Map((creators??[]).map(item=>[item.id,item.full_name]));
  const manualPlans:Plan[]=(rows??[]).map(row=>({...row,creator_name:names.get(row.created_by)??'교역자',kind:'manual',editable:canEdit}));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
  const currentYear=Number(today.slice(0,4)); const years=Array.from({length:7},(_,index)=>currentYear-2+index);
  const birthdayPlans:Plan[]=years.flatMap(year=>[
    ...((birthdays??[]) as SharedBirthday[]).map(person=>({id:`birthday-${person.person_type}-${person.person_id}-${year}`,schedule_date:`${year}-${person.month_day}`,schedule_time:null,title:`🎂 ${person.full_name} ${person.person_type==='teacher'?'선생님':'학생'} 생일`,details:`${person.full_name} ${person.person_type==='teacher'?'선생님':'학생'}의 생일입니다.`,created_at:'',updated_at:'',creator_name:'자동 등록',kind:'birthday' as const,editable:false})),
  ]);
  const holidayPlans:Plan[]=years.flatMap(year=>getKoreanHolidays(year).map((day,index)=>({id:`holiday-${year}-${index}-${day.date}`,schedule_date:day.date,schedule_time:null,title:`🇰🇷 ${day.name}`,details:'대한민국 국가 공휴일입니다.',created_at:'',updated_at:'',creator_name:'공휴일 자동 등록',kind:'holiday' as const,editable:false})));
  const plans=[...manualPlans,...birthdayPlans,...holidayPlans].sort((a,b)=>a.schedule_date.localeCompare(b.schedule_date));
  return <DashboardShell profile={{full_name:profile.full_name,role:profile.role as AppRole}} activeHref="/dashboard/plans"><div className="module-heading"><div><p className="eyebrow">PLAN CALENDAR</p><h1>계획표</h1><span>공유 일정과 학생·선생님 생일, 대한민국 공휴일을 한눈에 확인합니다.</span></div></div>{typeof params.message==='string'&&<p className="form-alert success">{params.message}</p>}{typeof params.error==='string'&&<p className="form-alert error">{params.error}</p>}{error?<p className="form-alert error">계획표를 불러오지 못했습니다. {error.message}</p>:birthdaysError?<p className="form-alert error">생일 일정을 불러오지 못했습니다. {birthdaysError.message}</p>:<PlansCalendar plans={plans} today={today} canEdit={canEdit}/>}</DashboardShell>;
}
