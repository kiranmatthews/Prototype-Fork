import { streetLine } from './street-line';

export const TRIAL_06 = streetLine(
  6,
  'Drop past the swing, board the cross-ferry and pop onto the stair rail.',
  -1,
  [
    ['spill', [8, 37, -1.6], 2, 8],
    ['sweep', [1, 85, -0.8], -5, 12],
    ['ferry', [-7, 125, -0.1], 2, 7],
    ['stairs', [6, 165, 0.7], -1, 7],
  ],
  ['lock', 1, 3, 1, 16, 3.8],
);
