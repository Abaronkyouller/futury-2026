import {
  BENEFIT_TERMS,
  BENEFIT_UNKNOWN,
  EXTRACTION_CHAR_BUDGET,
  GENERATION_CONTEXT_CHARS,
  MAX_QUOTE_CHARS,
  MAX_REQUIREMENTS_PER_RUN,
} from "../config/documents";
import { findCriterionId, parseRestriction } from "../documents/conditions";
import { sectionLabel, versionLabel } from "../documents/ingest";
import { findNormativeSentences } from "../documents/ruleExtract";
import { quoteOccursIn, truncate } from "../documents/text";
import type { DocSection, SourceDocument } from "../types/document";
import type { ExtractionMethod, Req, RequirementOrigin } from "../types/requirement";
import { chatCompletion } from "./client";
import { isActive } from "../feedback/collect";
import { newRunId } from "./generate";
import { extractJson, isObj, str, strList } from "./parse";
import type { ChatMessage } from "./prompt";

/**
 * H1/H2: identify requirements in an uploaded document and turn them into
 * testable criteria. Two methods:
 * - model: the language model reads the selected sections and returns
 *   requirements with a verbatim quote; every quote is checked against the
 *   section text before it is shown (quoteVerified).
 * - regelbasiert: normative sentences ("darf … nur", "muss", …) are taken
 *   verbatim; no paraphrase, no model call.
 */

const SCHEMA = `{
  "requirements": [
    {
      "sectionId": "ID des Abschnitts in eckigen Klammern, z. B. D1A2B-S042",
      "title": "kurze, prüfbare Anforderung in eigenen Worten",
      "benefit": "betroffene Leistung, z. B. Krankengeld, oder leer",
      "quote": "wörtliches Zitat aus dem Abschnitt (höchstens ${MAX_QUOTE_CHARS} Zeichen)",
      "statement": "Interpretation: was die Software tun oder verhindern muss",
      "conditions": ["einzelne Bedingung"],
      "dataFields": ["betroffenes Datenfeld, z. B. 3.1.18 Abgabegrund"],
      "ambiguities": ["Unklarheit oder Widerspruch im Text"],
      "criterionId": "im Text abgedruckte Kriterium-ID, sonst leer"
    }
  ]
}`;

const SYSTEM_PROMPT = `Du unterstützt die Systemprüfung von Entgeltabrechnungsprogrammen im Verfahren DTA EEL (Entgeltersatzleistungen). Du liest Abschnitte aus Spezifikationen und extrahierst prüfbare Anforderungen an die Entgeltabrechnungssoftware – vor allem Regeln dazu, wann welche Meldung (Abgabegrund) erzeugt, befüllt oder verhindert werden muss.

Verbindliche Regeln:
1. "quote" ist eine wörtliche Kopie aus genau dem Abschnitt mit der angegebenen "sectionId". Nicht umformulieren, nicht zusammenfügen. Kürzungen nur mit "…".
2. Erfinde keine Abschnitte, Fristen, Abgabegründe, Feldnummern oder Kriterium-IDs.
3. Halte Unklarheiten in "ambiguities" fest, statt sie aufzulösen.
4. Eine Anforderung pro prüfbarer Regel; Bedingungen einzeln in "conditions".
5. Antworte ausschließlich mit einem gültigen JSON-Objekt nach diesem Schema, ohne Markdown:
${SCHEMA}`;

export type ExtractionInput = {
  doc: SourceDocument;
  sections: DocSection[];
  /** Examiner's focus terms, also used for ranking. */
  focus: string;
  method: ExtractionMethod;
  model: string;
  temperature: number;
  /** Requirements already extracted from this document; used for numbering and feedback. */
  existing: Req[];
  /** Feedback entries switched off on the Feedback page; their comments are not sent. */
  feedbackExcluded?: readonly string[];
};

export type ExtractionRun = {
  runId: string;
  requirements: Req[];
  /** Raw model reply, or a JSON dump of the rule-based candidates. */
  rawReply: string;
  /** Requirements the model returned that were dropped, with the reason. */
  dropped: string[];
};

/** Sections that fit into the prompt budget, in the given order. */
export function sectionsWithinBudget(sections: DocSection[], budget = EXTRACTION_CHAR_BUDGET): DocSection[] {
  const out: DocSection[] = [];
  let used = 0;
  for (const s of sections) {
    if (used + s.text.length > budget && out.length > 0) break;
    out.push(s);
    used += s.text.length;
  }
  return out;
}

/** Splits all sections into prompt-sized batches without dropping any section. */
export function sectionBatches(sections: DocSection[], budget = EXTRACTION_CHAR_BUDGET): DocSection[][] {
  const batches: DocSection[][] = [];
  let batch: DocSection[] = [];
  let used = 0;
  for (const section of sections) {
    if (batch.length && used + section.text.length > budget) {
      batches.push(batch);
      batch = [];
      used = 0;
    }
    batch.push(section);
    used += section.text.length;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

/** Examiner decisions on earlier extractions from the same document (in-context feedback). */
function feedbackBlock(existing: Req[], excluded: readonly string[]): string {
  const reviewed = existing.filter((r) => (r.status !== "Offen" || r.comment) && isActive(r.id, excluded));
  if (reviewed.length === 0) return "";
  const lines = reviewed
    .slice(-6)
    .map((r) => `- ${r.status}: "${r.title}"${r.comment ? ` – Kommentar: "${r.comment}"` : ""}`);
  return `\nRückmeldungen des Prüfers zu früher extrahierten Anforderungen (berücksichtigen):\n${lines.join("\n")}`;
}

export function buildExtractionMessages(input: ExtractionInput): ChatMessage[] {
  const { doc, focus, existing } = input;
  const sections = sectionsWithinBudget(input.sections);
  const user = [
    `Dokument: ${doc.name}`,
    `Dokumentart: ${doc.classification.kind} · ${versionLabel(doc)}`,
    `Fokus des Prüfers: ${focus.trim() || "alle prüfbaren Anforderungen"}`,
    `Extrahiere höchstens ${MAX_REQUIREMENTS_PER_RUN} Anforderungen.${feedbackBlock(existing, input.feedbackExcluded ?? [])}`,
    "",
    "Abschnitte:",
    ...sections.map((s) => `[${s.id}] ${sectionLabel(s)}\n"""\n${s.text}\n"""`),
  ].join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}

/** Most frequent benefit term in a text, or the "unknown" label. */
export function detectBenefit(text: string): string {
  const counts = BENEFIT_TERMS.map((term) => ({ term, n: text.split(term).length - 1 }));
  // "Krankengeld" also matches inside "Kinderkrankengeld"; compound terms come first and are subtracted.
  const kinder = counts.find((c) => c.term === "Kinderkrankengeld")!.n;
  const kg = counts.find((c) => c.term === "Krankengeld")!;
  kg.n = Math.max(0, kg.n - kinder);
  const best = counts.sort((a, b) => b.n - a.n)[0];
  return best.n > 0 ? best.term : BENEFIT_UNKNOWN;
}

/** Field references as printed, e.g. 3.1.18 „Abgabegrund“ -> "3.1.18 Abgabegrund". */
export function findFieldRefs(text: string): string[] {
  const refs = [...text.matchAll(/(\d+\.\d+\.\d+)\s*[„"“]([^“”"]{2,60})[“”"]/g)].map((m) => `${m[1]} ${m[2].trim()}`);
  return [...new Set(refs)];
}

/** Next free requirement number for a document, so ids stay unique across runs. */
function idFactory(doc: SourceDocument, existing: Req[]) {
  let n = existing.length;
  const prefix = `ANF-${doc.id.slice(1)}`;
  return () => `${prefix}-${String(++n).padStart(3, "0")}`;
}

type OriginFields = Pick<RequirementOrigin, "quote" | "statement" | "conditions" | "dataFields" | "ambiguities"> & {
  criterionId?: string;
  quoteVerified: boolean;
  quoteNote?: string;
};

function makeRequirement(
  id: string,
  doc: SourceDocument,
  section: DocSection | null,
  fields: OriginFields,
  meta: { title: string; benefit: string; method: ExtractionMethod; model?: string; runId: string; extractedAt: string; sectionHint?: string },
): Req {
  const label = section ? sectionLabel(section) : `Abschnitt nicht zuordenbar (genannt: „${meta.sectionHint ?? "–"}“)`;
  return {
    id,
    title: meta.title,
    benefit: meta.benefit,
    source: `${doc.name} · ${label}`,
    status: "Offen",
    origin: {
      documentId: doc.id,
      documentName: doc.name,
      documentVersion: [doc.version, doc.stand].filter(Boolean).join(" · ") || undefined,
      documentKind: doc.classification.kind,
      sectionId: section?.id ?? meta.sectionHint ?? "",
      sectionLabel: label,
      ...fields,
      extractedBy: meta.method,
      model: meta.model,
      runId: meta.runId,
      extractedAt: meta.extractedAt,
      sectionText: section ? truncate(section.text, GENERATION_CONTEXT_CHARS) : "",
    },
  };
}

/** Rule-based extraction: normative sentences, verbatim. */
function extractByRules(input: ExtractionInput, runId: string, extractedAt: string): ExtractionRun {
  const nextId = idFactory(input.doc, input.existing);
  const candidates = findNormativeSentences(input.sections, MAX_REQUIREMENTS_PER_RUN);
  const requirements = candidates.map((c) => {
    const criterionId = findCriterionId(c.quote);
    const quote = c.quote.trim();
    const titleText = quote.replace(criterionId ?? "", "").replace(/^\s*=\s*\S+/, "").trim();
    return makeRequirement(
      nextId(),
      input.doc,
      c.section,
      {
        quote,
        statement: "",
        conditions: parseRestriction(quote)?.conditions ?? [],
        dataFields: findFieldRefs(quote),
        ambiguities: [],
        criterionId,
        quoteVerified: true,
        quoteNote: `Regelbasiert erkannt über Muster „${c.trigger}“`,
      },
      {
        title: truncate(titleText, 110),
        benefit: detectBenefit(c.section.text),
        method: "regelbasiert",
        runId,
        extractedAt,
      },
    );
  });
  return {
    runId,
    requirements,
    rawReply: JSON.stringify(candidates.map((c) => ({ sectionId: c.section.id, trigger: c.trigger, quote: c.quote })), null, 2),
    dropped: [],
  };
}

/** Finds the section that contains the quote: the cited one first, then the other given sections. */
function locateQuote(quote: string, citedId: string, sections: DocSection[]) {
  const cited = sections.find((s) => s.id === citedId) ?? null;
  if (cited && quoteOccursIn(quote, cited.text)) return { section: cited, verified: true };
  const other = sections.find((s) => s.id !== citedId && quoteOccursIn(quote, s.text));
  if (other) {
    return {
      section: other,
      verified: true,
      note: `Zitat in ${sectionLabel(other)} gefunden, nicht im vom Modell genannten Abschnitt „${citedId}“.`,
    };
  }
  return {
    section: cited,
    verified: false,
    note: "Zitat wurde in den übergebenen Abschnitten nicht wörtlich gefunden – bitte am Original prüfen.",
  };
}

async function extractByModel(input: ExtractionInput, runId: string, extractedAt: string): Promise<ExtractionRun> {
  const messages = buildExtractionMessages(input);
  const sent = sectionsWithinBudget(input.sections);
  const rawReply = await chatCompletion(input.model, messages, input.temperature);
  const json = extractJson(rawReply);
  const list = isObj(json) && Array.isArray(json.requirements) ? json.requirements : null;
  if (!list) throw new Error('Das JSON enthält kein Feld "requirements" (Liste).');

  const nextId = idFactory(input.doc, input.existing);
  const dropped: string[] = [];
  const requirements: Req[] = [];
  for (const item of list.slice(0, MAX_REQUIREMENTS_PER_RUN)) {
    if (!isObj(item)) continue;
    const quote = str(item.quote);
    const title = str(item.title);
    if (!quote || !title) {
      dropped.push(`„${title || "(ohne Titel)"}“: kein Zitat oder kein Titel`);
      continue;
    }
    const citedId = str(item.sectionId);
    const found = locateQuote(quote, citedId, sent);
    const criterionId = str(item.criterionId) || undefined;
    requirements.push(
      makeRequirement(
        nextId(),
        input.doc,
        found.section,
        {
          quote: truncate(quote, MAX_QUOTE_CHARS),
          statement: str(item.statement),
          conditions: strList(item.conditions),
          dataFields: strList(item.dataFields),
          ambiguities: [
            ...strList(item.ambiguities),
            // A criterion id that is not printed in the section is reported, not trusted.
            ...(criterionId && found.section && !found.section.text.includes(criterionId)
              ? [`Kriterium-ID „${criterionId}“ steht nicht im Abschnittstext.`]
              : []),
          ],
          criterionId,
          quoteVerified: found.verified,
          quoteNote: found.note,
        },
        {
          title,
          benefit: str(item.benefit) || detectBenefit(found.section?.text ?? ""),
          method: "model",
          model: input.model,
          runId,
          extractedAt,
          sectionHint: citedId,
        },
      ),
    );
  }
  if (requirements.length === 0) {
    throw new Error(`Das Modell hat keine verwertbaren Anforderungen geliefert.${dropped.length ? ` Verworfen: ${dropped.join("; ")}` : ""}`);
  }
  return { runId, requirements, rawReply, dropped };
}

/** Runs one extraction over the selected sections of a document. */
export async function extractRequirements(input: ExtractionInput): Promise<ExtractionRun> {
  if (input.sections.length === 0) throw new Error("Bitte mindestens einen Abschnitt auswählen.");
  const now = new Date();
  const runId = newRunId(now);
  const extractedAt = now.toISOString();
  if (input.method === "regelbasiert") {
    const run = extractByRules(input, runId, extractedAt);
    if (run.requirements.length === 0) {
      throw new Error("In den gewählten Abschnitten wurde kein normativer Satz („muss“, „darf … nur“, „ist … zu übermitteln“ …) gefunden.");
    }
    return run;
  }
  return extractByModel(input, runId, extractedAt);
}
