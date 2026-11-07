const currentYear = new Date().getFullYear();
const years = Array.from({ length: currentYear - 1899 }, (_, index) => currentYear - index);
const months = Array.from({ length: 12 }, (_, index) => index + 1);
const days = Array.from({ length: 31 }, (_, index) => index + 1);

export function BirthDateFields({ value }: { value: string | null }) {
  const [year = '', month = '', day = ''] = value?.split('-') ?? [];

  return <fieldset className="birth-date-fields">
    <legend>생년월일</legend>
    <label><span>년</span><select name="birth_year" defaultValue={year}><option value="">연도</option>{years.map((item) => <option key={item} value={item}>{item}년</option>)}</select></label>
    <label><span>월</span><select name="birth_month" defaultValue={month ? String(Number(month)) : ''}><option value="">월</option>{months.map((item) => <option key={item} value={item}>{item}월</option>)}</select></label>
    <label><span>일</span><select name="birth_day" defaultValue={day ? String(Number(day)) : ''}><option value="">일</option>{days.map((item) => <option key={item} value={item}>{item}일</option>)}</select></label>
  </fieldset>;
}
