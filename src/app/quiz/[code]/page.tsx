import { QuizPlayer } from './quiz-player';

export default async function QuizPlayerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <QuizPlayer code={code}/>;
}
