import type { Req } from "../types/requirement";
import type { OntologyConcept, TraceEvidence } from "../types/reasoning";
import { BENEFIT_UNKNOWN } from "../config/documents";
import { findAbgabegrund, findCriterionId, findThresholds, parseRestriction } from "../documents/conditions";
import { normalizeForMatch, truncate } from "../documents/text";

/** Builds a lightweight deterministic ontology from source-backed requirement data. */
export function buildOntology(req: Req): OntologyConcept[] {
  const o = req.origin;
  const quote = o?.quote ?? "";
  const allSource = `${quote}\n${o?.sectionText ?? ""}`;
  const sourceRef = o ? `${o.documentName} · ${o.sectionLabel}` : req.source;
  const concepts: OntologyConcept[] = [];
  const seen = new Set<string>();
  const inSource = (value: string) => normalizeForMatch(allSource).includes(normalizeForMatch(value));
  const add = (category: OntologyConcept["category"], label: string, value: string, fallback: TraceEvidence) => {
    const clean = value.trim();
    const key = `${category}|${clean.toLowerCase()}`;
    if (!clean || seen.has(key)) return;
    seen.add(key);
    const evidence: TraceEvidence = inSource(clean) ? "source" : fallback;
    concepts.push({ id: `onto-${concepts.length + 1}`, category, label, value: truncate(clean, 260), evidence, sourceRef, quote: evidence === "source" ? clean : undefined });
  };

  if (req.benefit && req.benefit !== BENEFIT_UNKNOWN) add("Leistung", "Leistungsart", req.benefit, o ? "model" : "assumption");
  for (const m of allSource.matchAll(/§\s*\d+[a-zA-Z]?(?:\s+SGB\s+[IVX]+)?/g)) add("Rechtsgrundlage", "Rechtsgrundlage", m[0], "source");

  const restriction = parseRestriction(quote);
  if (restriction?.action) add("Vorgang", "Ausgelöster Vorgang", restriction.action, o?.extractedBy === "model" ? "model" : "derived");
  const conditions = o?.conditions.length ? o.conditions : restriction?.conditions ?? [];
  for (const condition of conditions) {
    add("Voraussetzung", "Bedingung", condition, o?.extractedBy === "model" ? "model" : "source");
    for (const threshold of findThresholds(condition)) add("Frist", `Frist (${threshold.comparator})`, threshold.text, "source");
  }
  for (const threshold of findThresholds(quote)) add("Frist", `Frist (${threshold.comparator})`, threshold.text, "source");
  const code = findAbgabegrund(quote) ?? findAbgabegrund(allSource);
  if (code) add("Meldung", "Abgabegrund", code, "source");
  for (const field of o?.dataFields ?? []) add("Datenfeld", "Datenfeld", field, "model");
  const criterion = o?.criterionId ?? findCriterionId(quote) ?? findCriterionId(allSource);
  if (criterion) add("Kriterium", "Kriterium-ID", criterion, "source");
  if (/Arbeitgeber/i.test(allSource)) add("Akteur", "Beteiligter Akteur", "Arbeitgeber", "source");
  if (/Krankenkasse/i.test(allSource)) add("Akteur", "Beteiligter Akteur", "Krankenkasse", "source");
  return concepts;
}
