import * as THREE from 'three';
export function kineticPose(base: THREE.Vector3, axis: THREE.Vector3, amp: number,
  speed: number, phase: number, time: number, orbit: readonly [number, number] | undefined,
  out: THREE.Vector3): void {
  const angle = time * speed + phase;
  out.copy(base).addScaledVector(axis, Math.sin(angle) * amp);
  if (!orbit) return;
  const a = Math.cos(angle) * orbit[0], b = Math.sin(angle) * orbit[1];
  if (Math.abs(axis.y) > .5) { out.x += a; out.z += b; }
  else if (Math.abs(axis.x) > .5) { out.y += a; out.z += b; }
  else { out.x += a; out.y += b; }
}
