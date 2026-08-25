import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../dashboard-shell';
import { AttendanceManager } from './attendance-manager';

const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export default async function AttendancePage({ searchParams }: PageProps<'/dashboard/attendance'>) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle();
  if (!profile || !['admin','teacher'].includes(profile.role) || !profile.is_active) redirect('/dashboard');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const latestSunday = new Date(`${today}T00:00:00Z`);
  latestSunday.setUTCDate(latestSunday.getUTCDate() - latestSunday.getUTCDay());
  const defaultDate = latestSunday.toISOString().slice(0, 10);
  const selectedDate = validDate(params.date) ? params.date : defaultDate;
  const isSunday = new Date(`${selectedDate}T00:00:00Z`).getUTCDay() === 0;

  const [{ data: event }, { data: students }] = await Promise.all([
    supabase.from('attendance_events').select('id, service_date, title, opens_at, closes_at').eq('service_date', selectedDate).maybeSingle(),
    supabase.from('students').select('id, full_name, grade, class_name').eq('is_active', true).order('grade').order('full_name'),
  ]);
  const { data: records } = event ? await supabase.from('attendance_records').select('student_id, status, checked_at').eq('event_id', event.id) : { data: [] };

  return <DashboardShell profile={{ full_name: profile.full_name, role: profile.role as AppRole }} activeHref="/dashboard/attendance">
    <div className="module-heading"><div><p className="eyebrow">ATTENDANCE</p><h1>주일 출석관리</h1><span>{selectedDate} 출석 현황 · {event ? event.title : '아직 등록된 출석 없음'}</span></div>{profile.role === 'admin' && <Link className="module-primary-link" href="/dashboard/attendance/qr">출석 QR 화면</Link>}</div>
    <form className="attendance-date-picker" method="get"><label htmlFor="attendanceDate"><span>조회·등록 날짜</span><input id="attendanceDate" name="date" type="date" defaultValue={selectedDate} max={today}/></label><button type="submit">해당 날짜 조회</button><Link href={`/dashboard/attendance?date=${defaultDate}`}>최근 주일</Link>{!isSunday && <p>선택한 날짜는 일요일이 아닙니다. 입력은 가능하지만 홈 출석 그래프에는 일요일 기록만 집계됩니다.</p>}</form>
    <AttendanceManager eventId={event?.id ?? null} serviceDate={selectedDate} initialStudents={students ?? []} initialRecords={records ?? []}/>
  </DashboardShell>;
}
