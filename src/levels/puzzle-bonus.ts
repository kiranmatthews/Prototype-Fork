import type { CustomComponent, CustomLevelData } from '../level';
import type { BonusStyle } from './bonus-course-kit';
import { PUZZLE_LAYOUTS, type PuzzleLayoutId } from './puzzle-trilogy';

export const BONUS_LAYOUT_REPLACEMENTS: Readonly<Partial<Record<string, PuzzleLayoutId>>> = {
  jungle: 'crate-primer',
  'beachside-run': 'switchyard',
  coastal: 'clockwork-gauntlet',
};

// Same cuboid and bounds as the donor platform, expressed as the mesh primitive
// used by bonus surface dressing. No scenery or source palette comes across.
const CUBE = {
  vertices: [-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5,
    -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5],
  indices: [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5],
};

/** Preserve every crate, patrol, dependency, checkpoint and physical surface.
 * The destination still owns its name, sky, atmosphere, art and bonus camera.
 * Strip the main-level clock and use the unbranched donor before bonus alcoves.
 */
export function replaceBonusLayout(data: CustomLevelData, layout: PuzzleLayoutId, style: BonusStyle): void {
  const donor = structuredClone(PUZZLE_LAYOUTS[layout]);
  const view = data.components.find(c => c.cameraView)!;
  const gate = donor.components.find(c => c.t === 'gate')!;
  const end = gate.p[0] + 8;
  const surfaces = new Set(['platform', 'mesh', 'mover', 'phasepad', 'crumble', 'spinbridge']);
  const components: CustomComponent[] = donor.components
    .filter(c => c.grp !== 5 && !['clock', 'zone', 'camnode'].includes(c.t))
    .map(c => {
      if (!surfaces.has(c.t)) return c;
      const surface: CustomComponent = c.t === 'platform' ? {...c, t: 'mesh', ...structuredClone(CUBE)} : c;
      return {...surface, tex: style.tex, color: c.outline ? style.accent : style.color};
    });
  components.push(
    {t:'camnode',p:[-14,0,0],radius:0,grp:3},
    {t:'camnode',p:[end+13,0,0],radius:0,grp:3},
    {...view,p:[end/2,8,0],s:[end+54,58,18]},
  );
  data.spawn = donor.spawn;
  data.killY = donor.killY;
  data.components = components;
  data.groups = donor.groups?.filter(group => group.id !== 5);
}
