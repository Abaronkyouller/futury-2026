/**
 * Turns pdf.js text items into text lines. Kept free of pdf.js imports so it
 * can be unit-tested with plain objects.
 */

/** The subset of a pdf.js TextItem that is needed here. */
export type PdfTextItem = {
  str: string;
  /** [scaleX, skewY, skewX, scaleY, x, y] */
  transform: number[];
  width: number;
  hasEOL?: boolean;
};

/** Vertical distance (in PDF units) above which two items are on different lines. */
const LINE_TOLERANCE = 2.5;

/**
 * Groups items into lines by their baseline. Adds a space between items when
 * there is a visible horizontal gap and neither side already has whitespace.
 */
export function itemsToLines(items: PdfTextItem[]): string[] {
  const lines: string[] = [];
  let current = "";
  let lastY: number | null = null;
  let lastEndX = 0;

  const flush = () => {
    const t = current.replace(/\s+/g, " ").trim();
    if (t) lines.push(t);
    current = "";
  };

  for (const item of items) {
    const x = item.transform[4];
    const y = item.transform[5];
    const fontSize = Math.abs(item.transform[3]) || 10;
    if (lastY !== null && Math.abs(y - lastY) > LINE_TOLERANCE && item.str) flush();
    if (item.str) {
      const gap = x - lastEndX;
      const needsSpace = current && !/\s$/.test(current) && !/^\s/.test(item.str) && gap > fontSize * 0.15;
      current += (needsSpace ? " " : "") + item.str;
      lastEndX = x + item.width;
      lastY = y;
    }
    if (item.hasEOL) flush();
  }
  flush();
  return lines;
}
