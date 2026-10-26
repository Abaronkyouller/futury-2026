import type { Req } from "../types/requirement";
import type { GeneratedTestCase, GenerationSettings } from "../types/review";
import { FEEDBACK_EXAMPLES_MAX, OPEN_VALUE_MARKER } from "../config/ai";
import { GENERATION_CONTEXT_CHARS } from "../config/documents";
import { truncate } from "../documents/text";

/** OpenAI-compatible chat message. */
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * JSON shape the model must return. Kept as a literal string so the exact
 * contract is visible in the prompt preview and easy to change in one place.
 */
const RESPONSE_SCHEMA = `{
  "testCases": [
    {
      "title": "kurzer Titel",
      "technique": "Grenzwert | Äquivalenzklasse | Kombination | Negativtest",
      "given": "Ausgangslage (Stammdaten, Abrechnungsstand, im System hinterlegte Zeiten)",
      "when": "auslösendes Ereignis",
      "then": "erwartetes Verhalten der Software",
      "testData": [{ "field": "z. B. AU-Zeit 1", "value": "konkreter Testwert" }],
      "steps": [{ "actor": "Arbeitgeber | Krankenkasse", "action": "was gesendet oder geprüft wird", "abgabegrund": "zweistellig, nur wenn eine Meldung gesendet wird" }],
      "expectedFields": [{ "field": "Feldname im Datensatz", "value": "erwarteter Wert" }],
      "criteriaIds": ["nur Kriterium-ID/UUID, die wörtlich im Quelltext steht; niemals ANF-…; sonst []"],
      "priority": "Hoch | Mittel | Niedrig",
      "priorityReason": "warum diese Priorität",
      "reasoning": [{ "text": "Begründungsschritt", "basis": "Quelle | Annahme | Generiert", "sourceRef": "nur bei basis=Quelle" }],
      "sourceRefs": ["zitierte Quelle"],
      "openQuestions": ["offene fachliche Frage"]
    }
  ]
}`;

const SYSTEM_PROMPT = `Du bist ein Assistent für die Systemprüfung von Entgeltabrechnungsprogrammen im Verfahren DTA EEL (Entgeltersatzleistungen). Du schlägst Testfälle mit erwarteten Ergebnissen vor, mit denen die Kommunikation zwischen Entgeltabrechnungsprogramm (Arbeitgeber) und Krankenkasse geprüft wird. Ein menschlicher Prüfer und eine Regel-Engine entscheiden später über die Korrektheit.

Verbindliche Regeln:
1. Erfinde keine Paragraphen, Abschnittsnummern, Versionen, Stichtage, Fristen, Abgabegründe oder Kriterium-IDs. Zitiere als Quelle nur die in der Anfrage genannten Dokumente, Abschnitte und IDs. Übernimm ANF-IDs niemals in "criteriaIds".
2. Kennzeichne jeden Begründungsschritt mit "basis": "Quelle" (steht so im Quelltext), "Annahme" (deine Annahme, muss geprüft werden) oder "Generiert" (abgeleitete Testidee).
3. Wenn ein erwarteter Wert nicht eindeutig aus dem Quelltext folgt, schreibe als Wert genau "${OPEN_VALUE_MARKER}" und formuliere die Frage in "openQuestions".
4. Testdaten (z. B. AU-Zeiträume) dürfen frei gewählt werden, müssen aber gültige Kalenderdaten im Format TT.MM.JJJJ sein und genau die zu prüfende Bedingung treffen.
5. Beschreibe in "steps" die Nachrichtenfolge zwischen Arbeitgeber und Krankenkasse, wenn die Anforderung eine Meldung betrifft; sonst darf "steps" leer sein.
6. Verwende deutsche Fachbegriffe und Feldnamen (z. B. Abgabegrund, Arbeitsunfähigkeit, Vorerkrankungszeiten).
7. Antworte ausschließlich mit einem gültigen JSON-Objekt nach diesem Schema, ohne Markdown und ohne Text davor oder danach:
${RESPONSE_SCHEMA}`;

/** Instruction text for each priority focus option. */
const FOCUS_TEXT: Record<GenerationSettings["priorityFocus"], string> = {
  Ausgewogen: "Vergib Prioritäten ausgewogen nach fachlichem Risiko.",
  "Zahlbetrag & Meldung":
    "Priorisiere Fälle hoch, deren Fehler den Zahlbetrag der Leistung oder die Meldung an die Krankenkasse verfälschen würden.",
  Grenzwerte: "Priorisiere Grenzfälle (Stichtage, Schwellenwerte, Monatswechsel) hoch.",
};

/**
 * Renders previous examiner decisions as guidance. This is in-context learning:
 * the model sees the feedback in the prompt; no weights are changed.
 */
export function buildFeedbackBlock(reviewed: GeneratedTestCase[]): string {
  const examples = reviewed
    .filter((c) => c.review.decision !== "Offen")
    .slice(-FEEDBACK_EXAMPLES_MAX);
  if (examples.length === 0) return "";
  const lines = examples.map((c) => {
    const comment = c.review.comment.trim() ? ` – Kommentar: "${c.review.comment.trim()}"` : "";
    return `- ${c.review.decision}: "${c.title}" (${c.technique}, Priorität ${c.priority})${comment}`;
  });
  return `Rückmeldungen des Prüfers zu früheren Vorschlägen (berücksichtige sie; wiederhole abgelehnte Muster nicht):\n${lines.join("\n")}`;
}

/** Bullet list or "keine" for prompt sections. */
const list = (items: string[]) => (items.length ? items.map((i) => `  - ${i}`).join("\n") : "  - keine");

/** Requirement block for a requirement extracted from an uploaded document. */
function sourceBlock(req: Req): string[] {
  const o = req.origin!;
  return [
    "Anforderung:",
    `- ID: ${req.id}`,
    `- Titel: ${req.title}`,
    `- Leistung: ${req.benefit}`,
    `- Dokument: ${o.documentName} (${o.documentVersion ?? "Version/Stand nicht angegeben"}, Dokumentart ${o.documentKind})`,
    `- Abschnitt: ${o.sectionLabel}`,
    ...(o.criterionId ? [`- Kriterium-ID: ${o.criterionId}`] : []),
    `- Prüferstatus: ${req.status}${req.comment ? ` – Kommentar des Prüfers: "${req.comment}"` : ""}`,
    "",
    `Wörtliches Zitat aus der Quelle${o.quoteVerified ? "" : " (Achtung: im Abschnitt nicht wörtlich gefunden)"}:`,
    `"""${o.quote}"""`,
    "",
    o.statement ? `Interpretation: ${o.statement}` : "Interpretation: keine (regelbasiert extrahiert)",
    "Bedingungen:",
    list(o.conditions),
    "Datenfelder:",
    list(o.dataFields),
    "Unklarheiten (als openQuestions übernehmen, nicht auflösen):",
    list(o.ambiguities),
    "",
    "Abschnittstext als Kontext:",
    `"""${truncate(o.sectionText, GENERATION_CONTEXT_CHARS)}"""`,
  ];
}

/** Requirement block for the illustrative sample requirements (no source text). */
function sampleBlock(req: Req): string[] {
  return [
    "Anforderung:",
    `- ID: ${req.id}`,
    `- Titel: ${req.title}`,
    `- Leistung: ${req.benefit}`,
    `- Quelle: ${req.source}`,
    `- Status: ${req.status}${req.rule ? ` (Regel ${req.rule})` : " (noch nicht vom Prüfer genehmigt)"}`,
    "- Originaltext der Quelle: nicht verfügbar (Beispieldaten). Leite nichts ab, was über Titel und Quelle hinausgeht, ohne es als Annahme zu kennzeichnen.",
  ];
}

/** Builds the full message list for one generation run. */
export function buildMessages(
  req: Req,
  settings: GenerationSettings,
  reviewed: GeneratedTestCase[],
): ChatMessage[] {
  const steps = settings.reasoningDetail === "kurz" ? "1 bis 3" : "3 bis 6";
  const feedback = settings.useFeedback ? buildFeedbackBlock(reviewed) : "";
  const user = [
    ...(req.origin ? sourceBlock(req) : sampleBlock(req)),
    "",
    `Erzeuge höchstens ${settings.maxCases} Testfälle.`,
    `Erlaubte Techniken: ${settings.techniques.join(", ")}.`,
    `Begründung pro Testfall: ${steps} Schritte.`,
    FOCUS_TEXT[settings.priorityFocus],
    ...(feedback ? [feedback] : []),
  ].join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
