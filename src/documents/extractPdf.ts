import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { itemsToLines } from "./pdfLines";
import type { PdfTextItem } from "./pdfLines";
import type { PageLines } from "./segment";

// pdf.js parses in a web worker; Vite serves the worker file as an asset.
GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Reads the text layer of a PDF in the browser, page by page.
 * Scanned PDFs without a text layer yield empty pages; the caller reports them.
 */
export async function readPdfPages(
  data: ArrayBuffer,
  onProgress?: (page: number, total: number) => void,
): Promise<PageLines[]> {
  const task = getDocument({ data });
  const pdf = await task.promise;
  const pages: PageLines[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items.filter((it): it is PdfTextItem & typeof it => "str" in it);
      pages.push(itemsToLines(items));
      page.cleanup();
      onProgress?.(i, pdf.numPages);
    }
  } finally {
    // pdf.js v6: the loading task owns the worker resources.
    await task.destroy();
  }
  return pages;
}
