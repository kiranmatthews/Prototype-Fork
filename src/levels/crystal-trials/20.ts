import { streetLine } from './street-line';

export const TRIAL_20 = streetLine(
  20,
  'Choose the rail chord, cross two pendulums and kickflip from the inside ledge.',
  -1,
  [
    ['fork', [-8, 42, -0.5], 2, 7],
    ['rail', [6, 95, 0.8], -3, 6],
    ['sweep', [12, 144, 1], -4, 16],
    ['flip', [-6, 186, 1.5], 1, 7],
  ],
  ['yard', 1, 3, 1, 19, 3.8],
  [2],
);
