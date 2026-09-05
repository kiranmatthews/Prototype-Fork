/** Fork-owned keys share a browser origin with other GitHub Pages projects. */
export const LOCAL_RESET_MARKER = 'solProtoIgnoreLegacyStudioDrafts';
export const LOCAL_RESET_SIGNAL = 'solProtoLocalDataResetSignal';
export const LOCAL_RESET_RECEIPT = 'solProtoLocalDataResetReceipt';
export const SYNC_TOKEN_KEY = 'solProtoGHToken';

export function isResettableGameKey(key: string): boolean {
  return key.startsWith('solProto') && key !== SYNC_TOKEN_KEY;
}

/** Old unprefixed studio drafts may also belong to the original prototype. */
export function readForkStudioDraft(
  storage: Pick<Storage, 'getItem'> | null,
  key: string,
  legacyKey: string,
): string | null {
  if (!storage) return null;
  const current = storage.getItem(key);
  if (current !== null) return current;
  return storage.getItem(LOCAL_RESET_MARKER) === '1' ? null : storage.getItem(legacyKey);
}

export function localDataResetUrl(): URL {
  return new URL(`${import.meta.env.BASE_URL}reset-local-data.html`, location.href);
}

export function installLocalResetListener(): void {
  window.addEventListener('storage', (event) => {
    if (event.key === LOCAL_RESET_SIGNAL && event.newValue)
      location.replace(localDataResetUrl());
  });
}
