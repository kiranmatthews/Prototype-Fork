import { streetLine } from './street-line';

export const TRIAL_19 = streetLine(
  19,
  'Carry speed over two breakaways, open the short bridge and rebound uphill.',
  1,
  [
    ['crumble', [7, 40, -0.4], -2, 7],
    ['switch', [-9, 84, -0.2], 2, 7],
    ['rebound', [-2, 129, 2.4], -3, 7],
    ['spill', [9, 170, 1.2], 3, 6],
  ],
  ['roofs', 0, 3, -1, 21, 3.5],
  [1],
);
