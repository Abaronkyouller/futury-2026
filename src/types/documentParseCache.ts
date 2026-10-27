import type { SourceDocument } from "./document";

/** Locally parsed document retained so repeat uploads can skip PDF/DOCX parsing. */
export type DocumentParseCacheEntry = {
  id: string;
  cachedAt: string;
  document: SourceDocument;
};
