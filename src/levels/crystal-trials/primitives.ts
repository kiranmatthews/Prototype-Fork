import type { CustomComponent } from '../../level';

/** A complete twelve-triangle box, with its top faces first for edge grinding. */
export const box = (nm: string, p: [number, number, number], s: [number, number, number],
  extra: Partial<CustomComponent> = {}): CustomComponent => ({
  t: 'mesh', nm, p, s, tex: 'solid', color: '#a8b9a0', solidSides: true,
  vertices: [-.5,-.5,-.5, .5,-.5,-.5, .5,.5,-.5, -.5,.5,-.5,
    -.5,-.5,.5, .5,-.5,.5, .5,.5,.5, -.5,.5,.5],
  indices: [3,7,6, 3,6,2, 0,3,2, 0,2,1, 4,5,6, 4,6,7,
    0,4,7, 0,7,3, 1,2,6, 1,6,5, 0,1,5, 0,5,4],
  grindTopTriangles: 2, ...extra,
});
export const outlineStep = (nm: string, x: number, y: number, z: number, w: number, d: number, grp: number): CustomComponent =>
  box(nm, [x, y - .5, z], [w, 1, d], { outline: true, grp });
