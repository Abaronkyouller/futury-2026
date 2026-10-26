import type { Req } from "../types/requirement";
import type {
  GeneratedTestCase,
  GenerationSettings,
  OriginKind,
} from "../types/review";
import { chatCompletion } from "./client";
import { offlineDemoReply } from "./offlineDemo";
import { parseCases } from "./parse";
import { buildMessages } from "./prompt";
import { runChecks } from "./validate";

export type GenerationRun = {
  runId: string;
  cases: GeneratedTestCase[];
  /** Raw reply text, kept so the examiner can inspect exactly what the model said. */
  rawReply: string;
};

/** Sortable run id with milliseconds, e.g. "R20261026-172233-481", so quick successive runs never collide. */
function newRunId(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `R${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}-${p(now.getMilliseconds(), 3)}`;
}

/**
 * One generation run: build prompt -> call model (or offline demo) -> parse ->
 * run deterministic checks -> wrap as GeneratedTestCase with full origin info.
 */
export async function generateTestCases(
  req: Req,
  settings: GenerationSettings,
  reviewed: GeneratedTestCase[],
  kind: OriginKind,
): Promise<GenerationRun> {
  const messages = buildMessages(req, settings, reviewed);
  const rawReply =
    kind === "model"
      ? await chatCompletion(settings.model, messages, settings.temperature)
      : offlineDemoReply(req);

  const now = new Date();
  const runId = newRunId(now);
  const reqNo = req.id.split("-").pop();
  const raw = parseCases(rawReply).slice(0, settings.maxCases);

  const cases: GeneratedTestCase[] = raw.map((c, i) => ({
    ...c,
    // e.g. AI-028-172233481-1 (time part of the run id + position in the run)
    id: `AI-${reqNo}-${runId.slice(10).replace("-", "")}-${i + 1}`,
    requirementId: req.id,
    // Unknown priority falls back to "Hoch" so a malformed case is looked at first;
    // the failed priority check stays visible.
    priority: c.priority ?? "Hoch",
    checks: runChecks(c, req, settings),
    origin: {
      kind,
      model: kind === "model" ? settings.model : "offline-demo",
      runId,
      generatedAt: now.toISOString(),
    },
    review: { decision: "Offen", comment: "" },
    execution: "Nicht ausgeführt",
  }));
  return { runId, cases, rawReply };
}
