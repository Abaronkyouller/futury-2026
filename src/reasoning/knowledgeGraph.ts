import type { Req } from "../types/requirement";
import type { KnowledgeEdge, KnowledgeNode, OntologyConcept, ReasoningCase, TraceEvidence } from "../types/reasoning";
import { OPEN_VALUE_MARKER } from "../config/ai";
import { truncate } from "../documents/text";

const evidenceForBasis = (basis: string): TraceEvidence => basis === "Quelle" ? "source" : basis === "Annahme" ? "assumption" : "derived";

/** Builds a provenance graph from source document to expected test result. */
export function buildKnowledgeGraph(req: Req, c: ReasoningCase, ontology: OntologyConcept[], caseId: string) {
  const nodes: KnowledgeNode[] = [];
  const edges: KnowledgeEdge[] = [];
  const o = req.origin;
  const ref = o ? `${o.documentName} · ${o.sectionLabel}` : req.source;
  const source: KnowledgeNode = { id: `${req.id}-source`, kind: "Quelle", label: ref, evidence: o?.quoteVerified ? "source" : "open", detail: o?.documentVersion ?? "Version/Stand nicht angegeben", sourceRef: ref, quote: o?.quote };
  const requirement: KnowledgeNode = { id: req.id, kind: "Anforderung", label: `${req.id} · ${req.title}`, evidence: o?.extractedBy === "model" ? "model" : "source", detail: o?.statement, sourceRef: ref };
  nodes.push(source, requirement);
  edges.push({ id: `${req.id}-e-source`, from: source.id, to: requirement.id, relation: "entnommen aus", evidence: requirement.evidence });

  const conditions: KnowledgeNode[] = [];
  for (const [index, concept] of ontology.entries()) {
    if (concept.category !== "Voraussetzung" && concept.category !== "Frist" && concept.category !== "Kriterium") continue;
    const kind = concept.category === "Voraussetzung" ? "Bedingung" : concept.category === "Frist" ? "Schwellenwert" : "Kriterium";
    const node: KnowledgeNode = { id: `${req.id}-onto-${index + 1}`, kind, label: concept.value, evidence: concept.evidence, sourceRef: concept.sourceRef, quote: concept.quote };
    nodes.push(node);
    const parent = kind === "Schwellenwert" ? conditions[conditions.length - 1] ?? requirement : requirement;
    edges.push({ id: `${req.id}-e-onto-${index + 1}`, from: parent.id, to: node.id, relation: kind === "Bedingung" ? "hat Bedingung" : kind === "Schwellenwert" ? "hat Schwellenwert" : "hat Kriterium", evidence: concept.evidence });
    if (kind === "Bedingung") conditions.push(node);
  }

  const rule: KnowledgeNode = { id: `${req.id}-rule`, kind: "Regel", label: conditions.length ? "Bedingungen werden auf Zulässigkeit geprüft." : "Die zitierte Pflicht wird geprüft.", evidence: "derived", detail: "Lokale regelbasierte Ableitung; keine Rechtsprüfung", sourceRef: ref };
  const test: KnowledgeNode = { id: caseId, kind: "Testfall", label: `${caseId} · ${c.title}`, evidence: "derived", detail: `${c.given} / ${c.when} / ${c.then}`, sourceRef: ref };
  nodes.push(rule, test);
  edges.push({ id: `${req.id}-e-rule`, from: requirement.id, to: rule.id, relation: "leitet ab", evidence: "derived" });
  edges.push({ id: `${req.id}-e-test`, from: rule.id, to: test.id, relation: "prüft", evidence: "derived" });

  c.expectedFields.forEach((field, index) => {
    const evidence: TraceEvidence = field.value.includes(OPEN_VALUE_MARKER) ? "open" : "derived";
    const node: KnowledgeNode = { id: `${caseId}-expected-${index}`, kind: "Erwartet", label: `${field.field}: ${field.value}`, evidence, sourceRef: ref };
    nodes.push(node);
    edges.push({ id: `${caseId}-e-expected-${index}`, from: test.id, to: node.id, relation: "erwartet", evidence });
  });
  c.reasoning.forEach((step, index) => {
    const evidence = evidenceForBasis(step.basis);
    const node: KnowledgeNode = { id: `${caseId}-reason-${index}`, kind: "Begründung", label: truncate(step.text, 180), evidence, sourceRef: step.sourceRef };
    nodes.push(node);
    edges.push({ id: `${caseId}-e-reason-${index}`, from: test.id, to: node.id, relation: "begründet", evidence });
  });
  c.openQuestions.forEach((question, index) => {
    const node: KnowledgeNode = { id: `${caseId}-question-${index}`, kind: "Offene Frage", label: truncate(question, 180), evidence: "open", sourceRef: ref };
    nodes.push(node);
    edges.push({ id: `${caseId}-e-question-${index}`, from: test.id, to: node.id, relation: "offen", evidence: "open" });
  });
  return { nodes, edges };
}
