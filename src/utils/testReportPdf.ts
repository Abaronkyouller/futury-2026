import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import type { TestReport } from "../types/testReport";
import type { ResultComparison } from "../types/validation";
import { caseHtml, escapeHtml } from "./testCasePdf";
import { caseOutcome, countOutcomes, latestComparisons } from "./testOutcome";

/** Theme tokens copied into the print window, so the report uses the colours of theme.css (no literals here). */
const PRINT_TOKENS = ["--accent", "--text", "--missing", "--surface-2", "--good", "--bad", "--muted"];
function themeVars(): string {
  const css = getComputedStyle(document.documentElement);
  return `:root { ${PRINT_TOKENS.map((t) => `${t}: ${css.getPropertyValue(t).trim()};`).join(" ")} }`;
}

const fmt = (iso: string) => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

/** Examiner datasets of a case as a table (empty string when there are none). */
function datasetsHtml(item: GeneratedTestCase): string {
  const d = item.datasets;
  if (!d?.rows.length) return "";
  return `<section><h3>Testdatensätze (vom Prüfer gepflegt)</h3><table class="grid"><thead><tr><th>Nr.</th>${d.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>${d.rows
    .map((row, i) => `<tr><td>${i + 1}</td>${d.columns.map((_, j) => `<td>${escapeHtml(row[j] ?? "")}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></section>`;
}

/**
 * Opens a print-ready test report for one software (save as PDF in the print
 * dialog): software data, summary, overview table and every assigned case.
 */
export function printTestReport(report: TestReport, cases: GeneratedTestCase[], requirements: Req[], comparisons: ResultComparison[]): void {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Das Druckfenster wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.");
  win.opener = null;
  const reqs = new Map(requirements.map((r) => [r.id, r]));
  const latest = latestComparisons(comparisons);
  // Saved result per case: the examiner's setting for this software, else the comparison.
  const results = cases.map((c) => caseOutcome(c.id, report.outcomes, latest));
  const counts = countOutcomes(results.map((r) => r.outcome));
  const cls = (o: string) => (o === "Test erfolgreich" ? "ok" : o === "Test fehlgeschlagen" ? "bad" : "muted");
  const meta: [string, string][] = [
    ["Software", report.software],
    ["ID", report.id],
    ["Hersteller", report.vendor || "–"],
    ["Prüfer/in", report.examiner || "–"],
    ["Angelegt", fmt(report.createdAt)],
    ["Gespeichert", fmt(report.updatedAt)],
    ["Erstellt am", fmt(new Date().toISOString())],
  ];
  const overview = cases.map((c, i) => {
    const r = results[i];
    return `<tr><td class="mono">${escapeHtml(c.id)}</td><td>${escapeHtml(c.title || c.technique || "–")}</td><td>${escapeHtml(c.requirementId)}</td><td>${escapeHtml(c.priority)}</td><td>${escapeHtml(c.review.decision)}</td><td class="${cls(r.outcome)}">${escapeHtml(r.outcome)}<br><span class="muted">${r.source === "manuell" ? "manuell gesetzt" : r.source === "Abgleich" ? "aus dem Abgleich" : "kein Abgleich"}</span></td></tr>`;
  }).join("");

  win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Testbericht ${escapeHtml(report.software)} ${escapeHtml(report.id)}</title><style>
    ${themeVars()}
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; margin: 0; color: var(--text); }
    .report-head { border-bottom: 3px solid var(--accent); margin-bottom: 6mm; padding-bottom: 4mm; }
    .brand { color: var(--accent); font-weight: bold; letter-spacing: .05em; margin: 0 0 2mm; }
    h1 { font-size: 22pt; margin: 0 0 2mm; } h2 { font-size: 16pt; margin: 1mm 0 4mm; }
    h3 { font-size: 12pt; margin: 5mm 0 2mm; border-bottom: 1px solid currentColor; }
    h4 { font-size: 9pt; letter-spacing: .08em; margin: 3mm 0 1mm; }
    p { margin: 1mm 0 3mm; } article { break-before: page; }
    .case-id, .mono { font-family: monospace; } .case-id { margin: 0; }
    dl { display: grid; grid-template-columns: 35mm 1fr; margin: 0; } dt { font-weight: bold; } dd { margin: 0 0 1.5mm; }
    blockquote { border-left: 3px solid currentColor; margin: 2mm 0; padding: 2mm 4mm; }
    table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid var(--missing); padding: 1.8mm 2mm; text-align: left; vertical-align: top; }
    article th { width: 36%; } table.grid th, table.overview th { width: auto; background: var(--surface-2); }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 3mm 0 5mm; }
    .summary div { border: 1px solid var(--missing); border-radius: 2mm; padding: 2.5mm; } .summary b { display: block; font-size: 16pt; }
    .ok { color: var(--good); font-weight: bold; } .bad { color: var(--bad); font-weight: bold; } .muted { color: var(--muted); }
    .note { font-size: 9pt; color: var(--muted); }
    ol, ul { margin: 1mm 0 3mm; padding-left: 6mm; } li { margin-bottom: 1mm; } span { font-size: 9pt; }
    @media print { section, blockquote, tr { break-inside: avoid; } }
  </style></head><body>
    <header class="report-head">
      <p class="brand">ITSG · Prüfassistent DTA EEL</p>
      <h1>Testbericht: ${escapeHtml(report.software)}</h1>
      <dl>${meta.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join("")}</dl>
    </header>
    <h3>Zusammenfassung</h3>
    <div class="summary">
      <div><b>${cases.length}</b>Testfälle zugeordnet</div>
      <div><b class="ok">${counts["Test erfolgreich"]}</b>Test erfolgreich</div>
      <div><b class="bad">${counts["Test fehlgeschlagen"]}</b>Test fehlgeschlagen</div>
      <div><b>${counts["Test noch nicht durchgeführt"]}</b>Test noch nicht durchgeführt</div>
    </div>
    <p class="note">Das Ergebnis je Testfall hat der Prüfer für diese Software gesetzt („manuell gesetzt“) oder es stammt aus der Prüferentscheidung im Abgleich unter „Validierung &amp; Bericht“. Ohne beides gilt der Test als noch nicht durchgeführt. Testfälle sind Vorschläge des Prüfassistenten und ersetzen keine fachliche Prüfung.</p>
    <h3>Übersicht der Testfälle</h3>
    <table class="overview"><thead><tr><th>ID</th><th>Titel</th><th>Anforderung</th><th>Priorität</th><th>Prüfstatus</th><th>Ergebnis</th></tr></thead><tbody>${overview || `<tr><td colspan="6">Keine Testfälle zugeordnet.</td></tr>`}</tbody></table>
    ${cases.map((c) => caseHtml(c, reqs.get(c.requirementId)).replace(/<\/article>\s*$/, `${datasetsHtml(c)}<section><h3>Ergebnis</h3><p>${escapeHtml(caseOutcome(c.id, report.outcomes, latest).outcome)}</p></section></article>`)).join("")}
  </body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 150);
}
