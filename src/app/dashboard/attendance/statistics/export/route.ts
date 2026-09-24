import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

const isDate = (value: string | null): value is string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const badRequest = (message: string, status = 400) => new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
const dateLabel = (value: string) => `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const gradeParam = url.searchParams.get('grade') ?? 'all';
  if (!isDate(from) || !isDate(to) || from > to) return badRequest('올바른 조회 기간을 선택해 주세요.');
  const dayCount = Math.floor((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000) + 1;
  if (dayCount > 732) return badRequest('한 번에 최대 2년까지 다운로드할 수 있습니다.');
  const grade = gradeParam === 'all' ? null : Number(gradeParam);
  if (grade !== null && ![1,2,3,4,5,6].includes(grade)) return badRequest('올바른 학년을 선택해 주세요.');

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return badRequest('로그인이 필요합니다.', 401);
  const { data: profile } = await supabase.from('profiles').select('role,is_active').eq('id', auth.claims.sub).maybeSingle();
  if (!profile?.is_active || !['admin', 'teacher'].includes(profile.role)) return badRequest('출석부 다운로드 권한이 없습니다.', 403);

  let studentQuery = supabase.from('students').select('id,full_name,grade,class_name').eq('is_active', true).order('grade').order('full_name');
  if (grade !== null) studentQuery = studentQuery.eq('grade', grade);
  const [{ data: students }, { data: events }] = await Promise.all([
    studentQuery,
    supabase.from('attendance_events').select('id,service_date,title,is_statistics_excluded,statistics_exclusion_reason').gte('service_date', from).lte('service_date', to).order('service_date'),
  ]);
  const studentRows = students ?? [];
  const eventRows = events ?? [];
  const studentIds = new Set(studentRows.map((student) => student.id));
  const attendance: { event_id: string; student_id: string; status: string }[] = [];
  for (let offset = 0; offset < eventRows.length; offset += 100) {
    const ids = eventRows.slice(offset, offset + 100).map((event) => event.id);
    for (let page = 0; ; page += 1000) {
      const { data: rows } = await supabase.from('attendance_records').select('event_id,student_id,status').in('event_id', ids).range(page, page + 999);
      attendance.push(...(rows ?? []).filter((row) => studentIds.has(row.student_id)));
      if (!rows || rows.length < 1000) break;
    }
  }

  const dates = new Set(eventRows.map((event) => event.service_date));
  const cursor = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  while (cursor <= last) {
    if (cursor.getUTCDay() === 0) dates.add(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const dateColumns = [...dates].sort();
  const eventByDate = new Map(eventRows.map((event) => [event.service_date, event.id]));
  const excludedDates = new Set(eventRows.filter((event) => event.is_statistics_excluded).map((event) => event.service_date));
  const eligibleDates = dateColumns.filter((date) => !excludedDates.has(date));
  const recordMap = new Map(attendance.map((record) => [`${record.event_id}:${record.student_id}`, record.status]));
  const mark = (status?: string) => status === 'present' ? '○' : status === 'late' ? '△' : status === 'excused' ? '사' : '';

  const workbook = new ExcelJS.Workbook();
  workbook.creator = '청주신흥교회 드림어린이부';
  workbook.created = new Date();
  const roster = workbook.addWorksheet('출석 현황', { views: [{ state: 'frozen', xSplit: 3, ySplit: 4 }] });
  const lastColumn = 3 + dateColumns.length + 3;
  roster.mergeCells(1, 1, 1, lastColumn);
  roster.getCell(1, 1).value = `${from} ~ ${to} 드림어린이부 출석부`;
  roster.getCell(1, 1).font = { size: 17, bold: true, color: { argb: 'FF173D32' } };
  roster.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  roster.getRow(1).height = 30;
  roster.mergeCells(2, 1, 2, lastColumn);
  roster.getCell(2, 1).value = '○ 출석 · △ 지각 · 사 사유결석 · 공란 결석 · 제외 예배 없음';
  roster.getCell(2, 1).font = { size: 10, color: { argb: 'FF65736E' } };
  roster.getCell(2, 1).alignment = { horizontal: 'right' };
  const headers = ['학년', '이름', '반', ...dateColumns.map(dateLabel), '출석', '결석', '출석률'];
  roster.addRow([]);
  roster.addRow(headers);
  roster.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  roster.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF168B68' } };
  roster.getRow(4).alignment = { horizontal: 'center', vertical: 'middle' };
  studentRows.forEach((student) => {
    const marks = dateColumns.map((date) => {
      if (excludedDates.has(date)) return '제외';
      const eventId = eventByDate.get(date);
      return mark(eventId ? recordMap.get(`${eventId}:${student.id}`) : undefined);
    });
    const attended = marks.filter((value) => value === '○' || value === '△').length;
    const row = roster.addRow([student.grade, student.full_name, student.class_name ?? '', ...marks, attended, eligibleDates.length - attended, eligibleDates.length ? attended / eligibleDates.length : 0]);
    row.alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(lastColumn).numFmt = '0.0%';
  });
  roster.columns.forEach((column, index) => { column.width = index === 1 ? 12 : index === 2 ? 10 : index >= 3 && index < 3 + dateColumns.length ? 7 : 9; });
  roster.getColumn(1).width = 8;
  roster.eachRow((row, rowNumber) => { if (rowNumber >= 4) row.eachCell((cell) => { cell.border = { top: { style: 'thin', color: { argb: 'FFDCE5E1' } }, left: { style: 'thin', color: { argb: 'FFDCE5E1' } }, bottom: { style: 'thin', color: { argb: 'FFDCE5E1' } }, right: { style: 'thin', color: { argb: 'FFDCE5E1' } } }; }); });
  roster.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: lastColumn } };
  roster.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };

  const daily = workbook.addWorksheet('날짜별 집계', { views: [{ state: 'frozen', ySplit: 2 }] });
  daily.addRow(['날짜별 출석 집계']);
  daily.mergeCells(1, 1, 1, 6);
  daily.addRow(['날짜', '예배 상태', '전체 학생', '출석', '결석', '출석률']);
  dateColumns.forEach((date) => {
    if (excludedDates.has(date)) {
      daily.addRow([new Date(`${date}T00:00:00Z`), '예배 없음', '', '', '', '']);
      return;
    }
    const eventId = eventByDate.get(date);
    const attended = studentRows.filter((student) => ['present', 'late'].includes(eventId ? recordMap.get(`${eventId}:${student.id}`) ?? '' : '')).length;
    daily.addRow([new Date(`${date}T00:00:00Z`), '주일예배', studentRows.length, attended, studentRows.length - attended, studentRows.length ? attended / studentRows.length : 0]);
  });
  daily.getColumn(1).numFmt = 'yyyy-mm-dd'; daily.getColumn(6).numFmt = '0.0%';
  daily.columns.forEach((column) => { column.width = 16; });

  const gradeSheet = workbook.addWorksheet('학년별 집계');
  gradeSheet.addRow(['학년별 출석 집계']); gradeSheet.mergeCells(1, 1, 1, 5);
  gradeSheet.addRow(['학년', '학생 수', '출석 횟수', '가능 횟수', '출석률']);
  [1,2,3,4,5,6].filter((item) => grade === null || item === grade).forEach((item) => {
    const gradeStudents = studentRows.filter((student) => student.grade === item);
    const eligibleEventIds = new Set(eventRows.filter((event) => !event.is_statistics_excluded).map((event) => event.id));
    const attended = attendance.filter((record) => eligibleEventIds.has(record.event_id) && studentIds.has(record.student_id) && gradeStudents.some((student) => student.id === record.student_id) && ['present', 'late'].includes(record.status)).length;
    const possible = gradeStudents.length * eligibleDates.length;
    gradeSheet.addRow([`${item}학년`, gradeStudents.length, attended, possible, possible ? attended / possible : 0]);
  });
  gradeSheet.getColumn(5).numFmt = '0.0%'; gradeSheet.columns.forEach((column) => { column.width = 18; });
  for (const sheet of [daily, gradeSheet]) {
    sheet.getCell(1, 1).font = { size: 16, bold: true, color: { argb: 'FF173D32' } };
    sheet.getRow(1).height = 28;
    sheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF168B68' } };
    sheet.getRow(2).alignment = { horizontal: 'center' };
    sheet.eachRow((row, rowNumber) => { if (rowNumber >= 2) row.eachCell((cell) => { cell.border = { bottom: { style: 'thin', color: { argb: 'FFDCE5E1' } } }; }); });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `드림어린이부_출석부_${from}_${to}${grade ? `_${grade}학년` : ''}.xlsx`;
  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
