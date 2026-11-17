import { streetLine } from './street-line';

export const TRIAL_01 = streetLine(
  1,
  'Cross a hip onto a bent rail, then cut inside the split plaza.',
  1,
  [
    ['hip', [-7, 40, 0.4], 2, 9],
    ['rail', [5, 89, 1], -2, 8],
    ['fork', [-4, 130, 1.3], 2, 8],
  ],
  ['arcade', 0, 2, -1, 16, 3.2],
);
