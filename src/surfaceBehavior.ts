import type { CustomComponent } from './level';

/** Gameplay is explicit: a texture alone never changes traction. All ground
 * builders and the editor use this list and the same contact defaults. */
export const SLIPPERY_COMPONENT_TYPES: readonly CustomComponent['t'][] = [
  'platform', 'mesh', 'ramp', 'terrain', 'vertramp', 'crumble', 'mover',
];
export const ICE_SURFACE = Object.freeze({ grip: .12, minimumGrip: .02, color: '#a8dcec' });
export const FALL_AWAY_SURFACE = Object.freeze({ delay: .85, acceleration: 30, thickness: .5 });

export function surfaceGrip(contact: { slippy?: boolean; iceGrip?: number } | null | undefined): number {
  return contact?.slippy ? contact.iceGrip ?? ICE_SURFACE.grip : 1;
}

/** p is TOP centre for both authoring helpers. The serialized primitives
 * retain their ordinary contracts, so editing/exporting needs no special case. */
export function icePlatform(p: [number, number, number], s: [number, number, number],
  options: Partial<CustomComponent> = {}): CustomComponent {
  const x=s[0]/2,z=s[2]/2,chip=Math.min(.28,x*.15,z*.15);
  return { ...options, t: 'platform', p: [p[0], p[1] - s[1] / 2, p[2]], s,
    pts: options.pts ?? [[-x+chip,z],[x-chip,z],[x,z-chip],[x,-z+chip],
      [x-chip,-z],[-x+chip,-z],[-x,-z+chip],[-x,z-chip]],
    slip: true, iceGrip: options.iceGrip ?? ICE_SURFACE.grip, tex: options.tex ?? 'ice',
    color: options.color ?? ICE_SURFACE.color };
}

export function fallAwayPlatform(p: [number, number, number], s: [number, number, number],
  options: Partial<CustomComponent> = {}): CustomComponent {
  return { ...options, t: 'crumble', p, s,
    shake: options.shake ?? FALL_AWAY_SURFACE.delay,
    speed: options.speed ?? FALL_AWAY_SURFACE.acceleration,
    tex: options.tex ?? 'bridge-timber' };
}
