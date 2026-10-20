import * as THREE from 'three';

/** Renderer allocations are going away; the game still owns the source data. */
export function isGraphicsReset(event: { type: string; graphicsReset?: boolean }): boolean {
  return event.graphicsReset === true;
}

/** Call while the context is lost, before Three creates its replacement caches.
 * Three's geometry/texture/instance disposal listeners otherwise retain the old
 * cache and try to delete invalid handles when an asset is later retired.
 * Include inactive owners as well as the scene (e.g. reusable race characters).
 * Do not dispose materials, close images, clear morph data or end asset leases. */
export function releaseLostGraphicsResources(roots: readonly unknown[]): void {
  const seen = new Set<object>(), pending = [...roots];
  const geometries = new Set<THREE.BufferGeometry>(), textures = new Set<THREE.Texture>();
  const targets = new Set<THREE.RenderTarget>(), instances = new Set<THREE.InstancedMesh>();
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || seen.has(value) || value === globalThis ||
        ArrayBuffer.isView(value) || value instanceof ArrayBuffer ||
        (typeof Node !== 'undefined' && value instanceof Node) || value instanceof THREE.WebGLRenderer) continue;
    seen.add(value);
    if (value instanceof THREE.BufferGeometry) { geometries.add(value); continue; }
    if (value instanceof THREE.Texture) { textures.add(value); continue; }
    if (value instanceof THREE.RenderTarget) {
      targets.add(value); pending.push(...value.textures, value.depthTexture); continue;
    }
    if (value instanceof THREE.InstancedMesh) instances.add(value);
    if (value instanceof Map) for (const [key, entry] of value) pending.push(key, entry);
    else if (value instanceof Set) for (const entry of value) pending.push(entry);
    else for (const entry of Object.values(value)) pending.push(entry);
  }
  // A reset event releases renderer listeners through the same public contract
  // as dispose(), while allowing game-owned lifetime listeners to stay alive.
  const event = { type: 'dispose' as const, graphicsReset: true };
  for (const target of targets) target.dispatchEvent(event);
  for (const mesh of instances) mesh.dispatchEvent(event);
  for (const geometry of geometries) geometry.dispatchEvent(event);
  for (const texture of textures) texture.dispatchEvent(event);
}
