'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { drawRandomStudent } from './actions';

type DrawStudent = { id: string; fullName: string; grade: number; photoUrl: string | null };

export function RandomDrawMachine({ students, todayWinnerIds }: { students: DrawStudent[]; todayWinnerIds: string[] }) {
  const [grade, setGrade] = useState('all');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [wonToday, setWonToday] = useState<Set<string>>(new Set(todayWinnerIds));
  const [preventDuplicate, setPreventDuplicate] = useState(true);
  const [phase, setPhase] = useState<'ready' | 'drawing' | 'winner'>('ready');
  const [winner, setWinner] = useState<DrawStudent | null>(null);
  const [message, setMessage] = useState('학년과 제외 명단을 확인한 뒤 낚싯대를 던져 보세요!');

  const visibleStudents = useMemo(() => students.filter((student) => grade === 'all' || student.grade === Number(grade)), [grade, students]);
  const eligibleCount = visibleStudents.filter((student) => !excluded.has(student.id) && (!preventDuplicate || !wonToday.has(student.id))).length;

  function toggleExcluded(id: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function startDraw() {
    if (phase === 'drawing') return;
    if (eligibleCount === 0) { setMessage('추첨 가능한 학생이 없습니다. 설정을 확인해 주세요.'); return; }
    setWinner(null);
    setMessage('낚싯대를 던졌어요… 누가 올라올까요?');
    setPhase('drawing');
    const formData = new FormData();
    formData.set('grade', grade);
    formData.set('prevent_duplicate', String(preventDuplicate));
    excluded.forEach((id) => formData.append('excluded_student_ids', id));
    const minimumMotion = new Promise((resolve) => window.setTimeout(resolve, 3000));
    const [result] = await Promise.all([drawRandomStudent(formData), minimumMotion]);
    if (!result.ok) { setPhase('ready'); setMessage(result.message); return; }
    const selected = students.find((student) => student.id === result.winner.id) ?? {
      id: result.winner.id, fullName: result.winner.fullName, grade: result.winner.grade, photoUrl: null,
    };
    setWonToday((current) => new Set(current).add(selected.id));
    setWinner(selected);
    setMessage(result.message);
    setPhase('winner');
  }

  return <>
    <section className="random-draw-mobile-notice"><span>🎣</span><h2>PC에서 이용해 주세요</h2><p>랜덤 뽑기는 관리자 PC 화면에서만 사용할 수 있습니다.</p></section>
    <div className="random-draw-desktop">
      <header className="random-draw-heading"><div><p>ADMIN RANDOM DRAW</p><h1>행운의 물고기를 낚아라!</h1><span>등록된 재학생 가운데 공정하게 한 명을 뽑습니다.</span></div><div className="random-draw-count"><strong>{eligibleCount}</strong><span>현재 추첨 가능</span></div></header>
      <div className="random-draw-layout">
        <aside className="random-draw-controls">
          <label className="random-control-label">학년 선택<select value={grade} onChange={(event) => setGrade(event.target.value)} disabled={phase === 'drawing'}><option value="all">전체 학년</option>{[1,2,3,4,5,6].map((value) => <option key={value} value={value}>{value}학년</option>)}</select></label>
          <label className="random-switch"><input type="checkbox" checked={preventDuplicate} onChange={(event) => setPreventDuplicate(event.target.checked)} disabled={phase === 'drawing'}/><span><b>같은 날 중복 당첨 방지</b><small>오늘 당첨된 학생은 다시 뽑지 않아요.</small></span></label>
          <div className="random-exclusion-heading"><div><b>제외 LIST</b><small>{excluded.size}명 제외 중</small></div><button type="button" onClick={() => setExcluded(new Set())} disabled={!excluded.size || phase === 'drawing'}>전체 해제</button></div>
          <div className="random-exclusion-list">{visibleStudents.map((student) => <label key={student.id} className={excluded.has(student.id) ? 'excluded' : ''}><input type="checkbox" checked={excluded.has(student.id)} onChange={() => toggleExcluded(student.id)} disabled={phase === 'drawing'}/><span>{student.grade}학년</span><b>{student.fullName}</b>{wonToday.has(student.id) && <em>오늘 당첨</em>}</label>)}</div>
        </aside>
        <section className={`random-fishing-stage ${phase}`} aria-live="polite">
          <Image src="/random-draw-fishing.png" alt="호숫가에서 물고기를 낚는 어린이" fill priority sizes="(min-width: 900px) 70vw, 100vw"/>
          <div className="random-stage-shade"/>
          <div className="random-cast-line"><span/><i>🐟</i></div>
          <div className="random-result-card">
            {winner ? <>{winner.photoUrl ? <Image src={winner.photoUrl} alt={`${winner.fullName} 학생 얼굴`} width={132} height={132}/> : <div className="random-name-only">{winner.fullName.slice(0, 1)}</div>}<small>{winner.grade}학년 행운의 주인공</small><strong>{winner.fullName}</strong></> : <><div className="random-fish-placeholder">🐟</div><small>오늘의 행운을 기다리는 중</small><strong>누가 잡힐까요?</strong></>}
          </div>
          <div className="random-stage-action"><p>{message}</p><button type="button" onClick={startDraw} disabled={phase === 'drawing' || eligibleCount === 0}>{phase === 'drawing' ? '물고기를 끌어올리는 중…' : phase === 'winner' ? '한 번 더 낚기' : '낚싯대 던지기'}</button></div>
        </section>
      </div>
    </div>
  </>;
}
