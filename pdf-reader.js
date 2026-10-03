// pdf.js comes from the pdfjs-dist package, like chart.js and jspdf, so package.json sets its version.
const PDFJS_PATH = './node_modules/pdfjs-dist/build/pdf.min.mjs';
const PDFJS_WORKER_PATH = './node_modules/pdfjs-dist/build/pdf.worker.min.mjs';

// Loads pdf.js and sets its worker.
export async function loadPdfJs() {
  const module = await import(PDFJS_PATH);
  const pdfjs = module.default || module;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_PATH;
  }
  return pdfjs;
}
