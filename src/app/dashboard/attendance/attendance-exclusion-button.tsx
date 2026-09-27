'use client';

import { useState, useTransition } from 'react';
import { setAttendanceStatisticsExclusion } from './actions';

export function AttendanceExclusionButton({ serviceDate, excluded, reason }: { serviceDate: string; excluded: boolean; reason: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  const toggle = () => {
    const next = !excluded;
    const question = next ? '이 날짜를 별도 예배 없음으로 지정할까요? 기존 출석 기록과 출석 보석은 취소됩니다.' : '이 날짜를 정상 주일예배로 복원할까요?';
    if (!window.confirm(question)) return;
    const formData = new FormData(); formData.set('service_date', serviceDate); formData.set('excluded', String(next));
    startTransition(async () => {
      const result = await setAttendanceStatisticsExclusion(formData);
      if (!result.ok) { setError(result.message); return; }
      window.location.reload();
    });
  };

  return <div className={`attendance-exclusion-inline${excluded ? ' active' : ''}`} title={reason ?? '전세대 이음으로 교회학교 별도 예배 없음'}>
    {error && <span>{error}</span>}
    <button type="button" onClick={toggle} disabled={pending}>{pending ? '처리 중…' : excluded ? '예배 없음 · 복원' : '통계에서 제외'}</button>
  </div>;
}
