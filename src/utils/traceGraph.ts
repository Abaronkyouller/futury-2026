import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import { cases as sampleCases } from "../data/testCases";
import { OPEN_VALUE_MARKER } from "../config/ai";

/**
 * Builds the traceability chain for one requirement:
 *   Quelle -> Anforderung -> Regel -> Testfall -> Erwartet -> Beobachtet -> Befund
 *
 * Every node carries an evidence label so the graph never blurs sample data,
 * AI proposals and missing links (AGENTS.md instructions 3 and 5). The graph
 * shows links only; it does not prove a payroll result is correct.
 */

export type NodeKind =
  | "Quelle"
  | "Anforderung"
  | "Regel"
  | "Testfall"
  | "Erwartet"
  | "Beobachtet"
  | "Befund";

/**
 * - sample: illustrative repository data (not verified against a real source)
 * - ai: model proposal, not verified
 * - demo: offline demo, no model call
 * - missing: link or evidence does not exist yet
 */
export type Evidence = "sample" | "ai" | "demo" | "missing";

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
  sample: "Sample data",
  ai: "AI proposal (unverified)",
  demo: "Offline demo (simulated)",
  missing: "Missing / not yet available",
};

/** Sample test-case tuple, read by position as in src/data/testCases.ts. */
type SampleTuple = (typeof sampleCases)[number];

/** Known finding text for sample failures (mirrors the Validation page). */
const SAMPLE_FINDINGS: Record<string, string> = {
  "TC-028-04": "Bemessungszeitraum von/bis mismatch: September 2026 reported, August 2026 expected (data set #0412).",
};

/** Sample cases are linked to requirements by number: TC-028-xx -> REQ-EEL-028. */
function sampleCasesFor(req: Req): SampleTuple[] {
  const no = req.id.split("-").pop();
  return sampleCases.filter((c) => c[0].startsWith(`TC-${no}-`));
}

function sampleLane(c: SampleTuple): TraceNode[] {
  const [id, scenario, technique, expected, status] = c;
  const expectedMissing = expected.startsWith("[");
  const executed = status === "Passed" || status === "Failed";
  return [
    { id, kind: "Testfall", label: `${id} · ${scenario}`, evidence: "sample", details: [["Technique", technique], ["Status", status]] },
    {
      id: `${id}-exp`, kind: "Erwartet",
      label: expectedMissing ? "No expected value" : expected,
      evidence: expectedMissing ? "missing" : "sample",
      details: [["Expected", expected]],
    },
    {
      id: `${id}-obs`, kind: "Beobachtet",
      label: executed ? `Sample result: ${status}` : "Not executed",
      evidence: executed ? "sample" : "missing",
      details: [["Note", executed ? "Illustrative sample, not a real payroll run" : "No data set received"]],
    },
    {
      id: `${id}-fnd`, kind: "Befund",
      label: status === "Failed" ? "Mismatch" : status === "Passed" ? "No finding" : "No finding yet",
      evidence: executed ? "sample" : "missing",
      details: [["Finding", status === "Failed" ? SAMPLE_FINDINGS[id] ?? "Failed – no finding text recorded" : status === "Passed" ? "Expected and observed match" : "Requires execution"]],
    },
  ];
}

function generatedLane(c: GeneratedTestCase): TraceNode[] {
  const evidence: Evidence = c.origin.kind === "model" ? "ai" : "demo";
  const open = c.expectedFields.filter((f) => f.value.includes(OPEN_VALUE_MARKER)).length;
  return [
    {
      id: c.id, kind: "Testfall", label: `${c.id} · ${c.title}`, evidence,
      details: [
        ["Origin", `${c.origin.model} · run ${c.origin.runId}`],
        ["Priority", c.priority],
        ["Review", `${c.review.decision}${c.review.comment ? ` · "${c.review.comment}"` : ""}`],
        ["Cited sources", c.sourceRefs.join("; ") || "none"],
      ],
    },
    {
      id: `${c.id}-exp`, kind: "Erwartet",
      label: open > 0 ? `${c.expectedFields.length} field(s), ${open} open` : `${c.expectedFields.length} field(s)`,
      evidence,
      details: c.expectedFields.map((f) => [f.field, f.value] as [string, string]),
    },
    { id: `${c.id}-obs`, kind: "Beobachtet", label: c.execution, evidence: "missing", details: [["Note", "No payroll data set imported for this case"]] },
    { id: `${c.id}-fnd`, kind: "Befund", label: "No finding yet", evidence: "missing", details: [["Note", "Requires an observed result"]] },
  ];
}

export function buildTraceGraph(req: Req, generated: GeneratedTestCase[]): TraceGraph {
  const spine: TraceNode[] = [
    { id: `src-${req.id}`, kind: "Quelle", label: req.source, evidence: "sample", details: [["Source", req.source], ["Original text", "Not available in repository"]] },
    {
      id: req.id, kind: "Anforderung", label: `${req.id} · ${req.title}`, evidence: "sample",
      details: [["Benefit", req.benefit], ["Status", req.status], ["Extraction confidence", String(req.confidence)]],
    },
    req.rule
      ? { id: req.rule, kind: "Regel", label: req.rule, evidence: "sample", details: [["Rule", req.rule], ["Note", "Illustrative; no rule engine is connected"]] }
      : { id: `rule-${req.id}`, kind: "Regel", label: "No approved rule", evidence: "missing", details: [["Note", "Requirement not yet approved by an examiner"]] },
  ];
  const lanes = [
    ...sampleCasesFor(req).map(sampleLane),
    ...generated.filter((c) => c.requirementId === req.id && c.review.decision !== "Abgelehnt").map(generatedLane),
  ];
  return { spine, lanes };
}
