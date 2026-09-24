'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { GemIcon } from '@/components/app-icon';

type DisplayStudent = { id:string; name:string; grade:number; gender:'male'|'female'; photoUrl:string|null };
export type DisplayRankGroup = { rank:number; balance:number; students:DisplayStudent[] };

const runnerAssets = {
  male: ['/gem-runner-boy-a.webp', '/gem-runner-boy-b.webp', '/gem-runner-boy-c.webp'],
  female: ['/gem-runner-girl-a.webp', '/gem-runner-girl-b.webp', '/gem-runner-girl-c.webp'],
};
const medals = ['금메달', '은메달', '동메달'];

function Runner({ student, index, rank, visible }: { student:DisplayStudent; index:number; rank:number; visible:boolean }) {
  const asset = runnerAssets[student.gender][index % 3];
  return <article className={`ranking-runner rank-${rank}${visible ? ' visible' : ''}`}>
    <div className="ranking-runner-art">
      <Image src={asset} alt="달리는 어린이 캐릭터" fill priority={rank === 1} sizes="20vw"/>
      <div className="ranking-runner-face">{student.photoUrl ? <Image src={student.photoUrl} alt={`${student.name} 학생 얼굴`} fill unoptimized sizes="10vw"/> : <span>{student.name.slice(-1)}</span>}</div>
    </div>
    <div className="ranking-runner-name"><b>{student.name}</b><small>{student.grade}학년</small></div>
  </article>;
}

export function GemRankingDisplay({ groups }: { groups:DisplayRankGroup[] }) {
  const [revealedRank, setRevealedRank] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [desktop, setDesktop] = useState<boolean|null>(null);

  useEffect(() => {
    const update = () => setDesktop(window.innerWidth >= 900);
    const fullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    update();
    window.addEventListener('resize', update);
    document.addEventListener('fullscreenchange', fullscreen);
    return () => { window.removeEventListener('resize', update); document.removeEventListener('fullscreenchange', fullscreen); };
  }, []);

  async function reveal() {
    if (isRevealing) return;
    setIsRevealing(true);
    setRevealedRank(0);
    for (let rank = 3; rank >= 1; rank -= 1) {
      await new Promise((resolve) => window.setTimeout(resolve, rank === 3 ? 450 : 1000));
      setRevealedRank((current) => Math.max(current, 4 - rank));
    }
    setIsRevealing(false);
  }

  async function toggleFullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* F11 remains available. */ }
  }

  if (desktop === false) return <main className="ranking-desktop-only"><GemIcon/><h1>PC 전용 순위 화면입니다</h1><p>PC에서 보석 통계 페이지를 열고 전체 보석 순위 공개 버튼을 이용해 주세요.</p><button type="button" onClick={() => window.close()}>창 닫기</button></main>;
  const revealThreshold = (rank:number) => rank === 3 ? 1 : rank === 2 ? 2 : 3;

  return <main className="gem-ranking-display">
    <Image className="gem-ranking-track" src="/gem-ranking-track.webp" alt="밝은 운동장의 달리기 트랙" fill priority sizes="100vw"/>
    <div className="gem-ranking-overlay"/>
    <header className="gem-ranking-toolbar"><div><p>DREAM GEM RANKING</p><h1>드림보석 명예의 레이스</h1></div><div><button type="button" onClick={reveal} disabled={isRevealing}>{isRevealing ? '순위 공개 중…' : revealedRank ? '다시 공개하기' : '순위 공개'}</button><button type="button" onClick={toggleFullscreen}>{isFullscreen ? '전체화면 종료' : '전체화면'}</button><button type="button" onClick={() => window.close()}>창 닫기</button></div></header>

    <section className="gem-ranking-track-stage" aria-live="polite">
      {[3,2,1].map((rank) => {
        const group = groups.find((item) => item.rank === rank);
        return <div className={`ranking-lane rank-${rank}`} key={rank}>{(group?.students ?? []).map((student, index) => <Runner key={student.id} student={student} index={index} rank={rank} visible={revealedRank >= revealThreshold(rank)}/>)}</div>;
      })}
      {!groups.length && <p className="ranking-empty">표시할 재학생이 없습니다.</p>}
    </section>

    <aside className="gem-ranking-board">
      <div className="gem-ranking-board-title"><GemIcon/><div><span>현재 보석 순위</span><b>TOP 3</b></div></div>
      {[1,2,3].map((rank) => {
        const group = groups.find((item) => item.rank === rank);
        const visible = revealedRank >= revealThreshold(rank);
        return <section className={`ranking-board-group rank-${rank}${visible ? ' visible' : ''}`} key={rank}>
          <div className="ranking-board-heading"><span className="ranking-medal" aria-hidden="true"><i/><GemIcon/></span><span className="ranking-medal-label">{medals[rank - 1]}</span><em><GemIcon/>{visible ? `${group?.balance ?? 0}개` : '공개 전'}</em></div>
          <ul>{visible ? (group?.students ?? []).map((student) => <li key={student.id}>{student.name}<small>{student.grade}학년</small></li>) : <li className="ranking-hidden">?</li>}</ul>
        </section>;
      })}
    </aside>
    <div className={`ranking-celebration${revealedRank === 3 ? ' active' : ''}`} aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index}/>)}</div>
  </main>;
}
