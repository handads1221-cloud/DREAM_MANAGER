'use client';

import { deleteLedgerEntry, updateLedgerMemo } from './actions';

export function LedgerRowActions({ id, memo }: { id: string; memo: string | null }) {
  return <div className="ledger-row-actions">
    <form action={updateLedgerMemo}>
      <input type="hidden" name="id" value={id}/>
      <input name="memo" defaultValue={memo ?? ''} aria-label="메모 수정" placeholder="메모"/>
      <button type="submit">수정</button>
    </form>
    <form action={deleteLedgerEntry} onSubmit={(event) => { if (!window.confirm('이 기록을 삭제(취소)하시겠습니까? 잔액이 다시 계산됩니다.')) event.preventDefault(); }}>
      <input type="hidden" name="id" value={id}/>
      <button type="submit" className="ledger-delete-button">삭제</button>
    </form>
  </div>;
}
