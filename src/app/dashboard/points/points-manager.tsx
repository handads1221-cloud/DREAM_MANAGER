'use client';

import { useMemo, useState, useTransition } from 'react';
import { awardQuickPoint } from './actions';

type Balance = { student_id: string; full_name: string; grade: number; class_name: string | null; balance: number };

export function PointsManager({ initialBalances }: { initialBalances: Balance[] }) {
  const [students, setStudents] = useState(initialBalances); const [grade, setGrade] = useState<number | 'all'>('all');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null); const [pendingId, setPendingId] = useState<string | null>(null); const [, startTransition] = useTransition();
  const visible = useMemo(() => grade === 'all' ? students : students.filter((student) => student.grade === grade), [grade, students]);
  const counts = useMemo(() => students.reduce<Record<number, number>>((all, student) => ({ ...all, [student.grade]: (all[student.grade] ?? 0) + 1 }), {}), [students]);
  const changePoint = (studentId: string, amount: -1 | 1) => { const formData = new FormData(); formData.set('student_id', studentId); formData.set('amount', String(amount)); setPendingId(studentId); startTransition(async () => { const result = await awardQuickPoint(formData); setPendingId(null); if (!result.ok) { setFeedback({ kind: 'error', text: result.message }); return; } setStudents((current) => current.map((student) => student.student_id === result.studentId ? { ...student, balance: student.balance + result.amount } : student)); setFeedback({ kind: 'success', text: result.message }); }); };
  return <section className="points-manager"><div className="management-grade-filter"><button className={grade === 'all' ? 'active' : ''} onClick={() => setGrade('all')}>전체 <span>{students.length}</span></button>{[1,2,3,4,5,6].map((item) => <button key={item} className={grade === item ? 'active' : ''} onClick={() => setGrade(item)}>{item}학년 <span>{counts[item] ?? 0}</span></button>)}</div>{feedback && <p className={`form-alert ${feedback.kind}`}>{feedback.text}</p>}<div className="points-table"><div className="points-table-head"><span>학년</span><span>이름</span><span>반</span><span>보유 보석</span><span>빠른 지급·차감</span></div>{visible.map((student) => <div className="points-row" key={student.student_id}><span>{student.grade}학년</span><b>{student.full_name}</b><span>{student.class_name ?? '반 미정'}</span><strong>◆ {student.balance}</strong><div><button className="minus" onClick={() => changePoint(student.student_id, -1)} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 1개 차감`}>−</button><button className="plus" onClick={() => changePoint(student.student_id, 1)} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 1개 지급`}>＋</button></div></div>)}</div></section>;
}
