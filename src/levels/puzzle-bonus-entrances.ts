import type { CustomComponent } from '../level';

export const PUZZLE_BONUS_COURTS = [
  { x: 150, y: 1.2 },
  { x: 222, y: 4 },
  { x: 276, y: 5.2 },
] as const;

/** A final-court side branch leaves every earlier crate dependency intact.
 * The bonus stone sits beyond the main line, through a real opening in its
 * depth boundary. Permanent ground and three walls contain the entire detour.
 */
export function puzzleBonusEntrance(components: readonly CustomComponent[], index: number): CustomComponent[] {
  const { x, y } = PUZZLE_BONUS_COURTS[index];
  const result: CustomComponent[] = [];
  for (const component of components) {
    if (component.t !== 'wall' || !component.invisible || !component.s || Math.abs(component.p[2] - .83) > .01) {
      result.push(component);
      continue;
    }
    const left = component.p[0] - component.s[0] / 2;
    const right = component.p[0] + component.s[0] / 2;
    for (const [a, b] of [[left, x - 4], [x + 4, right]]) {
      if (b <= a) continue;
      result.push({ ...component, p: [(a + b) / 2, component.p[1], component.p[2]],
        s: [b - a, component.s[1], component.s[2]], nm: 'Side boundary beside the bonus court opening' });
    }
  }
  const court = components.find(component => component.t === 'platform' && component.s &&
    x >= component.p[0] - component.s[0] / 2 && x <= component.p[0] + component.s[0] / 2 &&
    Math.abs(component.p[1] + component.s[1] / 2 - y) < .01);
  // The original court already reaches z=2.7. Join there instead of drawing
  // two coplanar floors over its full width.
  result.push({ t: 'platform', p: [x, y - .5, 5.35], s: [8, 1, 5.3],
    tex: court?.tex ?? 'stone', color: court?.color ?? '#bba37a',
    grp: 1, nm: 'Permanent bonus alcove, joined to the final court' });
  // Start beyond the player's half-depth and collision skin on the main lane.
  // The near ends still overlap the existing depth boundary by 3 cm.
  for (const side of [-1, 1]) result.push({ t: 'wall', p: [x + side * 4.3, -14, 4.8],
    s: [.6, 60, 7.4], invisible: true, grp: 3, nm: 'Bonus alcove side boundary' });
  result.push(
    { t: 'wall', p: [x, -14, 8.3], s: [9.2, 60, .6], invisible: true, grp: 3, nm: 'Bonus alcove outer boundary' },
    { t: 'bonusplatform', p: [x, y, 5.4], to: [x, y + .1, 0], grp: 1, nm: 'Final court bonus detour' },
  );
  return result;
}
