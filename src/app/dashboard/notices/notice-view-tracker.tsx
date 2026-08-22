'use client';

import { useEffect, useRef } from 'react';
import { recordNoticeView } from './actions';

export function NoticeViewTracker({ noticeId }: { noticeId: string }) {
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    void recordNoticeView(noticeId);
  }, [noticeId]);
  return null;
}
