import { createContext, useContext } from "react";
import type { IngestProgress } from "../documents/ingest";
import type { DocRole, SourceDocument } from "../types/document";

export type DocumentStore = {
  documents: SourceDocument[];
  /** False until IndexedDB has been read. */
  ready: boolean;
  /** Set when documents cannot be persisted; they then live in memory for this session only. */
  storageWarning: string;
  /** Reads, segments and stores files. Returns error messages for files that failed. */
  addFiles: (files: File[], onProgress: (name: string, p: IngestProgress) => void) => Promise<{ added: SourceDocument[]; errors: string[] }>;
  removeDocument: (id: string) => void;
  /** Sets the role of a document (Spezifikation / Technische Informationen). */
  setRole: (id: string, role: DocRole) => void;
};

export const DocumentContext = createContext<DocumentStore | null>(null);

/** Access uploaded documents. Must be used inside <DocumentProvider>. */
export function useDocuments(): DocumentStore {
  const store = useContext(DocumentContext);
  if (!store) throw new Error("useDocuments muss innerhalb von <DocumentProvider> verwendet werden.");
  return store;
}
