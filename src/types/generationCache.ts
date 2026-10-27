import type { Req } from "./requirement";
import type { GeneratedTestCase } from "./review";

/** Cached output of one complete document analysis, persisted in IndexedDB. */
export type GenerationCacheEntry = {
  /** Normalized document name + detected version/stand. */
  id: string;
  documentName: string;
  documentVersion: string;
  /** Stable signature of the locally extracted document text. */
  documentFingerprint?: string;
  cachedAt: string;
  requirements: Req[];
  cases: GeneratedTestCase[];
};
