import { streetLine } from './street-line';

export const TRIAL_17 = streetLine(
  17,
  'Drop down the spillway, cut behind the patrol and carry the hip into offset rails.',
  1,
  [
    ['spill', [4, 44, -1.1], 1, 9],
    ['patrol', [6, 91, -0.7], 2, 10],
    ['hip', [-7, 135, -0.4], 2, 8],
    ['relay', [-19, 196, 1.1], -2, 8],
  ],
  ['terraces', 1, 4, 1, 23, 4.1],
  [4],
);
