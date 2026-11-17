import { streetLine } from './street-line';

export const TRIAL_11 = streetLine(
  11,
  'Transfer between offset rails, cut inside the switch and clear the stairwell.',
  -1,
  [
    ['relay', [5, 62, 1.2], -2, 8],
    ['switch', [-5, 115, 1.5], 5, 9],
    ['stairs', [-13, 143, 0.4], -3, 6],
  ],
  ['yard', 0, 2, 1, 19, 3.1],
  [3],
);
