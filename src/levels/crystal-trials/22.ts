import { streetLine } from './street-line';

export const TRIAL_22 = streetLine(
  22,
  'Catch the moving dock, clear the lighted sills and thread a cable into the stairs.',
  1,
  [
    ['ferry', [-8, 40, -0.5], 2, 7],
    ['tide', [4, 84, -0.2], -2, 7],
    ['cable', [13, 136, 0.9], 0, 6],
    ['stairs', [-3, 176, 0.4], 2, 6],
  ],
  ['lock', 0, 3, -1, 19, 4.6],
  [3],
);
