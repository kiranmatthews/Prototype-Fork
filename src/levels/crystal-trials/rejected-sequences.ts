import { skateSequence } from './skate-sequence';
import type { RejectedCrystalTrial } from './types';

/** The previous aligned, concatenated lines remain available in the archive. */
export const REJECTED_SEQUENCES: RejectedCrystalTrial[] = [
  skateSequence(1, 'Banks and rail', 'Bank air → long grind → raised roof gap.', [
    1,
    { kind: 3, entry: 'air' },
    2,
  ]),
  skateSequence(2, 'Bank, rope and moving roof', 'Bank air → rope grind → moving roof → gap.', [
    2,
    { kind: 6, entry: 'air' },
    4,
  ]),
  skateSequence(3, 'Long rail and transfers', 'Long balance → two rail transfers → bank air.', [3, 11, 1]),
  skateSequence(4, 'Moving roof, enemies and rail', 'Moving roof gaps → enemy carve → bank-to-rail air.', [
    4,
    9,
    { kind: 3, entry: 'air' },
  ]),
  skateSequence(5, 'Rails and halfpipe', 'Bank-to-rail air → transfers → high vert crystal.', [
    1,
    { kind: 11, entry: 'air' },
    5,
  ]),
  skateSequence(6, 'Rope, bounce row and rail', 'Rope air → spring and bounce row → high grind → roof gap.', [
    6,
    12,
    { kind: 3, entry: 'spring' },
    2,
  ]),
  skateSequence(
    7,
    'Timed roof and rail transfers',
    'Timed roof gap → rail transfers → enemy carve and bank.',
    [7, 11, 9],
  ),
  skateSequence(
    8,
    'Switch roof, ropes and Nitro',
    'Switch grind → roof gap → rope transfer → Nitro-framed air.',
    [8, 13, 16],
  ),
  skateSequence(
    9,
    'Enemies, moving roof and gate',
    'Enemy carve → moving roof gaps → grind and kickflip gate.',
    [9, 4, 21],
  ),
  skateSequence(
    10,
    'Bridge, rail and bounce row',
    'Bridge airs → rail catch → enemy carve → spring and bounce row.',
    [10, { kind: 17, entry: 'air' }, 12],
  ),
  skateSequence(
    11,
    'Transfers, switch and Nitro',
    'Rail transfers → switch roof → high grind → Nitro gap.',
    [11, 23, 16],
  ),
  skateSequence(
    12,
    'Bounce row, moving rail and gate',
    'Spring and bounce row → moving high rail → kickflip gap.',
    [12, { kind: 18, entry: 'spring' }, 21],
  ),
  skateSequence(
    13,
    'Ropes, rails and moving roof',
    'Rope transfer → two rail transfers → moving roof gaps.',
    [13, 11, 4],
  ),
  skateSequence(
    14,
    'Timed roofs and high rail',
    'Timed roof gaps → moving grind → switch roof and high rail.',
    [14, 18, 23],
  ),
  skateSequence(
    15,
    'TNT, switches and trick gate',
    'TNT-framed switch grind → enemy carve → rail catch and kickflip.',
    [15, 9, { kind: 21, entry: 'air' }],
  ),
  skateSequence(
    16,
    'Nitro, bounce row and transfers',
    'Nitro gap → spring and bounce row → high rail transfers.',
    [16, 12, { kind: 11, entry: 'spring' }],
  ),
  skateSequence(
    17,
    'Rails, ropes and bridge gaps',
    'Grind and enemy carve → rope transfer → bridge airs → roof gap.',
    [17, 13, 10, 2],
  ),
  skateSequence(
    18,
    'Moving decks and trick gate',
    'Moving grind → moving roof gaps → rail transfers → kickflip.',
    [18, 4, 11, 21],
  ),
  skateSequence(
    19,
    'Crumbling roofs and bounce row',
    'Crumbling gaps → switch roof → high grind → spring and bounce row.',
    [19, 23, 12],
  ),
  skateSequence(
    20,
    'Switches, ropes and trick gate',
    'Two switch grinds → rope transfer → Nitro air → rail and kickflip.',
    [20, 13, 16, { kind: 21, entry: 'air' }],
  ),
  skateSequence(
    21,
    'Trick gates and rail transfers',
    'Kickflip to rail → transfers → enemy carve → switch bank and high grind.',
    [21, { kind: 11, entry: 'air' }, 9, { kind: 23, entry: 'air' }],
  ),
  skateSequence(
    22,
    'Timed roof and bounce-to-rail',
    'Rope and timed gap → bounce-to-rail → enemy carve → bridge airs.',
    [22, 12, { kind: 17, entry: 'spring' }, 10],
  ),
  skateSequence(
    23,
    'Switch bank, ropes and Nitro',
    'Switch roof and high grind → moving rail → rope transfer → Nitro gap.',
    [23, 18, 13, 16],
  ),
  skateSequence(
    24,
    'Transfers, crumble and trick gate',
    'Rail transfers and carve → crumbling gaps → bounce-to-rail → kickflip.',
    [24, 19, 12, { kind: 21, entry: 'spring' }],
  ),
  skateSequence(
    25,
    'Switches, rails and bounce chain',
    'Switch and Nitro kickflip → timed gap → rope transfer → enemy carve → high grind → bounce row.',
    [25, 13, 17, { kind: 23, entry: 'air' }, 12],
  ),
].map((trial) => ({
  ...trial,
  attempt: `${String(trial.id).padStart(2, '0')}-l`,
  reason: 'Earlier centred sequence of short skating studies.',
}));
