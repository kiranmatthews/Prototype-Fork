import { streetLine } from './street-line';

export const TRIAL_14 = streetLine(
  14,
  'Read the dock lights, transfer between rails and exit through the swinging bay.',
  -1,
  [
    ['tide', [8, 41, -0.4], -1, 7],
    ['relay', [-9, 99, 0.6], 2, 7],
    ['sweep', [3, 150, 1.4], -4, 10],
  ],
  ['lock', 0, 2, 1, 19, 4.2],
  [2],
);
