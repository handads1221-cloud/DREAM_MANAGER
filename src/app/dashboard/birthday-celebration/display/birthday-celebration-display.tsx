'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import type { BirthdayPerson } from '../birthday-celebration-manager';

export function BirthdayCelebrationDisplay({ people, months }: { people: BirthdayPerson[]; months: number[] }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [celebrating, setCelebrating] = useState(true);
  useEffect(() => { const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', onChange); return () => document.removeEventListener('fullscreenchange', onChange); }, []);
  async function toggleFullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
  function replay() { setCelebrating(false); window.setTimeout(() => setCelebrating(true), 60); }
  const monthTitle = months.length === 1 ? `${months[0]}월` : `${months.join('·')}월`;
  const sizeClass = people.length > 14 ? 'many' : people.length > 8 ? 'medium' : 'few';
  return <main className={`birthday-display ${celebrating ? 'celebrating' : ''}`}>
    <Image className="birthday-display-background" src="/birthday-celebration-bg.png" alt="예수님과 아이들이 밝은 정원에서 생일을 축하하는 모습" fill priority sizes="100vw"/>
    <header className="birthday-display-toolbar"><button type="button" onClick={replay}>다시 축하하기</button><button type="button" onClick={toggleFullscreen}>{isFullscreen ? '전체화면 종료' : '전체화면'}</button><button type="button" onClick={() => window.close()}>창 닫기</button></header>
    <section className="birthday-display-content"><Image className="birthday-name-panel" src="/birthday-name-panel.png" alt="" fill priority sizes="65vw"/><div className="birthday-display-copy"><p>{monthTitle} 생일을 축하해요!</p><h1>사랑하고 축복합니다</h1><div className={`birthday-display-names ${sizeClass}`}>{people.map((person, index) => <span key={`${person.personType}-${person.id}`} style={{ animationDelay: `${Math.min(index * 90, 900)}ms` }}><b>{person.fullName}</b><small>{person.personType === 'teacher' ? '선생님' : `${Number(person.monthDay.slice(0, 2))}/${Number(person.monthDay.slice(3, 5))}`}</small></span>)}</div></div></section>
    <div className="birthday-heart-shower" aria-hidden="true">{Array.from({ length: 30 }, (_, index) => <i key={index} style={{ left: `${(index * 37) % 97}%`, animationDelay: `-${(index * 0.47).toFixed(2)}s`, animationDuration: `${5.8 + (index % 5) * 0.65}s`, fontSize: `${13 + (index % 4) * 4}px` }}>♥</i>)}</div>
  </main>;
}
