'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { GemIcon } from '@/components/app-icon';

export type GemRankingStudent = { id:string; name:string; grade:number; balance:number; photoUrl:string|null };
type RankedStudent = GemRankingStudent & { rank:number };

function rankStudents(students: GemRankingStudent[]): RankedStudent[] {
  const sorted = [...students].sort((a,b) => b.balance-a.balance || a.grade-b.grade || a.name.localeCompare(b.name,'ko'));
  let rank=0; let previous:number|null=null;
  return sorted.map((student) => { if (student.balance !== previous) { rank += 1; previous=student.balance; } return { ...student, rank }; });
}

function StudentAvatar({ student }: { student:GemRankingStudent }) {
  return student.photoUrl ? <Image className="gem-rank-avatar" src={student.photoUrl} alt={`${student.name} 얼굴 사진`} width={40} height={40}/> : <span className={`gem-rank-avatar placeholder grade-${student.grade}`}>{student.name.slice(-1)}</span>;
}

export function GemStatistics({ students }: { students:GemRankingStudent[] }) {
  const [grade,setGrade]=useState<number|'all'>('all'); const [expanded,setExpanded]=useState(false);
  const filtered=useMemo(()=>grade==='all'?students:students.filter(student=>student.grade===grade),[grade,students]);
  const ranked=useMemo(()=>rankStudents(filtered),[filtered]);
  const positive=filtered.filter(student=>student.balance>0); const total=filtered.reduce((sum,student)=>sum+student.balance,0); const average=filtered.length?total/filtered.length:0;
  const top=ranked.filter(student=>student.balance>0&&student.rank<=5); const shown=expanded?ranked:top;
  const counts=students.reduce<Record<number,number>>((all,student)=>({...all,[student.grade]:(all[student.grade]??0)+1}),{});
  return <section className="gem-statistics">
    <div className="gem-stat-summary"><article><span>보유 보석 합계</span><strong><GemIcon/> {total.toLocaleString()}개</strong></article><article><span>학생 1인 평균</span><strong>{average.toFixed(1)}개</strong></article><article><span>보유 학생</span><strong>{positive.length}명</strong></article></div>
    <div className="management-grade-filter gem-stat-filter"><button className={grade==='all'?'active':''} onClick={()=>{setGrade('all');setExpanded(false);}}>전체 <span>{students.length}</span></button>{[1,2,3,4,5,6].map(item=><button key={item} className={grade===item?'active':''} onClick={()=>{setGrade(item);setExpanded(false);}}>{item}학년 <span>{counts[item]??0}</span></button>)}</div>
    <div className="gem-ranking-card"><div className="gem-ranking-heading"><div><p className="eyebrow">{expanded?'ALL RANKING':'TOP 5'}</p><h2>{grade==='all'?'전체':`${grade}학년`} 보석 순위</h2></div><span>{filtered.length}명 기준</span></div>
      <div className="gem-ranking-head"><span>순위</span><span>학생</span><span>학년</span><span>보석</span></div>
      <div className="gem-ranking-list">{shown.map(student=><div className={`gem-ranking-row rank-${student.rank}`} key={student.id}><strong>{student.rank<=3?['🥇','🥈','🥉'][student.rank-1]:student.rank}</strong><div><StudentAvatar student={student}/><b>{student.name}</b></div><span>{student.grade}학년</span><em><GemIcon/> {student.balance}개</em></div>)}{shown.length===0&&<p>표시할 보석 보유 학생이 없습니다.</p>}</div>
      {ranked.length>top.length&&<button className="gem-ranking-toggle" onClick={()=>setExpanded(current=>!current)}>{expanded?'TOP 5만 보기':'전체 순위 보기'}</button>}
    </div>
  </section>;
}
