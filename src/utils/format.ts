/** Formats an ISO timestamp as German date/time, e.g. "26.10.2026, 17:22:05". */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("de-DE");
}

/** Quotes one CSV cell (RFC 4180): wraps in quotes and doubles inner quotes. */
export function csvCell(value: string | undefined): string {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

/** Builds a CSV document from rows of cells. */
export function toCsv(rows: (string | undefined)[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}
