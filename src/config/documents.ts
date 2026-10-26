import type { DocKind } from "../types/document";

/** File types accepted by the upload field. */
export const ACCEPTED_FILE_TYPES = ".pdf,.docx,.txt,.md";

/** Hard limit per file; larger files would make the browser extraction slow. */
export const MAX_FILE_BYTES = 30 * 1024 * 1024;

/** Sections longer than this are split into parts at paragraph boundaries. */
export const SECTION_MAX_CHARS = 5000;

/**
 * Maximum characters of source text sent to the model in one extraction run.
 * Roughly 4 characters per token; the context size of the gateway models is not
 * documented in the repository, so this is a conservative assumption.
 */
export const EXTRACTION_CHAR_BUDGET = 12000;

/** Characters of section text added as context when generating test cases for one requirement. */
export const GENERATION_CONTEXT_CHARS = 4000;

/** Generated cases shown per page in the workspace list of "Dokumente & Testfälle". */
export const CASES_PER_PAGE = 5;

/** Upper bound for requirements per extraction run. */
export const MAX_REQUIREMENTS_PER_RUN = 8;

/** Verbatim quotes longer than this are rejected by the prompt contract. */
export const MAX_QUOTE_CHARS = 900;

/** Number of ranked sections shown before "show all". */
export const RANKED_SECTIONS_SHOWN = 25;

/** Header/footer lines that appear on at least this share of PDF pages are removed. */
export const REPEATED_LINE_SHARE = 0.4;

/**
 * Warning texts that earlier versions stored on a document but that are no
 * longer produced. They are dropped when documents are loaded from IndexedDB,
 * so old records do not keep showing a notice the app no longer generates.
 */
export const RETIRED_WARNING_PREFIXES = ["Kopf-/Fußzeilen entfernt:"];

/** Example search terms offered in the section search. */
export const FOCUS_SUGGESTIONS = [
  "Vorerkrankung DBVO Abgabegrund 41",
  "Mutterschaftsgeld Schutzfrist",
  "Entgeltbescheinigung Bemessungszeitraum",
  "Stornierung Abgabegrund 88",
];

/**
 * Keywords for the document-kind heuristic. Counts are compared per kind; the
 * matched words are shown to the examiner as evidence. Lower-case stems.
 */
export const KIND_KEYWORDS: Record<DocKind, string[]> = {
  Fachlich: [
    "§",
    "sgb",
    "anspruch",
    "rundschreiben",
    "leistungsberechtigt",
    "gesetz",
    "versicherte",
    "mutterschaftsgeld",
    "krankengeld",
    "bsg",
    "rechtsprechung",
    "voraussetzungen",
  ],
  Technisch: [
    "datenbaustein",
    "datensatz",
    "abgabegrund",
    "kennzeichen",
    "grundstellung",
    "jhjjmmtt",
    "feldname",
    "schlüsselzahl",
    "stornierung",
    "übermittlung",
    "meldung",
    "dsid",
  ],
  Testkonstellation: [
    "testfall",
    "testkonstellation",
    "szenario",
    "erwartet",
    "kriterien",
    "voraussetzung",
    "im system hinterlegt",
    "anwendungsprogramm",
  ],
};

/** Very common German words ignored by the section search. */
export const STOPWORDS = new Set([
  "der", "die", "das", "und", "oder", "ist", "sind", "ein", "eine", "einer", "eines",
  "den", "dem", "des", "im", "in", "zu", "zur", "zum", "mit", "auf", "für", "von",
  "vom", "bei", "nach", "als", "auch", "nicht", "wird", "werden", "wenn", "dass",
  "sich", "es", "an", "aus", "so", "nur", "noch", "bzw", "durch",
]);

/**
 * Patterns that mark a sentence as normative (a candidate requirement) for the
 * rule-based extraction that works without a model.
 */
export const NORMATIVE_PATTERNS: RegExp[] = [
  /\bdarf\b[^.]{0,200}\bnur\b/i,
  /\bdürfen\b[^.]{0,200}\bnur\b/i,
  /\bnur\b(?:\s+dann)?[^.]{0,200}\bwenn\b/i,
  /\b(muss|müssen)\b/i,
  /\b(ist|sind)\b[^.]{0,160}\bzu\s+(melden|übermitteln|füllen|verwenden|beachten|beurteilen|prüfen|geben|stellen|richten|übernehmen|kennzeichnen)\b/i,
  /\bsicherzustellen\b|\bsichergestellt\b/i,
  /\bnicht\s+(zulässig|möglich)\b/i,
  /\bunzulässig\b/i,
];

/** Benefit names (Entgeltersatzleistungen) recognized in section text; the most frequent is used. */
export const BENEFIT_TERMS = [
  "Kinderkrankengeld",
  "Krankengeld",
  "Mutterschaftsgeld",
  "Verletztengeld",
  "Übergangsgeld",
  "Versorgungskrankengeld",
  "Entgeltfortzahlung",
];

/** Benefit label when none of BENEFIT_TERMS occurs. */
export const BENEFIT_UNKNOWN = "nicht angegeben";

/**
 * "Top-Treffer auswählen" ranks by search relevance × (1 + weight × normative
 * sentences, capped). Among equally relevant sections, those containing rules
 * ("muss", "darf … nur") are picked first. Shown to the examiner per section.
 */
export const NORMATIVE_WEIGHT = 0.05;
export const NORMATIVE_CAP = 8;
