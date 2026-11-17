import { streetLine } from './street-line';

export const TRIAL_18 = streetLine(
  18,
  'Grind the curved parapet, land in the bowl, then clear the moving quay and hip.',
  -1,
  [
    ['rail', [-10, 53, 0.8], 3, 7],
    ['bowl', [4, 99, -0.4], -4, 7],
    ['ferry', [12, 142, 0.2], 2, 7],
    ['flip', [-3, 185, 1.2], 1, 7],
  ],
  ['flyover', 1, 3, 1, 18, 6.7],
);
