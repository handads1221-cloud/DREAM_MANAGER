'use client';

import { useMemo, useState } from 'react';

export type BirthdayPerson = { id: string; fullName: string; personType: 'student' | 'teacher'; monthDay: string };

export function BirthdayCelebrationManager({ people, currentMonth }: { people: BirthdayPerson[]; currentMonth: number }) {
  const [months, setMonths] = useState<Set<number>>(() => new Set([currentMonth]));
  const [message, setMessage] = useState('축하할 월을 하나 이상 선택해 주세요.');
  const counts = useMemo(() => people.reduce<Record<number, number>>((result, person) => { const month = Number(person.monthDay.slice(0, 2)); result[month] = (result[month] ?? 0) + 1; return result; }, {}), [people]);
  const selected = useMemo(() => people.filter((person) => months.has(Number(person.monthDay.slice(0, 2)))).sort((a, b) => a.monthDay.localeCompare(b.monthDay) || a.fullName.localeCompare(b.fullName, 'ko')), [months, people]);

  function toggleMonth(month: number) {
    setMonths((current) => { const next = new Set(current); if (next.has(month)) next.delete(month); else next.add(month); return next; });
  }

  function openCelebration() {
    if (!months.size || !selected.length) { setMessage('선택한 월에 등록된 생일자가 없습니다.'); return; }
    const selectedMonths = [...months].sort((a, b) => a - b).join(',');
    const popup = window.open(`/dashboard/birthday-celebration/display?months=${selectedMonths}`, 'dream-birthday-celebration', 'popup=yes,width=1440,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes');
    if (!popup) { setMessage('새 창이 차단되었습니다. 브라우저의 팝업 차단을 허용한 뒤 다시 눌러 주세요.'); return; }
    popup.focus();
    setMessage('생일축하 화면을 새 창으로 열었습니다.');
  }

  return <div className="birthday-celebration-workspace">
    <section className="birthday-month-selector"><div><b>축하할 월 선택</b><span>여러 달을 함께 선택할 수 있습니다.</span></div><div className="birthday-month-grid-selector">{Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <button type="button" key={month} className={months.has(month) ? 'active' : ''} onClick={() => toggleMonth(month)}><strong>{month}월</strong><small>{counts[month] ?? 0}명</small></button>)}</div></section>
    <section className="birthday-celebrants-preview"><header><div><p>SELECTED CELEBRANTS</p><h2>생일축하자 명단</h2></div><strong>{selected.length}<small>명</small></strong></header><div className="birthday-celebrant-list">{selected.map((person) => <article key={`${person.personType}-${person.id}`}><time>{Number(person.monthDay.slice(0, 2))}월 {Number(person.monthDay.slice(3, 5))}일</time><b>{person.fullName}</b><span>{person.personType === 'teacher' ? '선생님' : '학생'}</span></article>)}{selected.length === 0 && <p>선택한 월에 등록된 생일자가 없습니다.</p>}</div></section>
    <section className="birthday-celebration-launch"><div><b>선택한 모든 생일자를 함께 축하합니다.</b><span>새 창이 열리면 전체화면 버튼을 눌러 주세요.</span></div><button type="button" onClick={openCelebration} disabled={!selected.length}>축하 화면 띄우기 <span aria-hidden="true">↗</span></button><small role="status">{message}</small></section>
  </div>;
}
