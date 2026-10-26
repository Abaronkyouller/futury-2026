/** Evidence status used by the local explainability layer. */
export type TraceEvidence = "source" | "derived" | "model" | "assumption" | "open";

export const TRACE_EVIDENCE_LABEL: Record<TraceEvidence, string> = {
  source: "Quelltext / belegt",
  derived: "Regelbasiert abgeleitet",
  model: "Modellauslegung",
  assumption: "Annahme – zu prüfen",
  open: "Offen / nicht belegt",
};

export type OntologyCategory =
  | "Leistung" | "Rechtsgrundlage" | "Vorgang" | "Voraussetzung" | "Frist"
  | "Meldung" | "Datenfeld" | "Kriterium" | "Akteur";

export type OntologyConcept = {
  id: string;
  category: OntologyCategory;
  label: string;
  value: string;
  evidence: TraceEvidence;
  sourceRef?: string;
  quote?: string;
};

export type KnowledgeNodeKind =
  | "Quelle" | "Anforderung" | "Bedingung" | "Schwellenwert" | "Kriterium"
  | "Regel" | "Testfall" | "Erwartet" | "Begründung" | "Offene Frage";

export type KnowledgeNode = {
  id: string;
  kind: KnowledgeNodeKind;
  label: string;
  evidence: TraceEvidence;
  detail?: string;
  sourceRef?: string;
  quote?: string;
};

export type KnowledgeEdge = {
  id: string;
  from: string;
  to: string;
  relation: string;
  evidence: TraceEvidence;
};

export type RuleStatus = "belegt" | "abgeleitet" | "offen" | "widerspruch";
export type RuleTrace = {
  id: string;
  label: string;
  expression: string;
  status: RuleStatus;
  evidence: string;
  sourceRef?: string;
};

export type CaseTrace = {
  builtAt: string;
  source: {
    documentId?: string;
    documentName: string;
    documentVersion?: string;
    documentKind?: string;
    sectionId?: string;
    sectionLabel: string;
    quote: string;
    quoteVerified: boolean;
    quoteNote?: string;
  };
  ontology: OntologyConcept[];
  graph: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] };
  rules: RuleTrace[];
  summary: string;
};

/** Minimal generated-case shape consumed by the deterministic trace builders. */
export type ReasoningCase = {
  title: string;
  given: string;
  when: string;
  then: string;
  testData: { field: string; value: string }[];
  steps: { actor: string; action: string; abgabegrund?: string }[];
  expectedFields: { field: string; value: string }[];
  criteriaIds: string[];
  reasoning: { text: string; basis: string; sourceRef?: string }[];
  sourceRefs: string[];
  openQuestions: string[];
};
