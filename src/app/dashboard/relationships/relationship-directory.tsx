'use client';

import { useMemo, useState } from 'react';

type RelationshipStudent = { id: string; full_name: string; grade: number; class_name: string | null; studentAccount: string; parent: string };

export function RelationshipDirectory({ students }: { students: RelationshipStudent[] }) {
  const [grade, setGrade] = useState<number | 'all'>('all'); const visible = useMemo(() => grade === 'all' ? students : students.filter((student) => student.grade === grade), [grade, students]); const counts = useMemo(() => students.reduce<Record<number, number>>((all, student) => ({ ...all, [student.grade]: (all[student.grade] ?? 0) + 1 }), {}), [students]);
  return <section className="relationship-directory"><h2>현재 연결 현황</h2><div className="management-grade-filter"><button className={grade === 'all' ? 'active' : ''} onClick={() => setGrade('all')}>전체 <span>{students.length}</span></button>{[1,2,3,4,5,6].map((item) => <button key={item} className={grade === item ? 'active' : ''} onClick={() => setGrade(item)}>{item}학년 <span>{counts[item] ?? 0}</span></button>)}</div><div className="relationship-table"><div className="relationship-table-head"><span>학년</span><span>이름</span><span>반</span><span>학생계정</span><span>부모계정</span></div>{visible.map((student) => <div className="relationship-row" key={student.id}><span>{student.grade}학년</span><b>{student.full_name}</b><span>{student.class_name ?? '반 미정'}</span><span className={student.studentAccount === '미연결' ? 'unlinked' : ''}>{student.studentAccount}</span><span className={student.parent === '미연결' ? 'unlinked' : ''}>{student.parent}</span></div>)}</div></section>;
}
