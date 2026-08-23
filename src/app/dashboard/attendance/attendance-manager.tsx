'use client';

import { useMemo, useState, useTransition } from 'react';
import { updateBulkAttendance } from './actions';

type Student = { id: string; full_name: string; grade: number; class_name: string | null };
type AttendanceRecord = { student_id: string; status: string; checked_at: string };

const statusLabel: Record<string, string> = { present: '출석', late: '지각', excused: '사유결석', absent: '결석' };

export function AttendanceManager({ eventId, initialStudents, initialRecords }: { eventId: string; initialStudents: Student[]; initialRecords: AttendanceRecord[] }) {
  const [grade, setGrade] = useState<number | 'all'>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [records, setRecords] = useState(() => new Map(initialRecords.map((record) => [record.student_id, record])));
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const visible = useMemo(() => grade === 'all' ? initialStudents : initialStudents.filter((student) => student.grade === grade), [grade, initialStudents]);
  const counts = useMemo(() => initialStudents.reduce<Record<number, number>>((all, student) => ({ ...all, [student.grade]: (all[student.grade] ?? 0) + 1 }), {}), [initialStudents]);
  const visibleIds = visible.map((student) => student.id); const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected((current) => { const next = new Set(current); visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id)); return next; });
  const runAction = (action: 'present' | 'cancel') => {
    if (selected.size === 0) { setFeedback({ kind: 'error', text: '처리할 학생을 한 명 이상 선택해 주세요.' }); return; }
    if (action === 'cancel' && !window.confirm(`선택한 ${selected.size}명의 출석을 취소할까요?`)) return;
    const formData = new FormData(); formData.set('event_id', eventId); formData.set('attendance_action', action); selected.forEach((id) => formData.append('student_ids', id));
    startTransition(async () => {
      const result = await updateBulkAttendance(formData);
      if (!result.ok) { setFeedback({ kind: 'error', text: result.message }); return; }
      setRecords((current) => { const next = new Map(current); result.studentIds.forEach((id) => result.action === 'present' ? next.set(id, { student_id: id, status: 'present', checked_at: new Date().toISOString() }) : next.delete(id)); return next; });
      setSelected(new Set()); setFeedback({ kind: 'success', text: result.message });
    });
  };

  return <section className="attendance-manager">
    <div className="attendance-grade-filter"><button className={grade === 'all' ? 'active' : ''} onClick={() => { setGrade('all'); setSelected(new Set()); }}>전체 <span>{initialStudents.length}</span></button>{[1,2,3,4,5,6].map((item) => <button key={item} className={grade === item ? 'active' : ''} onClick={() => { setGrade(item); setSelected(new Set()); }}>{item}학년 <span>{counts[item] ?? 0}</span></button>)}</div>
    <div className="attendance-bulk-bar"><label><input type="checkbox" checked={allVisibleSelected} onChange={toggleAll}/> 현재 목록 전체선택</label><span>{selected.size}명 선택</span><button onClick={() => runAction('present')} disabled={pending || selected.size === 0}>선택 출석</button><button className="cancel" onClick={() => runAction('cancel')} disabled={pending || selected.size === 0}>선택 출석취소</button></div>
    {feedback && <p className={`form-alert ${feedback.kind}`}>{feedback.text}</p>}
    <div className="attendance-table"><div className="attendance-table-head"><span>선택</span><span>이름</span><span>학년·반</span><span>현재 상태</span><span>처리 시각</span></div>{visible.map((student) => { const record = records.get(student.id); return <label className={selected.has(student.id) ? 'attendance-row selected' : 'attendance-row'} key={student.id}><input type="checkbox" checked={selected.has(student.id)} onChange={() => toggle(student.id)}/><b>{student.full_name}</b><span>{student.grade}학년 · {student.class_name ?? '반 미정'}</span><strong className={record ? `status-${record.status}` : 'status-none'}>{record ? statusLabel[record.status] ?? record.status : '미등록'}</strong><span>{record?.checked_at ? new Date(record.checked_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'}</span></label>; })}</div>
  </section>;
}
