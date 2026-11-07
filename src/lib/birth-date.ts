export function birthDateFromFormData(formData: FormData): string | null {
  const yearValue = String(formData.get('birth_year') ?? '').trim();
  const monthValue = String(formData.get('birth_month') ?? '').trim();
  const dayValue = String(formData.get('birth_day') ?? '').trim();

  if (!yearValue && !monthValue && !dayValue) return null;
  if (!yearValue || !monthValue || !dayValue) throw new Error('연도, 월, 일을 모두 선택해 주세요.');

  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const today = new Date();
  if (!Number.isInteger(year) || year < 1900 || year > today.getUTCFullYear() || month < 1 || month > 12 || day < 1 || day > 31 || candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day || candidate > today) {
    throw new Error('생년월일을 올바르게 선택해 주세요.');
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
