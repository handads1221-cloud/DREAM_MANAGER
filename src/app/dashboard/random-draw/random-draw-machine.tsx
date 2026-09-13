'use client';

import { useMemo, useState } from 'react';

export type DrawStudent = { id: string; fullName: string; grade: number; photoUrl: string | null };

export function RandomDrawMachine({ students, todayWinnerIds }: { students: DrawStudent[]; todayWinnerIds: string[] }) {
  const [grade, setGrade] = useState('all');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [preventDuplicate, setPreventDuplicate] = useState(true);
  const [message, setMessage] = useState('옵션을 선택한 뒤 전용 추첨 화면을 열어 주세요.');
  const wonToday = useMemo(() => new Set(todayWinnerIds), [todayWinnerIds]);
  const visibleStudents = useMemo(() => students.filter((student) => grade === 'all' || student.grade === Number(grade)), [grade, students]);
  const eligibleCount = visibleStudents.filter((student) => !excluded.has(student.id) && (!preventDuplicate || !wonToday.has(student.id))).length;

  function toggleExcluded(id: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function openDrawWindow() {
    if (eligibleCount === 0) {
      setMessage('추첨 가능한 학생이 없습니다. 제외 명단이나 중복 방지 설정을 확인해 주세요.');
      return;
    }
    const params = new URLSearchParams({ grade, preventDuplicate: String(preventDuplicate) });
    excluded.forEach((id) => params.append('excluded', id));
    const popup = window.open(`/dashboard/random-draw/display?${params.toString()}`, 'dream-random-draw-display', 'popup=yes,width=1440,height=900,menubar=no,toolbar=no,location=no,status=no,scrollbars=no,resizable=yes');
    if (!popup) {
      setMessage('새 창이 차단되었습니다. 브라우저 주소창의 팝업 차단을 허용한 뒤 다시 눌러 주세요.');
      return;
    }
    popup.focus();
    setMessage('전용 추첨 화면을 열었습니다. 새 창에서 전체화면 버튼을 눌러 주세요.');
  }

  return <>
    <section className="random-draw-mobile-notice"><span>🎣</span><h2>PC에서 이용해 주세요</h2><p>랜덤 뽑기는 관리자 PC 화면에서만 사용할 수 있습니다.</p></section>
    <div className="random-draw-desktop">
      <header className="random-draw-heading"><div><p>ADMIN RANDOM DRAW</p><h1>행운의 물고기를 낚아라!</h1><span>옵션은 이곳에서 선택하고, 추첨은 별도의 전체화면 창에서 진행합니다.</span></div><div className="random-draw-count"><strong>{eligibleCount}</strong><span>현재 추첨 가능</span></div></header>
      <div className="random-draw-layout">
        <aside className="random-draw-controls">
          <label className="random-control-label">학년 선택<select value={grade} onChange={(event) => setGrade(event.target.value)}><option value="all">전체 학년</option>{[1,2,3,4,5,6].map((value) => <option key={value} value={value}>{value}학년</option>)}</select></label>
          <label className="random-switch"><input type="checkbox" checked={preventDuplicate} onChange={(event) => setPreventDuplicate(event.target.checked)}/><span><b>같은 날 중복 당첨 방지</b><small>오늘 당첨된 학생은 다시 뽑지 않아요.</small></span></label>
          <div className="random-exclusion-heading"><div><b>제외 LIST</b><small>{excluded.size}명 제외 중</small></div><button type="button" onClick={() => setExcluded(new Set())} disabled={!excluded.size}>전체 해제</button></div>
          <div className="random-exclusion-list">{visibleStudents.map((student) => <label key={student.id} className={excluded.has(student.id) ? 'excluded' : ''}><input type="checkbox" checked={excluded.has(student.id)} onChange={() => toggleExcluded(student.id)}/><span>{student.grade}학년</span><b>{student.fullName}</b>{wonToday.has(student.id) ? <em>오늘 당첨</em> : null}</label>)}</div>
        </aside>
        <section className="random-draw-launch-card">
          <div className="random-draw-launch-visual" aria-hidden="true"><span>🎣</span><i>🐟</i></div><p>DRAW DISPLAY</p><h2>추첨 준비가 끝났어요!</h2>
          <dl><div><dt>선택 학년</dt><dd>{grade === 'all' ? '전체 학년' : `${grade}학년`}</dd></div><div><dt>제외 인원</dt><dd>{excluded.size}명</dd></div><div><dt>중복 방지</dt><dd>{preventDuplicate ? '사용' : '사용 안 함'}</dd></div></dl>
          <button type="button" onClick={openDrawWindow}>새 창에서 추첨하기 <span aria-hidden="true">↗</span></button><small role="status">{message}</small>
        </section>
      </div>
    </div>
  </>;
}
