import { useCallback, useEffect, useState } from "react";
import { ingestResult } from "../results/ingestResult";
import { deleteResult, loadResults, saveResult } from "../documents/storage";
import type { PayrollResult } from "../types/validation";
import { useReviewStore } from "./reviewContext";

const STORAGE_WARNING = "";

/**
 * Payroll result files imported on "Validierung & Bericht". The files are
 * read locally and kept in IndexedDB (they can be larger than localStorage
 * allows); the comparisons themselves live in the review store.
 */
export function useResults() {
  const { logEvent } = useReviewStore();
  const [results, setResults] = useState<PayrollResult[]>([]);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadResults()
      .then((list) => !cancelled && setResults(list.sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt))))
      .catch(() => !cancelled && setStorageWarning(STORAGE_WARNING))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const addFiles = useCallback(
    async (files: File[]): Promise<{ added: PayrollResult[]; errors: string[] }> => {
      const added: PayrollResult[] = [];
      const errors: string[] = [];
      for (const file of files) {
        try {
          const result = await ingestResult(file);
          added.push(result);
          setResults((r) => [...r, result]);
          saveResult(result).catch(() => setStorageWarning(STORAGE_WARNING));
          logEvent("Validierung", {
            summary: `Ergebnis „${result.name}“ importiert (${result.pageCount ? `${result.pageCount} Seite(n), ` : ""}${result.text.length.toLocaleString("de-DE")} Zeichen)`,
            after: result.warnings.join("\n") || undefined,
          });
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
      return { added, errors };
    },
    [logEvent],
  );

  const remove = useCallback(
    (id: string) => {
      const target = results.find((r) => r.id === id);
      if (!target) return;
      setResults((r) => r.filter((x) => x.id !== id));
      deleteResult(id).catch(() => setStorageWarning(STORAGE_WARNING));
      logEvent("Validierung", { summary: `Ergebnis „${target.name}“ entfernt – gespeicherte Abgleiche bleiben erhalten`, before: target.id });
    },
    [results, logEvent],
  );

  return { results, ready, storageWarning, addFiles, remove };
}
