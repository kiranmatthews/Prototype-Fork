/** One lease per asset per level, including loads still in flight. */
export class AssetCache<K, V> {
  private entries = new Map<K, { users: number; promise: Promise<V>; value?: V; ready: boolean; dependencies: (() => void)[] }>();
  constructor(private load: (key: K, dependency: (key: K) => Promise<V>) => Promise<V>, private destroy: (value: V, key: K) => void) {}
  acquire(key: K): { promise: Promise<V>; release: () => void } {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { users: 0, promise: undefined!, ready: false, dependencies: [] };
      const created = entry;
      const cleanup = () => {
        if (created.ready) this.destroy(created.value!, key);
        for (const release of created.dependencies) release();
        created.dependencies.length = 0;
      };
      created.promise = Promise.resolve().then(() => this.load(key, dependency => {
        const lease = this.acquire(dependency);
        created.dependencies.push(lease.release);
        return lease.promise;
      })).then(value => {
        created.value = value; created.ready = true;
        if (created.users === 0) cleanup();
        return value;
      }, error => {
        if (this.entries.get(key) === created) this.entries.delete(key);
        cleanup();
        throw error;
      });
      this.entries.set(key, created);
    }
    entry.users++;
    const held = entry;
    let released = false;
    return { promise: held.promise, release: () => {
      if (released) return;
      released = true;
      if (--held.users !== 0) return;
      if (this.entries.get(key) === held) this.entries.delete(key);
      if (held.ready) {
        this.destroy(held.value!, key);
        for (const release of held.dependencies) release();
        held.dependencies.length = 0;
      }
    } };
  }
  scope(): AssetScope<K, V> { return new AssetScope(this); }
}

export class AssetScope<K, V> {
  private leases = new Map<K, ReturnType<AssetCache<K, V>['acquire']>>();
  private disposed = false;
  constructor(private cache: AssetCache<K, V>) {}
  load = (key: K): Promise<V> => {
    if (this.disposed) return Promise.reject(new Error('Asset owner has been disposed'));
    let lease = this.leases.get(key);
    if (!lease) { lease = this.cache.acquire(key); this.leases.set(key, lease); }
    return lease.promise;
  };
  dispose(): void {
    this.disposed = true;
    for (const lease of this.leases.values()) lease.release();
    this.leases.clear();
  }
}

/** GPU disposal alone does not close GLTFLoader's decoded ImageBitmaps. */
export function disposeTextures(textures: Iterable<import('three').Texture>, retained: Iterable<import('three').Texture> = []): void {
  const keptImages = new Set([...retained].map(texture => texture.image));
  const images = new Set<{ close?: () => void }>();
  for (const texture of new Set(textures)) {
    if (texture.image && !keptImages.has(texture.image)) images.add(texture.image);
    texture.dispose();
  }
  for (const image of images) image.close?.();
}
