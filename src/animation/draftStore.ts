import type { AnimationSuiteDocument } from './types';
import { stringifyAnimationSuite } from './normalize';
import { parseAnimationSuite } from './validation';

export const DEFAULT_ANIMATION_DRAFT_NAMESPACE = 'solProtoAnimationDraft';

export interface AnimationDraftStorage {
  readonly length?: number;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key?(index: number): string | null;
}

export interface AnimationDraftStore {
  readonly namespace: string;
  keyFor(documentId: string): string;
  has(documentId: string): boolean;
  save(document: AnimationSuiteDocument): AnimationSuiteDocument;
  load(documentId: string): AnimationSuiteDocument | null;
  remove(documentId: string): void;
  listDocumentIds(): string[];
}

function browserStorage(): AnimationDraftStorage {
  try {
    if (globalThis.localStorage) return globalThis.localStorage;
  } catch {
    // Access can throw when browser storage is disabled for the current origin.
  }
  throw new Error('localStorage is unavailable; pass an AnimationDraftStorage implementation');
}

function safeDocumentId(value: string): string {
  if (value.trim().length === 0) throw new Error('animation draft document ID cannot be empty');
  return encodeURIComponent(value);
}

export function createLocalDraftStore(
  storage: AnimationDraftStorage = browserStorage(),
  namespace = DEFAULT_ANIMATION_DRAFT_NAMESPACE,
): AnimationDraftStore {
  const prefix = `${namespace}:`;
  const keyFor = (documentId: string): string => `${prefix}${safeDocumentId(documentId)}`;
  return {
    namespace,
    keyFor,
    has(documentId: string): boolean {
      return storage.getItem(keyFor(documentId)) !== null;
    },
    save(document: AnimationSuiteDocument): AnimationSuiteDocument {
      const normalized = parseAnimationSuite(document);
      storage.setItem(keyFor(normalized.id), stringifyAnimationSuite(normalized));
      return normalized;
    },
    load(documentId: string): AnimationSuiteDocument | null {
      const value = storage.getItem(keyFor(documentId));
      return value === null ? null : parseAnimationSuite(value);
    },
    remove(documentId: string): void {
      storage.removeItem(keyFor(documentId));
    },
    listDocumentIds(): string[] {
      if (storage.length === undefined || !storage.key) return [];
      const ids: string[] = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith(prefix)) continue;
        try {
          ids.push(decodeURIComponent(key.slice(prefix.length)));
        } catch {
          // Ignore a malformed key owned by another/older implementation.
        }
      }
      return ids.sort();
    },
  };
}
