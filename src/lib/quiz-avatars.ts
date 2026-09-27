export type QuizAvatar = { key: string; name: string; position: string };

export const quizAvatars: QuizAvatar[] = [
  { key: 'fox-detective', name: '탐정 여우', position: '0% 0%' },
  { key: 'rabbit-doctor', name: '의사 토끼', position: '25% 0%' },
  { key: 'bear-firefighter', name: '소방관 곰', position: '50% 0%' },
  { key: 'otter-scientist', name: '과학자 수달', position: '75% 0%' },
  { key: 'lion-chef', name: '요리사 사자', position: '100% 0%' },
  { key: 'cat-astronaut', name: '우주비행사 고양이', position: '0% 100%' },
  { key: 'panda-artist', name: '화가 판다', position: '25% 100%' },
  { key: 'dog-police', name: '경찰 강아지', position: '50% 100%' },
  { key: 'deer-teacher', name: '선생님 사슴', position: '75% 100%' },
  { key: 'raccoon-mechanic', name: '정비사 너구리', position: '100% 100%' },
];

export function avatarPosition(key: string) {
  return quizAvatars.find((avatar) => avatar.key === key)?.position ?? quizAvatars[0].position;
}
