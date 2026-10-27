import type { CoverageStatus, DocumentCoverage, SectionCoverage } from "../coverage/coverage";
import { percent } from "../coverage/coverage";
import { escapeHtml } from "./testCasePdf";
import { themeVars } from "./testReportPdf";
import { sanitizeCaseTitle } from "./caseText";

export type CoverageKpi = { label: string; part: number; whole: number; hint: string };

const STATUS_CLASS: Record<CoverageStatus, string> = {
  Abgedeckt: "ok",
  "Teilweise abgedeckt": "warn",
  "Anforderung ohne Testfall": "bad",
  "Keine Anforderung erkannt": "muted",
};

const fmt = () => new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date());

/** One table row per section; requirements and their test cases are listed inside the row. */
function sectionRow(s: SectionCoverage, onlyCovered: boolean): string {
  const shown = onlyCovered ? s.requirements.filter((r) => r.cases.length > 0) : s.requirements;
  const reqs = shown.length
    ? shown.map(({ req, cases }) => `<div class="req"><b>${escapeHtml(req.id)}</b> · ${escapeHtml(req.title)}${cases.length
        ? `<ul>${cases.map((c) => `<li><span class="mono">${escapeHtml(c.id)}</span> ${escapeHtml(sanitizeCaseTitle(c.title) || c.technique)} <span class="muted">(${escapeHtml(c.review.decision)})</span></li>`).join("")}</ul>`
        : `<p class="bad">Kein Testfall zu dieser Anforderung.</p>`}</div>`).join("")
    : `<span class="muted">Keine Anforderung erkannt</span>`;
  return `<tr><td><b>${escapeHtml(s.label)}</b><br><span class="muted">${escapeHtml(s.documentName)}${s.pages ? ` · ${escapeHtml(s.pages)}` : ""}</span></td><td class="${STATUS_CLASS[s.status]}">${escapeHtml(s.status)}</td><td>${reqs}</td></tr>`;
}

/**
 * Opens a print-ready coverage report (save as PDF in the print dialog) with
 * the same filters as on the page: figures, coverage per document and the
 * mapping section → requirement → test case.
 */
export function printCoverage(opts: {
  kpis: CoverageKpi[];
  caseCount: number;
  documents: DocumentCoverage[];
  sections: SectionCoverage[];
  filters: string[];
  acceptedOnly: boolean;
  /** Presentation view: requirements without a test case are left out. */
  onlyCovered: boolean;
}): void {
  const win = window.open("", "_blank");
  if (!win) throw new Error("Das Druckfenster wurde vom Browser blockiert. Bitte Pop-ups für diese Seite erlauben.");
  win.opener = null;
  const { kpis, caseCount, documents, sections, filters, acceptedOnly, onlyCovered } = opts;
  win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Testabdeckung</title><style>
    ${themeVars()}
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 9.5pt; line-height: 1.4; margin: 0; color: var(--text); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .report-head { border-bottom: 3px solid var(--accent); margin-bottom: 6mm; padding-bottom: 4mm; }
    .brand { color: var(--accent); font-weight: bold; letter-spacing: .05em; margin: 0 0 2mm; }
    h1 { font-size: 22pt; margin: 0 0 2mm; } h3 { font-size: 12pt; margin: 6mm 0 2mm; border-bottom: 1px solid currentColor; }
    p { margin: 1mm 0 2mm; }
    .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin: 3mm 0; }
    .kpis > div { border: 1px solid var(--missing); border-radius: 2mm; padding: 2.5mm; }
    .kpis b { display: block; font-size: 18pt; } .kpis small { display: block; color: var(--muted); }
    .bar { height: 2mm; background: var(--surface-2); border-radius: 1mm; overflow: hidden; margin: 1mm 0; }
    .bar i { display: block; height: 100%; background: var(--accent); }
    table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid var(--missing); padding: 1.8mm 2mm; text-align: left; vertical-align: top; }
    th { background: var(--surface-2); }
    .req { margin-bottom: 2mm; } .req ul { margin: 1mm 0 0; padding-left: 5mm; } .req li { margin-bottom: .5mm; }
    .mono { font-family: monospace; } .muted { color: var(--muted); } .note { font-size: 8.5pt; color: var(--muted); }
    .ok { color: var(--good); font-weight: bold; } .bad { color: var(--bad); font-weight: bold; } .warn { color: var(--warn); font-weight: bold; }
    @media print { tr { break-inside: avoid; } }
  </style></head><body>
    <header class="report-head">
      <p class="brand">ITSG · Prüfassistent DTA EEL</p>
      <h1>Testabdeckung</h1>
      <p><b>Erstellt:</b> ${escapeHtml(fmt())} · <b>Gezählt:</b> ${acceptedOnly ? "nur akzeptierte Testfälle" : "alle Testfälle außer abgelehnten"}</p>
      <p><b>Filter:</b> ${escapeHtml(filters.length ? filters.join(" · ") : "keine")}</p>
    </header>
    <h3>Kennzahlen</h3>
    <div class="kpis">
      ${kpis.map((k) => `<div><small>${escapeHtml(k.label)}</small><b>${percent(k.part, k.whole)} %</b><div class="bar"><i style="width:${percent(k.part, k.whole)}%"></i></div><small>${k.part} von ${k.whole}</small></div>`).join("")}
      <div><small>Testfälle zugeordnet</small><b>${caseCount}</b><small>${acceptedOnly ? "nur akzeptierte" : "ohne abgelehnte"}</small></div>
    </div>
    <p class="note">${kpis.map((k) => `<b>${escapeHtml(k.label)}:</b> ${escapeHtml(k.hint)}`).join(" ")} Ein Abschnitt gilt als abgedeckt, sobald zu einer daraus extrahierten Anforderung ein Testfall existiert; ob der Testfall die Anforderung fachlich vollständig prüft, sagt die Abdeckung nicht aus.</p>
    <h3>Abdeckung je Dokument</h3>
    <table><thead><tr><th>Dokument</th><th>Abschnitte mit Testfällen</th><th>Anforderungen mit Testfällen</th></tr></thead><tbody>
      ${documents.map((d) => `<tr><td>${escapeHtml(d.source.name)}${d.source.loaded || d.source.sample ? "" : `<br><span class="muted">Original nicht geladen – nur Abschnitte mit Anforderungen</span>`}</td><td>${percent(d.sectionsWithCases, d.sections.length)} % (${d.sectionsWithCases} von ${d.sections.length})</td><td>${percent(d.requirementsWithCases, d.requirements)} % (${d.requirementsWithCases} von ${d.requirements})</td></tr>`).join("")}
    </tbody></table>
    <h3>Zuordnung Abschnitt → Anforderung → Testfall</h3>
    <table><thead><tr><th style="width:30%">Abschnitt der Quelle</th><th style="width:16%">Status</th><th>Anforderungen und Testfälle</th></tr></thead><tbody>
      ${sections.length ? sections.map((s) => sectionRow(s, onlyCovered)).join("") : `<tr><td colspan="3">Keine Abschnitte für die gewählten Filter.</td></tr>`}
    </tbody></table>
  </body></html>`);
  win.document.close();
  win.focus();
  window.setTimeout(() => win.print(), 150);
}
