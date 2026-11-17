import { streetLine } from './street-line';

export const TRIAL_24 = streetLine(
  24,
  'Carve the bowl, dodge the sweep, transfer above the stairwell and flip the last hip.',
  1,
  [
    ['bowl', [-9, 47, -0.9], 4, 7],
    ['sweep', [3, 95, -0.2], -4, 10],
    ['relay', [9, 154, 0.9], -2, 8],
    ['stairs', [7, 202, 0.4], 3, 9],
    ['flip', [-2, 247, 1.3], -2, 8],
  ],
  ['terraces', 1, 4, -1, 22, 4.8],
  [3, 5],
);
