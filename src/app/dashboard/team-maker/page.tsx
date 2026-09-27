import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '../dashboard-shell';
import { TeamMaker } from './team-maker';

export default async function TeamMakerPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', claimsData.claims.sub).maybeSingle();
  if (!profile?.is_active || profile.role !== 'admin') redirect('/dashboard');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const { data: event } = await supabase.from('attendance_events').select('id').eq('service_date', today).maybeSingle();
  const { data: records } = event
    ? await supabase.from('attendance_records').select('student_id, status, students(id, full_name, grade)').eq('event_id', event.id).in('status', ['present', 'late', 'excused'])
    : { data: [] };

  const attendees = (records ?? []).flatMap((record) => {
    const student = Array.isArray(record.students) ? record.students[0] : record.students;
    return student ? [{ id: student.id, name: student.full_name, grade: student.grade ?? 0 }] : [];
  });

  return <DashboardShell profile={{ full_name: profile.full_name, role: 'admin' }} activeHref="/dashboard/team-maker">
    <Link href="/dashboard" className="back-home-button"><span aria-hidden="true">←</span> 홈으로</Link>
    <div className="module-heading team-maker-heading"><div><p className="eyebrow">TODAY&apos;S TEAM</p><h1>오늘의 팀 나누기</h1><span>{today} 출석 인원 {attendees.length}명을 학년이 몰리지 않도록 나눕니다.</span></div></div>
    <TeamMaker attendees={attendees}/>
  </DashboardShell>;
}
