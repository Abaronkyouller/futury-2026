import { GENERATION_CONTEXT_CHARS } from "../config/documents";
import { buildCaseTrace } from "../reasoning/trace";
import type { SourceDocument } from "../types/document";
import type { GenerationCacheEntry } from "../types/generationCache";
import type { Req } from "../types/requirement";
import type { GeneratedTestCase } from "../types/review";
import { sectionLabel } from "./ingest";
import { quoteOccursIn, shortHash, truncate } from "./text";

/** Exact cache identity requested by the owner: file name plus detected version/stand. */
export function generationCacheKey(doc: SourceDocument): string {
  const name = doc.name.normalize("NFKC").trim().toLocaleLowerCase("de-DE");
  const version = [doc.version, doc.stand].filter(Boolean).join(" · ") || "Version/Stand nicht angegeben";
  return `${name}::${version.normalize("NFKC").trim().toLocaleLowerCase("de-DE")}`;
}

/** Distinguishes changed content even when filename and printed version stayed the same. */
export function documentFingerprint(doc: SourceDocument): string {
  const text = doc.sections.map((section) => section.text).join("\n");
  return `${doc.sizeBytes}:${doc.charCount}:${doc.sections.length}:${shortHash(text)}`;
}

export function createGenerationCache(
  doc: SourceDocument,
  requirements: Req[],
  cases: GeneratedTestCase[],
): GenerationCacheEntry {
  return {
    id: generationCacheKey(doc),
    documentName: doc.name,
    documentVersion: [doc.version, doc.stand].filter(Boolean).join(" · ") || "Version/Stand nicht angegeben",
    documentFingerprint: documentFingerprint(doc),
    cachedAt: new Date().toISOString(),
    requirements,
    cases,
  };
}

export type RestoredGeneration = { requirements: Req[]; cases: GeneratedTestCase[]; cachedAt: string };

/**
 * Rebinds cached artifacts to a newly uploaded document. Every source quote is
 * checked against the new text; one mismatch invalidates the complete cache.
 */
export function restoreGenerationCache(doc: SourceDocument, cache: GenerationCacheEntry): RestoredGeneration | null {
  if (cache.id !== generationCacheKey(doc) || cache.requirements.length === 0 || cache.cases.length === 0) return null;
  const stamp = `${Date.now().toString(36)}-${shortHash(doc.id)}`;
  const now = new Date().toISOString();
  const sameContent = cache.documentFingerprint === documentFingerprint(doc);
  const requirementIds = new Map<string, string>();
  const requirements: Req[] = [];

  for (const [index, cached] of cache.requirements.entries()) {
    const origin = cached.origin;
    if (!origin?.quote) return null;
    const exact = doc.sections.find((section) => sectionLabel(section) === origin.sectionLabel);
    const sameSectionContext = Boolean(exact && origin.sectionText && truncate(exact.text, GENERATION_CONTEXT_CHARS) === origin.sectionText);
    const quotedSection = exact && quoteOccursIn(origin.quote, exact.text)
      ? exact
      : doc.sections.find((candidate) => quoteOccursIn(origin.quote, candidate.text));
    const section = sameContent || sameSectionContext ? exact ?? quotedSection : quotedSection;
    if (!section) return null;
    const quoteVerified = quoteOccursIn(origin.quote, section.text);
    const id = `ANF-CACHE-${stamp}-${index + 1}`;
    const label = sectionLabel(section);
    requirementIds.set(cached.id, id);
    requirements.push({
      ...cached,
      id,
      source: `${doc.name} · ${label}`,
      status: "Offen",
      comment: undefined,
      origin: {
        ...origin,
        documentId: doc.id,
        documentName: doc.name,
        documentVersion: [doc.version, doc.stand].filter(Boolean).join(" · ") || undefined,
        documentKind: doc.classification.kind,
        sectionId: section.id,
        sectionLabel: label,
        quoteVerified,
        quoteNote: quoteVerified ? undefined : origin.quoteNote,
        runId: `CACHE-${stamp}`,
        extractedAt: now,
        sectionText: truncate(section.text, GENERATION_CONTEXT_CHARS),
      },
    });
  }

  const requirementById = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const cases = cache.cases.flatMap((cached, index) => {
    const requirementId = requirementIds.get(cached.requirementId);
    const requirement = requirementId ? requirementById.get(requirementId) : undefined;
    if (!requirementId || !requirement) return [];
    const id = `CACHE-${stamp}-${index + 1}`;
    const item: GeneratedTestCase = {
      ...cached,
      id,
      requirementId,
      origin: { ...cached.origin, runId: `CACHE-${stamp}`, generatedAt: now },
      review: { decision: "Offen", comment: "" },
      execution: "Nicht ausgeführt",
      trace: undefined,
    };
    return [{ ...item, trace: buildCaseTrace(requirement, item, item.origin, id) }];
  });

  return cases.length ? { requirements, cases, cachedAt: cache.cachedAt } : null;
}
