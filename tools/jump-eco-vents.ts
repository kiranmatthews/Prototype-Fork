import { routePoint } from '../src/levels/blockworks-geometry';

// Local review dressing only: no published level edits or new collision.
export const JUMP_ECO_VENTS = [
  {name: 'Entry', station: 9, top: 0, side: 3.25, scale: 1},
  {name: 'First bend', station: 32, top: 0, side: -3.2, scale: .85},
  {name: 'Terrace approach', station: 199, top: -2.4, side: 2.8, scale: 1.1},
  {name: 'Ice approach', station: 560, top: 0, side: -2.6, scale: 1},
  {name: 'Foundry exit', station: 1224, top: 8.4, side: 2.6, scale: 1.15},
  {name: 'Roof relay', station: 1798, top: 6, side: -2.4, scale: .95},
  {name: 'Crown approach', station: 1966, top: 6, side: 2.6, scale: 1.1},
].map((v, i) => ({...v, position: routePoint(v.station, v.top + .03, v.side),
  approach: routePoint(v.station - 7, v.top + .15), seed: 101 + i * 17}));
