'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
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
  const touchStartX = useRef<number | null>(null);
  const avatarIndex = Math.max(0, quizAvatars.findIndex((item) => item.key === avatar));
  const selectedAvatar = quizAvatars[avatarIndex];

  function moveAvatar(direction: -1 | 1) {
    const nextIndex = (avatarIndex + direction + quizAvatars.length) % quizAvatars.length;
    setAvatar(quizAvatars[nextIndex].key);
  }

  function finishSwipe(clientX: number) {
    if (touchStartX.current === null) return;
    const distance = clientX - touchStartX.current;
    if (Math.abs(distance) > 42) moveAvatar(distance > 0 ? -1 : 1);
    touchStartX.current = null;
  }

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

  return <main className="quiz-public-page"><section className="quiz-join-card"><header><small>DREAM LIVE QUIZ</small><h1>퀴즈쇼에 참여해요!</h1><p>참여코드와 이름을 입력하고 마음에 드는 동물 친구를 골라 주세요.</p></header><label><span>참여코드</span><input inputMode="numeric" maxLength={6} value={code} placeholder="6자리 숫자" onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}/></label><label><span>이름</span><input maxLength={20} value={name} placeholder="내 이름" onChange={(event) => setName(event.target.value)}/></label><fieldset><legend>나의 아바타</legend><div className="quiz-avatar-carousel"><button type="button" className="quiz-avatar-arrow previous" onClick={() => moveAvatar(-1)} aria-label="이전 캐릭터">‹</button><div className="quiz-avatar-slide" role="group" aria-label={`${selectedAvatar.name}, ${selectedAvatar.character}`} onTouchStart={(event) => { touchStartX.current = event.changedTouches[0].clientX; }} onTouchEnd={(event) => finishSwipe(event.changedTouches[0].clientX)}><span className="quiz-avatar" style={{ backgroundPosition: selectedAvatar.position }}/><strong>{selectedAvatar.name}</strong><p>{selectedAvatar.character}</p><small>{selectedAvatar.origin} 이름 · {avatarIndex + 1} / {quizAvatars.length}</small></div><button type="button" className="quiz-avatar-arrow next" onClick={() => moveAvatar(1)} aria-label="다음 캐릭터">›</button></div><div className="quiz-avatar-dots" aria-label="캐릭터 바로 선택">{quizAvatars.map((item, index) => <button type="button" key={item.key} className={index === avatarIndex ? 'selected' : ''} onClick={() => setAvatar(item.key)} aria-label={`${item.name} 선택`} />)}</div><p className="quiz-avatar-hint">좌우로 넘겨서 캐릭터를 골라 보세요</p></fieldset>{message && <p className="quiz-error" role="alert">{message}</p>}<button className="quiz-join-button" type="button" disabled={isPending || code.length !== 6 || !name.trim()} onClick={join}>{isPending ? '입장 중...' : '퀴즈방 입장하기'}</button></section></main>;
}
