import { streetLine } from './street-line';

export const TRIAL_16 = streetLine(
  16,
  'Cross the bowl diagonally, take the ferry and spring onto the cable terrace.',
  -1,
  [
    ['bowl', [-8, 48, -0.8], 4, 7],
    ['ferry', [6, 90, -0.3], -2, 7],
    ['rebound', [12, 131, 2], -2, 7],
    ['cable', [-4, 186, 2.4], 0, 7],
  ],
  ['reservoir', 0, 3, 1, 22, 4.7],
  [2],
);
