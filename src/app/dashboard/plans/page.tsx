import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../dashboard-shell';
import { PlansCalendar, type Plan } from './plans-calendar';

export default async function PlansPage({ searchParams }: PageProps<'/dashboard/plans'>) {
  const params=await searchParams; const supabase=await createClient(); const {data}=await supabase.auth.getClaims(); if(!data?.claims?.sub) redirect('/login');
  const {data:profile}=await supabase.from('profiles').select('full_name,role,is_active').eq('id',data.claims.sub).maybeSingle();
  if(!profile?.is_active || !['admin','teacher'].includes(profile.role)) redirect('/dashboard');
  const {data:rows,error}=await supabase.from('weekly_plans').select('id,schedule_date,schedule_time,title,details,created_by,created_at,updated_at').order('schedule_date').order('schedule_time').limit(1000);
  const creatorIds=[...new Set((rows??[]).map(row=>row.created_by))]; const {data:creators}=creatorIds.length?await supabase.from('profiles').select('id,full_name').in('id',creatorIds):{data:[]}; const names=new Map((creators??[]).map(item=>[item.id,item.full_name]));
  const plans:Plan[]=(rows??[]).map(row=>({...row,creator_name:names.get(row.created_by)??'교역자'})); const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
  return <DashboardShell profile={{full_name:profile.full_name,role:profile.role as AppRole}} activeHref="/dashboard/plans"><div className="module-heading"><div><p className="eyebrow">WEEKLY PLAN</p><h1>주차별 계획표</h1><span>관리자와 선생님이 함께 일정을 등록하고 공유합니다.</span></div></div>{typeof params.message==='string'&&<p className="form-alert success">{params.message}</p>}{typeof params.error==='string'&&<p className="form-alert error">{params.error}</p>}{error?<p className="form-alert error">계획표를 불러오지 못했습니다. {error.message}</p>:<PlansCalendar plans={plans} today={today}/>}</DashboardShell>;
}
