import {
  isResettableGameKey, LOCAL_RESET_MARKER, LOCAL_RESET_RECEIPT, LOCAL_RESET_SIGNAL,
} from './localGameStorage';

type Entries = Array<[string, string]>;
export interface LocalGameBackup {
  version: 1;
  site: string;
  createdAt: string;
  local: Entries;
  session: Entries;
  animationDrafts: unknown[];
}
export interface ResetDependencies {
  local: Storage;
  session: Storage;
  site: string;
  drafts: { read(): Promise<unknown[]>; replace(records: unknown[]): Promise<void> };
  recovery: { read(): Promise<LocalGameBackup | null>; write(value: LocalGameBackup): Promise<void> };
  clearCaches(): Promise<void>;
}

function entries(storage: Storage): Entries {
  const result: Entries = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isResettableGameKey(key) && key !== LOCAL_RESET_SIGNAL && key !== LOCAL_RESET_RECEIPT) {
      const value = storage.getItem(key);
      if (value !== null) result.push([key, value]);
    }
  }
  return result;
}

function clearGameKeys(storage: Storage): void {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && isResettableGameKey(key)) keys.push(key);
  }
  for (const key of keys) storage.removeItem(key);
}

export async function resetLocalGameData(deps: ResetDependencies) {
  const createdAt = new Date().toISOString();
  const backup: LocalGameBackup = {
    version: 1, site: deps.site, createdAt,
    local: entries(deps.local), session: entries(deps.session),
    animationDrafts: await deps.drafts.read(),
  };
  // Never delete data until the recoverable snapshot is durably written.
  await deps.recovery.write(backup);
  deps.local.setItem(LOCAL_RESET_SIGNAL, createdAt);
  await deps.drafts.replace([]);
  clearGameKeys(deps.local);
  clearGameKeys(deps.session);
  // Preserve other projects' unprefixed drafts but stop importing them here.
  deps.local.setItem(LOCAL_RESET_MARKER, '1');
  await deps.clearCaches();
  if (entries(deps.local).some(([key]) => key !== LOCAL_RESET_MARKER) || entries(deps.session).length)
    throw new Error('Another game tab wrote data during the reset. Close it and retry.');
  if ((await deps.drafts.read()).length)
    throw new Error('Animation drafts were written during the reset. Close other game tabs and retry.');
  const receipt = { createdAt, localKeys: backup.local.length, sessionKeys: backup.session.length,
    animationDrafts: backup.animationDrafts.length, backupAvailable: true };
  deps.session.setItem(LOCAL_RESET_RECEIPT, JSON.stringify(receipt));
  return receipt;
}

export async function undoLocalGameReset(deps: ResetDependencies): Promise<void> {
  const backup = await deps.recovery.read();
  if (!backup || backup.version !== 1 || backup.site !== deps.site)
    throw new Error('No matching reset backup is available for this game.');
  if (![...backup.local, ...backup.session].every(([key, value]) => isResettableGameKey(key) && typeof value === 'string'))
    throw new Error('The backup contains an invalid or unrelated storage key.');
  deps.local.setItem(LOCAL_RESET_SIGNAL, new Date().toISOString());
  await deps.drafts.replace(backup.animationDrafts);
  clearGameKeys(deps.local); clearGameKeys(deps.session);
  for (const [key, value] of backup.local) deps.local.setItem(key, value);
  for (const [key, value] of backup.session) deps.session.setItem(key, value);
}

function openStore(database: string, store: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(database);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'id' });
    };
    request.onerror = () => reject(request.error ?? new Error('Browser database unavailable'));
    request.onblocked = () => reject(new Error('Close other game/animation tabs and retry.'));
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(store)) { db.close(); reject(new Error(`Missing ${store} storage`)); return; }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}

async function readRecords(database: string, store: string): Promise<unknown[]> {
  const db = await openStore(database, store);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const request = tx.objectStore(store).getAll();
      let result: unknown[] = [];
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Could not read local game records'));
    });
  } finally { db.close(); }
}

async function replaceRecords(database: string, store: string, records: unknown[], replace = true): Promise<void> {
  const db = await openStore(database, store);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const target = tx.objectStore(store);
      if (replace) target.clear();
      for (const record of records) target.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Could not update local game records'));
    });
  } finally { db.close(); }
}

export function browserResetDependencies(): ResetDependencies {
  const base = new URL(import.meta.env.BASE_URL, location.href);
  const site = base.origin + base.pathname;
  const recoveryDatabase = 'solProtoResetRecoveryV1';
  return {
    local: localStorage, session: sessionStorage, site,
    drafts: {
      read: () => readRecords('solProtoAnimation', 'animationDrafts'),
      replace: (records) => replaceRecords('solProtoAnimation', 'animationDrafts', records),
    },
    recovery: {
      read: async () => {
        const rows = await readRecords(recoveryDatabase, 'recovery');
        const row = rows.find((r) => (r as { id?: string }).id === site) as { backup: LocalGameBackup } | undefined;
        return row?.backup ?? null;
      },
      write: (backup) => replaceRecords(recoveryDatabase, 'recovery', [{ id: site, backup }], false),
    },
    clearCaches: async () => {
      if ('caches' in window) {
        for (const name of await caches.keys()) if (name.startsWith('solProto')) await caches.delete(name);
      }
      if ('serviceWorker' in navigator) {
        for (const registration of await navigator.serviceWorker.getRegistrations())
          if (registration.scope.startsWith(site)) await registration.unregister();
      }
    },
  };
}
