import { streetLine } from './street-line';

export const TRIAL_12 = streetLine(
  12,
  'Rebound onto the high apron, catch the crest rail and dive onto a moving dock.',
  1,
  [
    ['rebound', [-6, 43, 2.2], 2, 8],
    ['rail', [10, 96, 2.8], -3, 7],
    ['ferry', [17, 149, 1.9], -2, 8],
  ],
  ['roofs', 1, 3, -1, 18, 4],
);
