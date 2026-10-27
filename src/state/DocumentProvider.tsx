import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { RETIRED_WARNING_PREFIXES } from "../config/documents";
import { ingestFile, versionLabel } from "../documents/ingest";
import { deleteDocument, loadDocumentParseCache, loadDocuments, saveDocument, saveDocumentParseCache } from "../documents/storage";
import { cloneParsedDocument, createDocumentParseCache, documentParseCacheKey } from "../documents/parseCache";
import { DOC_ROLES } from "../types/document";
import type { DocRole, SourceDocument } from "../types/document";
import type { DocumentParseCacheEntry } from "../types/documentParseCache";
import { DocumentContext } from "./documentContext";
import type { DocumentStore } from "./documentContext";
import { useReviewStore } from "./reviewContext";
import { findPredecessor } from "../changes/ruleDiff";

const STORAGE_WARNING =
  "Dokumente können in diesem Browser nicht dauerhaft gespeichert werden (IndexedDB nicht verfügbar). Sie bleiben nur bis zum Neuladen erhalten.";

/**
 * Brings a document loaded from IndexedDB onto the current model:
 * - drops warnings an earlier version stored but the ingest pipeline no longer
 *   produces (e.g. the removed running headers/footers), which would otherwise
 *   keep showing retired notices forever;
 * - maps the retired role "Formatbeispiel" (and any unknown value) onto the
 *   current role set, so old records stay usable.
 */
function normalizeDocument(doc: SourceDocument): SourceDocument {
  const warnings = (doc.warnings ?? []).filter(
    (w) => !RETIRED_WARNING_PREFIXES.some((prefix) => w.startsWith(prefix)),
  );
  const role = (DOC_ROLES as readonly string[]).includes(doc.role) ? doc.role : "Spezifikation";
  return warnings.length === (doc.warnings ?? []).length && role === doc.role
    ? doc
    : { ...doc, warnings, role };
}

/**
 * Holds uploaded source documents. Text extraction runs locally in the
 * browser; documents are persisted in IndexedDB. Uploads, deletions and role
 * changes are written to the change log.
 */
export function DocumentProvider({ children }: { children: ReactNode }) {
  const { logEvent } = useReviewStore();
  const [documents, setDocuments] = useState<SourceDocument[]>([]);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadDocuments()
      .then((docs) => {
        if (!cancelled) {
          const normalized = docs.map(normalizeDocument).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
          setDocuments(normalized);
          // Backfill the parse cache for documents uploaded before this feature.
          for (const doc of normalized) {
            void saveDocumentParseCache(createDocumentParseCache(doc)).catch(() => undefined);
          }
        }
      })
      .catch(() => !cancelled && setStorageWarning(STORAGE_WARNING))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((doc: SourceDocument) => {
    saveDocument(doc).catch(() => setStorageWarning(STORAGE_WARNING));
  }, []);

  const addFiles = useCallback<DocumentStore["addFiles"]>(
    async (files, onProgress) => {
      const added: SourceDocument[] = [];
      const errors: string[] = [];
      // Documents known so far, so a predecessor uploaded in the same batch is found too.
      const known = [...documents];
      // Sequential: PDF parsing is CPU-heavy and progress stays readable.
      for (const file of files) {
        try {
          onProgress(file.name, { stage: "Lokaler Dokument-Cache wird geprüft" });
          let cached: DocumentParseCacheEntry | undefined;
          try {
            cached = await loadDocumentParseCache(documentParseCacheKey(file.name, file.size, file.lastModified));
            cached ??= await loadDocumentParseCache(documentParseCacheKey(file.name, file.size));
          } catch {
            // Cache access is optional; parsing below remains the fallback.
          }
          const read = cached
            ? cloneParsedDocument(cached.document, file)
            : await ingestFile(file, (p) => onProgress(file.name, p));
          const predecessor = findPredecessor(read, known);
          const doc = { ...read, predecessorId: predecessor?.id };
          known.push(doc);
          added.push(doc);
          persist(doc);
          await saveDocumentParseCache(createDocumentParseCache(doc)).catch(() => undefined);
          setDocuments((d) => [...d, doc]);
          logEvent("Dokument", {
            summary: `„${doc.name}“ hochgeladen: ${doc.sections.length} Abschnitte, Dokumentart ${doc.classification.kind}, Rolle ${doc.role}${predecessor ? `, Vorgängerversion „${predecessor.name}“` : ""}`,
            after: `${versionLabel(doc)}${doc.warnings.length ? `\nHinweise: ${doc.warnings.join(" | ")}` : ""}`,
          });
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
      return { added, errors };
    },
    [documents, logEvent, persist],
  );

  const removeDocument = useCallback(
    (id: string) => {
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;
      setDocuments((d) => d.filter((x) => x.id !== id));
      deleteDocument(id).catch(() => setStorageWarning(STORAGE_WARNING));
      logEvent("Dokument", {
        summary: `„${doc.name}“ entfernt – extrahierte Anforderungen behalten Zitat und Abschnittstext`,
        before: `${doc.id} · ${versionLabel(doc)}`,
      });
    },
    [documents, logEvent],
  );

  /** Applies a change to one document, persists it and logs before/after. */
  const update = useCallback(
    (id: string, change: (d: SourceDocument) => SourceDocument, describe: (d: SourceDocument) => string, what: string) => {
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;
      const next = change(doc);
      if (describe(doc) === describe(next)) return;
      setDocuments((list) => list.map((d) => (d.id === id ? next : d)));
      persist(next);
      logEvent("Dokument", { summary: `${what} von „${doc.name}“ geändert`, before: describe(doc), after: describe(next) });
    },
    [documents, logEvent, persist],
  );

  const setRole = useCallback(
    (id: string, role: DocRole) => update(id, (d) => ({ ...d, role }), (d) => d.role, "Rolle"),
    [update],
  );

  const setPredecessor = useCallback(
    (id: string, predecessorId: string | undefined) =>
      update(
        id,
        (d) => ({ ...d, predecessorId }),
        (d) => documents.find((x) => x.id === d.predecessorId)?.name ?? "keine",
        "Vorgängerversion",
      ),
    [update, documents],
  );

  const store = useMemo<DocumentStore>(
    () => ({ documents, ready, storageWarning, addFiles, removeDocument, setRole, setPredecessor }),
    [documents, ready, storageWarning, addFiles, removeDocument, setRole, setPredecessor],
  );

  return <DocumentContext.Provider value={store}>{children}</DocumentContext.Provider>;
}
