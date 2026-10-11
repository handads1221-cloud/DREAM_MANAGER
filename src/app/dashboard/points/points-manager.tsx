'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { GemIcon } from '@/components/app-icon';
import { awardPointsFromChat, awardQuickPoint } from './actions';

type Balance = { student_id: string; full_name: string; grade: number; class_name: string | null; balance: number };
type ChatMessage = { id: number; sender: 'bot' | 'user'; text: string; error?: boolean };

export function PointsManager({ initialBalances }: { initialBalances: Balance[] }) {
  const router = useRouter();
  const [students, setStudents] = useState(initialBalances); const [grade, setGrade] = useState<number | 'all'>('all');
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null); const [pendingId, setPendingId] = useState<string | null>(null); const [, startTransition] = useTransition();
  const [customStudent, setCustomStudent] = useState<Balance | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatPending, setChatPending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ id: 1, sender: 'bot', text: '이름과 수량을 알려주세요. 예: 김하늘, 이사랑 보석 2개 지급' }]);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(() => grade === 'all' ? students : students.filter((student) => student.grade === grade), [grade, students]);
  const counts = useMemo(() => students.reduce<Record<number, number>>((all, student) => ({ ...all, [student.grade]: (all[student.grade] ?? 0) + 1 }), {}), [students]);
  const customAmountNumber = Number(customAmount);
  const customAmountValid = Number.isInteger(customAmountNumber) && customAmountNumber >= 1 && customAmountNumber <= 999;
  useEffect(() => { if (chatOpen) chatMessagesRef.current?.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: 'smooth' }); }, [chatMessages, chatOpen, chatPending]);
  const changePoint = (studentId: string, amount: number, closeAfterSuccess = false) => { const formData = new FormData(); formData.set('student_id', studentId); formData.set('amount', String(amount)); setPendingId(studentId); startTransition(async () => { const result = await awardQuickPoint(formData); setPendingId(null); if (!result.ok) { setFeedback({ kind: 'error', text: result.message }); return; } setStudents((current) => current.map((student) => student.student_id === result.studentId ? { ...student, balance: student.balance + result.amount } : student)); setFeedback({ kind: 'success', text: result.message }); if (closeAfterSuccess) { setCustomStudent(null); setCustomAmount(''); } router.refresh(); }); };
  const submitCustomAward = () => {
    if (!customStudent) return;
    if (!customAmountValid) return;
    changePoint(customStudent.student_id, customAmountNumber, true);
  };
  const submitChatCommand = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const command = chatInput.trim();
    if (!command || chatPending) return;
    const stamp = Date.now();
    setChatMessages((current) => [...current, { id: stamp, sender: 'user', text: command }]);
    setChatInput(''); setChatPending(true);
    const result = await awardPointsFromChat(command);
    setChatPending(false);
    setChatMessages((current) => [...current, { id: stamp + 1, sender: 'bot', text: result.message, error: !result.ok }]);
    if (!result.ok) return;
    setStudents((current) => current.map((student) => { const change = result.changes.find((item) => item.studentId === student.student_id); return change ? { ...student, balance: student.balance + change.amount } : student; }));
    setFeedback({ kind: 'success', text: result.message }); router.refresh();
  };
  return <section className="points-manager"><div className="points-manager-toolbar"><button type="button" className={`point-chat-switch ${chatOpen ? 'active' : ''}`} role="switch" aria-checked={chatOpen} onClick={() => setChatOpen((current) => !current)}><span><i/></span>보석 챗봇</button></div>{chatOpen && <section className="point-chatbot" aria-label="보석 지급 챗봇"><header><div><GemIcon/><span><b>드림보석 챗봇</b><small>이름·수량·지급 또는 차감 입력</small></span></div><button type="button" onClick={() => setChatOpen(false)} aria-label="챗봇 닫기">×</button></header><div ref={chatMessagesRef} className="point-chat-messages" aria-live="polite">{chatMessages.map((message) => <p key={message.id} className={`${message.sender} ${message.error ? 'error' : ''}`}>{message.text}</p>)}{chatPending && <p className="bot pending">명령을 확인하고 있어요…</p>}</div><div className="point-chat-examples"><button type="button" onClick={() => setChatInput('김하늘 보석 1개 지급')}>한 명 지급 예시</button><button type="button" onClick={() => setChatInput('김하늘, 이사랑 보석 1개 차감')}>여러 명 차감 예시</button></div><form onSubmit={submitChatCommand}><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} maxLength={500} placeholder="예: 김하늘, 이사랑 보석 2개 지급" aria-label="보석 챗봇 명령"/><button type="submit" disabled={!chatInput.trim() || chatPending}>전송</button></form></section>}<div className="management-grade-filter"><button className={grade === 'all' ? 'active' : ''} onClick={() => setGrade('all')}>전체 <span>{students.length}</span></button>{[1,2,3,4,5,6].map((item) => <button key={item} className={grade === item ? 'active' : ''} onClick={() => setGrade(item)}>{item}학년 <span>{counts[item] ?? 0}</span></button>)}</div>{feedback && <p className={`form-alert ${feedback.kind}`}>{feedback.text}</p>}<div className="points-table"><div className="points-table-head"><span>학년</span><span>이름</span><span>보유</span><span>보석 추가/차감</span></div>{visible.map((student) => <div className="points-row" key={student.student_id}><span>{student.grade}학년</span><b>{student.full_name}</b><strong><GemIcon/> {student.balance}</strong><div className="point-buttons"><button className="minus-five" onClick={() => changePoint(student.student_id, -5)} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 5개 차감`}>−5</button><button className="minus" onClick={() => changePoint(student.student_id, -1)} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 1개 차감`}>−</button><button className="plus" onClick={() => changePoint(student.student_id, 1)} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 1개 추가`}>＋</button><button className="plus-many" onClick={() => { setCustomStudent(student); setCustomAmount(''); setFeedback(null); }} disabled={pendingId === student.student_id} aria-label={`${student.full_name} 보석 여러 개 추가`}>＋N</button></div></div>)}</div>
    {customStudent && <div className="point-quantity-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomStudent(null); }}><section className="point-quantity-dialog" role="dialog" aria-modal="true" aria-labelledby="point-quantity-title"><button type="button" className="point-quantity-close" onClick={() => setCustomStudent(null)} aria-label="닫기">×</button><p>보석 여러 개 추가</p><h2 id="point-quantity-title">{customStudent.full_name}</h2><label htmlFor="custom-gem-amount">추가할 보석 수</label><div className="point-quantity-input"><GemIcon/><input id="custom-gem-amount" type="number" inputMode="numeric" min="1" max="999" step="1" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="숫자 입력" autoFocus/><span>개</span></div><small>1개부터 999개까지 한 번에 지급할 수 있습니다.</small><div className="point-quantity-actions"><button type="button" onClick={() => setCustomStudent(null)}>취소</button><button type="button" className="confirm" onClick={submitCustomAward} disabled={pendingId === customStudent.student_id || !customAmountValid}>{pendingId === customStudent.student_id ? '지급 중…' : '보석 추가'}</button></div></section></div>}
  </section>;
}
