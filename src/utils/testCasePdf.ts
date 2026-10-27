import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import { testDataAvailability, visibleFields } from "./caseText";
import { rowPrivacy } from "./privacy";

export const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function rows(items: { field: string; value: string }[]): string {
  if (!items.length) return "<p>–</p>";
  return `<table><tbody>${items.map((item) => `<tr><th>${escapeHtml(item.field)}</th><td>${escapeHtml(item.value)}</td></tr>`).join("")}</tbody></table>`;
}

/**
 * Test data of a case for the PDF: the proposal of the generator and the
 * datasets maintained by the examiner (public rows only, numbered as in the
 * app). Cases that cannot have test data say so instead.
 */
function testDataHtml(item: GeneratedTestCase): string {
  const availability = testDataAvailability(item);
  if (!availability.available && !item.datasets?.rows.length) {
    return `<p><b>Keine Testdaten.</b> ${escapeHtml(availability.reason)}</p>`;
  }
  const proposal = visibleFields(item.testData);
  const parts: string[] = [];
  if (availability.available && proposal.length) parts.push(`<h4>Vorschlag</h4>${rows(proposal)}`);
  const d = item.datasets;
  const publicIdx = d ? d.rows.map((_, i) => i).filter((i) => rowPrivacy(d, i) === "Öffentlich") : [];
  if (d && publicIdx.length) {
    parts.push(`<h4>Testdatensätze (${publicIdx.length})</h4><table class="grid"><thead><tr><th>Nr.</th>${d.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead><tbody>${publicIdx
      .map((i) => `<tr><td>${i + 1}</td>${d.columns.map((_, j) => `<td>${escapeHtml(d.rows[i][j] ?? "")}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`);
  }
  if (d && publicIdx.length < d.rows.length) parts.push(`<p class="note">${d.rows.length - publicIdx.length} privater Testdatensatz/private Testdatensätze nicht enthalten.</p>`);
  return parts.join("") || "<p>–</p>";
}

export function caseHtml(item: GeneratedTestCase, req: Req | undefined): string {
  const origin = req?.origin;
  const source = origin
    ? `${origin.documentName}${origin.documentVersion ? ` · ${origin.documentVersion}` : ""} · ${origin.sectionLabel}`
    : req?.source ?? "Keine Quellenangabe";
  const flow = item.steps.length
    ? `<ol>${item.steps.map((step) => `<li><b>${escapeHtml(step.actor || "?")}:</b> ${escapeHtml(step.action)}${step.abgabegrund ? ` <span>(Abgabegrund ${escapeHtml(step.abgabegrund)})</span>` : ""}</li>`).join("")}</ol>`
    : "<p>–</p>";
  const reasoning = item.reasoning.length
    ? `<ol>${item.reasoning.map((step) => `<li><b>${escapeHtml(step.basis)}:</b> ${escapeHtml(step.text)}${step.sourceRef ? ` <span>· ${escapeHtml(step.sourceRef)}</span>` : ""}</li>`).join("")}</ol>`
    : "<p>–</p>";
  return `<article>
    <header><p class="case-id">${escapeHtml(item.id)}</p><h2>${escapeHtml(item.title || "Testfall ohne Titel")}</h2></header>
    <dl>
      <dt>Anforderung</dt><dd>${escapeHtml(req ? `${req.id} · ${req.title}` : item.requirementId)}</dd>
      <dt>Quelle</dt><dd>${escapeHtml(source)}</dd>
      <dt>Technik</dt><dd>${escapeHtml(item.technique || "–")}</dd>
      <dt>Priorität</dt><dd>${escapeHtml(item.priority)}</dd>
      <dt>Prüfstatus</dt><dd>${escapeHtml(item.review.decision)}</dd>
    </dl>
    ${origin?.quote ? `<section><h3>Quellennachweis</h3><blockquote>${escapeHtml(origin.quote)}</blockquote></section>` : ""}
    <section class="scenario">
      <h3>Testkonstellation</h3>
      <h4>GEGEBEN</h4><p>${escapeHtml(item.given || "–")}</p>
      <h4>WENN</h4><p>${escapeHtml(item.when || "–")}</p>
      <h4>DANN</h4><p>${escapeHtml(item.then || "–")}</p>
    </section>
    <section><h3>Testdaten</h3>${testDataHtml(item)}</section>
    <section><h3>Ablauf / Nachrichtenfolge</h3>${flow}</section>
    <section><h3>Erwartetes Ergebnis</h3>${rows(item.expectedFields)}</section>
    <section><h3>Kriterien</h3><p>${item.criteriaIds.length ? item.criteriaIds.map(escapeHtml).join(" · ") : "–"}</p></section>
    <section><h3>Modellbegründung</h3>${reasoning}</section>
    ${item.openQuestions.length ? `<section><h3>Offene Fragen</h3><ul>${item.openQuestions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul></section>` : ""}
  </article>`;
}

/** Opens a self-contained, print-ready DBVO-style test plan for saving as PDF. */
export function printTestCasesAsPdf(cases: GeneratedTestCase[], requirements: Req[], sourceFilter: string): void {
  const report = window.open("", "_blank");
  if (!report) throw new Error("Das Druckfenster wurde vom Browser blockiert.");
  report.opener = null;
  const requirementsById = new Map(requirements.map((req) => [req.id, req]));
  const generatedAt = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
  report.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Testfallkatalog</title><style>
    @page { size: A4; margin: 16mm; }
    table.grid th { width: auto; } table.grid td:first-child, table.grid th:first-child { width: 12mm; }
    .note { font-size: 8.5pt; font-style: italic; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 10pt; line-height: 1.4; margin: 0; }
    .report-head { border-bottom: 2px solid currentColor; margin-bottom: 8mm; padding-bottom: 4mm; }
    h1 { font-size: 22pt; margin: 0 0 2mm; } h2 { font-size: 16pt; margin: 1mm 0 4mm; }
    h3 { font-size: 12pt; margin: 5mm 0 2mm; border-bottom: 1px solid currentColor; }
    h4 { font-size: 9pt; letter-spacing: .08em; margin: 3mm 0 1mm; }
    p { margin: 1mm 0 3mm; } article { break-before: page; } article:first-of-type { break-before: auto; }
    .case-id { font-family: monospace; margin: 0; } dl { display: grid; grid-template-columns: 35mm 1fr; margin: 0; }
    dt { font-weight: bold; } dd { margin: 0 0 1.5mm; } blockquote { border-left: 3px solid currentColor; margin: 2mm 0; padding: 2mm 4mm; }
    table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid currentColor; padding: 2mm; text-align: left; vertical-align: top; } th { width: 36%; }
    ol, ul { margin: 1mm 0 3mm; padding-left: 6mm; } li { margin-bottom: 1mm; } span { font-size: 9pt; }
    @media print { .report-head { break-after: avoid; } section, table, blockquote { break-inside: avoid; } }
  </style></head><body>
    <header class="report-head"><h1>Testfallkatalog</h1><p><b>Quelle:</b> ${escapeHtml(sourceFilter === "Alle" ? "Alle gefilterten Quellen" : sourceFilter)}</p><p><b>Umfang:</b> ${cases.length} Testfall/Testfälle · <b>Erstellt:</b> ${escapeHtml(generatedAt)}</p></header>
    ${cases.map((item) => caseHtml(item, requirementsById.get(item.requirementId))).join("")}
  </body></html>`);
  report.document.close();
  report.focus();
  window.setTimeout(() => report.print(), 150);
}
