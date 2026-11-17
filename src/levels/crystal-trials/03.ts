import { streetLine } from './street-line';

export const TRIAL_03 = streetLine(
  3,
  'Grind down the stair flight, switch rails above the trench and bank out.',
  1,
  [
    ['stairs', [-6, 39, -0.4], 2, 8],
    ['relay', [8, 98, -0.7], -2, 7],
    ['spill', [16, 148, -0.3], -1, 9],
  ],
  ['terraces', 0, 2, -1, 18, 3.3],
);
