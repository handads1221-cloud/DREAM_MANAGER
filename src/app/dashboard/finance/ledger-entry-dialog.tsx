'use client';

import { useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { addLedgerEntry } from './actions';

const categories = ['주정헌금', '십일조', '감사헌금', '선교헌금', '교회재정', '행사비', '식비', '물품비', '기타'];

function LedgerSubmitButton() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}>{pending ? '등록 중…' : '장부에 등록'}</button>;
}

export function LedgerEntryDialog({ today }: { today: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submissionKey, setSubmissionKey] = useState('');

  const openDialog = () => {
    setSubmissionKey(crypto.randomUUID());
    dialogRef.current?.showModal();
  };

  return <>
    <button className="ledger-entry-open" type="button" onClick={openDialog}>수입·지출 등록</button>
    <dialog className="ledger-entry-dialog" ref={dialogRef} onClick={(event) => {
      if (event.target === event.currentTarget) dialogRef.current?.close();
    }}>
      <div className="ledger-entry-dialog-panel">
        <div className="ledger-entry-dialog-heading">
          <div><small>NEW TRANSACTION</small><h2>수입·지출 등록</h2></div>
          <button type="button" aria-label="팝업 닫기" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <form className="ledger-entry-form" action={addLedgerEntry}>
          <input type="hidden" name="submission_key" value={submissionKey}/>
          <label>거래 일자<input type="date" name="transaction_date" defaultValue={today} required/></label>
          <label>유형<select name="entry_type" defaultValue="income"><option value="income">수입</option><option value="expense">지출</option></select></label>
          <label>세부 유형<select name="category">{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>금액<input name="amount" type="number" inputMode="numeric" min="1" placeholder="금액을 입력해 주세요" required/></label>
          <label className="ledger-entry-memo">메모 (선택)<input name="memo" placeholder="간단한 내용을 입력해 주세요"/></label>
          <div className="ledger-entry-dialog-actions">
            <button type="button" onClick={() => dialogRef.current?.close()}>취소</button>
            <LedgerSubmitButton/>
          </div>
        </form>
      </div>
    </dialog>
  </>;
}
