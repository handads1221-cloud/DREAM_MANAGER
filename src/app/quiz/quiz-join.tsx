'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { quizAvatars } from '@/lib/quiz-avatars';

export function QuizJoin({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [isPending, startTransition] = useTransition();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(quizAvatars[0].key);
  const [message, setMessage] = useState('');

  function join() {
    setMessage('');
    startTransition(async () => {
      try {
        const token = crypto.randomUUID();
        const { data, error } = await supabase.rpc('join_quiz_room', { requested_code: code, requested_name: name, requested_avatar: avatar, requested_token: token });
        if (error) throw error;
        const session = { participantId: data.participant_id as string, token, name, avatar };
        window.localStorage.setItem(`dream-quiz-${code}`, JSON.stringify(session));
        router.push(`/quiz/${code}`);
      } catch (error) { setMessage(error instanceof Error ? error.message : '퀴즈방에 입장하지 못했습니다.'); }
    });
  }

  return <main className="quiz-public-page"><section className="quiz-join-card"><header><small>DREAM LIVE QUIZ</small><h1>퀴즈쇼에 참여해요!</h1><p>참여코드와 이름을 입력하고 마음에 드는 동물 친구를 골라 주세요.</p></header><label><span>참여코드</span><input inputMode="numeric" maxLength={6} value={code} placeholder="6자리 숫자" onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}/></label><label><span>이름</span><input maxLength={20} value={name} placeholder="내 이름" onChange={(event) => setName(event.target.value)}/></label><fieldset><legend>나의 아바타</legend><div className="quiz-avatar-picker">{quizAvatars.map((item) => <button type="button" key={item.key} className={avatar === item.key ? 'selected' : ''} onClick={() => setAvatar(item.key)} aria-label={item.name}><span className="quiz-avatar" style={{ backgroundPosition: item.position }}/><small>{item.name}</small></button>)}</div></fieldset>{message && <p className="quiz-error" role="alert">{message}</p>}<button className="quiz-join-button" type="button" disabled={isPending || code.length !== 6 || !name.trim()} onClick={join}>{isPending ? '입장 중...' : '퀴즈방 입장하기'}</button></section></main>;
}
