import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../dashboard-shell';
import { PlansCalendar, type Plan } from './plans-calendar';
import { getKoreanHolidays } from '@/lib/korean-holidays';

export default async function PlansPage({ searchParams }: PageProps<'/dashboard/plans'>) {
  const params=await searchParams; const supabase=await createClient(); const {data}=await supabase.auth.getClaims(); if(!data?.claims?.sub) redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,role,is_active').eq('id',data.claims.sub).maybeSingle();
  if(!profile?.is_active || !['admin','teacher'].includes(profile.role)) redirect('/dashboard');
  const [{data:rows,error},{data:students},{data:teacherRoles}]=await Promise.all([
    supabase.from('weekly_plans').select('id,schedule_date,schedule_time,title,details,created_by,created_at,updated_at').order('schedule_date').order('schedule_time').limit(1000),
    supabase.from('students').select('id,full_name,birth_date').eq('is_active',true).not('birth_date','is',null),
    supabase.from('user_roles').select('user_id').eq('role','teacher'),
  ]);
  const creatorIds=[...new Set((rows??[]).map(row=>row.created_by))];
  const teacherIds=[...new Set((teacherRoles??[]).map(row=>row.user_id))];
  const [{data:creators},{data:teachers}]=await Promise.all([
    creatorIds.length?supabase.from('profiles').select('id,full_name').in('id',creatorIds):Promise.resolve({data:[]}),
    teacherIds.length?supabase.from('profiles').select('id,full_name,birth_date').in('id',teacherIds).eq('is_active',true).not('birth_date','is',null):Promise.resolve({data:[]}),
  ]);
  const names=new Map((creators??[]).map(item=>[item.id,item.full_name]));
  const manualPlans:Plan[]=(rows??[]).map(row=>({...row,creator_name:names.get(row.created_by)??'교역자',kind:'manual',editable:true}));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
  const currentYear=Number(today.slice(0,4)); const years=Array.from({length:7},(_,index)=>currentYear-2+index);
  const birthdayPlans:Plan[]=years.flatMap(year=>[
    ...(students??[]).map(person=>({id:`birthday-student-${person.id}-${year}`,schedule_date:`${year}-${person.birth_date!.slice(5)}`,schedule_time:null,title:`🎂 ${person.full_name} 학생 생일`,details:`${person.full_name} 학생의 생일입니다.`,created_at:'',updated_at:'',creator_name:'자동 등록',kind:'birthday' as const,editable:false})),
    ...(teachers??[]).map(person=>({id:`birthday-teacher-${person.id}-${year}`,schedule_date:`${year}-${person.birth_date!.slice(5)}`,schedule_time:null,title:`🎂 ${person.full_name} 선생님 생일`,details:`${person.full_name} 선생님의 생일입니다.`,created_at:'',updated_at:'',creator_name:'자동 등록',kind:'birthday' as const,editable:false})),
  ]);
  const holidayPlans:Plan[]=years.flatMap(year=>getKoreanHolidays(year).map((day,index)=>({id:`holiday-${year}-${index}-${day.date}`,schedule_date:day.date,schedule_time:null,title:`🇰🇷 ${day.name}`,details:'대한민국 국가 공휴일입니다.',created_at:'',updated_at:'',creator_name:'공휴일 자동 등록',kind:'holiday' as const,editable:false})));
  const plans=[...manualPlans,...birthdayPlans,...holidayPlans].sort((a,b)=>a.schedule_date.localeCompare(b.schedule_date));
  return <DashboardShell profile={{full_name:profile.full_name,role:profile.role as AppRole}} activeHref="/dashboard/plans"><div className="module-heading"><div><p className="eyebrow">PLAN CALENDAR</p><h1>계획표</h1><span>공유 일정과 학생·선생님 생일, 대한민국 공휴일을 한눈에 확인합니다.</span></div></div>{typeof params.message==='string'&&<p className="form-alert success">{params.message}</p>}{typeof params.error==='string'&&<p className="form-alert error">{params.error}</p>}{error?<p className="form-alert error">계획표를 불러오지 못했습니다. {error.message}</p>:<PlansCalendar plans={plans} today={today}/>}</DashboardShell>;
}
