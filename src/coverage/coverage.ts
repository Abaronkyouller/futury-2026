import type { DocSection, SourceDocument } from "../types/document";
import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";

/**
 * Test coverage (Testabdeckung), built from the existing test cases.
 *
 * Every generated test case belongs to a requirement, and every requirement
 * extracted from a document records its document and section. Coverage is
 * therefore computed from the cases on "Testfälle" alone; no new test cases
 * are needed. If the original document is loaded, its sections without any
 * requirement are added, so the share of the whole document can be shown.
 * Without the document only sections with requirements are known.
 *
 * Unit of coverage is a source section as printed (split parts are merged). A
 * section is covered when at least one test case exists for a requirement from
 * it. Rejected cases never count; optionally only accepted cases count.
 * Cases of the sample requirements are grouped under "Beispieldaten".
 */

export const COVERAGE_STATUSES = ["Abgedeckt", "Teilweise abgedeckt", "Anforderung ohne Testfall", "Keine Anforderung erkannt"] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

export type RequirementCoverage = { req: Req; cases: GeneratedTestCase[] };

export type SectionCoverage = {
  key: string;
  documentId: string;
  documentName: string;
  /** "3.12 Datenbaustein DBVO" or the chunk title. */
  label: string;
  pages: string;
  requirements: RequirementCoverage[];
  cases: GeneratedTestCase[];
  status: CoverageStatus;
};

/** A source: an uploaded document (loaded or only known from the requirements) or the sample data. */
export type CoverageSource = { id: string; name: string; loaded: boolean; sample: boolean };

export type DocumentCoverage = {
  source: CoverageSource;
  sections: SectionCoverage[];
  sectionsWithCases: number;
  sectionsWithRequirements: number;
  requirements: number;
  requirementsWithCases: number;
};

/** Share in percent, rounded; 0 when there is nothing to cover. */
export const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

function sectionLabel(s: DocSection): string {
  return [s.number, s.title].filter(Boolean).join(" ") || "Ohne Titel";
}

function pageLabel(parts: DocSection[]): string {
  const starts = parts.map((p) => p.pageStart).filter((n): n is number => n !== undefined);
  const ends = parts.map((p) => p.pageEnd ?? p.pageStart).filter((n): n is number => n !== undefined);
  if (!starts.length) return "";
  const from = Math.min(...starts);
  const to = Math.max(...ends);
  return from === to ? `S. ${from}` : `S. ${from}–${to}`;
}

/** Which cases count: never rejected ones; with `acceptedOnly` only accepted ones. */
export function countsForCoverage(c: GeneratedTestCase, acceptedOnly: boolean): boolean {
  return acceptedOnly ? c.review.decision === "Akzeptiert" : c.review.decision !== "Abgelehnt";
}

const SAMPLE_SOURCE: CoverageSource = { id: "beispieldaten", name: "Beispieldaten (ohne hochgeladenes Dokument)", loaded: false, sample: true };

function section(key: string, src: CoverageSource, label: string, pages: string, reqs: RequirementCoverage[]): SectionCoverage {
  const withCases = reqs.filter((r) => r.cases.length > 0).length;
  const status: CoverageStatus = reqs.length === 0 ? "Keine Anforderung erkannt"
    : withCases === 0 ? "Anforderung ohne Testfall"
    : withCases < reqs.length ? "Teilweise abgedeckt" : "Abgedeckt";
  return { key, documentId: src.id, documentName: src.name, label, pages, requirements: reqs, cases: reqs.flatMap((r) => r.cases), status };
}

function summarize(source: CoverageSource, sections: SectionCoverage[]): DocumentCoverage {
  const reqs = sections.flatMap((s) => s.requirements);
  return {
    source,
    sections,
    sectionsWithCases: sections.filter((s) => s.cases.length > 0).length,
    sectionsWithRequirements: sections.filter((s) => s.requirements.length > 0).length,
    requirements: reqs.length,
    requirementsWithCases: reqs.filter((r) => r.cases.length > 0).length,
  };
}

export function buildCoverage(documents: SourceDocument[], requirements: Req[], cases: GeneratedTestCase[], acceptedOnly: boolean): DocumentCoverage[] {
  const counted = cases.filter((c) => countsForCoverage(c, acceptedOnly));
  const casesOf = (req: Req) => counted.filter((c) => c.requirementId === req.id);
  const loaded = new Map(documents.map((d) => [d.id, d]));
  const result: DocumentCoverage[] = [];

  // Sources: every loaded document plus every document named by a requirement.
  const docIds = [...new Set([...documents.map((d) => d.id), ...requirements.flatMap((r) => (r.origin ? [r.origin.documentId] : []))])];
  for (const docId of docIds) {
    const doc = loaded.get(docId);
    const docReqs = requirements.filter((r) => r.origin?.documentId === docId);
    const source: CoverageSource = { id: docId, name: doc?.name ?? docReqs[0]?.origin?.documentName ?? docId, loaded: Boolean(doc), sample: false };
    const sections: SectionCoverage[] = [];
    const placed = new Set<string>();
    if (doc) {
      // Merge parts of split sections into one logical section (same number and title).
      const groups = new Map<string, DocSection[]>();
      for (const s of doc.sections) {
        const key = `${doc.id}|${s.number ?? ""}|${s.title}`;
        groups.set(key, [...(groups.get(key) ?? []), s]);
      }
      for (const [key, parts] of groups) {
        const ids = new Set(parts.map((p) => p.id));
        const reqs = docReqs.filter((r) => ids.has(r.origin!.sectionId));
        reqs.forEach((r) => placed.add(r.id));
        sections.push(section(key, source, sectionLabel(parts[0]), pageLabel(parts), reqs.map((req) => ({ req, cases: casesOf(req) }))));
      }
    }
    // Requirements without a loaded section: grouped by the section label they recorded.
    const byLabel = new Map<string, Req[]>();
    for (const r of docReqs.filter((x) => !placed.has(x.id))) byLabel.set(r.origin!.sectionLabel, [...(byLabel.get(r.origin!.sectionLabel) ?? []), r]);
    for (const [label, reqs] of byLabel) sections.push(section(`${docId}|${label}`, source, label, "", reqs.map((req) => ({ req, cases: casesOf(req) }))));
    result.push(summarize(source, sections));
  }

  // Sample requirements: only those that have generated test cases.
  const samples = requirements.filter((r) => !r.origin && cases.some((c) => c.requirementId === r.id));
  if (samples.length) {
    const bySource = new Map<string, Req[]>();
    for (const r of samples) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);
    result.push(summarize(SAMPLE_SOURCE, [...bySource].map(([label, reqs]) => section(`sample|${label}`, SAMPLE_SOURCE, label, "", reqs.map((req) => ({ req, cases: casesOf(req) }))))));
  }
  return result;
}
