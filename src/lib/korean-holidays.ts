import Holidays from 'date-holidays';

export type KoreanHoliday = { date: string; name: string };

const dateAt = (date: string, amount: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
};

const weekend = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

export function getKoreanHolidays(year: number): KoreanHoliday[] {
  const calendar = new Holidays('KR', { languages: 'ko', types: ['public'] });
  const base = calendar.getHolidays(year).filter((holiday) => holiday.type === 'public');
  const days = new Map<string, Set<string>>();
  const add = (date: string, name: string) => {
    const names = days.get(date) ?? new Set<string>();
    names.add(name);
    days.set(date, names);
  };

  for (const holiday of base) add(holiday.date.slice(0, 10), holiday.name);

  for (const holiday of base) {
    if (!['설날', '추석'].includes(holiday.name)) continue;
    const date = holiday.date.slice(0, 10);
    add(dateAt(date, -1), `${holiday.name} 연휴`);
    add(dateAt(date, 1), `${holiday.name} 연휴`);
  }

  const substituteNames = new Set(['설날', '3·1절', '어린이날', '석가탄신일', '광복절', '추석', '개천절', '한글날', '기독탄신일']);
  for (const holiday of base) {
    if (!substituteNames.has(holiday.name)) continue;
    const center = holiday.date.slice(0, 10);
    const group = ['설날', '추석'].includes(holiday.name) ? [dateAt(center, -1), center, dateAt(center, 1)] : [center];
    const needsSubstitute = group.some((date) => weekend(date) || (days.get(date)?.size ?? 0) > 1);
    if (!needsSubstitute) continue;
    let substitute = dateAt(group.at(-1)!, 1);
    while (weekend(substitute) || days.has(substitute)) substitute = dateAt(substitute, 1);
    add(substitute, `${holiday.name} 대체공휴일`);
  }

  return [...days.entries()]
    .flatMap(([date, names]) => [...names].map((name) => ({ date, name })))
    .sort((a, b) => a.date.localeCompare(b.date));
}
