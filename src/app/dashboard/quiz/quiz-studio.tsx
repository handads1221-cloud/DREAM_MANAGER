'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createLiveRoom, deleteQuiz, saveQuiz, type QuizDraft } from './actions';

type QuizSummary = { id: string; title: string; description: string; createdAt: string; questionCount: number };
const newQuestion = () => ({ prompt: '', durationSeconds: 20, options: ['', '', '', ''], correctIndex: 0 });

export function QuizStudio({ quizzes }: { quizzes: QuizSummary[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [draft, setDraft] = useState<QuizDraft>({ title: '', description: '', questions: [newQuestion()] });

  function updateQuestion(index: number, patch: Partial<QuizDraft['questions'][number]>) {
    setDraft((current) => ({ ...current, questions: current.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question) }));
  }
  function submit() {
    setMessage('');
    startTransition(async () => {
      try {
        await saveQuiz(draft);
        setDraft({ title: '', description: '', questions: [newQuestion()] });
        setEditing(false);
        setMessage('퀴즈를 저장했습니다.');
        router.refresh();
      } catch (error) { setMessage(error instanceof Error ? error.message : '저장하지 못했습니다.'); }
    });
  }
  function launch(quizId: string) {
    setMessage('');
    startTransition(async () => {
      try { const code = await createLiveRoom(quizId); router.push(`/dashboard/quiz/${code}/host`); }
      catch (error) { setMessage(error instanceof Error ? error.message : '퀴즈방을 만들지 못했습니다.'); }
    });
  }

  return <div className="quiz-studio">
    <section className="quiz-hero"><div><small>LIVE QUIZ SHOW</small><h1>드림 라이브 퀴즈</h1><p>아이들이 스마트폰으로 함께 참여하는 실시간 퀴즈쇼예요.</p></div><button type="button" onClick={() => setEditing((value) => !value)}>{editing ? '작성 닫기' : '＋ 새 퀴즈 만들기'}</button></section>
    {message && <p className="quiz-message" role="status">{message}</p>}
    {editing && <section className="quiz-editor">
      <header><div><small>QUIZ BUILDER</small><h2>퀴즈 작성</h2></div><span>문제 {draft.questions.length}개</span></header>
      <label className="quiz-field"><span>퀴즈 제목</span><input value={draft.title} maxLength={80} placeholder="예: 성경 인물 퀴즈" onChange={(event) => setDraft({ ...draft, title: event.target.value })}/></label>
      <label className="quiz-field"><span>소개 (선택)</span><input value={draft.description} placeholder="아이들에게 보여줄 간단한 설명" onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label>
      <div className="quiz-question-list">{draft.questions.map((question, questionIndex) => <article className="quiz-question-editor" key={questionIndex}>
        <header><b>문제 {questionIndex + 1}</b><div><label>제한시간 <select value={question.durationSeconds} onChange={(event) => updateQuestion(questionIndex, { durationSeconds: Number(event.target.value) })}><option value={10}>10초</option><option value={20}>20초</option><option value={30}>30초</option><option value={45}>45초</option><option value={60}>60초</option></select></label>{draft.questions.length > 1 && <button type="button" onClick={() => setDraft({ ...draft, questions: draft.questions.filter((_, index) => index !== questionIndex) })}>삭제</button>}</div></header>
        <textarea value={question.prompt} maxLength={300} placeholder="문제를 입력해 주세요" onChange={(event) => updateQuestion(questionIndex, { prompt: event.target.value })}/>
        <div className="quiz-option-editor">{question.options.map((option, optionIndex) => <label key={optionIndex} className={question.correctIndex === optionIndex ? 'correct' : ''}><input type="radio" name={`correct-${questionIndex}`} checked={question.correctIndex === optionIndex} onChange={() => updateQuestion(questionIndex, { correctIndex: optionIndex })}/><span>{optionIndex + 1}</span><input value={option} maxLength={120} placeholder={`보기 ${optionIndex + 1}`} onChange={(event) => updateQuestion(questionIndex, { options: question.options.map((value, index) => index === optionIndex ? event.target.value : value) })}/></label>)}</div>
      </article>)}</div>
      <div className="quiz-editor-actions"><button type="button" className="secondary" onClick={() => setDraft({ ...draft, questions: [...draft.questions, newQuestion()] })}>＋ 문제 추가</button><button type="button" disabled={isPending} onClick={submit}>{isPending ? '저장 중...' : '퀴즈 저장'}</button></div>
    </section>}
    <section className="quiz-library"><header><div><small>MY QUIZZES</small><h2>저장된 퀴즈</h2></div><span>{quizzes.length}개</span></header>{quizzes.length === 0 ? <p className="quiz-empty">새 퀴즈를 만들어 첫 라이브 퀴즈쇼를 시작해 보세요.</p> : <div>{quizzes.map((quiz) => <article key={quiz.id}><div><small>{quiz.questionCount}문제</small><h3>{quiz.title}</h3><p>{quiz.description || '설명이 없는 퀴즈입니다.'}</p></div><div><button type="button" className="danger" disabled={isPending} onClick={() => startTransition(async () => { if (window.confirm('이 퀴즈를 삭제할까요?')) { await deleteQuiz(quiz.id); router.refresh(); } })}>삭제</button><button type="button" disabled={isPending} onClick={() => launch(quiz.id)}>라이브 시작</button></div></article>)}</div>}</section>
  </div>;
}
