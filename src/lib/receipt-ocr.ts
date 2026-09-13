export type ReceiptAmountSuggestion = { amount: number; confidence: '높음' | '보통' | '확인 필요'; reason: string; score: number };
type Candidate = { amount: number; score: number; lineIndex: number; reasons: Set<string> };

const primaryLabels = /(최종\s*결제|총\s*결제|결제\s*금액|승인\s*금액|받을\s*금액|청구\s*금액|합\s*계|총\s*액|grand\s*total|total\s*amount|amount\s*due)/i;
const secondaryLabels = /(결제|승인|합계|총액|total|amount|현금|카드)/i;
const misleadingLabels = /(사업자|등록번호|승인번호|카드번호|전화|tel|거래번호|가맹점번호|주문번호|일시|날짜|부가세|과세|면세|공급가|잔액|거스름|포인트|적립|할인\s*전)/i;
const amountPattern = /(?:₩|￦|\bkrw\b)?\s*([0-9]{1,3}(?:[,\s.][0-9]{3})+|[0-9]{3,9})\s*(?:원|₩|￦|krw)?/gi;

function amountsIn(line: string) {
  return [...line.matchAll(amountPattern)].map((match) => ({ amount: Number(match[1].replace(/[,\s.]/g, '')), hasCurrency: /(?:원|₩|￦|krw)/i.test(match[0]) })).filter(({ amount }) => Number.isSafeInteger(amount) && amount >= 100 && amount < 100_000_000 && !(amount >= 1900 && amount <= 2100));
}

export function rankReceiptAmounts(rawText: string): ReceiptAmountSuggestion[] {
  const lines = rawText.split(/\r?\n/).map((line) => line.replace(/[|]/g, ' ').replace(/O(?=\d)|(?<=\d)O/g, '0').trim()).filter(Boolean);
  const candidates: Candidate[] = [];
  lines.forEach((line, lineIndex) => {
    const previous = lines[lineIndex - 1] ?? '';
    const primary = primaryLabels.test(line);
    const secondary = secondaryLabels.test(line);
    const previousPrimary = primaryLabels.test(previous);
    const misleading = misleadingLabels.test(line);
    for (const { amount, hasCurrency } of amountsIn(line)) {
      const reasons = new Set<string>();
      let score = 0;
      if (primary) { score += 125; reasons.add('합계·결제금액 문구'); }
      else if (secondary) { score += 42; reasons.add('결제 관련 문구'); }
      if (previousPrimary) { score += 82; reasons.add('합계 문구 다음 줄'); }
      if (hasCurrency) { score += 28; reasons.add('원화 표시'); }
      if (misleading) { score -= 135; reasons.add('식별번호·세부금액 가능성'); }
      score += Math.round((lineIndex / Math.max(lines.length - 1, 1)) * 14);
      candidates.push({ amount, score, lineIndex, reasons });
    }
  });
  if (!candidates.length) return [];

  const grouped = new Map<number, Candidate>();
  for (const candidate of candidates) {
    const current = grouped.get(candidate.amount);
    if (!current) grouped.set(candidate.amount, { ...candidate, reasons: new Set(candidate.reasons) });
    else {
      current.score = Math.max(current.score, candidate.score) + 18;
      current.lineIndex = Math.max(current.lineIndex, candidate.lineIndex);
      current.reasons.add('영수증 내 반복 표시');
      candidate.reasons.forEach((reason) => current.reasons.add(reason));
    }
  }

  const unique = [...grouped.values()];
  for (const target of unique) {
    const parts = unique.filter((candidate) => candidate.amount < target.amount && candidate.score > -100);
    if (parts.some((first, index) => parts.slice(index + 1).some((second) => Math.abs(first.amount + second.amount - target.amount) <= 1))) {
      target.score += 34;
      target.reasons.add('세부금액 합계와 일치');
    }
  }

  return unique.sort((a, b) => b.score - a.score || b.lineIndex - a.lineIndex || b.amount - a.amount).slice(0, 3).map((candidate) => ({
    amount: candidate.amount,
    score: candidate.score,
    confidence: candidate.score >= 120 ? '높음' : candidate.score >= 55 ? '보통' : '확인 필요',
    reason: [...candidate.reasons].filter((reason) => reason !== '식별번호·세부금액 가능성').slice(0, 2).join(' · ') || '금액 형태와 위치 기준',
  }));
}

export function extractReceiptAmount(rawText: string): number | null {
  return rankReceiptAmounts(rawText)[0]?.amount ?? null;
}
