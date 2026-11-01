import type {CustomLevelData} from '../level';

// Exact current published editor course, now source-owned so older stock saves
// follow the same complete design as a fresh boot.
export const FLATS_LEVEL:CustomLevelData={
  "v": 1,
  "name": "Flats & Pipes",
  "spawn": [
    0,
    90.1,
    40
  ],
  "killY": 62,
  "components": [
    {
      "t": "platform",
      "p": [
        0,
        89.5,
        -75
      ],
      "edgeGrinding": false,
      "s": [
        84,
        1,
        350
      ],
      "tex": "asphalt"
    },
    {
      "t": "ramp",
      "p": [
        -36,
        90,
        -152
      ],
      "len": 8,
      "rise": 1.2,
      "w": 5,
      "color": "#aab4ba",
      "tex": "pavement"
    },
    {
      "t": "ramp",
      "p": [
        -24,
        90,
        -152
      ],
      "len": 8,
      "rise": 2.4,
      "w": 5,
      "color": "#aab4ba",
      "tex": "pavement"
    },
    {
      "t": "ramp",
      "p": [
        -12,
        90,
        -152
      ],
      "len": 8,
      "rise": 4,
      "w": 5,
      "color": "#aab4ba",
      "tex": "pavement"
    },
    {
      "t": "ramp",
      "p": [
        0,
        90,
        -152
      ],
      "len": 8,
      "rise": 6,
      "w": 5,
      "color": "#aab4ba",
      "tex": "pavement"
    },
    {
      "t": "ramp",
      "p": [
        12,
        90,
        -152
      ],
      "len": 8,
      "rise": 8,
      "w": 5,
      "color": "#aab4ba",
      "tex": "pavement"
    },
    {
      "t": "ramp",
      "p": [
        24,
        90,
        -152
      ],
      "len": 8,
      "rise": 11.2,
      "w": 5,
      "color": "#aab4ba",
      "tex": "pavement"
    },
    {
      "t": "ramp",
      "p": [
        36,
        90,
        -152
      ],
      "len": 8,
      "rise": 15.2,
      "w": 5,
      "color": "#aab4ba",
      "tex": "pavement"
    },
    {
      "t": "platform",
      "p": [
        0,
        89.5,
        -340
      ],
      "edgeGrinding": false,
      "s": [
        130,
        1,
        180
      ],
      "tex": "asphalt"
    },
    {
      "t": "wall",
      "p": [
        -16,
        90,
        0
      ],
      "s": [
        1.2,
        10,
        70
      ],
      "color": "#b89a70",
      "tex": "stone"
    },
    {
      "t": "wall",
      "p": [
        -32,
        90,
        0
      ],
      "s": [
        1.2,
        10,
        70
      ],
      "color": "#b89a70",
      "tex": "stone"
    },
    {
      "t": "wall",
      "p": [
        12,
        90,
        28
      ],
      "s": [
        34,
        10,
        1.2
      ],
      "color": "#b89a70",
      "tex": "stone"
    },
    {
      "t": "wall",
      "p": [
        0,
        90,
        -428
      ],
      "s": [
        130,
        6,
        4
      ],
      "color": "#b89a70",
      "tex": "stone"
    },
    {
      "t": "wall",
      "p": [
        64,
        90,
        -340
      ],
      "s": [
        4,
        6,
        180
      ],
      "color": "#b89a70",
      "tex": "stone"
    },
    {
      "t": "wall",
      "p": [
        -64,
        90,
        -340
      ],
      "s": [
        4,
        6,
        180
      ],
      "color": "#b89a70",
      "tex": "stone"
    },
    {
      "t": "vertramp",
      "p": [
        -9,
        90,
        -285.347
      ],
      "len": 40,
      "yaw": 0,
      "w": 3,
      "rise": 6,
      "vkind": "half"
    },
    {
      "t": "vertramp",
      "p": [
        9,
        90,
        -285.347
      ],
      "len": 40,
      "yaw": 0,
      "w": 3,
      "rise": 6,
      "vkind": "half"
    },
    {
      "t": "vertramp",
      "p": [
        0,
        90,
        -323.347
      ],
      "len": 36,
      "yaw": 90,
      "w": 3,
      "rise": 6,
      "vkind": "half"
    },
    {
      "t": "vertramp",
      "p": [
        0,
        90,
        -341.347
      ],
      "len": 36,
      "yaw": 90,
      "w": 3,
      "rise": 6,
      "vkind": "half"
    },
    {
      "t": "vertramp",
      "p": [
        0,
        89.99999786376952,
        -382
      ],
      "pts": [
        [
          -3,
          8
        ],
        [
          -13,
          8,
          5
        ],
        [
          -13,
          -8,
          5
        ],
        [
          13,
          -8,
          5
        ],
        [
          13,
          8,
          5
        ],
        [
          3,
          8
        ]
      ],
      "w": 0,
      "rise": 23,
      "arc": 60,
      "deck": 2.3,
      "vkind": "quarter",
      "color": "#aab4ba",
      "s": [
        1,
        1,
        1
      ],
      "tex": "pavement"
    },
    {
      "t": "rail",
      "p": [
        5,
        90.9,
        -25
      ],
      "pts": [
        [
          0,
          0,
          0,
          0
        ],
        [
          0,
          -60,
          0,
          0
        ]
      ]
    },
    {
      "t": "rail",
      "p": [
        12,
        90.9,
        -25
      ],
      "pts": [
        [
          0,
          0,
          0,
          0
        ],
        [
          0,
          -70,
          0,
          5.6
        ]
      ]
    },
    {
      "t": "rail",
      "p": [
        -6,
        90.9,
        -25
      ],
      "pts": [
        [
          0,
          0,
          0,
          0
        ],
        [
          0,
          -85,
          0,
          0
        ]
      ]
    },
    {
      "t": "rail",
      "p": [
        -10,
        90.9,
        -40
      ],
      "pts": [
        [
          0,
          0,
          0,
          0
        ],
        [
          0,
          -85,
          0,
          0
        ]
      ]
    },
    {
      "t": "rail",
      "p": [
        -14,
        90.9,
        -55
      ],
      "pts": [
        [
          0,
          0,
          0,
          0
        ],
        [
          0,
          -85,
          0,
          0
        ]
      ]
    },
    {
      "t": "gate",
      "p": [
        36,
        90,
        -420
      ]
    },
    {
      "t": "clock",
      "p": [
        2,
        90,
        35
      ]
    },
    {
      "t": "crate",
      "p": [
        -8,
        90,
        -48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -12,
        90,
        -42
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -8,
        90,
        -60
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -12,
        90,
        -54
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -8,
        90,
        -72
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -12,
        90,
        -66
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -8,
        90,
        -84
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -12,
        90,
        -78
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -8,
        90,
        -96
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -12,
        90,
        -90
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -8,
        90,
        -108
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -12,
        90,
        -102
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -10,
        90,
        -70
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -10,
        90,
        -100
      ],
      "kind": "mask"
    },
    {
      "t": "crate",
      "p": [
        9,
        90,
        -40
      ],
      "kind": "bouncy"
    },
    {
      "t": "crate",
      "p": [
        9,
        94.16,
        -40
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        -2,
        90,
        -60
      ],
      "kind": "bouncy"
    },
    {
      "t": "crate",
      "p": [
        -2,
        94.16,
        -60
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        16,
        90,
        -60
      ],
      "kind": "tnt"
    },
    {
      "t": "crate",
      "p": [
        20,
        90.05,
        -75
      ],
      "kind": "nitro"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90.96,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90.96,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90.96,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90.96,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90.96,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        90.96,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90.96,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90.96,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90.96,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90.96,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90.96,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        90.96,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90.96,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90.96,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90.96,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90.96,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90.96,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        90.96,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90.96,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90.96,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90.96,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90.96,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90.96,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        90.96,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90.96,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90.96,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90.96,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90.96,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90.96,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        90.96,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90.96,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90.96,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90.96,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90.96,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90.96,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        90.96,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        91.92,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        91.92,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        91.92,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        91.92,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        91.92,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        91.92,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        91.92,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        91.92,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        91.92,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        91.92,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        91.92,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        91.92,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        91.92,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        91.92,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        91.92,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        91.92,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        91.92,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        91.92,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        91.92,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        91.92,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        91.92,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        91.92,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        91.92,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        91.92,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        91.92,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        91.92,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        91.92,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        91.92,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        91.92,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        91.92,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        91.92,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        91.92,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        91.92,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        91.92,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        91.92,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        91.92,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        92.88,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        92.88,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        92.88,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        92.88,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        92.88,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        92.88,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        92.88,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        92.88,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        92.88,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        92.88,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        92.88,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        92.88,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        92.88,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        92.88,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        92.88,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        92.88,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        92.88,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        92.88,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        92.88,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        92.88,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        92.88,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        92.88,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        92.88,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        92.88,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        92.88,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        92.88,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        92.88,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        92.88,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        92.88,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        92.88,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        92.88,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        92.88,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        92.88,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        92.88,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        92.88,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        92.88,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        93.84,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        93.84,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        93.84,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        93.84,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        93.84,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        93.84,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        93.84,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        93.84,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        93.84,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        93.84,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        93.84,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        93.84,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        93.84,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        93.84,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        93.84,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        93.84,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        93.84,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        93.84,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        93.84,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        93.84,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        93.84,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        93.84,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        93.84,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        93.84,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        93.84,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        93.84,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        93.84,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        93.84,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        93.84,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        93.84,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        93.84,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        93.84,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        93.84,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        93.84,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        93.84,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        93.84,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        94.8,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        94.8,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        94.8,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        94.8,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        94.8,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        27.6,
        94.8,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        94.8,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        94.8,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        94.8,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        94.8,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        94.8,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        28.56,
        94.8,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        94.8,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        94.8,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        94.8,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        94.8,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        94.8,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        29.52,
        94.8,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        94.8,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        94.8,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        94.8,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        94.8,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        94.8,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        30.48,
        94.8,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        94.8,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        94.8,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        94.8,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        94.8,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        94.8,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        31.44,
        94.8,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        94.8,
        -42.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        94.8,
        -41.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        94.8,
        -40.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        94.8,
        -39.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        94.8,
        -38.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        32.4,
        94.8,
        -37.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -95
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -95.96
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -96.92
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -97.88
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -98.84
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -99.8
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -100.76
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -101.72
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -102.68
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -103.64
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -104.6
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -105.56
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -106.52
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -107.48
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -108.44
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -109.4
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -110.36
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -111.32
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -112.28
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -113.24
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -114.2
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -115.16
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -116.12
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        24,
        90,
        -117.08
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        20,
        90,
        -95
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        20,
        90,
        -95.96
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        20,
        90,
        -96.92
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        20,
        90,
        -97.88
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        20,
        90,
        -98.84
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        20,
        90,
        -99.8
      ],
      "kind": "nitro"
    },
    {
      "t": "crate",
      "p": [
        20,
        90,
        -100.76
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        20,
        90,
        -101.72
      ],
      "kind": "tnt"
    },
    {
      "t": "crate",
      "p": [
        16,
        90,
        -100
      ],
      "kind": "metalbounce"
    },
    {
      "t": "crate",
      "p": [
        16,
        90.96,
        -100
      ],
      "kind": "wood"
    },
    {
      "t": "crate",
      "p": [
        16,
        91.92,
        -100
      ],
      "kind": "metal"
    },
    {
      "t": "enemy",
      "p": [
        35,
        90,
        -295.347
      ],
      "range": 9,
      "speed": 4
    },
    {
      "t": "enemy",
      "p": [
        -35,
        90,
        -315.347
      ],
      "range": 9,
      "speed": 3.5,
      "foe": "floater"
    },
    {
      "t": "enemy",
      "p": [
        38,
        90,
        -357
      ],
      "range": 0,
      "speed": 0,
      "foe": "spinner"
    },
    {
      "t": "wumpa",
      "p": [
        -9,
        90.4,
        -271.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -9,
        90.4,
        -278.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -9,
        90.4,
        -285.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -9,
        90.4,
        -292.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -9,
        90.4,
        -299.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        9,
        90.4,
        -271.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        9,
        90.4,
        -278.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        9,
        90.4,
        -285.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        9,
        90.4,
        -292.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        9,
        90.4,
        -299.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -14,
        90.4,
        -323.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -7,
        90.4,
        -323.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        0,
        90.4,
        -323.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        7,
        90.4,
        -323.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        14,
        90.4,
        -323.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -14,
        90.4,
        -341.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -7,
        90.4,
        -341.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        0,
        90.4,
        -341.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        7,
        90.4,
        -341.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        14,
        90.4,
        -341.347
      ]
    },
    {
      "t": "wumpa",
      "p": [
        7,
        90.4,
        -397
      ]
    },
    {
      "t": "wumpa",
      "p": [
        4.95,
        90.4,
        -393.82
      ]
    },
    {
      "t": "wumpa",
      "p": [
        0,
        90.4,
        -392.5
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -4.95,
        90.4,
        -393.82
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -7,
        90.4,
        -397
      ]
    },
    {
      "t": "wumpa",
      "p": [
        -4.95,
        90.4,
        -400.18
      ]
    },
    {
      "t": "wumpa",
      "p": [
        0,
        90.4,
        -401.5
      ]
    },
    {
      "t": "wumpa",
      "p": [
        4.95,
        90.4,
        -400.18
      ]
    },
    {
      "t": "crystal",
      "p": [
        0,
        98.31,
        -285.347
      ]
    },
    {
      "t": "checkpoint",
      "p": [
        0,
        90,
        -136
      ],
      "nm": "Rail garden bank"
    },
    {
      "t": "checkpoint",
      "p": [
        22,
        90,
        -270
      ],
      "nm": "Pipe yard arrival bank"
    }
  ],
  "groups": [],
  "sky": "day"
};
