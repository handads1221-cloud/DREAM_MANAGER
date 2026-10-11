'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GemIcon } from '@/components/app-icon';
import { awardQuickPoint } from './actions';

type Balance = { student_id: string; full_name: string; grade: number; class_name: string | null; balance: number };

export function PointsManager({ initialBalances }: { initialBalances: Balance[] }) {
  const router = useRouter();
  const [students, setStudents] = useState(initialBalances); const [grade, setGrade] = useState<number | 'all'>('all');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null); const [pendingId, setPendingId] = useState<string | null>(null); const [, startTransition] = useTransition();
  const [customStudent, setCustomStudent] = useState<Balance | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const visible = useMemo(() => grade === 'all' ? students : students.filter((student) => student.grade === grade), [grade, students]);
  const counts = useMemo(() => students.reduce<Record<number, number>>((all, student) => ({ ...all, [student.grade]: (all[student.grade] ?? 0) + 1 }), {}), [students]);
  const customAmountNumber = Number(customAmount);
  const customAmountValid = Number.isInteger(customAmountNumber) && customAmountNumber >= 1 && customAmountNumber <= 999;
  const changePoint = (studentId: string, amount: number, closeAfterSuccess = false) => { const formData = new FormData(); formData.set('student_id', studentId); formData.set('amount', String(amount)); setPendingId(studentId); startTransition(async () => { const result = await awardQuickPoint(formData); setPendingId(null); if (!result.ok) { setFeedback({ kind: 'error', text: result.message }); return; } setStudents((current) => current.map((student) => student.student_id === result.studentId ? { ...student, balance: student.balance + result.amount } : student)); setFeedback({ kind: 'success', text: result.message }); if (closeAfterSuccess) { setCustomStudent(null); setCustomAmount(''); } router.refresh(); }); };
  const submitCustomAward = () => {
    if (!customStudent) return;
    if (!customAmountValid) return;
    changePoint(customStudent.student_id, customAmountNumber, true);
  };
  return <section className="points-manager"><div className="management-grade-filter"><button className={grade === 'all' ? 'active' : ''} onClick={() => setGrade('all')}>전체 <span>{students.length}</span></button>{[1,2,3,4,5,6].map((item) => <button key={item} className={grade === item ? 'active' : ''} onClick={() => setGrade(item)}>{item}학년 <span>{counts[item] ?? 0}</span></button>)}</div>{feedback && <p className={`form-alert ${feedback.kind}`}>{feedback.text}</p>}<div className="points-table"><div className="points-table-head"><span>학년</span><span>이름</span><span>보유</span><span>보석 추가/차감</span></div>{visible.map((student) => <div className="points-row" key={student.student_id}><span>{student.grade}학년</span><b>{student.full_name}</b><strong><GemIcon/> {student.balance}</strong><div className="point-buttons"><button className="minus-five" onClick={() => changePoint(student.student_id, -5)} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 5개 차감`}>−5</button><button className="minus" onClick={() => changePoint(student.student_id, -1)} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 1개 차감`}>−</button><button className="plus" onClick={() => changePoint(student.student_id, 1)} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 1개 추가`}>＋</button><button className="plus-many" onClick={() => { setCustomStudent(student); setCustomAmount(''); setFeedback(null); }} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 여러 개 추가`}>＋N</button></div></div>)}</div>
    {customStudent && <div className="point-quantity-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomStudent(null); }}><section className="point-quantity-dialog" role="dialog" aria-modal="true" aria-labelledby="point-quantity-title"><button type="button" className="point-quantity-close" onClick={() => setCustomStudent(null)} aria-label="닫기">×</button><p>보석 여러 개 추가</p><h2 id="point-quantity-title">{customStudent.full_name}</h2><label htmlFor="custom-gem-amount">추가할 보석 수</label><div className="point-quantity-input"><GemIcon/><input id="custom-gem-amount" type="number" inputMode="numeric" min="1" max="999" step="1" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="숫자 입력" autoFocus/><span>개</span></div><small>1개부터 999개까지 한 번에 지급할 수 있습니다.</small><div className="point-quantity-actions"><button type="button" onClick={() => setCustomStudent(null)}>취소</button><button type="button" className="confirm" onClick={submitCustomAward} disabled={pendingId === customStudent.student_id || !customAmountValid}>{pendingId === customStudent.student_id ? '지급 중…' : '보석 추가'}</button></div></section></div>}
  </section>;
}
