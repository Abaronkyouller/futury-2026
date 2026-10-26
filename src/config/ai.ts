import type { GenerationSettings } from "../types/review";

/** Frontend path proxied by Vite to the gateway (see vite.config.ts). */
export const AI_PROXY_PATH = "/api/llm";

/** Models listed in the hessian.ai Team 7 handout (ai1.jpg / ai2.jpg). */
export const AI_MODELS = [
  { id: "vllm/Kolibri-1", label: "Kolibri-1 · Aleph Alpha · text, DE/EN" },
  { id: "vllm/GLM-Flash:Latest", label: "GLM-5.3-Flash · Z.ai · text + vision" },
] as const;

/** Abort a model call after this long; long German outputs can take a while. */
export const AI_REQUEST_TIMEOUT_MS = 120_000;

/** Upper bound for completion tokens per run. */
export const AI_MAX_TOKENS = 4000;

/** How many reviewed cases are fed back into the prompt as examiner guidance. */
export const FEEDBACK_EXAMPLES_MAX = 6;

/** UI limit for cases per run. */
export const MAX_CASES_LIMIT = 8;

/** Placeholder the model must use when an expected value cannot be derived from the source. */
export const OPEN_VALUE_MARKER = "[offen – Regel nicht bestätigt]";

/** localStorage key for generated cases, reviews and the change log (per browser only). */
export const STORAGE_KEY = "futury-review-store-v1";

export const DEFAULT_SETTINGS: GenerationSettings = {
  model: AI_MODELS[0].id,
  temperature: 0.2,
  maxCases: 4,
  techniques: ["Grenzwert", "Äquivalenzklasse", "Negativtest"],
  reasoningDetail: "kurz",
  priorityFocus: "Ausgewogen",
  useFeedback: true,
};
