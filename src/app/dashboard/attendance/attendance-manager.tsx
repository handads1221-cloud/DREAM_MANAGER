'use client';

import { useMemo, useState, useTransition } from 'react';
import { setAttendanceStatisticsExclusion, updateBulkAttendance } from './actions';

type Student = { id: string; full_name: string; grade: number; class_name: string | null };
type AttendanceRecord = { student_id: string; status: string; checked_at: string };

const statusLabel: Record<string, string> = { present: '출석', late: '지각', excused: '사유결석', absent: '결석' };

export function AttendanceManager({ eventId, serviceDate, initialStudents, initialRecords, role, isStatisticsExcluded, exclusionReason }: { eventId: string | null; serviceDate: string; initialStudents: Student[]; initialRecords: AttendanceRecord[]; role: 'admin' | 'teacher'; isStatisticsExcluded: boolean; exclusionReason: string | null }) {
  const [grade, setGrade] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [records, setRecords] = useState(() => new Map(initialRecords.map((record) => [record.student_id, record])));
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const visible = useMemo(() => initialStudents.filter((student) => {
    if (grade !== 'all' && student.grade !== grade) return false;
    const attended = ['present','late'].includes(records.get(student.id)?.status ?? '');
    return statusFilter === 'all' || (statusFilter === 'present' ? attended : !attended);
  }), [grade, statusFilter, initialStudents, records]);
  const counts = useMemo(() => initialStudents.reduce<Record<number, number>>((all, student) => ({ ...all, [student.grade]: (all[student.grade] ?? 0) + 1 }), {}), [initialStudents]);
  const presentCount = useMemo(() => [...records.values()].filter((record) => ['present','late'].includes(record.status)).length, [records]);
  const presentByGrade = useMemo(() => initialStudents.reduce<Record<number, number>>((all, student) => {
    if (['present','late'].includes(records.get(student.id)?.status ?? '')) all[student.grade] = (all[student.grade] ?? 0) + 1;
    return all;
  }, {}), [initialStudents, records]);
  const visibleIds = visible.map((student) => student.id); const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected((current) => { const next = new Set(current); visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id)); return next; });
  const runAction = (action: 'present' | 'cancel') => {
    if (isStatisticsExcluded) { setFeedback({ kind: 'error', text: '별도 예배가 없는 날짜에는 출석을 처리할 수 없습니다.' }); return; }
    if (selected.size === 0) { setFeedback({ kind: 'error', text: '처리할 학생을 한 명 이상 선택해 주세요.' }); return; }
    if (action === 'cancel' && !window.confirm(`선택한 ${selected.size}명의 출석을 취소할까요?`)) return;
    const formData = new FormData(); if (eventId) formData.set('event_id', eventId); formData.set('service_date', serviceDate); formData.set('attendance_action', action); selected.forEach((id) => formData.append('student_ids', id));
    startTransition(async () => {
      const result = await updateBulkAttendance(formData);
      if (!result.ok) { setFeedback({ kind: 'error', text: result.message }); return; }
      setRecords((current) => { const next = new Map(current); result.studentIds.forEach((id) => result.action === 'present' ? next.set(id, { student_id: id, status: 'present', checked_at: new Date().toISOString() }) : next.delete(id)); return next; });
      setSelected(new Set()); setFeedback({ kind: 'success', text: result.message });
    });
  };
  const toggleExclusion = () => {
    const next = !isStatisticsExcluded;
    const question = next ? '이 날짜를 별도 예배 없음으로 지정할까요? 기존 출석 기록과 출석 보석은 취소됩니다.' : '이 날짜를 정상 주일예배로 복원할까요?';
    if (!window.confirm(question)) return;
    const formData = new FormData(); formData.set('service_date', serviceDate); formData.set('excluded', String(next));
    startTransition(async () => {
      const result = await setAttendanceStatisticsExclusion(formData);
      if (!result.ok) { setFeedback({ kind: 'error', text: result.message }); return; }
      window.location.reload();
    });
  };

  return <section className="attendance-manager">
    {role === 'admin' && <div className={`attendance-exclusion-control${isStatisticsExcluded ? ' active' : ''}`}><div><b>{isStatisticsExcluded ? '통계 제외됨 · 예배 없음' : '별도 예배가 없는 주일인가요?'}</b><span>{exclusionReason ?? '전세대 이음으로 교회학교 별도 예배 없음'}</span></div><button type="button" onClick={toggleExclusion} disabled={pending}>{isStatisticsExcluded ? '정상 주일로 복원' : '통계에서 제외'}</button></div>}
    {isStatisticsExcluded && <p className="attendance-no-service-notice"><strong>이 날짜는 출석 통계에서 제외됩니다.</strong><span>{exclusionReason}</span><small>출석 입력·QR 출석·출석 보석 지급이 중지됩니다.</small></p>}
    <div className="attendance-live-summary compact"><div><span>이번 주 출석</span><strong>{presentCount}<small> / {initialStudents.length}명</small></strong></div></div>
    <div className="attendance-grade-summary">{[1,2,3,4,5,6].map((item) => <span key={item}><b>{item}학년</b><strong>{presentByGrade[item] ?? 0}<small>/{counts[item] ?? 0}명</small></strong></span>)}</div>
    <div className="attendance-filter-stack"><div className="attendance-grade-filter"><button type="button" className={grade === 'all' ? 'active' : ''} onClick={() => { setGrade('all'); setSelected(new Set()); }}>전체 <span>{initialStudents.length}</span></button>{[1,2,3,4,5,6].map((item) => <button type="button" key={item} className={grade === item ? 'active' : ''} onClick={() => { setGrade(item); setSelected(new Set()); }}>{item}학년 <span>{counts[item] ?? 0}</span></button>)}</div><div className="attendance-status-filter" aria-label="출석 상태 필터"><button type="button" className={statusFilter === 'all' ? 'active' : ''} onClick={() => { setStatusFilter('all'); setSelected(new Set()); }}>전체 보기</button><button type="button" className={statusFilter === 'present' ? 'active' : ''} onClick={() => { setStatusFilter('present'); setSelected(new Set()); }}>출석만 보기</button><button type="button" className={statusFilter === 'absent' ? 'active' : ''} onClick={() => { setStatusFilter('absent'); setSelected(new Set()); }}>미출석만 보기</button></div></div>
    <div className="attendance-bulk-bar"><label><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} disabled={isStatisticsExcluded}/> 현재 목록 전체선택</label><span>{selected.size}명 선택</span><button onClick={() => runAction('present')} disabled={pending || selected.size === 0 || isStatisticsExcluded}>선택 출석</button><button className="cancel" onClick={() => runAction('cancel')} disabled={pending || selected.size === 0 || isStatisticsExcluded}>선택 출석취소</button></div>
    {feedback && <p className={`form-alert ${feedback.kind}`}>{feedback.text}</p>}
    <div className="attendance-table"><div className="attendance-table-head"><span>선택</span><span>이름</span><span>학년·반</span><span>상태</span></div>{visible.map((student) => { const record = records.get(student.id); return <label className={selected.has(student.id) ? 'attendance-row selected' : 'attendance-row'} key={student.id}><input type="checkbox" checked={selected.has(student.id)} onChange={() => toggle(student.id)} disabled={isStatisticsExcluded}/><b>{student.full_name}</b><span>{student.grade}학년 · {student.class_name ?? '반 미정'}</span><strong className={record ? `status-${record.status}` : 'status-none'}>{isStatisticsExcluded ? '예배 없음' : record ? statusLabel[record.status] ?? record.status : '미등록'}</strong></label>; })}</div>
  </section>;
}
