import type { Req } from "../types/requirement";
import type { GenerationSettings, Priority, ReasoningStep, TestStep, Technique } from "../types/review";
import type { RawCase } from "./parse";
import { boundaryValues, findAbgabegrund, findThresholds, parseRestriction } from "../documents/conditions";
import type { Restriction } from "../documents/conditions";
import { truncate } from "../documents/text";

/**
 * Rule-based test derivation – works without a language model.
 *
 * From a verbatim restriction "X darf nur …, wenn A, B und C" it follows
 * logically that X is allowed when all conditions hold and not allowed when
 * any one of them fails. Thresholds in a condition ("mindestens 30 Tage")
 * give boundary cases. These are the only derivations made; the source is
 * cited for every case and counting rules stay open questions. The examiner
 * still confirms every case (AGENTS.md instruction 4).
 */

/** Characters of a condition shown in a case title. */
const TITLE_CONDITION_CHARS = 70;

const OBLIGATION_QUESTION =
  "Welches beobachtbare Ergebnis belegt in der Entgeltabrechnungssoftware, dass die Vorgabe erfüllt ist?";

const COUNTING_QUESTION =
  "Wie wird die Frist gezählt (Kalendertage, Beginn- und Endtag eingeschlossen, Stichtag „zum Zeitpunkt der Meldung“)?";

type Draft = Omit<RawCase, "priority"> & { priority: Priority; technique: Technique };

/** Name of the expected-result field: a message for reporting rules, otherwise a generic action. */
function resultField(action: string): string {
  return /meldung|anfrage|abgabegrund|datensatz|übermitt/i.test(action) ? "Meldung wird erzeugt" : "Vorgang ist zulässig";
}

/** Who triggers the action according to the source; the payroll software acts for the employer. */
function actorOf(text: string): string {
  return /durch die Krankenkasse|Krankenkasse (?:übermittelt|meldet)/i.test(text) ? "Krankenkasse" : "Arbeitgeber";
}

function flowSteps(req: Req, allowed: boolean): TestStep[] {
  const quote = req.origin!.quote;
  const code = findAbgabegrund(quote);
  const actor = actorOf(quote);
  const message = code ? `Meldung mit Abgabegrund ${code}` : "den Vorgang";
  if (allowed) {
    return [{ actor, action: `löst ${message} aus`, abgabegrund: code }];
  }
  return [
    { actor, action: `versucht, ${message} auszulösen`, abgabegrund: code },
    { actor: "Entgeltabrechnungsprogramm", action: `verhindert ${message}` },
  ];
}

function baseCase(req: Req, r: Restriction): Pick<RawCase, "sourceRefs" | "criteriaIds" | "reasoning"> {
  const o = req.origin!;
  const ref = `${o.documentName} · ${o.sectionLabel}`;
  return {
    sourceRefs: [ref],
    criteriaIds: o.criterionId ? [o.criterionId] : [],
    reasoning: [{ text: `Zitat: „${truncate(r.action, 200)}, wenn …“`, basis: "Quelle", sourceRef: ref }],
  };
}

/** Conditions as test data rows: "erfüllt" / "nicht erfüllt" per condition. */
function conditionRows(conditions: string[], violated: number | null, override?: { index: number; value: string }) {
  return conditions.map((c, i) => ({
    field: `Bedingung ${i + 1}: ${truncate(c, 160)}`,
    value: override?.index === i ? override.value : i === violated ? "nicht erfüllt" : "erfüllt",
  }));
}

function restrictionCases(req: Req, r: Restriction): Draft[] {
  const field = resultField(r.action);
  const base = baseCase(req, r);
  const ambiguities = req.origin!.ambiguities;
  const all = r.conditions.length;

  const positive: Draft = {
    ...base,
    title: "Alle Bedingungen erfüllt",
    technique: "Äquivalenzklasse",
    given: `Alle ${all} Bedingung(en) aus der Quelle sind erfüllt.`,
    when: "Der Vorgang wird in der Entgeltabrechnungssoftware ausgelöst.",
    then: `Zulässig: ${r.action}.`,
    testData: conditionRows(r.conditions, null),
    steps: flowSteps(req, true),
    expectedFields: [{ field, value: "ja" }],
    priority: "Mittel",
    priorityReason: "Regelfall; belegt, dass die zulässige Meldung überhaupt erzeugt wird.",
    reasoning: [...base.reasoning, { text: "Sind alle Bedingungen erfüllt, ist der Vorgang laut Zitat zulässig.", basis: "Generiert" }],
    openQuestions: [...ambiguities],
  };

  const boundaries: Draft[] = r.conditions.flatMap((cond, i) =>
    findThresholds(cond).flatMap((t) =>
      boundaryValues(t).map((b) => ({
        ...base,
        title: `Grenzwert ${t.text}: ${b.label}`,
        technique: "Grenzwert" as const,
        given: `Bedingung ${i + 1} liegt mit ${b.label} ${b.satisfies ? "gerade noch innerhalb" : "knapp außerhalb"} der Grenze „${t.text}“; alle übrigen Bedingungen sind erfüllt.`,
        when: "Der Vorgang wird ausgelöst.",
        then: b.satisfies ? `Zulässig: ${r.action}.` : "Nicht zulässig – der Vorgang darf nicht erfolgen.",
        testData: conditionRows(r.conditions, null, { index: i, value: b.label }),
        steps: flowSteps(req, b.satisfies),
        expectedFields: [{ field, value: b.satisfies ? "ja" : "nein" }],
        priority: "Hoch" as const,
        priorityReason: "Grenzwert; Abweichungen um einen Tag sind typische Fehlerquellen.",
        reasoning: [
          ...base.reasoning,
          { text: `Bedingung ${i + 1} nennt den Schwellenwert „${t.text}“.`, basis: "Quelle" as const, sourceRef: base.sourceRefs[0] },
          { text: `${b.label} ${b.satisfies ? "erfüllt" : "verletzt"} die Bedingung, daher ist der Vorgang ${b.satisfies ? "zulässig" : "unzulässig"}.`, basis: "Generiert" as const },
        ],
        openQuestions: [COUNTING_QUESTION, ...ambiguities],
      })),
    ),
  );

  const negatives: Draft[] = r.conditions.map((cond, i) => ({
    ...base,
    title: `Bedingung ${i + 1} nicht erfüllt: ${truncate(cond, TITLE_CONDITION_CHARS)}`,
    technique: "Negativtest",
    given: `Bedingung ${i + 1} ist nicht erfüllt („${truncate(cond, 200)}“); alle übrigen Bedingungen sind erfüllt.`,
    when: "Der Vorgang wird ausgelöst.",
    then: "Nicht zulässig – der Vorgang darf nicht erfolgen.",
    testData: conditionRows(r.conditions, i),
    steps: flowSteps(req, false),
    expectedFields: [{ field, value: "nein" }],
    priority: "Hoch",
    priorityReason: "Eine unzulässige Meldung würde an die Krankenkasse übermittelt.",
    reasoning: [
      ...base.reasoning,
      { text: `„nur …, wenn“: fehlt Bedingung ${i + 1}, ist der Vorgang unzulässig.`, basis: "Generiert" },
    ],
    openQuestions: [...ambiguities],
  }));

  // Interleave so that a small "max. cases" still covers each kind.
  const ordered: Draft[] = [positive];
  for (let i = 0; i < Math.max(boundaries.length, negatives.length); i++) {
    if (boundaries[i]) ordered.push(boundaries[i]);
    if (negatives[i]) ordered.push(negatives[i]);
  }
  return ordered;
}

/** A plain obligation ("muss", "ist zu übermitteln"): one case, observable result left open. */
function obligationCase(req: Req): Draft {
  const o = req.origin!;
  const ref = `${o.documentName} · ${o.sectionLabel}`;
  const reasoning: ReasoningStep[] = [
    { text: `Zitat: „${truncate(o.quote, 240)}“`, basis: "Quelle", sourceRef: ref },
    { text: "Die Vorgabe wird als Regelfall geprüft; das beobachtbare Ergebnis muss der Prüfer festlegen.", basis: "Generiert" },
  ];
  return {
    title: `Vorgabe erfüllt: ${truncate(req.title, TITLE_CONDITION_CHARS)}`,
    technique: "Äquivalenzklasse",
    given: "Ausgangslage, in der die zitierte Vorgabe anzuwenden ist.",
    when: "Der betroffene Vorgang wird in der Entgeltabrechnungssoftware ausgeführt.",
    then: `Die Software erfüllt die Vorgabe: „${truncate(o.quote, 300)}“`,
    testData: o.conditions.map((c, i) => ({ field: `Bedingung ${i + 1}`, value: c })),
    steps: flowSteps(req, true).filter((s) => s.abgabegrund),
    expectedFields: [{ field: "Vorgabe laut Zitat erfüllt", value: "ja" }],
    criteriaIds: o.criterionId ? [o.criterionId] : [],
    priority: "Mittel",
    priorityReason: "Pflichtvorgabe ohne erkennbare Grenzwerte.",
    reasoning,
    sourceRefs: [ref],
    openQuestions: [OBLIGATION_QUESTION, ...o.ambiguities],
  };
}

/**
 * Derives test cases for a requirement that has a source quote. Returns an
 * empty list for the sample requirements (no source text available).
 */
export function deriveRuleCases(req: Req, settings: GenerationSettings): RawCase[] {
  if (!req.origin) return [];
  const restriction = parseRestriction(req.origin.quote);
  const drafts = restriction
    ? restrictionCases(req, {
        action: restriction.action,
        // Conditions extracted by the model take precedence over the bullet split.
        conditions: req.origin.conditions.length ? req.origin.conditions : restriction.conditions,
      })
    : [obligationCase(req)];
  return drafts.filter((d) => settings.techniques.includes(d.technique)).slice(0, settings.maxCases);
}
