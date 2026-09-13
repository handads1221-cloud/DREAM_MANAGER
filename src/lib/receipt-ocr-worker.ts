import type { Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;

export function getReceiptOcrWorker() {
  if (!workerPromise) {
    workerPromise = import('tesseract.js')
      .then(({ createWorker }) => createWorker('kor+eng'))
      .catch((error) => {
        workerPromise = null;
        throw error;
      });
  }
  return workerPromise;
}

export function warmReceiptOcrWorker() {
  void getReceiptOcrWorker().catch(() => undefined);
}
