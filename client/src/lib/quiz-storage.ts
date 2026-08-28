/** Practical Black Utility: browser-only persistence for quiz records and packaged local image blobs. */
import type { QuizSetRecord, UserAnswer } from "./quiz";

const DB_NAME = "study-quiz-studio";
const DB_VERSION = 2;
const SETS_STORE = "quizSets";
const ASSETS_STORE = "quizAssets";
const PROGRESS_STORE = "quizProgress";
const LEGACY_STORAGE_KEY = "study-quiz-studio.quiz-sets.v1";

export type QuizAssetRecord = {
  id: string;
  setKey: string;
  path: string;
  blob: Blob;
};

export type SavedQuizProgress = {
  setKey: string;
  questionIds: string[];
  choiceIdsByQuestion: Record<string, string[]>;
  currentIndex: number;
  answers: Record<string, UserAnswer>;
  feedback: boolean | null;
  reviewParentId: string | null;
  updatedAt: string;
};

let databasePromise: Promise<IDBDatabase> | null = null;
let saveQueue = Promise.resolve();

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDBを開けませんでした。"));
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SETS_STORE)) database.createObjectStore(SETS_STORE, { keyPath: "key" });
      if (!database.objectStoreNames.contains(ASSETS_STORE)) {
        const assets = database.createObjectStore(ASSETS_STORE, { keyPath: "id" });
        assets.createIndex("setKey", "setKey", { unique: false });
      }
      if (!database.objectStoreNames.contains(PROGRESS_STORE)) {
        database.createObjectStore(PROGRESS_STORE, { keyPath: "setKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
  return databasePromise;
}

function resultOf<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDBの操作に失敗しました。"));
  });
}

export async function loadStoredSets(): Promise<QuizSetRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(SETS_STORE, "readonly");
  return resultOf(transaction.objectStore(SETS_STORE).getAll()) as Promise<QuizSetRecord[]>;
}

export function saveStoredSets(sets: QuizSetRecord[]) {
  saveQueue = saveQueue.then(async () => {
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(SETS_STORE, "readwrite");
      const store = transaction.objectStore(SETS_STORE);
      store.clear();
      sets.forEach((set) => store.put(set));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("問題セットを保存できませんでした。"));
    });
  });
  return saveQueue;
}

export async function migrateLegacySets(): Promise<QuizSetRecord[]> {
  const stored = await loadStoredSets();
  if (stored.length) return stored;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const legacy = JSON.parse(raw) as QuizSetRecord[];
    if (!Array.isArray(legacy)) return [];
    await saveStoredSets(legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    return legacy;
  } catch {
    return [];
  }
}

export async function saveSetAssets(setKey: string, assets: Array<{ path: string; blob: Blob }>) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ASSETS_STORE, "readwrite");
    const store = transaction.objectStore(ASSETS_STORE);
    const index = store.index("setKey");
    const keysRequest = index.getAllKeys(IDBKeyRange.only(setKey));
    keysRequest.onsuccess = () => {
      keysRequest.result.forEach((key) => store.delete(key));
      assets.forEach((asset) =>
        store.put({ id: `${setKey}:${asset.path}`, setKey, path: asset.path, blob: asset.blob }),
      );
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("画像を保存できませんでした。"));
  });
}

export async function loadSetAssets(setKey: string): Promise<QuizAssetRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(ASSETS_STORE, "readonly");
  return resultOf(transaction.objectStore(ASSETS_STORE).index("setKey").getAll(IDBKeyRange.only(setKey)));
}

export async function deleteSetAssets(setKey: string) {
  await saveSetAssets(setKey, []);
}

export async function loadQuizProgress(setKey: string): Promise<SavedQuizProgress | null> {
  const database = await openDatabase();
  const transaction = database.transaction(PROGRESS_STORE, "readonly");
  const stored = await resultOf(transaction.objectStore(PROGRESS_STORE).get(setKey));
  return (stored as SavedQuizProgress | undefined) ?? null;
}

export function saveQuizProgress(progress: SavedQuizProgress) {
  saveQueue = saveQueue.then(async () => {
    const database = await openDatabase();
    await resultOf(database.transaction(PROGRESS_STORE, "readwrite").objectStore(PROGRESS_STORE).put(progress));
  });
  return saveQueue;
}

export function clearQuizProgress(setKey: string) {
  saveQueue = saveQueue.then(async () => {
    const database = await openDatabase();
    await resultOf(database.transaction(PROGRESS_STORE, "readwrite").objectStore(PROGRESS_STORE).delete(setKey));
  });
  return saveQueue;
}
