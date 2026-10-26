import type { Req } from "../types/requirement";
import type {
  GeneratedTestCase,
  GenerationSettings,
  OriginKind,
} from "../types/review";
import { chatCompletion } from "./client";
import { offlineDemoReply } from "./offlineDemo";
import { parseCases } from "./parse";
import type { RawCase } from "./parse";
import { buildMessages, EMPTY_CONTEXT } from "./prompt";
import type { GenerationContext } from "./prompt";
import { deriveRuleCases } from "./ruleCases";
import { runChecks } from "./validate";

export type GenerationRun = {
  runId: string;
  cases: GeneratedTestCase[];
  /** Raw reply text (or the rule-based JSON), kept so the examiner can inspect exactly what was produced. */
  rawReply: string;
};

/** Sortable run id with milliseconds, e.g. "R20261026-172233-481", so quick successive runs never collide. */
export function newRunId(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `R${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}-${p(now.getMilliseconds(), 3)}`;
}

/** Produces the raw cases for one run, depending on where they come from. */
async function produce(
  req: Req,
  settings: GenerationSettings,
  reviewed: GeneratedTestCase[],
  kind: OriginKind,
  context: GenerationContext,
): Promise<{ raw: RawCase[]; rawReply: string }> {
  if (kind === "regelbasiert") {
    const raw = deriveRuleCases(req, settings);
    if (raw.length === 0) {
      throw new Error(
        req.origin
          ? "Aus dem Zitat ließ sich mit den gewählten Techniken kein Testfall ableiten. Wählen Sie weitere Techniken oder nutzen Sie die KI."
          : "Regelbasierte Ableitung braucht ein Quellzitat. Beispielanforderungen haben keins – nutzen Sie die KI oder die Offline-Demo.",
      );
    }
    return { raw, rawReply: JSON.stringify({ testCases: raw }, null, 2) };
  }
  const rawReply =
    kind === "model"
      ? await chatCompletion(settings.model, buildMessages(req, settings, reviewed, context), settings.temperature)
      : offlineDemoReply(req);
  return { raw: parseCases(rawReply).slice(0, settings.maxCases), rawReply };
}

/**
 * One generation run: produce cases (model, rule-based or offline demo) ->
 * run deterministic checks -> wrap as GeneratedTestCase with full origin info.
 */
export async function generateTestCases(
  req: Req,
  settings: GenerationSettings,
  reviewed: GeneratedTestCase[],
  kind: OriginKind,
  context: GenerationContext = EMPTY_CONTEXT,
): Promise<GenerationRun> {
  const { raw, rawReply } = await produce(req, settings, reviewed, kind, context);

  const now = new Date();
  const runId = newRunId(now);
  const reqNo = req.id.split("-").pop();
  const model = kind === "model" ? settings.model : kind;

  const cases: GeneratedTestCase[] = raw.map((c, i) => ({
    ...c,
    // e.g. AI-028-172233481-1 (time part of the run id + position in the run)
    id: `${kind === "regelbasiert" ? "RB" : "AI"}-${reqNo}-${runId.slice(10).replace("-", "")}-${i + 1}`,
    requirementId: req.id,
    // Unknown priority falls back to "Hoch" so a malformed case is looked at first;
    // the failed priority check stays visible.
    priority: c.priority ?? "Hoch",
    checks: runChecks(c, req, settings, context),
    origin: { kind, model, runId, generatedAt: now.toISOString() },
    review: { decision: "Offen", comment: "" },
    execution: "Nicht ausgeführt",
  }));
  return { runId, cases, rawReply };
}
