import { streetLine } from './street-line';

export const TRIAL_15 = streetLine(
  15,
  'Skirt the patrol, open the inside ledge and pop a kickflip over the stair cut.',
  1,
  [
    ['patrol', [-11, 43, -0.3], 3, 9],
    ['switch', [2, 86, 0.4], -3, 7],
    ['stairs', [10, 125, 0.5], 2, 6],
    ['flip', [-5, 165, 1.3], 2, 7],
  ],
  ['arcade', 1, 3, -1, 20, 4.9],
);
