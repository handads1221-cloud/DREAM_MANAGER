'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { avatarPosition } from '@/lib/quiz-avatars';

type Question = { id: string; prompt: string; position: number; durationSeconds: number; options: { id: string; label: string; position: number; isCorrect: boolean }[] };
type Room = { id: string; code: string; controlToken: string; state: string; currentQuestionIndex: number; questionStartedAt: string | null };
type RoomControlResult = { state: string; current_question_index: number; question_started_at: string | null };
type Participant = { id: string; display_name: string; avatar_key: string; score: number };
type HostState = { state: string; current_question_index: number; question_started_at: string | null; participants: Participant[]; answer_count: number };

export function QuizHost({ room: initialRoom, quiz, joinUrl, qrDataUrl }: { room: Room; quiz: { title: string; description: string; questions: Question[] }; joinUrl: string; qrDataUrl: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [room, setRoom] = useState(initialRoom);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [answerCount, setAnswerCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState('');
  const question = quiz.questions[room.currentQuestionIndex] ?? null;

  const broadcast = useCallback(async (event: string) => {
    const channel = supabase.channel(`quiz:${room.code}`);
    await channel.subscribe();
    await channel.send({ type: 'broadcast', event, payload: { at: Date.now() } });
    await supabase.removeChannel(channel);
  }, [room.code, supabase]);
  const refresh = useCallback(async () => {
    const { data, error: refreshError } = await supabase.rpc('get_live_quiz_host_state', { requested_room: room.id, requested_token: room.controlToken });
    if (refreshError) { setError('진행 정보를 불러오지 못했습니다. 화면을 새로고침해 주세요.'); return; }
    const hostState = data as HostState;
    setRoom((current) => ({ ...current, state: hostState.state, currentQuestionIndex: hostState.current_question_index, questionStartedAt: hostState.question_started_at }));
    setParticipants(hostState.participants ?? []);
    setAnswerCount(hostState.answer_count ?? 0);
  }, [room.controlToken, room.id, supabase]);

  useEffect(() => { const initial = window.setTimeout(() => void refresh(), 0); const timer = window.setInterval(refresh, 1500); const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement)); document.addEventListener('fullscreenchange', onFullscreen); return () => { window.clearTimeout(initial); window.clearInterval(timer); document.removeEventListener('fullscreenchange', onFullscreen); }; }, [refresh]);
  useEffect(() => { if (room.state !== 'question' || !question || !room.questionStartedAt) { const reset = window.setTimeout(() => setSecondsLeft(0), 0); return () => window.clearTimeout(reset); } const tick = () => { const elapsed = (Date.now() - new Date(room.questionStartedAt!).getTime()) / 1000; setSecondsLeft(Math.max(0, Math.ceil(question.durationSeconds - elapsed))); }; const timer = window.setInterval(tick, 250); return () => window.clearInterval(timer); }, [room.state, room.questionStartedAt, question]);

  async function updateRoom(state: 'question' | 'reveal' | 'finished', questionIndex: number | null, event: string) {
    setError('');
    const { data, error: updateError } = await supabase.rpc('control_live_quiz_room', {
      requested_room: room.id,
      requested_token: room.controlToken,
      requested_state: state,
      requested_question_index: questionIndex,
    });
    if (updateError) { setError('진행 상태를 저장하지 못했습니다. 잠시 후 다시 눌러 주세요.'); return; }
    const updated = data as RoomControlResult;
    setRoom((current) => ({ ...current, state: updated.state, currentQuestionIndex: updated.current_question_index, questionStartedAt: updated.question_started_at }));
    await broadcast(event);
  }
  async function startQuestion(index: number) { await updateRoom('question', index, 'state'); }
  async function reveal() { if (room.state === 'question') await updateRoom('reveal', room.currentQuestionIndex, 'state'); }
  async function next() { if (room.currentQuestionIndex + 1 < quiz.questions.length) await startQuestion(room.currentQuestionIndex + 1); else await updateRoom('finished', room.currentQuestionIndex, 'state'); }
  async function toggleFullscreen() { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }

  return <main className="quiz-host-page">
    <header className="quiz-host-toolbar"><button type="button" onClick={() => router.push('/dashboard/quiz')}>← 퀴즈 목록</button><div><button type="button" onClick={toggleFullscreen}>{isFullscreen ? '전체화면 종료' : '전체화면'}</button><button type="button" onClick={() => window.open(joinUrl, '_blank')}>참여 화면</button></div></header>
    {error && <p className="quiz-error" role="alert">{error}</p>}
    {room.state === 'lobby' && <section className="quiz-lobby"><div className="quiz-lobby-copy"><small>게임 준비 완료!</small><h1>{quiz.title}</h1><p>{quiz.description || '스마트폰으로 QR을 찍고 퀴즈에 참여해 주세요!'}</p><div className="quiz-room-code"><span>참여 코드</span><strong>{room.code}</strong></div><b>{participants.length}명 참여 완료</b><button type="button" disabled={participants.length === 0} onClick={() => startQuestion(0)}>첫 문제 시작</button></div><div className="quiz-lobby-qr"><Image unoptimized src={qrDataUrl} alt={`${room.code} 퀴즈 참여 QR 코드`} width={420} height={420}/><span>{joinUrl}</span></div><div className="quiz-participant-cloud">{participants.map((participant) => <div key={participant.id}><span className="quiz-avatar" style={{ backgroundPosition: avatarPosition(participant.avatar_key) }}/><b>{participant.display_name}</b></div>)}</div></section>}
    {room.state !== 'lobby' && room.state !== 'finished' && question && <section className="quiz-host-question"><header><span>문제 {room.currentQuestionIndex + 1} / {quiz.questions.length}</span><strong className={secondsLeft <= 5 && room.state === 'question' ? 'urgent' : ''}>{room.state === 'reveal' ? '정답 공개!' : secondsLeft}</strong><span>{answerCount} / {participants.length}명 답변</span></header><h1>{question.prompt}</h1><div className="quiz-host-options">{question.options.map((option) => <article className={room.state === 'reveal' && option.isCorrect ? 'correct' : ''} key={option.id}><span>{option.position + 1}</span><b>{option.label}</b>{room.state === 'reveal' && option.isCorrect && <em>정답</em>}</article>)}</div><footer>{room.state === 'question' ? <button type="button" onClick={reveal}>답변 마감 · 정답 공개</button> : <button type="button" onClick={next}>{room.currentQuestionIndex + 1 < quiz.questions.length ? '다음 문제' : '최종 순위 보기'}</button>}</footer></section>}
    {room.state === 'finished' && <section className="quiz-final"><small>최종 순위</small><h1>퀴즈왕을 축하해요!</h1><div>{participants.slice(0, 10).map((participant, index, ranked) => { const rank = new Set(ranked.slice(0, index).map((item) => item.score)).size + 1; return <article key={participant.id} className={rank <= 3 ? `rank-${rank}` : ''}><strong>{rank}</strong><span className="quiz-avatar" style={{ backgroundPosition: avatarPosition(participant.avatar_key) }}/><b>{participant.display_name}</b><em>{participant.score.toLocaleString()}점</em></article>; })}</div><button type="button" onClick={() => router.push('/dashboard/quiz')}>퀴즈 목록으로</button></section>}
  </main>;
}
