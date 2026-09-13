'use client';

export function PrintButton() {
  return <button type="button" onClick={() => window.print()}>PDF 저장 / 인쇄</button>;
}
