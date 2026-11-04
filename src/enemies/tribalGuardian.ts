import * as THREE from 'three';
import type { Enemy } from '../level';

/** Measured from the full Smart Mesh, including its oversized head and feet.
 * The combat box covers the body/head; the hair and swinging hands are artwork. */
export const TRIBAL_GUARDIAN = { artworkScale: 2.6, height: 2.43, width: 1.15, turnSeconds: .38, defeatSeconds: 1.05 } as const;
export const isTribalGuardian = (enemy: Enemy): boolean => enemy.kind === 'grunt' && enemy.visual.diagnostics.appearance === 'tribal';

/** A short planted turn at each patrol end prevents a biped snapping through 180°. */
export function stepTribalGuardian(enemy: Enemy, dt: number): void {
  enemy.stateT += dt;
  const along = enemy.axis === 'z' ? 'z' : 'x';
  if (enemy.state !== 'turn') {
    enemy.group.position[along] += enemy.dir * enemy.speed * dt;
    if (enemy.group.position[along] >= enemy.x1 || enemy.group.position[along] <= enemy.x0) {
      enemy.group.position[along] = THREE.MathUtils.clamp(enemy.group.position[along], enemy.x0, enemy.x1);
      enemy.dir = enemy.group.position[along] >= enemy.x1 ? -1 : 1;
      enemy.state = 'turn'; enemy.stateT = 0;
    }
  } else if (enemy.stateT >= TRIBAL_GUARDIAN.turnSeconds) {
    enemy.state = 'patrol'; enemy.stateT = 0;
  }
  const target = enemy.axis === 'z' ? (enemy.dir > 0 ? 0 : Math.PI) : (enemy.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  const delta = Math.atan2(Math.sin(target - enemy.group.rotation.y), Math.cos(target - enemy.group.rotation.y));
  const limit = Math.PI / TRIBAL_GUARDIAN.turnSeconds * dt;
  enemy.group.rotation.y += THREE.MathUtils.clamp(delta, -limit, limit);
}
