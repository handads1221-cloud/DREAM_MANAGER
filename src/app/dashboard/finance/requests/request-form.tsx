'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { compressImageFile } from '@/lib/compress-image';
import { preprocessReceiptImage } from '@/lib/receipt-image';
import { rankReceiptAmounts, type ReceiptAmountSuggestion } from '@/lib/receipt-ocr';
import { createPaymentRequest } from '../actions';

export function RequestForm() {
  const [busy, setBusy] = useState('');
  const [amount, setAmount] = useState('');
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);
  const [suggestions, setSuggestions] = useState<ReceiptAmountSuggestion[]>([]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  async function scan(files: FileList | null) {
    if (!files?.[0]) return;
    if (files.length > 5) { setBusy('영수증은 최대 5장까지 가능합니다.'); return; }
    try {
      setBusy('영수증 금액 인식 중…');
      const { recognize } = await import('tesseract.js');
      const preparedImage = await preprocessReceiptImage(files[0]);
      const { data } = await recognize(preparedImage, 'kor+eng');
      const ranked = rankReceiptAmounts(data.text);
      setSuggestions(ranked);
      if (ranked[0]) setAmount(String(ranked[0].amount));
      setBusy(ranked[0] ? `추천 금액을 입력했습니다. 인식 신뢰도 ${ranked[0].confidence}` : '사용금액을 찾지 못했습니다. 직접 입력해 주세요.');
    } catch {
      setBusy('OCR 인식에 실패했습니다. 금액을 직접 입력해 주세요.');
    }
  }

  function handleReceipts(files: FileList | null) {
    const selected = Array.from(files ?? []).slice(0, 5);
    setPreviews(selected.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })));
    setSuggestions([]);
    void scan(files);
  }

  async function submit(formData: FormData) {
    try {
      setBusy('사진 압축 중…');
      const files = await Promise.all(formData.getAll('receipts').filter((value): value is File => value instanceof File).map(compressImageFile));
      formData.delete('receipts');
      files.forEach((file) => formData.append('receipts', file));
      setBusy('등록 중…');
      await createPaymentRequest(formData);
    } catch (error) {
      setBusy(error instanceof Error ? error.message : '처리하지 못했습니다.');
    }
  }

  return <form action={submit} className="finance-request-form">
    <label>비목<select name="category">{['행사비', '식비', '교통비', '물품비', '교육비', '기타'].map((category) => <option key={category}>{category}</option>)}</select></label>
    <label>금액<input name="amount" type="number" min="1" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="영수증의 최종 결제금액"/></label>
    <label>내 계좌번호<input name="bank_account" required placeholder="은행명 계좌번호 예금주"/></label>
    <label>영수증 사진<input name="receipts" type="file" accept="image/jpeg,image/png,image/webp" multiple required onChange={(event) => handleReceipts(event.target.files)}/></label>
    {previews.length ? <section className="receipt-preview" aria-label="선택한 영수증 미리보기"><div><b>영수증 미리보기</b><span>{previews.length}장 선택</span></div><div>{previews.map((preview, index) => <figure key={preview.url}><Image src={preview.url} alt={`선택한 영수증 ${index + 1}`} width={240} height={300} unoptimized/><figcaption>{index + 1}. {preview.name}</figcaption></figure>)}</div></section> : null}
    {suggestions.length ? <section className="ocr-suggestions" aria-label="OCR 추천 금액"><div><b>인식된 금액 후보</b><span>영수증을 확인하고 선택하세요.</span></div><div>{suggestions.map((suggestion, index) => <button type="button" key={suggestion.amount} className={amount === String(suggestion.amount) ? 'selected' : ''} onClick={() => setAmount(String(suggestion.amount))}><i>{index === 0 ? '추천' : `후보 ${index + 1}`}</i><strong>{suggestion.amount.toLocaleString()}원</strong><small>신뢰도 {suggestion.confidence} · {suggestion.reason}</small></button>)}</div></section> : null}
    <label>내용<textarea name="memo"/></label><button disabled={busy.endsWith('중…')}>결제 요청</button>{busy ? <p>{busy}</p> : null}
  </form>;
}
