import { QuizJoin } from './quiz-join';

export default async function PublicQuizJoinPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code = '' } = await searchParams;
  return <QuizJoin initialCode={code.replace(/\D/g, '').slice(0, 6)}/>;
}
