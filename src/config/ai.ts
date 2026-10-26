import type { GenerationSettings } from "../types/review";

/** Frontend path proxied by Vite to the gateway (see vite.config.ts). */
export const AI_PROXY_PATH = "/api/llm";

/** The one model configured with HAI_MODEL in .env.local. */
const FALLBACK_AI_MODEL = "vllm/Kolibri-1";
export const AI_MODEL =
  typeof __HAI_MODEL__ === "string" && __HAI_MODEL__.trim() ? __HAI_MODEL__.trim() : FALLBACK_AI_MODEL;

/** Abort a model call after this long; long German outputs can take a while. */
export const AI_REQUEST_TIMEOUT_MS = 120_000;

/** Upper bound for completion tokens per run. */
export const AI_MAX_TOKENS = 4000;

/** How many reviewed cases are fed back into the prompt as examiner guidance. */
export const FEEDBACK_EXAMPLES_MAX = 6;

/** UI limit for cases per run. */
export const MAX_CASES_LIMIT = 12;

/** Placeholder the model must use when an expected value cannot be derived from the source. */
export const OPEN_VALUE_MARKER = "[offen – Regel nicht bestätigt]";

/** localStorage key for generated cases, reviews and the change log (per browser only). */
export const STORAGE_KEY = "futury-review-store-v1";

export const DEFAULT_SETTINGS: GenerationSettings = {
  model: AI_MODEL,
  temperature: 0.2,
  maxCases: 4,
  techniques: ["Grenzwert", "Äquivalenzklasse", "Negativtest"],
  reasoningDetail: "ausführlich",
  priorityFocus: "Ausgewogen",
  useFeedback: true,
};

/** Requirement extraction should copy, not create: always run with temperature 0. */
export const EXTRACTION_TEMPERATURE = 0;
