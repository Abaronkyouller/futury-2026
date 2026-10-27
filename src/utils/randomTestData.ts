/**
 * Random test-data values for the examiner's datasets (Testdaten → "+").
 *
 * Each value is derived from the proposed value of the column (or, if there is
 * none, from the column name) so it keeps the same type and format:
 *   "41 Tage" → "37 Tage", "01.10.2026" → "14.09.2026", "3.250,00 €" → "2.871,40 €",
 *   "ja" → "nein", "Abgabegrund 41" → unchanged code.
 * The values are illustrative and fictitious; they are not taken from real
 * payroll data and are not checked against the rule.
 */

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(items: readonly T[]): T => items[rand(0, items.length - 1)];
const pad = (n: number) => String(n).padStart(2, "0");

const DATE = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;
const MONEY = /(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})(\s*(?:€|EUR))?/g;
const NUMBER = /\d+(?:,\d+)?/g;
/** Pairs of opposite values that are swapped at random. */
const TOGGLES: [string, string][] = [["ja", "nein"], ["erfüllt", "nicht erfüllt"], ["zulässig", "nicht zulässig"], ["vorhanden", "nicht vorhanden"], ["true", "false"]];
/** Words before a number that mark it as a code, which must not be changed. */
const CODE_CONTEXT = /(abgabegrund|grund|schlüssel|kennzeichen|code|version|§|nr\.?|uuid|datensatz|baustein)\s*[„"]?$/i;
const FIRST_NAMES = ["Anna", "Ben", "Clara", "David", "Elif", "Felix", "Greta", "Hannes", "Ida", "Jonas", "Lena", "Mehmet", "Nora", "Paul"];
const LAST_NAMES = ["Muster", "Beispiel", "Probe", "Testmann", "Demo", "Fiktiv"];

function shiftDate(d: number, m: number, y: number, days: number): string {
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return `${pad(d)}.${pad(m)}.${y}`;
  date.setDate(date.getDate() + days);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/** Inverse of the placeholder id in varyValue ("a" → 0, "b" → 1, …, "ba" → 26). */
const unId = (key: string) => parseInt(key.split("").map((ch) => (ch.charCodeAt(0) - 97).toString(26)).join(""), 26);

function formatMoney(value: number): string {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Varies a whole number around `n`: roughly ±50 %, at least ±5, never negative. */
function varyInt(n: number): number {
  const spread = Math.max(5, Math.round(n * 0.5));
  return Math.max(0, n + rand(-spread, spread));
}

/**
 * Random value derived from an existing value of the column. All dates of one
 * dataset move by the same `dateShift` (days), so "von … bis …" stays in order
 * and durations between dates are kept; a value with two or more dates keeps
 * its other numbers (e.g. the number of days) for the same reason.
 */
function varyValue(value: string, dateShift: number): string {
  const trimmed = value.trim();
  for (const [a, b] of TOGGLES) {
    if (trimmed.toLowerCase() === a) return pick([a, b]);
    if (trimmed.toLowerCase() === b) return pick([a, b]);
  }
  // Placeholders keep their positions so each number is replaced exactly once.
  const parts: string[] = [];
  // Placeholder ids are letters, so the number pass below cannot touch them.
  const id = (i: number) => i.toString(26).split("").map((ch) => String.fromCharCode(97 + parseInt(ch, 26))).join("");
  const hold = (s: string) => `\uE000${id(parts.push(s) - 1)}\uE000`;
  const dateCount = value.match(DATE)?.length ?? 0;
  let out = value.replace(DATE, (_, d, m, y) => hold(shiftDate(+d, +m, +y, dateShift)));
  if (dateCount >= 2) return out.replace(/\uE000([a-z]+)\uE000/g, (_, key: string) => parts[unId(key)]);
  out = out.replace(MONEY, (_, euros: string, cents: string, unit = "") => {
    const n = Number(euros.replace(/\./g, "")) + Number(cents) / 100;
    return hold(formatMoney(Math.max(0, n * (0.7 + Math.random() * 0.6))) + unit);
  });
  out = out.replace(NUMBER, (match: string, offset: number, whole: string) => {
    if (CODE_CONTEXT.test(whole.slice(0, offset))) return match; // codes stay as they are
    if (match.includes(",")) {
      const n = Number(match.replace(",", "."));
      return hold((n * (0.5 + Math.random())).toFixed(match.split(",")[1].length).replace(".", ","));
    }
    if (match.length >= 4) return match; // years, IDs
    return hold(String(varyInt(Number(match))));
  });
  return out.replace(/\uE000([a-z]+)\uE000/g, (_, key: string) => parts[unId(key)]);
}

/** Random value from the column name alone (used for columns without a proposal). */
function valueForColumn(column: string, dateShift: number): string {
  const c = column.toLowerCase();
  const today = new Date();
  if (/datum|beginn|ende|von|bis|seit|tag der/.test(c)) return shiftDate(today.getDate(), today.getMonth() + 1, today.getFullYear(), dateShift);
  if (/entgelt|betrag|lohn|gehalt|brutto|netto|zahlung|krankengeld|€/.test(c)) return `${formatMoney(rand(150000, 650000) / 100)} €`;
  if (/tage|dauer|frist/.test(c)) return `${rand(1, 90)} Tage`;
  if (/woche/.test(c)) return `${rand(1, 12)} Wochen`;
  if (/monat/.test(c)) return `${rand(1, 18)} Monate`;
  if (/stunden/.test(c)) return String(rand(10, 40));
  if (/name|person|beschäftigt|versichert/.test(c)) return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)} (fiktiv)`;
  if (/ja\/nein|erfüllt|vorhanden/.test(c)) return pick(["ja", "nein"]);
  return "";
}

/**
 * Creates `count` rows of random values. Each column is derived from its
 * proposed value (if any) or its name; rows are re-drawn a few times to avoid
 * exact duplicates, which can still occur when a column has nothing to vary.
 */
export function randomRows(columns: string[], proposal: (column: string) => string, count: number, existing: string[][] = []): string[][] {
  const seen = new Set(existing.map((r) => r.join("\u0001")));
  const rows: string[][] = [];
  for (let i = 0; i < count; i++) {
    let row: string[] = [];
    for (let attempt = 0; attempt < 8; attempt++) {
      const dateShift = rand(-60, 60); // one shift per dataset keeps dates of different columns in order
      row = columns.map((col) => {
        const base = proposal(col);
        return base ? varyValue(base, dateShift) : valueForColumn(col, dateShift);
      });
      if (!seen.has(row.join("\u0001"))) break;
    }
    seen.add(row.join("\u0001"));
    rows.push(row);
  }
  return rows;
}
