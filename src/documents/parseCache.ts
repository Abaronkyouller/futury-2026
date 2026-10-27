import type { SourceDocument } from "../types/document";
import type { DocumentParseCacheEntry } from "../types/documentParseCache";
import { shortHash } from "./text";

/** File identity available before parsing. Last-modified is included when known. */
export function documentParseCacheKey(name: string, size: number, lastModified?: number): string {
  const normalized = name.normalize("NFKC").trim().toLocaleLowerCase("de-DE");
  return `${normalized}::${size}::${lastModified ?? "legacy"}`;
}

export function createDocumentParseCache(doc: SourceDocument): DocumentParseCacheEntry {
  return {
    id: documentParseCacheKey(doc.name, doc.sizeBytes, doc.fileLastModified),
    cachedAt: new Date().toISOString(),
    document: doc,
  };
}

/** Gives a repeat upload fresh document/section IDs while reusing parsed text. */
export function cloneParsedDocument(cached: SourceDocument, file: File): SourceDocument {
  const uploadedAt = new Date().toISOString();
  const id = `D${shortHash(`${file.name}|${file.size}|${uploadedAt}|${Math.random()}`)}`;
  return {
    ...cached,
    id,
    name: file.name,
    sizeBytes: file.size,
    fileLastModified: file.lastModified,
    uploadedAt,
    predecessorId: undefined,
    sections: cached.sections.map((section, index) => ({
      ...section,
      id: `${id}-S${String(index + 1).padStart(3, "0")}`,
    })),
  };
}
