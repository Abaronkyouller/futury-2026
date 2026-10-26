import type { SourceDocument } from "../types/document";

/**
 * Persists uploaded documents in this browser's IndexedDB. Full specification
 * texts (several 100 kB each) would exceed the localStorage quota, so they are
 * kept apart from the review store. If IndexedDB is unavailable (private mode,
 * blocked storage) the app keeps working in memory and reports that.
 */

const DB_NAME = "futury-documents";
const DB_VERSION = 1;
const STORE = "documents";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB ist in diesem Browser nicht verfügbar."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB konnte nicht geöffnet werden."));
  });
}

/** Runs one request in a transaction and resolves with its result. */
async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB-Transaktion fehlgeschlagen."));
    });
  } finally {
    db.close();
  }
}

export function loadDocuments(): Promise<SourceDocument[]> {
  return run("readonly", (s) => s.getAll() as IDBRequest<SourceDocument[]>);
}

export async function saveDocument(doc: SourceDocument): Promise<void> {
  await run("readwrite", (s) => s.put(doc));
}

export async function deleteDocument(id: string): Promise<void> {
  await run("readwrite", (s) => s.delete(id));
}
