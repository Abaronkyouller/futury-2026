import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { RETIRED_WARNING_PREFIXES } from "../config/documents";
import { ingestFile, versionLabel } from "../documents/ingest";
import { deleteDocument, loadDocuments, saveDocument } from "../documents/storage";
import type { DocKind, DocRole, SourceDocument } from "../types/document";
import { DocumentContext } from "./documentContext";
import type { DocumentStore } from "./documentContext";
import { useReviewStore } from "./reviewContext";

const STORAGE_WARNING =
  "Dokumente können in diesem Browser nicht dauerhaft gespeichert werden (IndexedDB nicht verfügbar). Sie bleiben nur bis zum Neuladen erhalten.";

/**
 * Removes warnings that an earlier version stored on the document but that the
 * current ingest pipeline no longer produces (e.g. the removed running
 * headers/footers). Without this, already-uploaded documents would keep
 * displaying retired notices from IndexedDB forever.
 */
function normalizeDocument(doc: SourceDocument): SourceDocument {
  const warnings = (doc.warnings ?? []).filter(
    (w) => !RETIRED_WARNING_PREFIXES.some((prefix) => w.startsWith(prefix)),
  );
  return warnings.length === (doc.warnings ?? []).length ? doc : { ...doc, warnings };
}

/**
 * Holds uploaded source documents. Text extraction runs locally in the
 * browser; documents are persisted in IndexedDB. Uploads, deletions and
 * manual reclassifications are written to the change log.
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
          setDocuments(docs.map(normalizeDocument).sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt)));
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
      // Sequential: PDF parsing is CPU-heavy and progress stays readable.
      for (const file of files) {
        try {
          const doc = await ingestFile(file, (p) => onProgress(file.name, p));
          added.push(doc);
          persist(doc);
          setDocuments((d) => [...d, doc]);
          logEvent("Dokument", {
            summary: `„${doc.name}“ hochgeladen: ${doc.sections.length} Abschnitte, Dokumentart ${doc.classification.kind}, Rolle ${doc.role}`,
            after: `${versionLabel(doc)}${doc.warnings.length ? `\nHinweise: ${doc.warnings.join(" | ")}` : ""}`,
          });
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
      return { added, errors };
    },
    [logEvent, persist],
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

  const setKind = useCallback(
    (id: string, kind: DocKind) =>
      update(
        id,
        (d) => ({ ...d, classification: { ...d.classification, kind, overridden: true } }),
        (d) => d.classification.kind,
        "Dokumentart",
      ),
    [update],
  );

  const setRole = useCallback(
    (id: string, role: DocRole) => update(id, (d) => ({ ...d, role }), (d) => d.role, "Rolle"),
    [update],
  );

  const generationContext = useMemo(
    () => ({
      formatExamples: documents
        .filter((d) => d.role === "Formatbeispiel")
        .map((d) => ({ name: d.name, text: d.sections.map((s) => s.text).join("\n") })),
    }),
    [documents],
  );

  const store = useMemo<DocumentStore>(
    () => ({ documents, ready, storageWarning, addFiles, removeDocument, setKind, setRole, generationContext }),
    [documents, ready, storageWarning, addFiles, removeDocument, setKind, setRole, generationContext],
  );

  return <DocumentContext.Provider value={store}>{children}</DocumentContext.Provider>;
}
