function seededScore(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function arrangeQuizOptions<T extends { id: string }>(options: T[], roomCode: string, questionId: string) {
  if (options.length < 2) return options;

  const seed = `${roomCode}:${questionId}`;
  return [...options].sort((left, right) => {
    const difference = seededScore(`${seed}:${left.id}`) - seededScore(`${seed}:${right.id}`);
    return difference || left.id.localeCompare(right.id);
  });
}
