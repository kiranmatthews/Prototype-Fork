import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeSpinModel, normalizeSpinSmear, type SpinSmearSettings } from './smear';
import { SPIN_SMEAR_DATABASE as DATABASE, SPIN_SMEAR_REVISION_KEY as REVISION_KEY } from './storageKeys';

const listeners = new Set<() => void>();
let template: THREE.Group | null = null;
let pending: Promise<THREE.Group | null> | null = null;
let epoch = 0;

interface SavedModel { version: 1; glb: ArrayBuffer; settings: SpinSmearSettings }

async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('models');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('The spin model database is busy.'));
  });
}

async function readModel(): Promise<SavedModel | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('models').objectStore('models').get('active');
      request.onsuccess = () => {
        const value = request.result as SavedModel | undefined;
        resolve(value?.version === 1 && value.glb instanceof ArrayBuffer ? value : null);
      };
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function writeModel(value: SavedModel): Promise<void> {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('models', 'readwrite');
      transaction.objectStore('models').put(value, 'active');
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}

async function parseModel(glb: ArrayBuffer): Promise<THREE.Group> {
  const { scene } = await new GLTFLoader().parseAsync(glb, '');
  // No rig, animation or external asset URL is required by a baked model.
  if (!scene.children.length) throw new Error('The baked spin model is empty.');
  return scene;
}

export function loadSpinSmearModel(): Promise<THREE.Group | null> {
  if (pending) return pending;
  const generation = epoch;
  return pending = (async () => {
    let next: THREE.Group | null = null;
    try {
      const saved = await readModel();
      if (saved) {
        next = await parseModel(saved.glb);
        next.userData.spinSmear = { version: 1, settings: normalizeSpinSmear(saved.settings), saved: true };
      }
    } catch { /* A blocked/corrupt local store uses the current character. */ }
    if (generation !== epoch) {
      if (next) disposeSpinModel(next, true);
      return loadSpinSmearModel();
    }
    template = next;
    return template;
  })();
}

export function subscribeSpinSmear(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function exportSpinSmear(model: THREE.Group): Promise<ArrayBuffer> {
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const result = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true });
  if (!(result instanceof ArrayBuffer)) throw new Error('Could not export the baked spin model.');
  return result;
}

/** Replace the fixed geometry only on explicit Bake; storage is atomic. */
export async function saveSpinSmearModel(model: THREE.Group, settings: SpinSmearSettings): Promise<{
  persisted: boolean; glb: ArrayBuffer;
}> {
  const glb = await exportSpinSmear(model);
  const next = await parseModel(glb);
  let persisted = true;
  try { await writeModel({ version: 1, glb, settings: normalizeSpinSmear(settings) }); }
  catch { persisted = false; }
  epoch++;
  const previous = template;
  next.userData.spinSmear = { version: 1, settings: normalizeSpinSmear(settings), saved: persisted };
  template = next;
  pending = Promise.resolve(next);
  for (const listener of listeners) listener();
  if (previous) disposeSpinModel(previous, true);
  if (persisted) {
    try { localStorage.setItem(REVISION_KEY, `${Date.now()}-${epoch}`); }
    catch { /* The same-document subscribers still receive the new bake. */ }
  }
  return { persisted, glb };
}

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key !== REVISION_KEY) return;
  epoch++;
  const previous = template;
  template = null;
  pending = null;
  void loadSpinSmearModel().then(() => {
    for (const listener of listeners) listener();
    if (previous) disposeSpinModel(previous, true);
  });
});
