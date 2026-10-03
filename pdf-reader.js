const PDFJS_PATH = './vendor/pdfjs/pdf.min.mjs';
const PDFJS_WORKER_PATH = './vendor/pdfjs/pdf.worker.min.mjs';

// Loads the vendored pdf.js and sets its worker.
export async function loadPdfJs() {
  const module = await import(PDFJS_PATH);
  const pdfjs = module.default || module;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_PATH;
  }
  return pdfjs;
}
