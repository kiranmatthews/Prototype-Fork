import { streetLine } from './street-line';

export const TRIAL_23 = streetLine(
  23,
  'Open the crate bridge, carve the falling tongue, then take the rail to a rebound.',
  -1,
  [
    ['switch', [9, 43, 0.4], -1, 7],
    ['crumble', [-4, 87, 0.6], 2, 7],
    ['rail', [-12, 137, 1.2], 3, 6],
    ['catch', [-16, 188, 3.2], -1, 9],
  ],
  ['arcade', 1, 4, 1, 23, 5.6],
  [2],
);
