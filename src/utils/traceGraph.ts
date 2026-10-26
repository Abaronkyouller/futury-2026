import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import { ORIGIN_LABEL } from "../types/review";
import { cases as sampleCases } from "../data/testCases";
import { OPEN_VALUE_MARKER } from "../config/ai";
import { sanitizeCaseTitle } from "./caseText";

/**
 * Builds the traceability chain for one requirement:
 *   Quelle -> Anforderung -> Regel -> Testfall -> Erwartet -> Beobachtet -> Befund
 *
 * Every node carries an evidence label so the graph never blurs source text,
 * sample data, AI proposals and missing links (AGENTS.md instructions 3 and 5).
 * The graph shows links only; it does not prove a payroll result is correct.
 */

export type NodeKind = "Quelle" | "Anforderung" | "Regel" | "Testfall" | "Erwartet" | "Beobachtet" | "Befund";

/**
 * - source: verbatim from an uploaded document (quote found in the section)
 * - sample: illustrative repository data (not verified against a real source)
 * - ai: model proposal, not verified
 * - rule: derived deterministically from a source quote, not yet confirmed
 * - demo: offline demo, no model call
 * - missing: link or evidence does not exist yet
 */
export type Evidence = "source" | "sample" | "ai" | "rule" | "demo" | "missing";

export type TraceNode = {
  id: string;
  kind: NodeKind;
  label: string;
  evidence: Evidence;
  details: [string, string][];
};

export type TraceGraph = {
  /** Source -> requirement -> rule, shared by all test cases. */
  spine: TraceNode[];
  /** One lane per test case: test case -> expected -> observed -> finding. */
  lanes: TraceNode[][];
};

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  source: "Quelle (Dokument, Zitat geprüft)",
  sample: "Beispieldaten",
  ai: "KI-Vorschlag (ungeprüft)",
  rule: "Regelbasiert abgeleitet",
  demo: "Offline-Demo (simuliert)",
  missing: "Fehlt / noch nicht vorhanden",
};

/** Sample test-case tuple, read by position as in src/data/testCases.ts. */
type SampleTuple = (typeof sampleCases)[number];

/** Known finding text for sample failures (mirrors the Validation page). */
const SAMPLE_FINDINGS: Record<string, string> = {
  "TC-028-04": "Bemessungszeitraum von/bis weicht ab: September 2026 gemeldet, August 2026 erwartet (Datensatz #0412).",
};

/** Sample cases are linked to requirements by number: TC-028-xx -> REQ-EEL-028. */
function sampleCasesFor(req: Req): SampleTuple[] {
  if (req.origin) return [];
  const no = req.id.split("-").pop();
  return sampleCases.filter((c) => c[0].startsWith(`TC-${no}-`));
}

function sampleLane(c: SampleTuple): TraceNode[] {
  const [id, scenario, technique, expected, status] = c;
  const expectedMissing = expected.startsWith("[");
  const executed = status === "Bestanden" || status === "Fehlgeschlagen";
  return [
    { id, kind: "Testfall", label: `${id} · ${scenario}`, evidence: "sample", details: [["Technik", technique], ["Status", status]] },
    {
      id: `${id}-exp`, kind: "Erwartet",
      label: expectedMissing ? "Kein erwarteter Wert" : expected,
      evidence: expectedMissing ? "missing" : "sample",
      details: [["Erwartet", expected]],
    },
    {
      id: `${id}-obs`, kind: "Beobachtet",
      label: executed ? `Beispielergebnis: ${status}` : "Nicht ausgeführt",
      evidence: executed ? "sample" : "missing",
      details: [["Hinweis", executed ? "Illustratives Beispiel, kein echter Abrechnungslauf" : "Kein Datensatz eingegangen"]],
    },
    {
      id: `${id}-fnd`, kind: "Befund",
      label: status === "Fehlgeschlagen" ? "Abweichung" : status === "Bestanden" ? "Kein Befund" : "Noch kein Befund",
      evidence: executed ? "sample" : "missing",
      details: [[
        "Befund",
        status === "Fehlgeschlagen"
          ? SAMPLE_FINDINGS[id] ?? "Fehlgeschlagen – kein Befundtext erfasst"
          : status === "Bestanden" ? "Erwartet und beobachtet stimmen überein" : "Erfordert eine Ausführung",
      ]],
    },
  ];
}

const CASE_EVIDENCE: Record<GeneratedTestCase["origin"]["kind"], Evidence> = {
  model: "ai",
  regelbasiert: "rule",
  "offline-demo": "demo",
};

function generatedLane(c: GeneratedTestCase): TraceNode[] {
  const evidence = CASE_EVIDENCE[c.origin.kind];
  const open = c.expectedFields.filter((f) => f.value.includes(OPEN_VALUE_MARKER)).length;
  return [
    {
      id: c.id, kind: "Testfall", label: [c.id, sanitizeCaseTitle(c.title)].filter(Boolean).join(" · "), evidence,
      details: [
        ["Herkunft", `${ORIGIN_LABEL[c.origin.kind]} · ${c.origin.model} · Lauf ${c.origin.runId}`],
        ["Priorität", `${c.priority} – ${c.priorityReason || "ohne Begründung"}`],
        ["Prüfung", `${c.review.decision}${c.review.comment ? ` · "${c.review.comment}"` : ""}`],
        ["Zitierte Quellen", c.sourceRefs.join("; ") || "keine"],
        ["Kriterien", c.criteriaIds.join("; ") || "keine"],
        ["Ablauf", c.steps.map((s, i) => `${i + 1}. ${s.actor}: ${s.action}${s.abgabegrund ? ` (${s.abgabegrund})` : ""}`).join(" ") || "–"],
      ],
    },
    {
      id: `${c.id}-exp`, kind: "Erwartet",
      label: open > 0 ? `${c.expectedFields.length} Feld(er), ${open} offen` : `${c.expectedFields.length} Feld(er)`,
      evidence,
      details: c.expectedFields.map((f) => [f.field, f.value] as [string, string]),
    },
    { id: `${c.id}-obs`, kind: "Beobachtet", label: c.execution, evidence: "missing", details: [["Hinweis", "Für diesen Fall wurde kein Datensatz aus der Entgeltabrechnung importiert"]] },
    { id: `${c.id}-fnd`, kind: "Befund", label: "Noch kein Befund", evidence: "missing", details: [["Hinweis", "Erfordert ein beobachtetes Ergebnis"]] },
  ];
}

function spineFor(req: Req): TraceNode[] {
  const o = req.origin;
  const source: TraceNode = o
    ? {
        id: `src-${req.id}`, kind: "Quelle", label: `${o.documentName} · ${o.sectionLabel}`,
        evidence: o.quoteVerified ? "source" : "missing",
        details: [
          ["Dokument", o.documentName],
          ["Version/Stand", o.documentVersion ?? "nicht angegeben"],
          ["Dokumentart", o.documentKind],
          ["Abschnitt", o.sectionLabel],
          ["Zitat", o.quote],
          ["Zitat geprüft", o.quoteVerified ? "ja – im Abschnitt gefunden" : "nein – am Original prüfen"],
        ],
      }
    : { id: `src-${req.id}`, kind: "Quelle", label: req.source, evidence: "sample", details: [["Quelle", req.source], ["Originaltext", "Im Prototyp nicht vorhanden"]] };

  const requirement: TraceNode = {
    id: req.id, kind: "Anforderung", label: `${req.id} · ${req.title}`,
    evidence: o ? (o.extractedBy === "model" ? "ai" : "rule") : "sample",
    details: [
      ["Leistung", req.benefit],
      ["Status", req.status],
      ...(o
        ? ([
            ["Extraktion", o.extractedBy === "model" ? `KI (${o.model})` : "Regelbasiert"],
            ["Interpretation", o.statement || "–"],
            ["Bedingungen", o.conditions.join(" · ") || "–"],
          ] as [string, string][])
        : ([["Extraktionskonfidenz", String(req.confidence)]] as [string, string][])),
      ...(req.comment ? ([["Kommentar", req.comment]] as [string, string][]) : []),
    ],
  };

  const rule: TraceNode = req.rule
    ? { id: req.rule, kind: "Regel", label: req.rule, evidence: "sample", details: [["Regel", req.rule], ["Hinweis", "Illustrativ; keine Regel-Engine angebunden"]] }
    : req.status === "Genehmigt"
      ? { id: `rule-${req.id}`, kind: "Regel", label: "Prüfkriterium genehmigt", evidence: "source", details: [["Hinweis", "Vom Prüfer genehmigt. Nicht maschinell ausführbar – keine Regel-Engine angebunden."]] }
      : { id: `rule-${req.id}`, kind: "Regel", label: "Keine genehmigte Regel", evidence: "missing", details: [["Hinweis", "Anforderung wurde noch nicht vom Prüfer genehmigt"]] };

  return [source, requirement, rule];
}

export function buildTraceGraph(req: Req, generated: GeneratedTestCase[]): TraceGraph {
  const lanes = [
    ...sampleCasesFor(req).map(sampleLane),
    ...generated.filter((c) => c.requirementId === req.id && c.review.decision !== "Abgelehnt").map(generatedLane),
  ];
  return { spine: spineFor(req), lanes };
}
