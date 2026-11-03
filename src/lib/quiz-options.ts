export function arrangeQuizOptions<T>(options: T[], questionIndex: number) {
  if (options.length < 2) return options;

  const targetPosition = questionIndex % options.length;
  const offset = (options.length - targetPosition) % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
}
