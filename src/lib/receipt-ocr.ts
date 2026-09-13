type AmountCandidate = { amount: number; score: number; lineIndex: number };

const primaryLabels = /(최종\s*결제|총\s*결제|결제\s*금액|승인\s*금액|받을\s*금액|청구\s*금액|합\s*계|총\s*액|grand\s*total|total\s*amount|amount\s*due)/i;
const secondaryLabels = /(결제|승인|합계|총액|total|amount|현금|카드)/i;
const misleadingLabels = /(사업자|등록번호|승인번호|카드번호|전화|tel|거래번호|가맹점번호|주문번호|일시|날짜|부가세|과세|면세|공급가|잔액|거스름)/i;
const amountPattern = /(?:₩|￦|\bkrw\b)?\s*([0-9]{1,3}(?:[,\s.][0-9]{3})+|[0-9]{3,9})\s*(?:원|₩|￦|krw)?/gi;

function amountsIn(line: string) {
  return [...line.matchAll(amountPattern)].map((match) => ({ amount: Number(match[1].replace(/[,\s.]/g, '')), hasCurrency: /(?:원|₩|￦|krw)/i.test(match[0]) })).filter(({ amount }) => Number.isSafeInteger(amount) && amount >= 100 && amount < 100_000_000 && !(amount >= 1900 && amount <= 2100));
}

export function extractReceiptAmount(rawText: string): number | null {
  const lines = rawText.split(/\r?\n/).map((line) => line.replace(/[|]/g, ' ').trim()).filter(Boolean);
  const candidates: AmountCandidate[] = [];
  lines.forEach((line, lineIndex) => {
    const previous = lines[lineIndex - 1] ?? '';
    const primary = primaryLabels.test(line);
    const secondary = secondaryLabels.test(line);
    const previousPrimary = primaryLabels.test(previous);
    const misleading = misleadingLabels.test(line);
    for (const { amount, hasCurrency } of amountsIn(line)) {
      let score = primary ? 120 : secondary ? 45 : 0;
      if (previousPrimary) score += 85;
      if (hasCurrency) score += 30;
      if (misleading) score -= 130;
      score += Math.round((lineIndex / Math.max(lines.length - 1, 1)) * 12);
      candidates.push({ amount, score, lineIndex });
    }
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || b.lineIndex - a.lineIndex || b.amount - a.amount);
  if (candidates[0].score > 0) return candidates[0].amount;
  return candidates.filter((candidate) => candidate.amount < 10_000_000).sort((a, b) => b.amount - a.amount)[0]?.amount ?? null;
}
