import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../../dashboard-shell';

type AwardFilter = 'all' | 'perfect' | 'good' | 'other';
type AttendanceRecord = { event_id: string; student_id: string; status: string };

const validYear = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2020 && parsed <= 2100 ? parsed : fallback;
};

const validFilter = (value: unknown): AwardFilter =>
  value === 'perfect' || value === 'good' || value === 'other' ? value : 'all';

const validGrade = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 6 ? parsed : 'all';
};

export default async function AttendanceAwardsPage({ searchParams }: PageProps<'/dashboard/attendance/awards'>) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle();
  if (!profile || !profile.is_active || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const currentYear = Number(today.slice(0, 4));
  const year = validYear(params.year, currentYear);
  const filter = validFilter(params.filter);
  const grade = validGrade(params.grade);
  const lastDate = year === currentYear ? today : `${year}-12-31`;

  const [{ data: students }, { data: events }] = await Promise.all([
    supabase.from('students').select('id, full_name, grade, class_name').eq('is_active', true).order('grade').order('full_name'),
    supabase.from('attendance_events').select('id, service_date, is_statistics_excluded').gte('service_date', `${year}-01-01`).lte('service_date', lastDate).eq('is_statistics_excluded', false).order('service_date'),
  ]);

  const sundayEvents = (events ?? []).filter((event) => new Date(`${event.service_date}T00:00:00Z`).getUTCDay() === 0);
  const eventIds = sundayEvents.map((event) => event.id);
  const records: AttendanceRecord[] = [];
  for (let offset = 0; offset < eventIds.length; offset += 100) {
    const ids = eventIds.slice(offset, offset + 100);
    for (let page = 0; ; page += 1000) {
      const { data: rows } = await supabase.from('attendance_records').select('event_id, student_id, status').in('event_id', ids).in('status', ['present', 'late']).range(page, page + 999);
      records.push(...(rows ?? []));
      if (!rows || rows.length < 1000) break;
    }
  }

  const attendanceByStudent = new Map<string, Set<string>>();
  const lateByStudent = new Map<string, Set<string>>();
  for (const record of records) {
    const attended = attendanceByStudent.get(record.student_id) ?? new Set<string>();
    attended.add(record.event_id);
    attendanceByStudent.set(record.student_id, attended);
    if (record.status === 'late') {
      const late = lateByStudent.get(record.student_id) ?? new Set<string>();
      late.add(record.event_id);
      lateByStudent.set(record.student_id, late);
    }
  }

  const totalServices = sundayEvents.length;
  const rows = (students ?? []).map((student) => {
    const attended = attendanceByStudent.get(student.id)?.size ?? 0;
    const absences = Math.max(totalServices - attended, 0);
    const category: Exclude<AwardFilter, 'all'> | 'none' = totalServices === 0 ? 'none' : absences === 0 ? 'perfect' : absences <= 3 ? 'good' : 'other';
    return { ...student, attended, absences, late: lateByStudent.get(student.id)?.size ?? 0, category };
  }).sort((a, b) => a.absences - b.absences || b.attended - a.attended || a.grade - b.grade || a.full_name.localeCompare(b.full_name, 'ko'));

  const gradeRows = rows.filter((row) => grade === 'all' || row.grade === grade);
  const counts = {
    perfect: gradeRows.filter((row) => row.category === 'perfect').length,
    good: gradeRows.filter((row) => row.category === 'good').length,
    other: gradeRows.filter((row) => row.category === 'other').length,
  };
  const visibleRows = gradeRows.filter((row) => filter === 'all' || row.category === filter);
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 3 + index);
  const filterLinks: { key: AwardFilter; label: string; count: number }[] = [
    { key: 'all', label: '전체', count: gradeRows.length },
    { key: 'perfect', label: '개근', count: counts.perfect },
    { key: 'good', label: '정근', count: counts.good },
    { key: 'other', label: '그 외', count: counts.other },
  ];

  return <DashboardShell profile={{ full_name: profile.full_name, role: profile.role as AppRole }} activeHref="/dashboard/attendance">
    <div className="module-heading">
      <div><p className="eyebrow">ATTENDANCE AWARDS</p><h1>개근·정근 현황</h1><span>{year}년 결석이 적은 순서로 확인합니다.</span></div>
      <Link className="module-secondary-link" href="/dashboard/attendance">출석관리로 돌아가기</Link>
    </div>

    <section className="attendance-award-guide">
      <div><strong>개근</strong><span>기록된 예배일에 결석 0회</span></div>
      <div><strong>정근</strong><span>기록된 예배일에 결석 1~3회</span></div>
      <p>현재 재학 중인 학생 기준이며, 별도 예배 없음으로 통계에서 제외한 날짜와 미래 날짜는 계산하지 않습니다.</p>
    </section>

    <div className="attendance-award-summary">
      <article><span>집계 예배</span><strong>{totalServices}<small>회</small></strong></article>
      <article className="perfect"><span>개근 학생</span><strong>{counts.perfect}<small>명</small></strong></article>
      <article className="good"><span>정근 학생</span><strong>{counts.good}<small>명</small></strong></article>
    </div>

    <form className="attendance-award-toolbar" method="get">
      <label><span>조회 연도</span><select name="year" defaultValue={year}>{yearOptions.map((item) => <option key={item} value={item}>{item}년</option>)}</select></label>
      <label><span>학년</span><select name="grade" defaultValue={grade}><option value="all">전체 학년</option>{[1,2,3,4,5,6].map((item) => <option key={item} value={item}>{item}학년</option>)}</select></label>
      <input type="hidden" name="filter" value={filter}/>
      <button type="submit">조회</button>
    </form>

    <nav className="attendance-award-filters" aria-label="개근 정근 분류">
      {filterLinks.map((item) => <Link key={item.key} className={filter === item.key ? 'active' : ''} href={`/dashboard/attendance/awards?year=${year}&grade=${grade}&filter=${item.key}`}>{item.label}<span>{item.count}</span></Link>)}
    </nav>

    <section className="attendance-award-list">
      <div className="attendance-award-head"><span>구분</span><span>학생</span><span>출석</span><span>지각</span><span>결석</span></div>
      {totalServices === 0 ? <div className="attendance-award-empty">{year}년에 집계할 주일 출석 기록이 없습니다.</div> : visibleRows.length === 0 ? <div className="attendance-award-empty">조건에 맞는 학생이 없습니다.</div> : visibleRows.map((row) => <article key={row.id}>
        <span className={`attendance-award-badge ${row.category}`}>{row.category === 'perfect' ? '개근' : row.category === 'good' ? '정근' : '일반'}</span>
        <div><strong>{row.full_name}</strong><small>{row.grade}학년{row.class_name ? ` · ${row.class_name}` : ''}</small></div>
        <b>{row.attended}<small>회</small></b>
        <b>{row.late}<small>회</small></b>
        <b className={row.absences <= 3 ? 'low' : ''}>{row.absences}<small>회</small></b>
      </article>)}
    </section>
  </DashboardShell>;
}
