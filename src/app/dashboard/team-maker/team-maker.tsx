'use client';

import { useState } from 'react';

type Attendee = { id: string; name: string; grade: number };
type TeamCount = 2 | 4;

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function divideTeams(attendees: Attendee[], teamCount: TeamCount, randomize = false) {
  const teams = Array.from({ length: teamCount }, () => [] as Attendee[]);
  const byGrade = new Map<number, Attendee[]>();
  for (const attendee of attendees) byGrade.set(attendee.grade, [...(byGrade.get(attendee.grade) ?? []), attendee]);

  [...byGrade.entries()].sort(([left], [right]) => left - right).forEach(([, gradeStudents], gradeIndex) => {
    const students = randomize ? shuffled(gradeStudents) : [...gradeStudents].sort((left, right) => left.name.localeCompare(right.name, 'ko'));
    const start = randomize ? Math.floor(Math.random() * teamCount) : gradeIndex % teamCount;
    students.forEach((student, studentIndex) => {
      const preferred = (start + studentIndex) % teamCount;
      const smallestSize = Math.min(...teams.map((team) => team.length));
      const available = teams.map((team, index) => ({ index, size: team.length })).filter((team) => team.size === smallestSize).map((team) => team.index);
      const target = available.includes(preferred) ? preferred : available[(studentIndex + gradeIndex) % available.length];
      teams[target].push(student);
    });
  });
  return teams;
}

export function TeamMaker({ attendees }: { attendees: Attendee[] }) {
  const [teamCount, setTeamCount] = useState<TeamCount>(2);
  const [teams, setTeams] = useState(() => divideTeams(attendees, 2));

  const changeCount = (count: TeamCount) => {
    setTeamCount(count);
    setTeams(divideTeams(attendees, count, true));
  };

  return <section className="team-maker">
    <div className="team-maker-toolbar">
      <div role="group" aria-label="팀 개수 선택">
        <button className={teamCount === 2 ? 'active' : ''} type="button" onClick={() => changeCount(2)}>2팀</button>
        <button className={teamCount === 4 ? 'active' : ''} type="button" onClick={() => changeCount(4)}>4팀</button>
      </div>
      <button className="team-reshuffle" type="button" disabled={!attendees.length} onClick={() => setTeams(divideTeams(attendees, teamCount, true))}>다시 섞기</button>
    </div>
    {!attendees.length ? <p className="team-maker-empty">오늘 등록된 출석 인원이 없습니다.</p> : <div className={`team-quadrants teams-${teamCount}`}>
      {teams.map((team, index) => <article key={index} className={`team-panel team-${index + 1}`}>
        <header><h2>{index + 1}팀</h2><span>{team.length}명</span></header>
        <div>{team.map((student) => <strong key={student.id}>{student.name}</strong>)}</div>
      </article>)}
    </div>}
  </section>;
}
