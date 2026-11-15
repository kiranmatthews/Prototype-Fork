import type { RejectedCrystalTrial } from './types';

/** Measured skating sections retained as playable short studies. */
export const REJECTED_SKATING: RejectedCrystalTrial[] = [
  {
    "id": 1,
    "name": "1 / Bank, gap and landing",
    "brief": "Bank → airborne crystal → long landing.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -186
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "1 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -60
        ],
        "s": [
          104,
          1,
          300
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "1 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "1 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "1 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "1 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "ramp",
        "nm": "1 / Launch bank",
        "p": [
          0,
          0,
          -18
        ],
        "len": 16,
        "rise": 2,
        "w": 18
      },
      {
        "t": "platform",
        "nm": "1 / Rolling landing",
        "p": [
          0,
          -0.5,
          -72
        ],
        "s": [
          24,
          1,
          76
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "1 / Bank, gap and landing",
        "p": [
          0,
          2.8,
          -32
        ]
      },
      {
        "t": "ramp",
        "nm": "1 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -134
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "01-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 2,
    "name": "2 / Bank and roof gap",
    "brief": "Long approach → bank → roof gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -192
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "2 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -63
        ],
        "s": [
          104,
          1,
          306
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "2 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "2 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "2 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "2 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "ramp",
        "nm": "2 / Roof launch",
        "p": [
          0,
          0,
          -17
        ],
        "len": 22,
        "rise": 3,
        "w": 18
      },
      {
        "t": "platform",
        "nm": "2 / Roof landing",
        "p": [
          0,
          -0.5,
          -78
        ],
        "s": [
          24,
          1,
          76
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "2 / Bank and roof gap",
        "p": [
          0,
          3.6,
          -37
        ]
      },
      {
        "t": "ramp",
        "nm": "2 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -140
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "02-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 3,
    "name": "3 / Long rail over a pit",
    "brief": "Fast rail catch → long balance → rolling exit.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -216
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "3 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -75
        ],
        "s": [
          104,
          1,
          330
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "3 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "3 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "3 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "3 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "3 / Long rail",
        "p": [
          0,
          1.2,
          -51
        ],
        "len": 86
      },
      {
        "t": "pit",
        "nm": "3 / Rail death pit",
        "p": [
          0,
          -6,
          -55
        ],
        "s": [
          26,
          1,
          66
        ],
        "color": "#192e42"
      },
      {
        "t": "platform",
        "nm": "3 / Rail runout",
        "p": [
          0,
          -0.5,
          -114
        ],
        "s": [
          24,
          1,
          52
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "3 / Long rail over a pit",
        "p": [
          0,
          3.1,
          -94
        ]
      },
      {
        "t": "ramp",
        "nm": "3 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -164
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "03-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 4,
    "name": "4 / Moving deck and roof gap",
    "brief": "Bank → broad moving deck → ollie to roof.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -208
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "4 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -71
        ],
        "s": [
          104,
          1,
          322
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "4 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "4 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "4 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "4 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "ramp",
        "nm": "4 / Moving deck approach",
        "p": [
          0,
          0,
          -18
        ],
        "len": 16,
        "rise": 2,
        "w": 18
      },
      {
        "t": "mover",
        "nm": "4 / Broad moving deck",
        "p": [
          0,
          0,
          -47
        ],
        "s": [
          22,
          0.8,
          32
        ],
        "axis": "x",
        "amp": 3,
        "speed": 0.45
      },
      {
        "t": "platform",
        "nm": "4 / Roof runout",
        "p": [
          0,
          -0.5,
          -101
        ],
        "s": [
          24,
          1,
          62
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "4 / Moving deck and roof gap",
        "p": [
          0,
          1.6,
          -67
        ]
      },
      {
        "t": "ramp",
        "nm": "4 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -156
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "04-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 5,
    "name": "5 / Halfpipe and high crystal",
    "brief": "Wide halfpipe → high vert air → rolling exit.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -214
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "5 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -74
        ],
        "s": [
          104,
          1,
          328
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "5 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "5 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "5 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "5 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "5 / Open halfpipe entry",
        "p": [
          0,
          -0.5,
          -25
        ],
        "s": [
          24,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "vertramp",
        "nm": "5 / Wide pumping halfpipe",
        "p": [
          0,
          0,
          -54
        ],
        "vkind": "half",
        "w": 7,
        "rise": 4,
        "len": 48,
        "arc": 90,
        "arcSteps": 24,
        "deck": 4,
        "skateCamera": true
      },
      {
        "t": "crystal",
        "nm": "5 / Halfpipe and high crystal",
        "p": [
          11,
          10.5,
          -54
        ]
      },
      {
        "t": "platform",
        "nm": "5 / Halfpipe runout",
        "p": [
          0,
          -0.5,
          -108
        ],
        "s": [
          24,
          1,
          60
        ],
        "color": "#789496"
      },
      {
        "t": "ramp",
        "nm": "5 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -162
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "05-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 6,
    "name": "6 / Grind rope and landing",
    "brief": "Sagging grind rope → high crystal → wide runout.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -214
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "6 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -74
        ],
        "s": [
          104,
          1,
          328
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "6 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "6 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "6 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "6 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rope",
        "nm": "6 / Long grind rope",
        "p": [
          0,
          2,
          -49
        ],
        "len": 82,
        "amp": 0.8,
        "shake": 6
      },
      {
        "t": "platform",
        "nm": "6 / Rope landing",
        "p": [
          0,
          -0.5,
          -111
        ],
        "s": [
          24,
          1,
          54
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "6 / Grind rope and landing",
        "p": [
          0,
          2.4,
          -90
        ]
      },
      {
        "t": "ramp",
        "nm": "6 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -162
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "06-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 7,
    "name": "7 / Timed deck and ollie gap",
    "brief": "Long timed deck → ollie gap → rolling landing.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -208
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "7 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -71
        ],
        "s": [
          104,
          1,
          322
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "7 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "7 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "7 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "7 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "phasepad",
        "nm": "7 / Timed runway",
        "p": [
          0,
          0,
          -40
        ],
        "s": [
          24,
          0.8,
          44
        ],
        "cycle": 9,
        "amp": 0.8,
        "phase": 0
      },
      {
        "t": "platform",
        "nm": "7 / Gap landing",
        "p": [
          0,
          -0.5,
          -101
        ],
        "s": [
          24,
          1,
          62
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "7 / Timed deck and ollie gap",
        "p": [
          0,
          1.6,
          -66
        ]
      },
      {
        "t": "ramp",
        "nm": "7 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -156
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "07-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 8,
    "name": "8 / Switch rail and revealed roof",
    "brief": "Grind switch → revealed roof → ollie gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -254
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "8 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -94
        ],
        "s": [
          104,
          1,
          368
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "8 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "8 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "8 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "8 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "8 / Switch rail",
        "p": [
          0,
          1.2,
          -42
        ],
        "len": 68
      },
      {
        "t": "crate",
        "nm": "8 / Grind-through switch",
        "p": [
          0,
          1.2,
          -44
        ],
        "kind": "bang",
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "8 / Revealed roof runway",
        "p": [
          0,
          -0.5,
          -90
        ],
        "s": [
          24,
          1,
          40
        ],
        "tex": "solid",
        "color": "#a8b9a0",
        "solidSides": true,
        "vertices": [
          -0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5
        ],
        "indices": [
          3,
          7,
          6,
          3,
          6,
          2,
          0,
          3,
          2,
          0,
          2,
          1,
          4,
          5,
          6,
          4,
          6,
          7,
          0,
          4,
          7,
          0,
          7,
          3,
          1,
          2,
          6,
          1,
          6,
          5,
          0,
          1,
          5,
          0,
          5,
          4
        ],
        "grindTopTriangles": 2,
        "outline": true,
        "grp": 2
      },
      {
        "t": "platform",
        "nm": "8 / Gap landing",
        "p": [
          0,
          -0.5,
          -148
        ],
        "s": [
          24,
          1,
          60
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "8 / Switch rail and revealed roof",
        "p": [
          0,
          1.6,
          -114
        ]
      },
      {
        "t": "ramp",
        "nm": "8 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -202
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "08-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 9,
    "name": "9 / Enemy carve and bank gap",
    "brief": "Wide enemy slalom → bank → roof gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -256
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "9 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -95
        ],
        "s": [
          104,
          1,
          370
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "9 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "9 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "9 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "9 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "9 / Wide carving deck",
        "p": [
          0,
          -0.5,
          -57
        ],
        "s": [
          28,
          1,
          74
        ],
        "color": "#789496"
      },
      {
        "t": "enemy",
        "nm": "9 / First visible blade",
        "foe": "spinner",
        "p": [
          0,
          0,
          -36
        ],
        "range": 0,
        "speed": 0
      },
      {
        "t": "enemy",
        "nm": "9 / Offset visible blade",
        "foe": "spinner",
        "p": [
          5,
          0,
          -64
        ],
        "range": 0,
        "speed": 0
      },
      {
        "t": "ramp",
        "nm": "9 / Carve exit bank",
        "p": [
          0,
          0,
          -98
        ],
        "len": 16,
        "rise": 2,
        "w": 18
      },
      {
        "t": "platform",
        "nm": "9 / Roof landing",
        "p": [
          0,
          -0.5,
          -148
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "9 / Enemy carve and bank gap",
        "p": [
          0,
          2.8,
          -112
        ]
      },
      {
        "t": "ramp",
        "nm": "9 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -204
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "09-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 10,
    "name": "10 / Banks and narrow bridge",
    "brief": "Bank → narrow bridge → bank → roof gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -248
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "10 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -91
        ],
        "s": [
          104,
          1,
          362
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "10 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "10 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "10 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "10 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "ramp",
        "nm": "10 / Bridge launch",
        "p": [
          0,
          0,
          -18
        ],
        "len": 16,
        "rise": 2,
        "w": 18
      },
      {
        "t": "woodpath",
        "nm": "10 / Narrow skating bridge",
        "p": [
          0,
          0,
          -34
        ],
        "pts": [
          [
            0,
            0
          ],
          [
            0,
            -52
          ]
        ],
        "w": 8,
        "scaffold": true,
        "rails": false
      },
      {
        "t": "ramp",
        "nm": "10 / Roof launch",
        "p": [
          0,
          0,
          -90
        ],
        "len": 16,
        "rise": 2,
        "w": 8
      },
      {
        "t": "platform",
        "nm": "10 / Roof runout",
        "p": [
          0,
          -0.5,
          -140
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "10 / Banks and narrow bridge",
        "p": [
          0,
          2.8,
          -104
        ]
      },
      {
        "t": "ramp",
        "nm": "10 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -196
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "10-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 11,
    "name": "11 / Three offset rails",
    "brief": "Three rail transfers → crystal → long runout.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -284
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "11 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -109
        ],
        "s": [
          104,
          1,
          398
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "11 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "11 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "11 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "11 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "11 / Entry rail",
        "p": [
          0,
          1.2,
          -33
        ],
        "len": 50
      },
      {
        "t": "rail",
        "nm": "11 / Right transfer rail",
        "p": [
          4.5,
          1.2,
          -77
        ],
        "len": 62
      },
      {
        "t": "rail",
        "nm": "11 / Left transfer rail",
        "p": [
          0,
          1.2,
          -125
        ],
        "len": 58
      },
      {
        "t": "pit",
        "nm": "11 / Transfer death pit",
        "p": [
          0,
          -6,
          -85
        ],
        "s": [
          26,
          1,
          126
        ],
        "color": "#192e42"
      },
      {
        "t": "platform",
        "nm": "11 / Rail landing",
        "p": [
          0,
          -0.5,
          -178
        ],
        "s": [
          24,
          1,
          60
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "11 / Three offset rails",
        "p": [
          0,
          3.1,
          -154
        ]
      },
      {
        "t": "ramp",
        "nm": "11 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -232
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "11-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 12,
    "name": "12 / Trampoline and airborne bounce crates",
    "brief": "Rolling spring → airborne bounce row → roof.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -292
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "12 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -113
        ],
        "s": [
          104,
          1,
          406
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "12 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "12 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "12 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "12 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "12 / Spring approach",
        "p": [
          0,
          -0.5,
          -23
        ],
        "s": [
          24,
          1,
          6
        ],
        "color": "#789496"
      },
      {
        "t": "trampoline",
        "nm": "12 / Rolling spring",
        "p": [
          0,
          0.05,
          -36
        ],
        "s": [
          18,
          0.4,
          20
        ],
        "speed": 22,
        "amp": 1.25
      },
      {
        "t": "crate",
        "nm": "12 / Airborne bounce row",
        "kind": "metalbounce",
        "p": [
          -1.92,
          7,
          -67
        ]
      },
      {
        "t": "crate",
        "nm": "12 / Airborne bounce row",
        "kind": "metalbounce",
        "p": [
          -0.96,
          7,
          -67
        ]
      },
      {
        "t": "crate",
        "nm": "12 / Airborne bounce row",
        "kind": "metalbounce",
        "p": [
          0,
          7,
          -67
        ]
      },
      {
        "t": "crate",
        "nm": "12 / Airborne bounce row",
        "kind": "metalbounce",
        "p": [
          0.96,
          7,
          -67
        ]
      },
      {
        "t": "crate",
        "nm": "12 / Airborne bounce row",
        "kind": "metalbounce",
        "p": [
          1.92,
          7,
          -67
        ]
      },
      {
        "t": "platform",
        "nm": "12 / Long high landing",
        "p": [
          0,
          6.5,
          -113
        ],
        "s": [
          24,
          1,
          34
        ],
        "color": "#789496"
      },
      {
        "t": "ramp",
        "nm": "12 / High roof descent",
        "p": [
          0,
          0,
          -154
        ],
        "len": 48,
        "rise": 7,
        "w": 24,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "12 / Lower runout",
        "p": [
          0,
          -0.5,
          -197
        ],
        "s": [
          24,
          1,
          38
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "12 / Trampoline and airborne bounce crates",
        "p": [
          0,
          11,
          -90
        ]
      },
      {
        "t": "ramp",
        "nm": "12 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -240
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "12-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 13,
    "name": "13 / Two offset grind ropes",
    "brief": "Bank → rope grind → lateral transfer → rope air.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -242
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "13 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -88
        ],
        "s": [
          104,
          1,
          356
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "13 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "13 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "13 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "13 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "ramp",
        "nm": "13 / Rope entry bank",
        "p": [
          0,
          0,
          -3
        ],
        "len": 22,
        "rise": 2,
        "w": 18
      },
      {
        "t": "rope",
        "nm": "13 / Entry rope",
        "p": [
          0,
          4,
          -33
        ],
        "len": 50,
        "amp": 0.6,
        "shake": 6
      },
      {
        "t": "rope",
        "nm": "13 / Transfer rope",
        "p": [
          3.5,
          4,
          -77
        ],
        "len": 62,
        "amp": 0.6,
        "shake": 6
      },
      {
        "t": "platform",
        "nm": "13 / Rope runout",
        "p": [
          0,
          -0.5,
          -134
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "13 / Two offset grind ropes",
        "p": [
          3.5,
          4.1,
          -108
        ]
      },
      {
        "t": "ramp",
        "nm": "13 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -190
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "13-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 14,
    "name": "14 / Two timed roofs and gaps",
    "brief": "Timed roof → ollie → timed roof → crystal gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -254
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "14 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -94
        ],
        "s": [
          104,
          1,
          368
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "14 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "14 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "14 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "14 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "phasepad",
        "nm": "14 / First timed roof",
        "p": [
          0,
          0,
          -40
        ],
        "s": [
          24,
          0.8,
          44
        ],
        "cycle": 10,
        "amp": 0.85,
        "phase": 0
      },
      {
        "t": "phasepad",
        "nm": "14 / Second timed roof",
        "p": [
          0,
          0,
          -88
        ],
        "s": [
          24,
          0.8,
          36
        ],
        "cycle": 10,
        "amp": 0.85,
        "phase": 0.85
      },
      {
        "t": "platform",
        "nm": "14 / Roof runout",
        "p": [
          0,
          -0.5,
          -146
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "14 / Two timed roofs and gaps",
        "p": [
          0,
          1.6,
          -110
        ]
      },
      {
        "t": "ramp",
        "nm": "14 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -202
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "14-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 15,
    "name": "15 / TNT frames, switch rail and roof",
    "brief": "TNT-framed rail → switch → revealed roof gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -258
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "15 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -96
        ],
        "s": [
          104,
          1,
          372
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "15 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "15 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "15 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "15 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "15 / Switch rail",
        "p": [
          0,
          1.2,
          -42
        ],
        "len": 68
      },
      {
        "t": "crate",
        "nm": "15 / TNT outside the grind line",
        "p": [
          -5,
          0,
          -32
        ],
        "kind": "tnt"
      },
      {
        "t": "crate",
        "nm": "15 / TNT outside the grind line",
        "p": [
          -5,
          0,
          -48
        ],
        "kind": "tnt"
      },
      {
        "t": "crate",
        "nm": "15 / TNT outside the grind line",
        "p": [
          5,
          0,
          -32
        ],
        "kind": "tnt"
      },
      {
        "t": "crate",
        "nm": "15 / TNT outside the grind line",
        "p": [
          5,
          0,
          -48
        ],
        "kind": "tnt"
      },
      {
        "t": "crate",
        "nm": "15 / Grind-through switch",
        "p": [
          0,
          1.2,
          -52
        ],
        "kind": "bang",
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "15 / Revealed roof",
        "p": [
          0,
          -0.5,
          -90
        ],
        "s": [
          24,
          1,
          40
        ],
        "tex": "solid",
        "color": "#a8b9a0",
        "solidSides": true,
        "vertices": [
          -0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5
        ],
        "indices": [
          3,
          7,
          6,
          3,
          6,
          2,
          0,
          3,
          2,
          0,
          2,
          1,
          4,
          5,
          6,
          4,
          6,
          7,
          0,
          4,
          7,
          0,
          7,
          3,
          1,
          2,
          6,
          1,
          6,
          5,
          0,
          1,
          5,
          0,
          5,
          4
        ],
        "grindTopTriangles": 2,
        "outline": true,
        "grp": 2
      },
      {
        "t": "platform",
        "nm": "15 / Roof landing",
        "p": [
          0,
          -0.5,
          -150
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "15 / TNT frames, switch rail and roof",
        "p": [
          0,
          1.6,
          -114
        ]
      },
      {
        "t": "ramp",
        "nm": "15 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -206
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "15-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 16,
    "name": "16 / Nitro frames and bank gap",
    "brief": "Nitro-framed approach → bank → long landing.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -194
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "16 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -64
        ],
        "s": [
          104,
          1,
          308
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "16 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "16 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "16 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "16 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "crate",
        "nm": "16 / Nitro outside the clear lane",
        "p": [
          -6,
          0,
          -9
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "16 / Nitro outside the clear lane",
        "p": [
          -6,
          0,
          -14
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "16 / Nitro outside the clear lane",
        "p": [
          -6,
          0,
          -19
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "16 / Nitro outside the clear lane",
        "p": [
          6,
          0,
          -9
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "16 / Nitro outside the clear lane",
        "p": [
          6,
          0,
          -14
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "16 / Nitro outside the clear lane",
        "p": [
          6,
          0,
          -19
        ],
        "kind": "nitro"
      },
      {
        "t": "ramp",
        "nm": "16 / Framed launch",
        "p": [
          0,
          0,
          -19
        ],
        "len": 22,
        "rise": 3,
        "w": 10
      },
      {
        "t": "pit",
        "nm": "16 / Designated gap pit",
        "p": [
          0,
          -6,
          -36
        ],
        "s": [
          18,
          1,
          12
        ],
        "color": "#192e42"
      },
      {
        "t": "platform",
        "nm": "16 / Broad clear landing",
        "p": [
          0,
          -0.5,
          -80
        ],
        "s": [
          24,
          1,
          76
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "16 / Nitro frames and bank gap",
        "p": [
          0,
          3.6,
          -37
        ]
      },
      {
        "t": "ramp",
        "nm": "16 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -142
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "16-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 17,
    "name": "17 / Rail, enemy carve and bank",
    "brief": "Long rail → wide enemy carve → bank air.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -288
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "17 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -111
        ],
        "s": [
          104,
          1,
          402
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "17 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "17 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "17 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "17 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "17 / Entry rail",
        "p": [
          0,
          1.2,
          -42
        ],
        "len": 68
      },
      {
        "t": "pit",
        "nm": "17 / Rail pit",
        "p": [
          0,
          -6,
          -46
        ],
        "s": [
          26,
          1,
          48
        ],
        "color": "#192e42"
      },
      {
        "t": "platform",
        "nm": "17 / Enemy carving deck",
        "p": [
          0,
          -0.5,
          -98
        ],
        "s": [
          28,
          1,
          56
        ],
        "color": "#789496"
      },
      {
        "t": "enemy",
        "nm": "17 / Visible blade on the deck",
        "foe": "spinner",
        "p": [
          0,
          0,
          -100
        ],
        "range": 0,
        "speed": 0
      },
      {
        "t": "ramp",
        "nm": "17 / Exit bank",
        "p": [
          0,
          0,
          -130
        ],
        "len": 16,
        "rise": 2,
        "w": 18
      },
      {
        "t": "platform",
        "nm": "17 / Clear landing",
        "p": [
          0,
          -0.5,
          -180
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "17 / Rail, enemy carve and bank",
        "p": [
          0,
          2.8,
          -144
        ]
      },
      {
        "t": "ramp",
        "nm": "17 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -236
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "17-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 18,
    "name": "18 / Moving rail and roof",
    "brief": "Lateral moving rail → rolling roof landing.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -226
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "18 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -80
        ],
        "s": [
          104,
          1,
          340
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "18 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "18 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "18 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "18 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "18 / Moving rail",
        "p": [
          0,
          1.2,
          -51
        ],
        "len": 86,
        "amp": 0.6,
        "axis": "y",
        "speed": 0.45
      },
      {
        "t": "platform",
        "nm": "18 / Broad moving-rail receiver",
        "p": [
          0,
          -0.5,
          -119
        ],
        "s": [
          24,
          1,
          62
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "18 / Moving rail and roof",
        "p": [
          0,
          2.8,
          -94
        ]
      },
      {
        "t": "ramp",
        "nm": "18 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -174
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "18-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 19,
    "name": "19 / Crumbling roofs and gaps",
    "brief": "Long crumble deck → ollie → crumble deck → gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -254
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "19 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -94
        ],
        "s": [
          104,
          1,
          368
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "19 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "19 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "19 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "19 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "crumble",
        "nm": "19 / First long crumble roof",
        "p": [
          0,
          0,
          -40
        ],
        "s": [
          24,
          0.8,
          44
        ],
        "shake": 3
      },
      {
        "t": "crumble",
        "nm": "19 / Second long crumble roof",
        "p": [
          0,
          0,
          -88
        ],
        "s": [
          24,
          0.8,
          36
        ],
        "shake": 2.8
      },
      {
        "t": "platform",
        "nm": "19 / Roof runout",
        "p": [
          0,
          -0.5,
          -146
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "19 / Crumbling roofs and gaps",
        "p": [
          0,
          1.4,
          -110
        ]
      },
      {
        "t": "ramp",
        "nm": "19 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -202
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "19-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 20,
    "name": "20 / Two switch rails and roof",
    "brief": "Two switch grinds → two revealed roofs → gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -328
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "20 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -131
        ],
        "s": [
          104,
          1,
          442
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "20 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "20 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "20 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "20 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "20 / First switch rail",
        "p": [
          0,
          1.2,
          -35
        ],
        "len": 54
      },
      {
        "t": "crate",
        "nm": "20 / First switch",
        "p": [
          0,
          1.2,
          -42
        ],
        "kind": "bang",
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "20 / First revealed deck",
        "p": [
          0,
          -0.5,
          -78
        ],
        "s": [
          24,
          1,
          44
        ],
        "tex": "solid",
        "color": "#a8b9a0",
        "solidSides": true,
        "vertices": [
          -0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5
        ],
        "indices": [
          3,
          7,
          6,
          3,
          6,
          2,
          0,
          3,
          2,
          0,
          2,
          1,
          4,
          5,
          6,
          4,
          6,
          7,
          0,
          4,
          7,
          0,
          7,
          3,
          1,
          2,
          6,
          1,
          6,
          5,
          0,
          1,
          5,
          0,
          5,
          4
        ],
        "grindTopTriangles": 2,
        "outline": true,
        "grp": 2
      },
      {
        "t": "rail",
        "nm": "20 / Second switch rail",
        "p": [
          0,
          1.2,
          -114
        ],
        "len": 60
      },
      {
        "t": "crate",
        "nm": "20 / Second switch",
        "p": [
          0,
          1.2,
          -118
        ],
        "kind": "bang",
        "grp": 3
      },
      {
        "t": "mesh",
        "nm": "20 / Second revealed roof",
        "p": [
          0,
          -0.5,
          -161
        ],
        "s": [
          24,
          1,
          46
        ],
        "tex": "solid",
        "color": "#a8b9a0",
        "solidSides": true,
        "vertices": [
          -0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5
        ],
        "indices": [
          3,
          7,
          6,
          3,
          6,
          2,
          0,
          3,
          2,
          0,
          2,
          1,
          4,
          5,
          6,
          4,
          6,
          7,
          0,
          4,
          7,
          0,
          7,
          3,
          1,
          2,
          6,
          1,
          6,
          5,
          0,
          1,
          5,
          0,
          5,
          4
        ],
        "grindTopTriangles": 2,
        "outline": true,
        "grp": 3
      },
      {
        "t": "platform",
        "nm": "20 / Final landing",
        "p": [
          0,
          -0.5,
          -222
        ],
        "s": [
          24,
          1,
          60
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "20 / Two switch rails and roof",
        "p": [
          0,
          1.6,
          -188
        ]
      },
      {
        "t": "ramp",
        "nm": "20 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -276
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "20-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 21,
    "name": "21 / Rail and kickflip gap",
    "brief": "Rail → rolling bank → kickflip through the gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -274
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "21 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -104
        ],
        "s": [
          104,
          1,
          388
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "21 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "21 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "21 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "21 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "21 / Entry rail",
        "p": [
          0,
          1.2,
          -40
        ],
        "len": 64
      },
      {
        "t": "platform",
        "nm": "21 / Bank run-up",
        "p": [
          0,
          -0.5,
          -86
        ],
        "s": [
          24,
          1,
          40
        ],
        "color": "#789496"
      },
      {
        "t": "ramp",
        "nm": "21 / Trick launch",
        "p": [
          0,
          0,
          -110
        ],
        "len": 16,
        "rise": 2,
        "w": 18
      },
      {
        "t": "trickgate",
        "nm": "21 / Kickflip aperture",
        "p": [
          0,
          3.3,
          -124
        ],
        "s": [
          16,
          10,
          0.6
        ],
        "radius": 4,
        "trick": "kick"
      },
      {
        "t": "platform",
        "nm": "21 / Clear trick landing",
        "p": [
          0,
          -0.5,
          -164
        ],
        "s": [
          24,
          1,
          68
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "21 / Rail and kickflip gap",
        "p": [
          0,
          2.8,
          -125
        ]
      },
      {
        "t": "ramp",
        "nm": "21 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -222
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "21-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 22,
    "name": "22 / Grind rope and timed roof",
    "brief": "Rope grind → long timed deck → ollie gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -272
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "22 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -103
        ],
        "s": [
          104,
          1,
          386
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "22 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "22 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "22 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "22 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rope",
        "nm": "22 / Entry grind rope",
        "p": [
          0,
          2,
          -42
        ],
        "len": 68,
        "amp": 0.7,
        "shake": 6
      },
      {
        "t": "phasepad",
        "nm": "22 / Timed skating roof",
        "p": [
          0,
          0,
          -96
        ],
        "s": [
          24,
          0.8,
          52
        ],
        "cycle": 12,
        "amp": 0.85,
        "phase": 0
      },
      {
        "t": "platform",
        "nm": "22 / Roof landing",
        "p": [
          0,
          -0.5,
          -163
        ],
        "s": [
          24,
          1,
          66
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "22 / Grind rope and timed roof",
        "p": [
          0,
          1.6,
          -126
        ]
      },
      {
        "t": "ramp",
        "nm": "22 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -220
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "22-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 23,
    "name": "23 / Switch rail, bank and high rail",
    "brief": "Switch grind → revealed roof → bank → high rail.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -320
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "23 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -127
        ],
        "s": [
          104,
          1,
          434
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "23 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "23 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "23 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "23 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "23 / Switch rail",
        "p": [
          0,
          1.2,
          -39
        ],
        "len": 62
      },
      {
        "t": "crate",
        "nm": "23 / Roof switch",
        "p": [
          0,
          1.2,
          -48
        ],
        "kind": "bang",
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "23 / Revealed bank approach",
        "p": [
          0,
          -0.5,
          -90
        ],
        "s": [
          24,
          1,
          52
        ],
        "tex": "solid",
        "color": "#a8b9a0",
        "solidSides": true,
        "vertices": [
          -0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5
        ],
        "indices": [
          3,
          7,
          6,
          3,
          6,
          2,
          0,
          3,
          2,
          0,
          2,
          1,
          4,
          5,
          6,
          4,
          6,
          7,
          0,
          4,
          7,
          0,
          7,
          3,
          1,
          2,
          6,
          1,
          6,
          5,
          0,
          1,
          5,
          0,
          5,
          4
        ],
        "grindTopTriangles": 2,
        "outline": true,
        "grp": 2
      },
      {
        "t": "ramp",
        "nm": "23 / High rail bank",
        "p": [
          0,
          0,
          -118
        ],
        "len": 20,
        "rise": 3,
        "w": 18
      },
      {
        "t": "rail",
        "nm": "23 / High receiver rail",
        "p": [
          0,
          3.8,
          -161
        ],
        "len": 54
      },
      {
        "t": "platform",
        "nm": "23 / High rail runout",
        "p": [
          0,
          -0.5,
          -213
        ],
        "s": [
          24,
          1,
          62
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "23 / Switch rail, bank and high rail",
        "p": [
          0,
          5.7,
          -188
        ]
      },
      {
        "t": "ramp",
        "nm": "23 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -268
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "23-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 24,
    "name": "24 / Rail transfers, enemy and bank",
    "brief": "Rail transfer → wide enemy carve → bank air.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -330
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "24 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -132
        ],
        "s": [
          104,
          1,
          444
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "24 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "24 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "24 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "24 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "24 / First rail",
        "p": [
          0,
          1.2,
          -33
        ],
        "len": 50
      },
      {
        "t": "rail",
        "nm": "24 / Offset rail",
        "p": [
          4.5,
          1.2,
          -77
        ],
        "len": 62
      },
      {
        "t": "pit",
        "nm": "24 / Rail transfer pit",
        "p": [
          0,
          -6,
          -62
        ],
        "s": [
          26,
          1,
          80
        ],
        "color": "#192e42"
      },
      {
        "t": "platform",
        "nm": "24 / Wide carving deck",
        "p": [
          0,
          -0.5,
          -134
        ],
        "s": [
          28,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "enemy",
        "nm": "24 / Visible blade at the carve",
        "foe": "spinner",
        "p": [
          4.5,
          0,
          -136
        ],
        "range": 0,
        "speed": 0
      },
      {
        "t": "ramp",
        "nm": "24 / Roof launch",
        "p": [
          0,
          0,
          -170
        ],
        "len": 16,
        "rise": 2,
        "w": 18
      },
      {
        "t": "platform",
        "nm": "24 / Long roof landing",
        "p": [
          0,
          -0.5,
          -222
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "24 / Rail transfers, enemy and bank",
        "p": [
          0,
          2.8,
          -184
        ]
      },
      {
        "t": "ramp",
        "nm": "24 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -278
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "24-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  },
  {
    "id": 25,
    "name": "25 / Switch rail, Nitro, trick gap and timed roof",
    "brief": "Switch grind → Nitro-framed bank → kickflip → timed roof gap.",
    "skateLine": true,
    "spawn": [
      0,
      0.15,
      55
    ],
    "exit": [
      0,
      -8,
      -366
    ],
    "reviewViews": [
      {
        "name": "commitment",
        "position": [
          0,
          0.15,
          -5
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "25 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -150
        ],
        "s": [
          104,
          1,
          480
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "25 / Clear skating approach",
        "p": [
          0,
          -0.5,
          12
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "25 / Return junction",
        "p": [
          0,
          -0.5,
          57
        ],
        "s": [
          88,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "25 / Checkpoint before the line",
        "p": [
          0,
          0,
          35
        ]
      },
      {
        "t": "ramp",
        "nm": "25 / Recovery bank",
        "p": [
          34,
          -8,
          20
        ],
        "len": 48,
        "rise": 8,
        "w": 16,
        "yaw": 180
      },
      {
        "t": "rail",
        "nm": "25 / Switch rail",
        "p": [
          0,
          1.2,
          -42
        ],
        "len": 68
      },
      {
        "t": "crate",
        "nm": "25 / Roof switch",
        "p": [
          0,
          1.2,
          -52
        ],
        "kind": "bang",
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "25 / Revealed long roof",
        "p": [
          0,
          -0.5,
          -112
        ],
        "s": [
          26,
          1,
          84
        ],
        "tex": "solid",
        "color": "#a8b9a0",
        "solidSides": true,
        "vertices": [
          -0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          -0.5,
          0.5,
          -0.5,
          -0.5,
          -0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5,
          0.5,
          0.5,
          -0.5,
          0.5,
          0.5
        ],
        "indices": [
          3,
          7,
          6,
          3,
          6,
          2,
          0,
          3,
          2,
          0,
          2,
          1,
          4,
          5,
          6,
          4,
          6,
          7,
          0,
          4,
          7,
          0,
          7,
          3,
          1,
          2,
          6,
          1,
          6,
          5,
          0,
          1,
          5,
          0,
          5,
          4
        ],
        "grindTopTriangles": 2,
        "outline": true,
        "grp": 2
      },
      {
        "t": "crate",
        "nm": "25 / Nitro outside the clear lane",
        "p": [
          -6,
          0,
          -126
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "25 / Nitro outside the clear lane",
        "p": [
          -6,
          0,
          -138
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "25 / Nitro outside the clear lane",
        "p": [
          -6,
          0,
          -150
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "25 / Nitro outside the clear lane",
        "p": [
          6,
          0,
          -126
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "25 / Nitro outside the clear lane",
        "p": [
          6,
          0,
          -138
        ],
        "kind": "nitro"
      },
      {
        "t": "crate",
        "nm": "25 / Nitro outside the clear lane",
        "p": [
          6,
          0,
          -150
        ],
        "kind": "nitro"
      },
      {
        "t": "ramp",
        "nm": "25 / Trick launch",
        "p": [
          0,
          0,
          -159
        ],
        "len": 22,
        "rise": 3,
        "w": 10
      },
      {
        "t": "trickgate",
        "nm": "25 / Kickflip aperture",
        "p": [
          0,
          4.2,
          -177
        ],
        "s": [
          16,
          10,
          0.6
        ],
        "radius": 4,
        "trick": "kick"
      },
      {
        "t": "phasepad",
        "nm": "25 / Long timed roof",
        "p": [
          0,
          0,
          -199.5
        ],
        "s": [
          24,
          0.8,
          37
        ],
        "cycle": 12,
        "amp": 0.85,
        "phase": 0.5
      },
      {
        "t": "platform",
        "nm": "25 / Final crystal landing",
        "p": [
          0,
          -0.5,
          -258
        ],
        "s": [
          24,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "crystal",
        "nm": "25 / Switch rail, Nitro, trick gap and timed roof",
        "p": [
          0,
          1.6,
          -222
        ]
      },
      {
        "t": "ramp",
        "nm": "25 / Rolling exit to the flat floor",
        "p": [
          0,
          -8,
          -314
        ],
        "len": 48,
        "rise": 8,
        "w": 24,
        "yaw": 180
      }
    ],
    "attempt": "25-s",
    "reason": "Short skating study; replaced by a longer challenge linking multiple skating skills."
  }
];
