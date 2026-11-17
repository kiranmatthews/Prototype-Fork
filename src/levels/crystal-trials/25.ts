import { streetLine } from './street-line';

export const TRIAL_25 = streetLine(
  25,
  'Link a switch shortcut, pulsing dock, cable transfer, two spring beds and a kickflip.',
  -1,
  [
    ['switch', [8, 42, 0.3], -2, 7],
    ['tide', [-5, 85, -0.1], 2, 7],
    ['cable', [-9, 140, 0.6], 0, 7],
    ['relay', [2, 202, 1.2], -3, 8],
    ['doubleCatch', [15, 246, 3.3], 0, 11],
    ['flip', [13, 292, 3.6], -2, 8],
  ],
  ['flyover', 1, 5, 1, 24, 7.9],
  [3, 6],
);
