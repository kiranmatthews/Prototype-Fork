import { streetLine } from './street-line';

export const TRIAL_21 = streetLine(
  21,
  'Hip onto the high line, change rails, carve below the patrol and cross the sluice.',
  -1,
  [
    ['hip', [9, 39, 0.6], -3, 7],
    ['relay', [-4, 95, 1.1], 2, 7],
    ['patrol', [-12, 140, 0.2], 4, 8],
    ['bowl', [2, 185, -0.6], -4, 7],
    ['tide', [11, 229, 0.2], 1, 7],
  ],
  ['flyover', 0, 3, 1, 21, 7],
  [2],
);
