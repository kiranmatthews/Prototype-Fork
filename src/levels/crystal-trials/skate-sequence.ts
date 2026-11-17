import type { CustomComponent } from '../../level';
import type { CrystalTrial } from './types';
import { REJECTED_SKATING } from './rejected-skating';
import { skateTrial } from './skate-primitives';

export type SkateLink = number | { kind: number; entry: 'air' | 'spring' };
const rises: Record<number, number> = { 1:2, 2:2, 3:1.5, 4:.75, 5:0, 6:.75,
  7:.75, 8:.75, 9:2, 10:2, 11:1.5, 12:7, 13:2, 14:.75, 15:.75, 16:2,
  17:2, 18:1.5, 19:.75, 20:.75, 21:2, 22:.75, 23:3, 24:2, 25:.75 };
const foundation = /Flat recovery floor|Clear skating approach|Return junction|Checkpoint before the line|Recovery bank|Rolling exit to the flat floor/;

// Move only the incoming edge. The opposite lip determines the next handoff.
function setDeckFront(deck: CustomComponent, front: number) {
  const size = deck.s!;
  const back = deck.p[2] - size[2] / 2;
  deck.p[2] = (front + back) / 2;
  size[2] = front - back;
}

/** Each section hands its speed and height to the next; no intervening spawn,
 * checkpoint, exit or recovery courtyard. The sole crystal is at the end.
 * Air links replace a landing with a rail; spring links catch the second
 * rebound on a high rail. Ordinary links raise the receiving roof instead. */
export function skateSequence(id: number, description: string, brief: string, links: SkateLink[]): CrystalTrial {
  const pieces = links.map(link => {
    const spec: { kind: number; entry?: 'air' | 'spring' } = typeof link === 'number' ? { kind: link } : link;
    const source = REJECTED_SKATING.find(t => t.id === spec.kind)!;
    const components = structuredClone(source.components).filter(c => !foundation.test(c.nm ?? ''));
    let endZ = source.exit![2] + 76;
    if (spec.kind === 18) {
      const movingRail = components.find(c => c.t === 'rail')!;
      const receiver = components.find(c => c.t === 'platform')!;
      // At the low point, early pops are already descending as late pops
      // rise. One metre beyond the tip puts the lip within both trajectories.
      setDeckFront(receiver, movingRail.p[2] - movingRail.len! / 2 - 1);
    }
    if ([7, 14, 19].includes(spec.kind)) {
      const firstRoof = components.find(c => c.t === 'phasepad' || c.t === 'crumble')!;
      // The approach supports the rider up to -20. Its last two metres used
      // to show through the first temporary roof and stay solid after it went.
      setDeckFront(firstRoof, -20);
    }
    if (spec.kind === 17 || spec.kind === 24) {
      // A fast grind exit spends its first ~20m airborne. Give the rider a
      // further full skating beat to carve around the visible enemy.
      const terrace = components.find(c => c.nm?.includes(spec.kind === 17 ? 'Enemy carving deck' : 'Wide carving deck'))!;
      terrace.p[2] -= 8; terrace.s![2] += 16;
      for (const c of components) if (c.t === 'enemy' || c.t === 'crystal' || c.t === 'ramp' ||
        c.nm?.includes(spec.kind === 17 ? 'Clear landing' : 'Long roof landing')) c.p[2] -= 16;
      endZ -= 16;
    }
    if (spec.kind === 12) {
      const bounceRow = components.filter(c => c.t === 'crate' && c.kind === 'metalbounce');
      components.splice(0, components.length, ...components.filter(c => !bounceRow.includes(c)));
      for (const crate of bounceRow) for (const dz of [-2.88, -1.92, -.96, 0, .96, 1.92, 2.88])
        components.push({ ...crate, p: [crate.p[0], crate.p[1], crate.p[2] + dz] });
      // Keep the height earned by the bounce chain for the following roof.
      components.splice(0, components.length, ...components.filter(c => !/High roof descent|Lower runout/.test(c.nm ?? '')));
      const roof = components.find(c => c.nm?.includes('Long high landing'))!;
      roof.p[2] = -123; roof.s![2] = 54; endZ = -150;
    }
    const landing = components.find(c => c.t === 'platform' && c.s && Math.abs(c.p[2] - c.s[2] / 2 - endZ) < .01)!;
    return { ...spec, components, endZ, landing, origin: [0, 0, 0] as [number, number, number] };
  });
  for (let i = 1; i < pieces.length; i++) {
    const previous = pieces[i - 1], next = pieces[i];
    if (next.entry === 'spring') {
      next.origin = [0, previous.origin[1] + 8, previous.origin[2] - 82];
      previous.components = previous.components.filter(c => c !== previous.landing);
    } else if (next.entry === 'air') {
      const front = previous.landing.p[2] + previous.landing.s![2] / 2;
      next.origin = [0, previous.origin[1] + rises[previous.kind], previous.origin[2] + front + 8];
      previous.components = previous.components.filter(c => c !== previous.landing);
    } else {
      next.origin = [0, previous.origin[1] + rises[previous.kind], previous.origin[2] + previous.endZ + 20];
      if (previous.kind !== 12) previous.landing.p[1] += rises[previous.kind];
    }
  }
  const last = pieces[pieces.length - 1], endZ = last.origin[2] + last.endZ;
  const components: CustomComponent[] = pieces.flatMap((piece, index) => piece.components
    .filter(c => c.t !== 'crystal' || index === pieces.length - 1)
    .map(c => {
      const offset = piece.origin;
      c.p = c.p.map((value, axis) => value + offset[axis]) as [number, number, number];
      if (c.t === 'pit') c.p[1] = -6;
      if (c.to) c.to = c.to.map((value, axis) => value + offset[axis]) as [number, number, number];
      c.grp = index * 10 + (c.grp ?? 1);
      c.nm = c.t === 'crystal' ? `${id} / ${description}` : `${id} / ${index + 1} / ${c.nm?.split(' / ').slice(1).join(' / ') ?? c.t}`;
      if (c.t === 'phasepad') {
        // Preserve the section's skating window after its approach moves.
        // All timed decisions in a sequence use one cycle family.
        const phase = (c.phase ?? 0) + offset[2] / (23 * (c.cycle ?? 4));
        c.phase = ((phase % 1) + 1) % 1;
      }
      return c;
    }));
  const result = skateTrial(id, description, brief, components, endZ);
  // A forward drop reaches the recovery floor without creating a backwards
  // ramp that bypasses the entire sequence's earned height.
  result.components = result.components.filter(c => !c.nm?.includes('Rolling exit to the flat floor'));
  result.skateSections = pieces.map((piece, index) => ({ kind: piece.kind, origin: piece.origin,
    ...('entry' in piece ? { entry: piece.entry } : {}),
    outgoingRail: !!pieces[index + 1]?.entry, endZ: piece.endZ }));
  return result;
}
