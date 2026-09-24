import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell, type AppRole } from '../../dashboard-shell';

const validYear = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 2020 && parsed <= 2100 ? parsed : fallback;
};

const monthNames = Array.from({ length: 12 }, (_, index) => `${index + 1}월`);

export default async function AttendanceStatisticsPage({ searchParams }: PageProps<'/dashboard/attendance/statistics'>) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect('/login');
  const { data: profile } = await supabase.from('profiles').select('full_name, role, is_active').eq('id', data.claims.sub).maybeSingle();
  if (!profile || !profile.is_active || !['admin', 'teacher'].includes(profile.role)) redirect('/dashboard');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const currentYear = Number(today.slice(0, 4));
  const year = validYear(params.year, currentYear);
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const { data: events } = await supabase.from('attendance_events').select('id,service_date,is_statistics_excluded').gte('service_date', from).lte('service_date', to).order('service_date');
  const allEventRows = events ?? [];
  const eventRows = allEventRows.filter((event) => !event.is_statistics_excluded);
  const excludedCount = allEventRows.length - eventRows.length;
  const eventIds = eventRows.map((event) => event.id);
  const records: { event_id: string; status: string }[] = [];
  for (let offset = 0; offset < eventIds.length; offset += 100) {
    const ids = eventIds.slice(offset, offset + 100);
    if (!ids.length) continue;
    for (let page = 0; ; page += 1000) {
      const { data: rows } = await supabase.from('attendance_records').select('event_id,status').in('event_id', ids).in('status', ['present', 'late']).range(page, page + 999);
      records.push(...(rows ?? []));
      if (!rows || rows.length < 1000) break;
    }
  }

  const eventDate = new Map(eventRows.map((event) => [event.id, event.service_date]));
  const totals = Array(12).fill(0) as number[];
  const sundaySets = Array.from({ length: 12 }, () => new Set<string>());
  for (const event of eventRows) {
    const month = Number(event.service_date.slice(5, 7)) - 1;
    if (new Date(`${event.service_date}T00:00:00Z`).getUTCDay() === 0) sundaySets[month].add(event.service_date);
  }
  for (const record of records) {
    const date = eventDate.get(record.event_id);
    if (!date || new Date(`${date}T00:00:00Z`).getUTCDay() !== 0) continue;
    totals[Number(date.slice(5, 7)) - 1] += 1;
  }
  const averages = totals.map((total, index) => sundaySets[index].size ? total / sundaySets[index].size : 0);
  const maxTotal = Math.max(...totals, 1);
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - 3 + index);

  return <DashboardShell profile={{ full_name: profile.full_name, role: profile.role as AppRole }} activeHref="/dashboard/attendance">
    <div className="module-heading"><div><p className="eyebrow">ATTENDANCE STATISTICS</p><h1>출석통계</h1><span>{year}년 주일 출석 현황</span></div><Link className="module-secondary-link" href="/dashboard/attendance">출석관리로 돌아가기</Link></div>

    <form className="attendance-stat-year" method="get">
      <label htmlFor="statisticsYear"><span>조회 연도</span><select id="statisticsYear" name="year" defaultValue={year}>{yearOptions.map((item) => <option key={item} value={item}>{item}년</option>)}</select></label>
      <button type="submit">연도 조회</button>
    </form>

    <section className="attendance-monthly-card">
      <div className="attendance-stat-title"><div><p className="eyebrow">MONTHLY ATTENDANCE</p><h2>월별 출석인원</h2></div><span>막대: 월간 총 출석 횟수 · 숫자: 주일 평균 인원{excludedCount ? ` · 별도 예배 없음 ${excludedCount}회 제외` : ''}</span></div>
      <div className="attendance-monthly-chart">{monthNames.map((month, index) => <div className="attendance-month-column" key={month}>
        <strong>{averages[index] ? `${averages[index].toFixed(1)}명` : '0명'}</strong>
        <div className="attendance-month-track"><i style={{ height: `${Math.max(totals[index] ? 8 : 2, totals[index] / maxTotal * 100)}%` }}/></div>
        <b>{month}</b><small>{totals[index]}회</small>
      </div>)}</div>
    </section>

    <section className="attendance-export-card">
      <div><p className="eyebrow">EXCEL DOWNLOAD</p><h2>기간별 출석부 다운로드</h2><span>선택 기간의 학생별 출석표와 날짜별·학년별 집계를 엑셀로 만듭니다.</span></div>
      <form action="/dashboard/attendance/statistics/export" method="get">
        <label><span>시작일</span><input type="date" name="from" defaultValue={`${year}-01-01`} max={today} required/></label>
        <label><span>종료일</span><input type="date" name="to" defaultValue={year === currentYear ? today : `${year}-12-31`} max={today} required/></label>
        <label><span>학년</span><select name="grade" defaultValue="all"><option value="all">전체 학년</option>{[1,2,3,4,5,6].map((grade) => <option key={grade} value={grade}>{grade}학년</option>)}</select></label>
        <button type="submit">엑셀 다운로드</button>
      </form>
      <p>○ 출석 · △ 지각 · 공란 결석 · 예배 없음은 통계 제외로 표시합니다. 연락처와 주소 등 개인정보는 포함하지 않습니다.</p>
    </section>
  </DashboardShell>;
}
