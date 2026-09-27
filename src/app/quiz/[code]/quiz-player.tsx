'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { avatarPosition } from '@/lib/quiz-avatars';

type Session = { participantId: string; token: string; name: string; avatar: string };
type LiveState = { state: 'lobby' | 'question' | 'reveal' | 'finished'; question_index: number; question_started_at: string | null; participant_count: number; question: null | { id: string; prompt: string; duration_seconds: number; options: { id: string; label: string; position: number }[] }; participant: { id: string; name: string; avatar_key: string; score: number; answered: boolean } | null; leaderboard: { name: string; avatar_key: string; score: number; rank: number }[] };

export function QuizPlayer({ code }: { code: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [live, setLive] = useState<LiveState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [error, setError] = useState('');

  const refresh = useCallback(async (currentSession: Session) => {
    const { data, error: stateError } = await supabase.rpc('get_live_quiz_state', { requested_code: code, requested_participant: currentSession.participantId, requested_token: currentSession.token });
    if (stateError) { setError(stateError.message); return; }
    setLive(data as LiveState);
  }, [code, supabase]);
  useEffect(() => {
    const raw = window.localStorage.getItem(`dream-quiz-${code}`);
    if (!raw) { router.replace(`/quiz?code=${code}`); return; }
    const current = JSON.parse(raw) as Session;
    const initialize = window.setTimeout(() => { setSession(current); void refresh(current); }, 0);
    const channel = supabase.channel(`quiz:${code}`).on('broadcast', { event: 'state' }, () => void refresh(current)).subscribe();
    const timer = window.setInterval(() => void refresh(current), 2500);
    return () => { window.clearTimeout(initialize); window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [code, refresh, router, supabase]);
  useEffect(() => { const reset = window.setTimeout(() => setSelected(null), 0); return () => window.clearTimeout(reset); }, [live?.question?.id]);
  useEffect(() => { if (live?.state !== 'question' || !live.question || !live.question_started_at) { const reset = window.setTimeout(() => setSecondsLeft(0), 0); return () => window.clearTimeout(reset); } const tick = () => setSecondsLeft(Math.max(0, Math.ceil(live.question!.duration_seconds - (Date.now() - new Date(live.question_started_at!).getTime()) / 1000))); const timer = window.setInterval(tick, 250); return () => window.clearInterval(timer); }, [live?.state, live?.question, live?.question_started_at]);

  async function answer(optionId: string) {
    if (!session || live?.participant?.answered || submitting) return;
    setSelected(optionId); setSubmitting(true);
    const { error: answerError } = await supabase.rpc('submit_live_quiz_answer', { requested_code: code, requested_participant: session.participantId, requested_token: session.token, requested_option: optionId });
    if (answerError) setError(answerError.message); else await refresh(session);
    setSubmitting(false);
  }
  if (!session || !live) return <main className="quiz-player-page"><div className="quiz-player-wait"><span className="quiz-loading">● ● ●</span><h1>퀴즈방에 연결하고 있어요</h1></div></main>;
  if (error) return <main className="quiz-player-page"><div className="quiz-player-wait"><h1>연결을 확인해 주세요</h1><p>{error}</p><button onClick={() => router.replace(`/quiz?code=${code}`)}>다시 입장하기</button></div></main>;

  return <main className="quiz-player-page"><header className="quiz-player-header"><div><span className="quiz-avatar" style={{ backgroundPosition: avatarPosition(session.avatar) }}/><b>{session.name}</b></div><strong>{live.participant?.score.toLocaleString() ?? 0}점</strong></header>
    {live.state === 'lobby' && <section className="quiz-player-wait"><small>현재 {live.participant_count}명 입장</small><h1>잠시만 기다려 주세요!</h1><p>선생님이 곧 퀴즈를 시작할 거예요.</p><div className="quiz-bubble-mascot"><span className="quiz-avatar" style={{ backgroundPosition: avatarPosition(session.avatar) }}/></div></section>}
    {live.state === 'question' && live.question && <section className="quiz-player-question"><header><span>문제 {live.question_index + 1}</span><strong className={secondsLeft <= 5 ? 'urgent' : ''}>{secondsLeft}</strong></header><h1>{live.question.prompt}</h1>{live.participant?.answered ? <div className="quiz-answer-sent"><b>답변 완료!</b><p>다른 친구들의 답변을 기다리고 있어요.</p></div> : <div className="quiz-player-options">{live.question.options.map((option) => <button type="button" key={option.id} className={selected === option.id ? 'selected' : ''} disabled={submitting || secondsLeft === 0} onClick={() => answer(option.id)}><span>{option.position + 1}</span><b>{option.label}</b></button>)}</div>}</section>}
    {live.state === 'reveal' && <section className="quiz-player-result"><small>현재 점수</small><strong>{live.participant?.score.toLocaleString() ?? 0}</strong><h1>정답을 확인해 봐요!</h1><p>다음 문제를 기다려 주세요.</p>{live.leaderboard.slice(0, 5).map((ranker) => <div key={`${ranker.rank}-${ranker.name}`}><b>{ranker.rank}위 {ranker.name}</b><span>{ranker.score.toLocaleString()}점</span></div>)}</section>}
    {live.state === 'finished' && <section className="quiz-player-final"><small>QUIZ COMPLETE</small><h1>정말 잘했어요!</h1><strong>{live.participant?.score.toLocaleString() ?? 0}점</strong><div>{live.leaderboard.slice(0, 10).map((ranker) => <article key={`${ranker.rank}-${ranker.name}`}><span>{ranker.rank}</span><i className="quiz-avatar" style={{ backgroundPosition: avatarPosition(ranker.avatar_key) }}/><b>{ranker.name}</b><em>{ranker.score.toLocaleString()}점</em></article>)}</div></section>}
  </main>;
}
