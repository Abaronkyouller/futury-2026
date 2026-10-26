import type { Req } from "../types/requirement";
import type { CaseTrace, ReasoningCase } from "../types/reasoning";
import { buildKnowledgeGraph } from "./knowledgeGraph";
import { buildOntology } from "./ontology";
import { buildRules } from "./rules";

/** Combines ontology, provenance graph and deterministic rules for one case. */
export function buildCaseTrace(req: Req, c: ReasoningCase, origin: { kind: string; model: string }, caseId: string): CaseTrace {
  const o = req.origin;
  const ontology = buildOntology(req);
  const graph = buildKnowledgeGraph(req, c, ontology, caseId);
  const rules = buildRules(req, c, origin);
  const sourceCount = ontology.filter((x) => x.evidence === "source").length;
  const openCount = rules.filter((x) => x.status === "offen" || x.status === "widerspruch").length;
  return {
    builtAt: new Date().toISOString(),
    source: { documentId: o?.documentId, documentName: o?.documentName ?? req.source, documentVersion: o?.documentVersion, documentKind: o?.documentKind, sectionId: o?.sectionId, sectionLabel: o?.sectionLabel ?? "Beispieldaten", quote: o?.quote ?? "", quoteVerified: o?.quoteVerified ?? false, quoteNote: o?.quoteNote },
    ontology,
    graph,
    rules,
    summary: `${sourceCount} quellbelegte(s) Konzept(e) · ${rules.length} Regelprüfung(en) · ${openCount} offene/auffällige(r) Punkt(e)`,
  };
}
