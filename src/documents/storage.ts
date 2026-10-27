import type { SourceDocument } from "../types/document";
import type { PayrollResult } from "../types/validation";
import type { GenerationCacheEntry } from "../types/generationCache";
import type { DocumentParseCacheEntry } from "../types/documentParseCache";

/**
 * Persists uploaded documents in this browser's IndexedDB. Full specification
 * texts (several 100 kB each) would exceed the localStorage quota, so they are
 * kept apart from the review store. If IndexedDB is unavailable (private mode,
 * blocked storage) the app keeps working in memory and reports that.
 *
 * Version 4 adds parsed-document caches; existing data is retained.
 */

const DB_NAME = "futury-documents";
const DB_VERSION = 4;
const STORES = ["documents", "results", "generationCache", "documentParseCache"] as const;
type StoreName = (typeof STORES)[number];

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB ist in diesem Browser nicht verfügbar."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB konnte nicht geöffnet werden."));
  });
}

/** Runs one request in a transaction and resolves with its result. */
async function run<T>(store: StoreName, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = action(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB-Transaktion fehlgeschlagen."));
    });
  } finally {
    db.close();
  }
}

export function loadDocuments(): Promise<SourceDocument[]> {
  return run("documents", "readonly", (s) => s.getAll() as IDBRequest<SourceDocument[]>);
}

export async function saveDocument(doc: SourceDocument): Promise<void> {
  await run("documents", "readwrite", (s) => s.put(doc));
}

export async function deleteDocument(id: string): Promise<void> {
  await run("documents", "readwrite", (s) => s.delete(id));
}

export function loadResults(): Promise<PayrollResult[]> {
  return run("results", "readonly", (s) => s.getAll() as IDBRequest<PayrollResult[]>);
}

export async function saveResult(result: PayrollResult): Promise<void> {
  await run("results", "readwrite", (s) => s.put(result));
}

export async function deleteResult(id: string): Promise<void> {
  await run("results", "readwrite", (s) => s.delete(id));
}

export function loadGenerationCache(id: string): Promise<GenerationCacheEntry | undefined> {
  return run("generationCache", "readonly", (s) => s.get(id) as IDBRequest<GenerationCacheEntry | undefined>);
}

export async function saveGenerationCache(entry: GenerationCacheEntry): Promise<void> {
  await run("generationCache", "readwrite", (s) => s.put(entry));
}

export function loadDocumentParseCache(id: string): Promise<DocumentParseCacheEntry | undefined> {
  return run("documentParseCache", "readonly", (s) => s.get(id) as IDBRequest<DocumentParseCacheEntry | undefined>);
}

export async function saveDocumentParseCache(entry: DocumentParseCacheEntry): Promise<void> {
  await run("documentParseCache", "readwrite", (s) => s.put(entry));
}
