import type { AnimationSuiteDocument } from './types';
import type { AnimationDraftStore } from './draftStore';
import { createLocalDraftStore } from './draftStore';
import { stringifyAnimationSuite } from './normalize';
import { parseAnimationSuite } from './validation';

export const DEFAULT_ANIMATION_DRAFT_DATABASE = 'solProtoAnimation';
export const DEFAULT_ANIMATION_DRAFT_OBJECT_STORE = 'animationDrafts';

export interface AsyncAnimationDraftStore {
  save(document: AnimationSuiteDocument): Promise<AnimationSuiteDocument>;
  load(documentId: string): Promise<AnimationSuiteDocument | null>;
  remove(documentId: string): Promise<void>;
  has(documentId: string): Promise<boolean>;
  listDocumentIds(): Promise<string[]>;
}

interface StoredAnimationDraft {
  id: string;
  json: string;
  updatedAt: number;
}

export interface IndexedDbDraftStoreOptions {
  databaseName?: string;
  objectStoreName?: string;
  databaseVersion?: number;
  factory?: IDBFactory;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export function createIndexedDbDraftStore(
  options: IndexedDbDraftStoreOptions = {},
): AsyncAnimationDraftStore {
  const factory = options.factory ?? globalThis.indexedDB;
  if (!factory) throw new Error('IndexedDB is unavailable');
  const databaseName = options.databaseName ?? DEFAULT_ANIMATION_DRAFT_DATABASE;
  const objectStoreName = options.objectStoreName ?? DEFAULT_ANIMATION_DRAFT_OBJECT_STORE;
  const databaseVersion = options.databaseVersion ?? 1;
  let databasePromise: Promise<IDBDatabase> | undefined;

  const database = (): Promise<IDBDatabase> => {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = factory.open(databaseName, databaseVersion);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(objectStoreName)) {
          request.result.createObjectStore(objectStoreName, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => {
        const result = request.result;
        result.onversionchange = () => result.close();
        resolve(result);
      };
      request.onerror = () => reject(request.error ?? new Error('Could not open the animation draft database'));
      request.onblocked = () => reject(new Error('Animation draft database upgrade is blocked by another tab'));
    });
    databasePromise.catch(() => {
      databasePromise = undefined;
    });
    return databasePromise;
  };

  return {
    async save(document: AnimationSuiteDocument): Promise<AnimationSuiteDocument> {
      const normalized = parseAnimationSuite(document);
      const db = await database();
      const transaction = db.transaction(objectStoreName, 'readwrite');
      const stored: StoredAnimationDraft = {
        id: normalized.id,
        json: stringifyAnimationSuite(normalized),
        updatedAt: Date.now(),
      };
      const request = transaction.objectStore(objectStoreName).put(stored);
      await Promise.all([requestResult(request), transactionComplete(transaction)]);
      return normalized;
    },
    async load(documentId: string): Promise<AnimationSuiteDocument | null> {
      const db = await database();
      const transaction = db.transaction(objectStoreName, 'readonly');
      const request = transaction.objectStore(objectStoreName).get(documentId) as IDBRequest<StoredAnimationDraft | undefined>;
      const [stored] = await Promise.all([requestResult(request), transactionComplete(transaction)]);
      return stored ? parseAnimationSuite(stored.json) : null;
    },
    async remove(documentId: string): Promise<void> {
      const db = await database();
      const transaction = db.transaction(objectStoreName, 'readwrite');
      const request = transaction.objectStore(objectStoreName).delete(documentId);
      await Promise.all([requestResult(request), transactionComplete(transaction)]);
    },
    async has(documentId: string): Promise<boolean> {
      const db = await database();
      const transaction = db.transaction(objectStoreName, 'readonly');
      const request = transaction.objectStore(objectStoreName).count(documentId);
      const [count] = await Promise.all([requestResult(request), transactionComplete(transaction)]);
      return count > 0;
    },
    async listDocumentIds(): Promise<string[]> {
      const db = await database();
      const transaction = db.transaction(objectStoreName, 'readonly');
      const request = transaction.objectStore(objectStoreName).getAllKeys();
      const [keys] = await Promise.all([requestResult(request), transactionComplete(transaction)]);
      return keys.filter((key): key is string => typeof key === 'string').sort();
    },
  };
}

function asyncAdapter(store: AnimationDraftStore): AsyncAnimationDraftStore {
  return {
    save: async (document) => store.save(document),
    load: async (documentId) => store.load(documentId),
    remove: async (documentId) => store.remove(documentId),
    has: async (documentId) => store.has(documentId),
    listDocumentIds: async () => store.listDocumentIds(),
  };
}

export interface PreferredDraftStoreOptions extends IndexedDbDraftStoreOptions {
  fallback?: AnimationDraftStore;
}

/** Uses IndexedDB for dense clips and transparently falls back to localStorage. */
export function createPreferredDraftStore(
  options: PreferredDraftStoreOptions = {},
): AsyncAnimationDraftStore {
  let fallback: AsyncAnimationDraftStore | undefined;
  const fallbackStore = (): AsyncAnimationDraftStore => {
    fallback ??= asyncAdapter(options.fallback ?? createLocalDraftStore());
    return fallback;
  };
  let primary: AsyncAnimationDraftStore | undefined;
  try {
    primary = createIndexedDbDraftStore(options);
  } catch {
    return {
      save: (document) => fallbackStore().save(document),
      load: (documentId) => fallbackStore().load(documentId),
      remove: (documentId) => fallbackStore().remove(documentId),
      has: (documentId) => fallbackStore().has(documentId),
      listDocumentIds: () => fallbackStore().listDocumentIds(),
    };
  }
  const withFallback = async <T>(
    preferred: () => Promise<T>,
    backup: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await preferred();
    } catch {
      return backup();
    }
  };
  return {
    save: (document) => withFallback(() => primary.save(document), () => fallbackStore().save(document)),
    load: (documentId) => withFallback(() => primary.load(documentId), () => fallbackStore().load(documentId)),
    remove: (documentId) => withFallback(() => primary.remove(documentId), () => fallbackStore().remove(documentId)),
    has: (documentId) => withFallback(() => primary.has(documentId), () => fallbackStore().has(documentId)),
    listDocumentIds: () => withFallback(() => primary.listDocumentIds(), () => fallbackStore().listDocumentIds()),
  };
}
