import type { Req } from "../types/requirement";
import type { GeneratedTestCase, GenerationSettings } from "../types/review";
import { FEEDBACK_EXAMPLES_MAX, OPEN_VALUE_MARKER } from "../config/ai";

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
      "given": "Ausgangslage (Stammdaten, Abrechnungsstand)",
      "when": "auslösendes Ereignis",
      "then": "erwartetes Verhalten der Software",
      "expectedFields": [{ "field": "Feldname im Datensatz", "value": "erwarteter Wert" }],
      "priority": "Hoch | Mittel | Niedrig",
      "priorityReason": "warum diese Priorität",
      "reasoning": [{ "text": "Begründungsschritt", "basis": "Quelle | Annahme | Generiert", "sourceRef": "nur bei basis=Quelle" }],
      "sourceRefs": ["zitierte Quelle"],
      "openQuestions": ["offene fachliche Frage"]
    }
  ]
}`;

const SYSTEM_PROMPT = `Du bist ein Assistent für die Systemprüfung von Entgeltabrechnungsprogrammen im Verfahren DTA EEL (Entgeltersatzleistungen). Du schlägst Testfälle mit erwarteten Ergebnissen vor. Ein menschlicher Prüfer und eine Regel-Engine entscheiden später über die Korrektheit.

Verbindliche Regeln:
1. Erfinde keine Paragraphen, Abschnittsnummern, Versionen, Stichtage oder Fristen. Als Quelle darfst du nur die in der Anfrage genannte Quelle und Anforderungs-ID zitieren.
2. Kennzeichne jeden Begründungsschritt mit "basis": "Quelle" (steht so in der Anforderung), "Annahme" (deine Annahme, muss geprüft werden) oder "Generiert" (abgeleitete Testidee).
3. Wenn ein erwarteter Wert nicht eindeutig aus der Anforderung folgt, schreibe als Wert genau "${OPEN_VALUE_MARKER}" und formuliere die Frage in "openQuestions".
4. Verwende deutsche Fachbegriffe und Feldnamen (z. B. Bemessungszeitraum, Arbeitsunfähigkeit).
5. Antworte ausschließlich mit einem gültigen JSON-Objekt nach diesem Schema, ohne Markdown und ohne Text davor oder danach:
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

/** Builds the full message list for one generation run. */
export function buildMessages(
  req: Req,
  settings: GenerationSettings,
  reviewed: GeneratedTestCase[],
): ChatMessage[] {
  const steps = settings.reasoningDetail === "kurz" ? "1 bis 3" : "3 bis 6";
  const feedback = settings.useFeedback ? buildFeedbackBlock(reviewed) : "";
  const user = [
    "Anforderung:",
    `- ID: ${req.id}`,
    `- Titel: ${req.title}`,
    `- Leistung: ${req.benefit}`,
    `- Quelle: ${req.source}`,
    `- Status: ${req.status}${req.rule ? ` (Regel ${req.rule})` : " (noch nicht vom Prüfer genehmigt)"}`,
    "- Originaltext der Quelle: nicht verfügbar (Beispieldaten). Leite nichts ab, was über Titel und Quelle hinausgeht, ohne es als Annahme zu kennzeichnen.",
    "",
    `Erzeuge höchstens ${settings.maxCases} Testfälle.`,
    `Erlaubte Techniken: ${settings.techniques.join(", ")}.`,
    `Begründung pro Testfall: ${steps} Schritte.`,
    FOCUS_TEXT[settings.priorityFocus],
    feedback,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: user },
  ];
}
