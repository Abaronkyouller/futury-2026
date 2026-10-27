/** Page numbers with first/last pages and an elided window around the current page. */
function pageNumbers(page: number, pageCount: number, windowSize = 5): (number | null)[] {
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (pageCount <= windowSize + 2) return range(1, pageCount);
  if (page <= windowSize - 1) return [...range(1, windowSize), null, pageCount];
  if (page >= pageCount - windowSize + 2) return [1, null, ...range(pageCount - windowSize + 1, pageCount)];
  const half = Math.floor(windowSize / 2);
  return [1, null, ...range(page - half, page + half), null, pageCount];
}

/** Reusable numbered pagination for test-case lists. */
export function Pager({
  page,
  pageCount,
  total,
  onPage,
  unit = "Testfall/Testfälle",
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
  /** Label of the counted items in the info text. */
  unit?: string;
}) {
  return <nav className="pager" aria-label="Seitennavigation">
    <button disabled={page <= 1} onClick={() => onPage(page - 1)}>←</button>
    {pageNumbers(page, pageCount).map((value, index) => value === null
      ? <span key={`gap-${index}`} className="gap">…</span>
      : <button key={value} className={value === page ? "active" : ""} aria-current={value === page ? "page" : undefined} onClick={() => onPage(value)}>{value}</button>)}
    <button disabled={page >= pageCount} onClick={() => onPage(page + 1)}>→</button>
    <span className="pagerinfo">Seite {page} von {pageCount} · {total} {unit}</span>
  </nav>;
}
