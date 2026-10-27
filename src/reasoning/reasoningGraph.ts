import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import { ORIGIN_LABEL } from "../types/review";
import type { TraceEvidence } from "../types/reasoning";
import type { ResultComparison } from "../types/validation";
import { cases as sampleCases } from "../data/testCases";
import { OPEN_VALUE_MARKER } from "../config/ai";
import { normalizeForMatch, tokenize, truncate } from "../documents/text";
import { sanitizeCaseTitle } from "../utils/caseText";
import { buildOntology } from "./ontology";

/**
 * Reasoning graph of one requirement (Nachverfolgbarkeit).
 *
 * Read top-down, it shows how a test case came about:
 *   Quelle → Anforderung → Bedingungen/Kriterien → Begründungsschritte → Testfall → Erwartet → Ergebnis
 * Only the test case in focus is expanded; the others hang off the requirement.
 *
 * Grounding checks are deterministic and local (no model call): they look up
 * the case's claims in the cited source text and the case's own test data.
 * A warning means "not found in the source", which is a hint at a possible
 * hallucination, not proof of one; a passed check doesn't prove correctness.
 */

export type GraphEvidence = "source" | "sample" | "model" | "derived" | "assumption" | "demo" | "manual" | "open";

export const GRAPH_EVIDENCE_LABEL: Record<GraphEvidence, string> = {
  manual: "Vom Prüfer eingegeben (nicht aus der Quelle abgeleitet)",
  source: "Quelle (Zitat geprüft)",
  sample: "Beispieldaten",
  model: "KI-Auslegung (ungeprüft)",
  derived: "Regelbasiert abgeleitet",
  assumption: "Annahme – zu bestätigen",
  demo: "Offline-Demo (simuliert)",
  open: "Fehlt / offen",
};

/** Rows of the graph, top to bottom. */
export const GRAPH_LAYERS = [
  "Quelle",
  "Anforderung",
  "Bedingungen & Kriterien",
  "Begründung des Modells",
  "Testfall",
  "Erwartet & offene Fragen",
  "Ergebnis & Befund",
] as const;

export type GraphNode = {
  id: string;
  layer: number;
  kind: string;
  label: string;
  evidence: GraphEvidence;
  details: [string, string][];
  /** Verbatim source text shown in the detail panel. */
  quote?: string;
  /** Grounding warnings attached to this node. */
  warnings: string[];
  /** Test case this node belongs to; clicking a test-case node focuses it. */
  caseId?: string;
};

export type GraphEdge = { id: string; from: string; to: string; relation: string; evidence: GraphEvidence };

export type CheckStatus = "ok" | "warn" | "info";
export type GroundingCheck = { id: string; label: string; status: CheckStatus; detail: string; nodeId?: string };

export type CaseSummary = { id: string; label: string; evidence: GraphEvidence; warnings: number };

export type ReasoningGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  checks: GroundingCheck[];
  cases: CaseSummary[];
  focusId?: string;
  /** Claims of the focused case (reasoning steps + expected values) and how many are backed. */
  claims: { total: number; backed: number };
  hiddenRejected: number;
};

const FROM_TRACE: Record<TraceEvidence, GraphEvidence> = {
  source: "source", derived: "derived", model: "model", assumption: "assumption", open: "open",
};
const CASE_EVIDENCE: Record<GeneratedTestCase["origin"]["kind"], GraphEvidence> = {
  model: "model", regelbasiert: "derived", "offline-demo": "demo", manuell: "manual",
};
/** Ontology categories shown as nodes; data fields and actors would only add noise. */
const CONCEPT_CATEGORIES = new Set(["Voraussetzung", "Frist", "Kriterium", "Meldung", "Rechtsgrundlage", "Vorgang"]);
/** Share of a "Quelle" step's terms that must occur in the source before it counts as backed. */
const MIN_SOURCE_OVERLAP = 0.35;
/** Overlap at which a reasoning step is attached to a condition instead of the requirement. */
const MIN_CONCEPT_OVERLAP = 0.3;

type SampleTuple = (typeof sampleCases)[number];
const SAMPLE_FINDINGS: Record<string, string> = {
  "TC-028-04": "Bemessungszeitraum von/bis weicht ab: September 2026 gemeldet, August 2026 erwartet (Datensatz #0412).",
};

/** Sample cases are linked by number: TC-028-xx → REQ-EEL-028. */
function sampleCasesFor(req: Req): SampleTuple[] {
  if (req.origin) return [];
  const no = req.id.split("-").pop();
  return sampleCases.filter((c) => c[0].startsWith(`TC-${no}-`));
}

/** Terms of length ≥ 4 used for overlap scores. */
const terms = (text: string) => [...new Set(tokenize(text).filter((t) => t.length >= 4))];

/** Share of `text`'s terms that also occur in `pool` (0–1). */
function overlap(text: string, pool: Set<string>): number {
  const t = terms(text);
  return t.length ? t.filter((x) => pool.has(x)).length / t.length : 0;
}

/** Numbers in a text ("42", "3,5", "01.10.2026" → "01", "10", "2026"). */
const numbersIn = (text: string) => [...new Set(text.match(/\d+(?:,\d+)?/g) ?? [])];

/** True if `n` occurs as a whole number in the normalized pool. */
function hasNumber(pool: string, n: string): boolean {
  const variants = new Set([n, n.replace(/^0+(?=\d)/, "")]);
  return [...variants].some((v) => new RegExp(`(^|[^\\d])0*${v.replace(",", "[,.]")}($|[^\\d])`).test(pool));
}

function sourceAndRequirement(req: Req): GraphNode[] {
  const o = req.origin;
  const source: GraphNode = o
    ? {
        id: "src", layer: 0, kind: "Quelle", label: `${o.documentName} · ${o.sectionLabel}`,
        evidence: o.quoteVerified ? "source" : "open", quote: o.quote,
        warnings: o.quoteVerified ? [] : ["Zitat wurde nicht wörtlich im Abschnitt gefunden – am Original prüfen."],
        details: [
          ["Dokument", o.documentName],
          ["Version/Stand", o.documentVersion ?? "nicht angegeben"],
          ["Dokumentart", o.documentKind],
          ["Abschnitt", o.sectionLabel],
          ["Zitat geprüft", o.quoteVerified ? "ja – im Abschnitt gefunden" : "nein"],
          ...(o.quoteNote ? ([["Hinweis", o.quoteNote]] as [string, string][]) : []),
        ],
      }
    : { id: "src", layer: 0, kind: "Quelle", label: req.source, evidence: "sample", warnings: [], details: [["Quelle", req.source], ["Originaltext", "Im Prototyp nicht vorhanden (Beispieldaten)"]] };

  const requirement: GraphNode = {
    id: "req", layer: 1, kind: "Anforderung", label: `${req.id} · ${req.title}`,
    evidence: o ? (o.extractedBy === "model" ? "model" : "derived") : "sample",
    warnings: [],
    details: [
      ["Leistung", req.benefit],
      ["Prüfstatus", req.status],
      ...(o
        ? ([
            ["Extraktion", o.extractedBy === "model" ? `KI (${o.model ?? "Modell"}) – Auslegung mit dem Zitat vergleichen` : "Regelbasiert aus dem Zitat"],
            ["Auslegung", o.statement || "–"],
            ["Bedingungen", o.conditions.join(" · ") || "–"],
            ["Unklarheiten", o.ambiguities.join(" · ") || "–"],
          ] as [string, string][])
        : []),
      ...(req.comment ? ([["Kommentar", req.comment]] as [string, string][]) : []),
    ],
  };
  return [source, requirement];
}

/** Observed result and finding from the latest comparison of a case. */
function resultNodes(c: GeneratedTestCase, cmp: ResultComparison | undefined): GraphNode[] {
  if (!cmp) {
    return [{ id: `${c.id}-obs`, layer: 6, kind: "Beobachtet", label: "Noch kein Ergebnis importiert", evidence: "open", warnings: [], caseId: c.id, details: [["Hinweis", "Unter „Validierung & Bericht“ ein Ergebnis der Entgeltabrechnung abgleichen."]] }];
  }
  const assessments = cmp.assessments.map((a) => [a.label, a.ok ? `${a.overall} – ${a.summary || "ohne Zusammenfassung"}` : `Fehler: ${a.error ?? ""}`] as [string, string]);
  return [
    { id: `${c.id}-obs`, layer: 6, kind: "Beobachtet", label: `Importiert: ${cmp.resultName}`, evidence: "source", warnings: [], caseId: c.id, details: [["Ergebnisdatei", cmp.resultName], ["Abgleich", `${cmp.id} · ${cmp.createdAt}`], ...assessments] },
    cmp.feedback
      ? { id: `${c.id}-fnd`, layer: 6, kind: "Befund", label: `Prüfer: ${cmp.feedback.verdict}`, evidence: "source", warnings: [], caseId: c.id, details: [["Prüferurteil", cmp.feedback.verdict], ["Zutreffende Einschätzung", cmp.feedback.rating], ["Kommentar", cmp.feedback.comment || "–"]] }
      : { id: `${c.id}-fnd`, layer: 6, kind: "Befund", label: `Vorläufig: ${cmp.consensus}`, evidence: "model", warnings: ["Noch keine Prüferentscheidung – unverbindlich."], caseId: c.id, details: [["Konsens", cmp.consensus]] },
  ];
}

/**
 * Expands one generated case: reasoning steps, expected values, open questions,
 * result. Returns nodes, edges and the grounding checks of the case.
 */
function expandCase(req: Req, c: GeneratedTestCase, concepts: GraphNode[], cmp: ResultComparison | undefined) {
  const o = req.origin;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const checks: GroundingCheck[] = [];
  const sourceText = o ? `${o.quote}\n${o.sectionText}` : "";
  const sourceTerms = new Set(terms(sourceText));
  // Values the case itself sets (test data, steps, scenario) may legitimately appear in expected results.
  const ownInputs = [c.given, c.when, ...c.testData.map((f) => `${f.field} ${f.value}`), ...c.steps.map((s) => `${s.action} ${s.abgabegrund ?? ""}`)].join("\n");
  const numberPool = normalizeForMatch(`${sourceText}\n${ownInputs}`);
  let backed = 0;

  // Reasoning steps → attach to the best-matching condition, else to source/requirement.
  c.reasoning.forEach((step, i) => {
    const id = `${c.id}-why-${i}`;
    const warnings: string[] = [];
    const evidence: GraphEvidence = step.basis === "Quelle" ? "source" : step.basis === "Annahme" ? "assumption" : CASE_EVIDENCE[c.origin.kind];
    const share = o ? overlap(step.text, sourceTerms) : 0;
    if (step.basis === "Quelle" && o && share < MIN_SOURCE_OVERLAP) {
      warnings.push(`Als „Quelle“ markiert, aber nur ${Math.round(share * 100)} % der Begriffe stehen im zitierten Abschnitt.`);
    }
    const unbacked = o ? numbersIn(step.text).filter((n) => !hasNumber(numberPool, n)) : [];
    if (unbacked.length) warnings.push(`Zahl(en) ${unbacked.join(", ")} weder in der Quelle noch in den Testdaten.`);
    if (step.basis === "Quelle" && !warnings.length) backed++;
    else if (step.basis !== "Annahme" && !warnings.length) backed++;
    nodes.push({
      id, layer: 3, kind: `Schritt ${i + 1} · ${step.basis}`, label: step.text,
      evidence: warnings.length && evidence === "source" ? "open" : evidence, warnings, caseId: c.id,
      details: [
        ["Grundlage laut Modell", step.basis],
        ["Zitierte Stelle", step.sourceRef || "keine angegeben"],
        ...(o ? ([["Begriffe in der Quelle", `${Math.round(share * 100)} %`]] as [string, string][]) : []),
      ],
    });
    let best: GraphNode | undefined;
    let bestScore = 0;
    for (const k of concepts) {
      const s = overlap(k.label, new Set(terms(step.text)));
      if (s > bestScore) { best = k; bestScore = s; }
    }
    if (step.basis === "Annahme") edges.push({ id: `${id}-in`, from: "req", to: id, relation: "nimmt an", evidence: "assumption" });
    else if (best && bestScore >= MIN_CONCEPT_OVERLAP) edges.push({ id: `${id}-in`, from: best.id, to: id, relation: "stützt sich auf", evidence: warnings.length ? "open" : best.evidence });
    else if (step.basis === "Quelle") edges.push({ id: `${id}-in`, from: "src", to: id, relation: "zitiert", evidence: warnings.length ? "open" : "source" });
    else edges.push({ id: `${id}-in`, from: "req", to: id, relation: "leitet ab", evidence });
    edges.push({ id: `${id}-out`, from: id, to: c.id, relation: "begründet", evidence });
  });
  if (!c.reasoning.length) {
    edges.push({ id: `${c.id}-in`, from: "req", to: c.id, relation: "erzeugt", evidence: CASE_EVIDENCE[c.origin.kind] });
    checks.push({ id: "why", label: "Begründung", status: "warn", detail: "Das Modell hat keine Begründungsschritte geliefert – Herleitung nicht nachvollziehbar.", nodeId: c.id });
  }
  // Criteria the case claims to cover → link the matching criterion node.
  for (const k of concepts) {
    if (k.kind === "Kriterium-ID" && c.criteriaIds.some((x) => normalizeForMatch(x) === normalizeForMatch(k.label))) {
      edges.push({ id: `${c.id}-crit-${k.id}`, from: k.id, to: c.id, relation: "deckt ab", evidence: k.evidence });
    }
  }

  // Expected values: every number must come from the source or the case's own inputs.
  c.expectedFields.forEach((f, i) => {
    const id = `${c.id}-exp-${i}`;
    const open = f.value.includes(OPEN_VALUE_MARKER);
    const unbacked = open || !o ? [] : numbersIn(f.value).filter((n) => !hasNumber(numberPool, n));
    const warnings = unbacked.length ? [`Wert ${unbacked.join(", ")} steht weder in der Quelle noch in den Testdaten – Herleitung prüfen.`] : [];
    if (!open && !warnings.length) backed++;
    nodes.push({
      id, layer: 5, kind: "Erwartet", label: `${f.field}: ${f.value}`, caseId: c.id, warnings,
      evidence: open ? "open" : warnings.length ? "open" : CASE_EVIDENCE[c.origin.kind],
      details: [["Feld", f.field], ["Wert", f.value], ["Herkunft", open ? "Offen – der Prüfer legt den Wert fest" : c.origin.kind === "manuell" ? "Vom Prüfer eingegeben, nicht durch eine Abrechnung bestätigt" : "Aus Regel und Testdaten abgeleitet, nicht durch eine Abrechnung bestätigt"]],
    });
    edges.push({ id: `${id}-in`, from: c.id, to: id, relation: "erwartet", evidence: open ? "open" : CASE_EVIDENCE[c.origin.kind] });
  });
  c.openQuestions.forEach((q, i) => {
    const id = `${c.id}-q-${i}`;
    nodes.push({ id, layer: 5, kind: "Offene Frage", label: q, evidence: "open", warnings: [], caseId: c.id, details: [["Frage", q]] });
    edges.push({ id: `${id}-in`, from: c.id, to: id, relation: "offen", evidence: "open" });
  });

  const result = resultNodes(c, cmp);
  nodes.push(...result);
  edges.push({ id: `${c.id}-obs-in`, from: c.id, to: result[0].id, relation: "beobachtet", evidence: result[0].evidence });
  if (result[1]) edges.push({ id: `${c.id}-fnd-in`, from: result[0].id, to: result[1].id, relation: "ergibt", evidence: result[1].evidence });

  // ----- Check list -----
  if (o) {
    checks.unshift({ id: "quote", label: "Quellzitat", status: o.quoteVerified ? "ok" : "warn", detail: o.quoteVerified ? "Zitat steht wörtlich im zitierten Abschnitt." : "Zitat nicht wörtlich gefunden – am Original prüfen.", nodeId: "src" });
    if (o.extractedBy === "model") checks.push({ id: "interp", label: "Auslegung der Anforderung", status: "info", detail: "Die Anforderung wurde von der KI ausgelegt. Auslegung und Bedingungen mit dem Zitat vergleichen.", nodeId: "req" });
  } else {
    checks.unshift({ id: "quote", label: "Quellzitat", status: "info", detail: "Beispieldaten ohne Originaltext – Aussagen lassen sich nicht gegen eine Quelle prüfen.", nodeId: "src" });
  }
  const steps = nodes.filter((n) => n.layer === 3);
  if (steps.length) {
    const weak = steps.filter((n) => n.warnings.length);
    const assumptions = c.reasoning.filter((r) => r.basis === "Annahme").length;
    const fromSource = c.reasoning.filter((r) => r.basis === "Quelle").length;
    checks.push({
      id: "why", label: "Begründungsschritte",
      status: weak.length ? "warn" : assumptions ? "info" : "ok",
      detail: `${fromSource} als Quelle, ${assumptions} als Annahme, ${c.reasoning.length - fromSource - assumptions} als abgeleitet markiert.`
        + (weak.length ? ` ${weak.length} Schritt(e) finden sich nicht in der Quelle wieder.` : "")
        + (assumptions ? " Annahmen muss der Prüfer bestätigen." : ""),
      nodeId: weak[0]?.id ?? steps[0].id,
    });
  }
  const expected = nodes.filter((n) => n.kind === "Erwartet");
  const unbackedExp = expected.filter((n) => n.warnings.length);
  const openExp = c.expectedFields.filter((f) => f.value.includes(OPEN_VALUE_MARKER)).length;
  checks.push({
    id: "expected", label: "Erwartete Werte",
    status: unbackedExp.length ? "warn" : openExp ? "info" : expected.length ? "ok" : "warn",
    detail: !expected.length ? "Keine erwarteten Werte angegeben."
      : unbackedExp.length ? `${unbackedExp.length} von ${expected.length} Wert(en) enthalten Zahlen ohne Beleg in Quelle oder Testdaten.`
      : openExp ? `${openExp} von ${expected.length} Wert(en) ausdrücklich offen.`
      : `Alle Zahlen in den ${expected.length} erwarteten Wert(en) finden sich in Quelle oder Testdaten.`,
    nodeId: unbackedExp[0]?.id ?? expected[0]?.id,
  });
  const failed = c.checks.filter((x) => !x.passed);
  checks.push({
    id: "structure", label: "Strukturprüfung", status: failed.length ? "warn" : "ok",
    detail: failed.length ? failed.map((x) => `${x.label}${x.detail ? `: ${x.detail}` : ""}`).join(" · ") : `Alle ${c.checks.length} Prüfungen bestanden (Kriterien, Abgabegründe, Daten, Quellenangabe …).`,
    nodeId: c.id,
  });
  checks.push({
    id: "review", label: "Prüferentscheidung",
    status: c.review.decision === "Akzeptiert" ? "ok" : "info",
    detail: c.review.decision === "Akzeptiert" ? `Akzeptiert${c.review.comment ? ` – „${c.review.comment}“` : ""}.` : "Noch nicht bestätigt – der Testfall ist ein Vorschlag.",
    nodeId: c.id,
  });
  return { nodes, edges, checks, failedChecks: failed, claims: { total: c.reasoning.filter((r) => r.basis !== "Annahme").length + expected.length - openExp, backed } };
}

function caseNode(c: GeneratedTestCase): GraphNode {
  return {
    id: c.id, layer: 4, kind: "Testfall", caseId: c.id, warnings: [],
    label: [c.id, sanitizeCaseTitle(c.title)].filter(Boolean).join(" · "),
    evidence: CASE_EVIDENCE[c.origin.kind],
    details: [
      ["Herkunft", `${ORIGIN_LABEL[c.origin.kind]} · ${c.origin.model} · Lauf ${c.origin.runId}`],
      ["Technik", c.technique],
      ["Priorität", `${c.priority} – ${c.priorityReason || "ohne Begründung"}`],
      ["Gegeben", c.given || "–"],
      ["Wenn", c.when || "–"],
      ["Dann", c.then || "–"],
      ["Testdaten", c.testData.map((f) => `${f.field}: ${f.value}`).join(" · ") || "–"],
      ["Ablauf", c.steps.map((s, i) => `${i + 1}. ${s.actor}: ${s.action}${s.abgabegrund ? ` (${s.abgabegrund})` : ""}`).join(" ") || "–"],
      ["Zitierte Quellen", c.sourceRefs.join("; ") || "keine"],
      ["Kriterien", c.criteriaIds.join("; ") || "keine"],
      ["Prüfung", `${c.review.decision}${c.review.comment ? ` · „${c.review.comment}“` : ""}`],
    ],
  };
}

function sampleNodes(t: SampleTuple, focused: boolean): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const [id, scenario, technique, expected, status] = t;
  const nodes: GraphNode[] = [{ id, layer: 4, kind: "Testfall", label: `${id} · ${scenario}`, evidence: "sample", caseId: id, warnings: [], details: [["Technik", technique], ["Status", status], ["Hinweis", "Beispieldaten – keine Modellbegründung vorhanden"]] }];
  const edges: GraphEdge[] = [{ id: `${id}-in`, from: "req", to: id, relation: "Beispiel", evidence: "sample" }];
  if (!focused) return { nodes, edges };
  const missing = expected.startsWith("[");
  const executed = status === "Bestanden" || status === "Fehlgeschlagen";
  nodes.push(
    { id: `${id}-exp`, layer: 5, kind: "Erwartet", label: missing ? "Kein erwarteter Wert" : expected, evidence: missing ? "open" : "sample", caseId: id, warnings: [], details: [["Erwartet", expected]] },
    { id: `${id}-fnd`, layer: 6, kind: "Befund", label: executed ? `Beispielergebnis: ${status}` : "Nicht ausgeführt", evidence: executed ? "sample" : "open", caseId: id, warnings: [], details: [["Befund", status === "Fehlgeschlagen" ? SAMPLE_FINDINGS[id] ?? "Fehlgeschlagen" : status]] },
  );
  edges.push({ id: `${id}-e1`, from: id, to: `${id}-exp`, relation: "erwartet", evidence: "sample" }, { id: `${id}-e2`, from: id, to: `${id}-fnd`, relation: "ergibt", evidence: "sample" });
  return { nodes, edges };
}

/** Number of grounding warnings of a case without building its full graph. */
export function caseWarnings(req: Req, c: GeneratedTestCase): number {
  const concepts = conceptNodes(req);
  const x = expandCase(req, c, concepts, undefined);
  return x.nodes.reduce((n, node) => n + node.warnings.length, 0) + x.failedChecks.length + (req.origin && !req.origin.quoteVerified ? 1 : 0);
}

function conceptNodes(req: Req): GraphNode[] {
  return buildOntology(req)
    .filter((k) => CONCEPT_CATEGORIES.has(k.category))
    .map((k) => ({
      id: `k-${k.id}`, layer: 2, kind: k.label, label: k.value, evidence: req.origin ? FROM_TRACE[k.evidence] : "sample",
      quote: k.quote, warnings: k.evidence === "source" || !req.origin ? [] : ["Nicht wörtlich in der Quelle – Auslegung prüfen."],
      details: [["Kategorie", k.category], ["Beleg", k.evidence === "source" ? "wörtlich in der Quelle" : "aus der Auslegung, nicht wörtlich belegt"], ["Quelle", k.sourceRef ?? "–"]],
    }));
}

export function buildReasoningGraph(req: Req, generated: GeneratedTestCase[], comparisons: ResultComparison[], focusId?: string): ReasoningGraph {
  const latest = new Map<string, ResultComparison>();
  for (const cmp of comparisons) latest.set(cmp.testCaseId, cmp);
  const forReq = generated.filter((c) => c.requirementId === req.id);
  const visible = forReq.filter((c) => c.review.decision !== "Abgelehnt");
  const samples = sampleCasesFor(req);
  const allIds = [...visible.map((c) => c.id), ...samples.map((s) => s[0] as string)];
  const focus = focusId && allIds.includes(focusId) ? focusId : allIds[0];

  const nodes: GraphNode[] = sourceAndRequirement(req);
  const edges: GraphEdge[] = [{ id: "src-req", from: "src", to: "req", relation: "entnommen aus", evidence: nodes[1].evidence }];
  const concepts = conceptNodes(req);
  nodes.push(...concepts);
  for (const k of concepts) edges.push({ id: `req-${k.id}`, from: "req", to: k.id, relation: "hat", evidence: k.evidence });

  let checks: GroundingCheck[] = [];
  let claims = { total: 0, backed: 0 };
  const summaries: CaseSummary[] = [];
  for (const c of visible) {
    const node = caseNode(c);
    nodes.push(node);
    summaries.push({ id: c.id, label: node.label, evidence: node.evidence, warnings: caseWarnings(req, c) });
    if (c.id === focus) {
      const x = expandCase(req, c, concepts, latest.get(c.id));
      nodes.push(...x.nodes);
      edges.push(...x.edges);
      node.warnings.push(...x.failedChecks.map((f) => `${f.label}${f.detail ? `: ${f.detail}` : ""}`));
      checks = x.checks;
      claims = x.claims;
    } else {
      edges.push({ id: `${c.id}-in`, from: "req", to: c.id, relation: "erzeugt", evidence: node.evidence });
    }
  }
  for (const s of samples) {
    const x = sampleNodes(s, s[0] === focus);
    nodes.push(...x.nodes);
    edges.push(...x.edges);
    summaries.push({ id: s[0], label: `${s[0]} · ${s[1]}`, evidence: "sample", warnings: 0 });
    if (s[0] === focus) checks = [{ id: "sample", label: "Beispieldaten", status: "info", detail: "Illustratives Beispiel ohne Modellbegründung und ohne Originaltext.", nodeId: s[0] }];
  }
  return { nodes, edges, checks, cases: summaries, focusId: focus, claims, hiddenRejected: forReq.length - visible.length };
}

/** Text searched on the Nachverfolgbarkeit page for one requirement. */
export function requirementHaystack(req: Req, generated: GeneratedTestCase[]): string {
  const o = req.origin;
  return [
    req.id, req.title, req.source, req.benefit,
    o?.documentName, o?.sectionLabel, o?.criterionId, o ? truncate(o.quote, 600) : "",
    ...generated.filter((c) => c.requirementId === req.id).flatMap((c) => [c.id, c.title, c.technique]),
  ].filter(Boolean).join(" ").toLocaleLowerCase("de-DE");
}
