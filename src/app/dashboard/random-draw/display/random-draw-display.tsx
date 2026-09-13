'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { drawRandomStudent } from '../actions';
import type { DrawStudent } from '../random-draw-machine';

type DrawConfig = { version: 1; grade: string; excludedStudentIds: string[]; preventDuplicate: boolean };

function readConfig(configKey: string, studentIds: Set<string>): DrawConfig | null {
  try {
    const saved = localStorage.getItem(configKey);
    localStorage.removeItem(configKey);
    if (!saved) return null;
    const value = JSON.parse(saved) as Partial<DrawConfig>;
    const validGrade = value.grade === 'all' || ['1', '2', '3', '4', '5', '6'].includes(String(value.grade));
    if (value.version !== 1 || !validGrade || typeof value.preventDuplicate !== 'boolean' || !Array.isArray(value.excludedStudentIds)) return null;
    return { version: 1, grade: String(value.grade), preventDuplicate: value.preventDuplicate, excludedStudentIds: value.excludedStudentIds.filter((id): id is string => typeof id === 'string' && studentIds.has(id)) };
  } catch {
    return null;
  }
}

export function RandomDrawDisplay({ configKey, students, todayWinnerIds }: { configKey: string; students: DrawStudent[]; todayWinnerIds: string[] }) {
  const studentIds = useMemo(() => new Set(students.map((student) => student.id)), [students]);
  const [config, setConfig] = useState<DrawConfig | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [wonToday, setWonToday] = useState<Set<string>>(new Set(todayWinnerIds));
  const [phase, setPhase] = useState<'ready' | 'drawing' | 'winner'>('ready');
  const [winner, setWinner] = useState<DrawStudent | null>(null);
  const [message, setMessage] = useState('낚싯대를 던져 오늘의 행운을 만나 보세요!');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const task = window.setTimeout(() => {
      setConfig(readConfig(configKey, studentIds));
      setConfigLoaded(true);
    }, 0);
    return () => window.clearTimeout(task);
  }, [configKey, studentIds]);

  useEffect(() => {
    function handleFullscreenChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const eligibleCount = config ? students.filter((student) => (config.grade === 'all' || student.grade === Number(config.grade)) && !config.excludedStudentIds.includes(student.id) && (!config.preventDuplicate || !wonToday.has(student.id))).length : 0;

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen();
    } catch {
      setMessage('브라우저에서 전체화면 전환을 허용하지 않았습니다. F11 키를 이용해 주세요.');
    }
  }

  async function startDraw() {
    if (!config || phase === 'drawing') return;
    if (eligibleCount === 0) { setMessage('추첨 가능한 학생이 없습니다. 옵션 창에서 설정을 다시 선택해 주세요.'); return; }
    setWinner(null);
    setMessage('낚싯대를 던졌어요… 누가 올라올까요?');
    setPhase('drawing');
    const formData = new FormData();
    formData.set('grade', config.grade);
    formData.set('prevent_duplicate', String(config.preventDuplicate));
    config.excludedStudentIds.forEach((id) => formData.append('excluded_student_ids', id));
    const minimumMotion = new Promise((resolve) => window.setTimeout(resolve, 3000));
    const [result] = await Promise.all([drawRandomStudent(formData), minimumMotion]);
    if (!result.ok) { setPhase('ready'); setMessage(result.message); return; }
    const selected = students.find((student) => student.id === result.winner.id) ?? { id: result.winner.id, fullName: result.winner.fullName, grade: result.winner.grade, photoUrl: null };
    setWonToday((current) => new Set(current).add(selected.id));
    setWinner(selected);
    setMessage(result.message);
    setPhase('winner');
  }

  if (configLoaded && !config) return <main className="random-draw-display-error"><span>🎣</span><h1>추첨 설정을 불러올 수 없어요</h1><p>랜덤 뽑기 옵션 화면에서 다시 새 창을 열어 주세요.</p><button type="button" onClick={() => window.close()}>창 닫기</button></main>;

  return <main className="random-draw-display-page"><section className={`random-fishing-stage random-draw-display-stage ${phase}`} aria-live="polite">
    <Image src="/random-draw-fishing.png" alt="예수님과 어린이가 호숫가에서 함께 물고기를 낚는 모습" fill priority sizes="100vw"/><div className="random-stage-shade"/>
    <header className="random-display-toolbar"><div><p>행운의 물고기를 낚아라!</p><span>{config ? `${config.grade === 'all' ? '전체 학년' : `${config.grade}학년`} · ${eligibleCount}명 추첨 가능 · 중복 방지 ${config.preventDuplicate ? '켜짐' : '꺼짐'}` : '추첨 설정을 불러오는 중'}</span></div><div><button type="button" onClick={toggleFullscreen}>{isFullscreen ? '전체화면 종료' : '전체화면'}</button><button type="button" onClick={() => window.close()}>창 닫기</button></div></header>
    <div className="random-cast-line"><span/><i>🐟</i></div>
    <div className="random-result-card">{winner ? <>{winner.photoUrl ? <Image src={winner.photoUrl} alt={`${winner.fullName} 학생 얼굴`} width={160} height={160}/> : <div className="random-name-only">{winner.fullName.slice(0, 1)}</div>}<small>{winner.grade}학년 행운의 주인공</small><strong>{winner.fullName}</strong></> : <><div className="random-fish-placeholder">🐟</div><small>오늘의 행운을 기다리는 중</small><strong>누가 잡힐까요?</strong></>}</div>
    <div className="random-stage-action"><p>{configLoaded ? message : '추첨 설정을 불러오는 중입니다…'}</p><button type="button" onClick={startDraw} disabled={!config || phase === 'drawing' || eligibleCount === 0}>{phase === 'drawing' ? '물고기를 끌어올리는 중…' : phase === 'winner' ? '한 번 더 낚기' : '낚싯대 던지기'}</button></div>
  </section></main>;
}
