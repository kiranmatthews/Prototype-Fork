import type { RejectedCrystalTrial } from './types';

/** Published first collection, preserved before the skating refinement. */
export const REJECTED_PLATFORMING: RejectedCrystalTrial[] = [
  {
    "id": 1,
    "name": "1 / Bounce crate",
    "brief": "Bounce crate → airborne crystal.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "components": [
      {
        "t": "platform",
        "nm": "01 / Garden landing and retry floor",
        "p": [
          0,
          -0.5,
          -4
        ],
        "s": [
          24,
          1,
          30
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "01 / First Lift start",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crate",
        "nm": "01 / Reusable arrow spring",
        "kind": "metalbounce",
        "p": [
          0,
          0,
          -5
        ]
      },
      {
        "t": "crystal",
        "nm": "1 / Bounce crate",
        "p": [
          0,
          6.1,
          -5
        ]
      },
      {
        "t": "camnode",
        "nm": "01 / See the spring and its overhead goal together",
        "p": [
          0,
          5,
          -4
        ],
        "s": [
          30,
          30,
          40
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          11,
          18
        ],
        "cameraTarget": [
          0,
          4,
          -4
        ],
        "cameraFollowDistance": 17,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 3.6,
        "cameraFov": 57,
        "cameraAspect": 1.7777777777777777
      },
      {
        "t": "platform",
        "nm": "01 / Rear garden rim",
        "p": [
          0,
          -0.2,
          -19.6
        ],
        "s": [
          24,
          0.6,
          1.2
        ],
        "color": "#d5b376"
      }
    ],
    "attempt": "01-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 2,
    "name": "2 / Trampoline and high platform",
    "brief": "Trampoline → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "components": [
      {
        "t": "platform",
        "nm": "02 / Courtyard and local retry",
        "p": [
          3,
          -0.5,
          -10
        ],
        "s": [
          30,
          1,
          42
        ],
        "color": "#829a94"
      },
      {
        "t": "checkpoint",
        "nm": "02 / Bell Tower start",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "trampoline",
        "nm": "02 / Bell spring",
        "p": [
          0,
          0.12,
          -8
        ],
        "s": [
          6,
          0.45,
          6
        ],
        "speed": 22,
        "amp": 1.25
      },
      {
        "t": "platform",
        "nm": "02 / High bell balcony",
        "p": [
          6,
          7.9,
          -13
        ],
        "s": [
          4.6,
          1,
          5.2
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "2 / Trampoline and high platform",
        "p": [
          6,
          8.4,
          -13
        ]
      },
      {
        "t": "platform",
        "nm": "02 / Left bell pillar",
        "p": [
          3.15,
          6.15,
          -15.6
        ],
        "s": [
          0.8,
          12.3,
          0.8
        ],
        "color": "#536c77"
      },
      {
        "t": "platform",
        "nm": "02 / Right bell pillar",
        "p": [
          8.85,
          6.15,
          -15.6
        ],
        "s": [
          0.8,
          12.3,
          0.8
        ],
        "color": "#536c77"
      },
      {
        "t": "platform",
        "nm": "02 / Bell arch lintel",
        "p": [
          6,
          12.6,
          -15.6
        ],
        "s": [
          6.5,
          0.6,
          0.8
        ],
        "color": "#d8b26e"
      },
      {
        "t": "camnode",
        "nm": "02 / Spring and bell balcony in one view",
        "p": [
          3,
          7,
          -10
        ],
        "s": [
          38,
          38,
          52
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          3,
          11,
          18
        ],
        "cameraTarget": [
          3,
          5,
          -10
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4.5,
        "cameraFov": 58,
        "cameraAspect": 1.7777777777777777
      }
    ],
    "attempt": "02-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 3,
    "name": "3 / Long rail over a pit",
    "brief": "Long rail over a death pit → raised platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "lower-return",
        "position": [
          15,
          -7.85,
          -21
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "03 / Safe catch and balance practice",
        "p": [
          0,
          -0.5,
          -6
        ],
        "s": [
          18,
          1,
          32
        ],
        "color": "#809b9b"
      },
      {
        "t": "checkpoint",
        "nm": "03 / Viaduct start",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "rail",
        "nm": "03 / Needle rail",
        "p": [
          0,
          1.2,
          -41
        ],
        "len": 72,
        "yaw": 0
      },
      {
        "t": "pit",
        "nm": "03 / Visible pit beneath the silver line",
        "p": [
          0,
          -6,
          -50
        ],
        "s": [
          18,
          1,
          54
        ],
        "color": "#192e42"
      },
      {
        "t": "platform",
        "nm": "03 / Raised crystal receiver",
        "p": [
          0,
          2.6,
          -84
        ],
        "s": [
          8,
          1,
          12
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "3 / Long rail over a pit",
        "p": [
          0,
          3.1,
          -84
        ]
      },
      {
        "t": "platform",
        "nm": "03 / Wide one-way return landing",
        "p": [
          11,
          -8.5,
          -84
        ],
        "s": [
          10,
          1,
          12
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "03 / Lower return outside the pit",
        "p": [
          15,
          -8.5,
          -52
        ],
        "s": [
          6,
          1,
          64
        ],
        "color": "#789496"
      },
      {
        "t": "ramp",
        "nm": "03 / Return climb to the approach",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 6,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "03 / Return joins the observation promenade",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          10,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "03 / Read the pit, line and raised receiver",
        "p": [
          0,
          5,
          -39
        ],
        "s": [
          21,
          30,
          108
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          11,
          -14
        ],
        "cameraTarget": [
          0,
          2,
          -39
        ],
        "cameraFollowDistance": 16,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 2,
        "cameraFov": 58,
        "cameraAspect": 1.7777777777777777
      },
      {
        "t": "camnode",
        "nm": "03 / Return view",
        "p": [
          15,
          -4,
          -44
        ],
        "s": [
          9,
          12,
          120
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -60
        ],
        "cameraTarget": [
          15,
          -3,
          -38
        ],
        "cameraFollowDistance": 14,
        "cameraFollowTargetHeight": 2.5
      }
    ],
    "attempt": "03-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 4,
    "name": "4 / Moving platform and lift",
    "brief": "Moving platform → fixed island → lift → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "lift-observation",
        "position": [
          0,
          0.15,
          -32
        ]
      },
      {
        "name": "lower-return",
        "position": [
          15,
          -7.85,
          -21
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "04 / Ferry observation bank",
        "p": [
          0,
          -0.5,
          3
        ],
        "s": [
          18,
          1,
          16
        ],
        "color": "#809b9b"
      },
      {
        "t": "checkpoint",
        "nm": "04 / Passing Platforms start",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "mover",
        "nm": "04 / Horizontal ferry",
        "p": [
          0,
          0,
          -15
        ],
        "s": [
          6,
          0.5,
          6
        ],
        "axis": "z",
        "amp": 6,
        "speed": 0.7,
        "phase": 0,
        "color": "#a8a3d8"
      },
      {
        "t": "platform",
        "nm": "04 / Fixed island between moving transfers",
        "p": [
          0,
          -0.5,
          -29
        ],
        "s": [
          10,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "mover",
        "nm": "04 / Gallery lift",
        "p": [
          0,
          4,
          -40
        ],
        "s": [
          6,
          0.6,
          6
        ],
        "axis": "y",
        "amp": 4,
        "speed": 0.7,
        "phase": 1.7,
        "color": "#a8a3d8"
      },
      {
        "t": "platform",
        "nm": "04 / High crystal gallery",
        "p": [
          0,
          7.9,
          -49
        ],
        "s": [
          8,
          1,
          10
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "4 / Moving platform and lift",
        "p": [
          0,
          8.4,
          -50
        ]
      },
      {
        "t": "pit",
        "nm": "04 / Water below the moving route",
        "p": [
          0,
          -6,
          -25
        ],
        "s": [
          16,
          1,
          42
        ],
        "color": "#192e42"
      },
      {
        "t": "platform",
        "nm": "04 / Broad lower return landing",
        "p": [
          15,
          -8.5,
          -50
        ],
        "s": [
          12,
          1,
          12
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "04 / Lower return outside the pit",
        "p": [
          15,
          -8.5,
          -35
        ],
        "s": [
          6,
          1,
          30
        ],
        "color": "#789496"
      },
      {
        "t": "ramp",
        "nm": "04 / Return climb",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 6,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "04 / Upper return junction",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          10,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "04 / Observe both machines and their receivers",
        "p": [
          0,
          6,
          -25
        ],
        "s": [
          21,
          40,
          84
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          11,
          1
        ],
        "cameraTarget": [
          0,
          3.2,
          -25
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 3.2,
        "cameraFov": 58,
        "cameraAspect": 1.7777777777777777
      },
      {
        "t": "camnode",
        "nm": "04 / Return view",
        "p": [
          15,
          -4,
          -44
        ],
        "s": [
          9,
          12,
          120
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -60
        ],
        "cameraTarget": [
          15,
          -3,
          -38
        ],
        "cameraFollowDistance": 14,
        "cameraFollowTargetHeight": 2.5
      }
    ],
    "attempt": "04-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 5,
    "name": "5 / Halfpipe and high crystal",
    "brief": "Halfpipe pumps → high crystal.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "halfpipe-floor",
        "position": [
          0,
          0.15,
          -33
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "05 / Open halfpipe approach",
        "p": [
          0,
          -0.5,
          -5
        ],
        "s": [
          24,
          1,
          32
        ],
        "color": "#809b9b"
      },
      {
        "t": "checkpoint",
        "nm": "05 / Skylight start",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "vertramp",
        "nm": "05 / Pumping halfpipe",
        "p": [
          0,
          0,
          -33
        ],
        "vkind": "half",
        "w": 5,
        "rise": 4,
        "len": 28,
        "arc": 90,
        "arcSteps": 24,
        "deck": 2.5,
        "skateCamera": true
      },
      {
        "t": "crystal",
        "nm": "5 / Halfpipe and high crystal",
        "p": [
          9,
          9.8,
          -33
        ]
      },
      {
        "t": "camnode",
        "nm": "05 / See the pipe and high crystal",
        "p": [
          0,
          6,
          -20
        ],
        "s": [
          38,
          40,
          70
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          13,
          8
        ],
        "cameraTarget": [
          0,
          4,
          -22
        ],
        "cameraFollowDistance": 22,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4,
        "cameraFov": 65,
        "cameraAspect": 1.7777777777777777
      }
    ],
    "attempt": "05-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 6,
    "name": "6 / Climbing rope and high platform",
    "brief": "Climbing rope → high framed platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "rope-and-window",
        "position": [
          0,
          0.15,
          -13
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "06 / Rope courtyard and missed-release recovery",
        "p": [
          0,
          -0.5,
          -12
        ],
        "s": [
          26,
          1,
          50
        ],
        "color": "#849c8d"
      },
      {
        "t": "checkpoint",
        "nm": "06 / Vine Window start",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "ropeswing",
        "nm": "06 / Climbing vine",
        "p": [
          0,
          14,
          -18
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 0,
        "yaw": 90
      },
      {
        "t": "platform",
        "nm": "06 / High window gallery",
        "p": [
          0,
          8.7,
          -27
        ],
        "s": [
          6,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "platform",
        "nm": "06 / Window left pier",
        "p": [
          -3.8,
          7.6,
          -25
        ],
        "s": [
          1.2,
          15.2,
          1.2
        ],
        "color": "#aa9875"
      },
      {
        "t": "platform",
        "nm": "06 / Window right pier",
        "p": [
          3.8,
          7.6,
          -25
        ],
        "s": [
          1.2,
          15.2,
          1.2
        ],
        "color": "#aa9875"
      },
      {
        "t": "platform",
        "nm": "06 / Window lintel",
        "p": [
          0,
          15.2,
          -25
        ],
        "s": [
          8.8,
          0.8,
          1.2
        ],
        "color": "#aa9875"
      },
      {
        "t": "crystal",
        "nm": "6 / Climbing rope and high platform",
        "p": [
          0,
          9.2,
          -28
        ]
      },
      {
        "t": "camnode",
        "nm": "06 / Frame the climb and its high receiving window",
        "p": [
          0,
          7,
          -17
        ],
        "s": [
          38,
          42,
          66
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          12,
          10
        ],
        "cameraTarget": [
          0,
          5,
          -19
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4.5,
        "cameraFov": 65,
        "cameraAspect": 1.7777777777777777
      }
    ],
    "attempt": "06-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 7,
    "name": "7 / Timed steps",
    "brief": "Three timed steps → raised platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "lower-recovery",
        "position": [
          15,
          -7.85,
          -21
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "07 / Stair observation bank",
        "p": [
          0,
          -0.5,
          3
        ],
        "s": [
          18,
          1,
          16
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "07 / Vanishing Stairs start",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "phasepad",
        "nm": "07 / Vanishing stair 1",
        "p": [
          0,
          1.5,
          -10
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0
      },
      {
        "t": "phasepad",
        "nm": "07 / Vanishing stair 2",
        "p": [
          0,
          3,
          -17
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.76
      },
      {
        "t": "phasepad",
        "nm": "07 / Vanishing stair 3",
        "p": [
          0,
          4.5,
          -24
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.52
      },
      {
        "t": "platform",
        "nm": "07 / Crystal balcony after the rhythm",
        "p": [
          0,
          5.7,
          -33
        ],
        "s": [
          8,
          1,
          8
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "7 / Timed steps",
        "p": [
          0,
          6.2,
          -34
        ]
      },
      {
        "t": "platform",
        "nm": "07 / Missed-step recovery courtyard",
        "p": [
          0,
          -8.5,
          -20
        ],
        "s": [
          26,
          1,
          58
        ],
        "color": "#7d8b9c"
      },
      {
        "t": "platform",
        "nm": "07 / Lower return beside the stairs",
        "p": [
          15,
          -8.5,
          -33
        ],
        "s": [
          8,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "ramp",
        "nm": "07 / Retry climb",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 6,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "07 / Upper return junction",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          10,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "07 / Watch the whole rising rhythm",
        "p": [
          0,
          4,
          -20
        ],
        "s": [
          21,
          40,
          76
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          11,
          6
        ],
        "cameraTarget": [
          0,
          2.5,
          -23
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 3.5,
        "cameraFov": 62,
        "cameraAspect": 1.7777777777777777
      },
      {
        "t": "camnode",
        "nm": "07 / Look along the retry ramp toward the entrance",
        "p": [
          15,
          -4,
          -24
        ],
        "s": [
          9,
          12,
          80
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -40
        ],
        "cameraTarget": [
          15,
          -3,
          -18
        ],
        "cameraFollowDistance": 14,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 2.5,
        "cameraFov": 62,
        "cameraAspect": 1.7777777777777777
      }
    ],
    "attempt": "07-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 8,
    "name": "8 / Switch, steps and bounce crate",
    "brief": "Switch → two raised steps → bounce crate → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "components": [
      {
        "t": "platform",
        "nm": "08 / Orchard courtyard and local retry",
        "p": [
          0,
          -0.5,
          -12
        ],
        "s": [
          26,
          1,
          52
        ],
        "color": "#849d87"
      },
      {
        "t": "checkpoint",
        "nm": "08 / Outline Orchard start",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crate",
        "nm": "08 / Reveal switch",
        "kind": "bang",
        "p": [
          -5,
          0,
          -7
        ],
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "08 / First revealed step",
        "p": [
          0,
          1.7000000000000002,
          -14
        ],
        "s": [
          5,
          1,
          4
        ],
        "color": "#a8b9a0",
        "outline": true,
        "grp": 2,
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
        "grindTopTriangles": 2
      },
      {
        "t": "mesh",
        "nm": "08 / Revealed spring terrace",
        "p": [
          0,
          3.9000000000000004,
          -22
        ],
        "s": [
          6,
          1,
          6
        ],
        "color": "#a8b9a0",
        "outline": true,
        "grp": 2,
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
        "grindTopTriangles": 2
      },
      {
        "t": "crate",
        "nm": "08 / Revealed reusable arrow",
        "kind": "metalbounce",
        "p": [
          0,
          4.4,
          -22
        ],
        "outline": true,
        "grp": 2
      },
      {
        "t": "platform",
        "nm": "08 / High orchard gallery",
        "p": [
          6,
          9.7,
          -26
        ],
        "s": [
          5,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "8 / Switch, steps and bounce crate",
        "p": [
          6,
          10.2,
          -26
        ]
      },
      {
        "t": "camnode",
        "nm": "08 / Read switch, outlines, arrow and high gallery",
        "p": [
          0,
          6,
          -18
        ],
        "s": [
          40,
          42,
          70
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          3,
          14,
          10
        ],
        "cameraTarget": [
          3,
          5,
          -20
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4.5,
        "cameraFov": 63,
        "cameraAspect": 1.7777777777777777
      }
    ],
    "attempt": "08-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 9,
    "name": "9 / Turtle shell and high platform",
    "brief": "Turtle shell → held bounce → double jump → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "components": [
      {
        "t": "platform",
        "nm": "09 / Flat courtyard",
        "p": [
          0,
          -0.5,
          -12
        ],
        "s": [
          28,
          1,
          52
        ],
        "color": "#849d87"
      },
      {
        "t": "checkpoint",
        "nm": "09 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "enemy",
        "nm": "09 / Turtle spring",
        "foe": "turtle",
        "p": [
          0,
          0,
          -14
        ],
        "range": 0,
        "speed": 0
      },
      {
        "t": "platform",
        "nm": "09 / High receiver",
        "p": [
          6,
          7.699999999999999,
          -18
        ],
        "s": [
          5,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "9 / Turtle shell and high platform",
        "p": [
          6,
          8.2,
          -18
        ]
      },
      {
        "t": "pit",
        "nm": "09 / Reset pit beyond the courtyard",
        "p": [
          -9,
          -6,
          -42
        ],
        "s": [
          6,
          1,
          8
        ]
      },
      {
        "t": "camnode",
        "nm": "09 / Shell and receiver view",
        "p": [
          0,
          5,
          -15
        ],
        "s": [
          42,
          40,
          62
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          2,
          12,
          12
        ],
        "cameraTarget": [
          2,
          4,
          -16
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4,
        "cameraFov": 62
      }
    ],
    "attempt": "09-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 10,
    "name": "10 / Folding bridge and small platform",
    "brief": "Spin-open bridge → timed crossing → small raised platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "lower-return",
        "position": [
          15,
          -7.85,
          -21
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "10 / Approach",
        "p": [
          0,
          -0.5,
          5
        ],
        "s": [
          18,
          1,
          26
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "10 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -15
        ],
        "s": [
          40,
          1,
          74
        ],
        "color": "#929e94"
      },
      {
        "t": "checkpoint",
        "nm": "10 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "spinbridge",
        "nm": "10 / Timed folding bridge",
        "p": [
          0,
          0,
          -8
        ],
        "s": [
          14,
          0.4,
          3
        ],
        "yaw": 90,
        "cycle": 0.5,
        "hold": 5,
        "tex": "wood"
      },
      {
        "t": "platform",
        "nm": "10 / Small receiver",
        "p": [
          0,
          1.7000000000000002,
          -27
        ],
        "s": [
          3.5,
          1,
          3.5
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "10 / Folding bridge and small platform",
        "p": [
          0,
          2.2,
          -27
        ]
      },
      {
        "t": "ramp",
        "nm": "10 / Return ramp",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 5,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "10 / Return junction",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          8,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "10 / Bridge view",
        "p": [
          0,
          4,
          -13
        ],
        "s": [
          21,
          42,
          66
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          10,
          11,
          9
        ],
        "cameraTarget": [
          0,
          3,
          -20
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4,
        "cameraFov": 64
      },
      {
        "t": "camnode",
        "nm": "10 / Return view",
        "p": [
          15,
          -4,
          -24
        ],
        "s": [
          9,
          12,
          80
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -40
        ],
        "cameraTarget": [
          15,
          -3,
          -18
        ],
        "cameraFollowDistance": 14,
        "cameraFollowTargetHeight": 2.5
      }
    ],
    "attempt": "10-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 11,
    "name": "11 / Offset rail transfers",
    "brief": "Three offset rails over a pit → raised platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "lower-return",
        "position": [
          15,
          -7.85,
          -21
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "11 / Safe approach",
        "p": [
          0,
          -0.5,
          0
        ],
        "s": [
          18,
          1,
          22
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "11 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -38
        ],
        "s": [
          40,
          1,
          112
        ],
        "color": "#929e94"
      },
      {
        "t": "checkpoint",
        "nm": "11 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "rail",
        "nm": "11 / First rail",
        "p": [
          0,
          1.2,
          -17.5
        ],
        "len": 25
      },
      {
        "t": "rail",
        "nm": "11 / Right rail",
        "p": [
          3.2,
          1.2,
          -39
        ],
        "len": 34
      },
      {
        "t": "rail",
        "nm": "11 / Left rail",
        "p": [
          0,
          1.2,
          -64.5
        ],
        "len": 31
      },
      {
        "t": "pit",
        "nm": "11 / Rail transfer pit",
        "p": [
          0,
          -6,
          -49
        ],
        "s": [
          18,
          1,
          62
        ],
        "color": "#192e42"
      },
      {
        "t": "platform",
        "nm": "11 / Raised receiver",
        "p": [
          0,
          2.6,
          -86
        ],
        "s": [
          7,
          1,
          8
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "11 / Offset rail transfers",
        "p": [
          0,
          3.1,
          -86
        ]
      },
      {
        "t": "ramp",
        "nm": "11 / Return ramp",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 5,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "11 / Return junction",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          8,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "11 / Rail transfer view",
        "p": [
          0,
          4,
          -39
        ],
        "s": [
          21,
          38,
          110
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          11,
          -10
        ],
        "cameraTarget": [
          0,
          2,
          -39
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 2.5,
        "cameraFov": 62
      },
      {
        "t": "camnode",
        "nm": "11 / Return view",
        "p": [
          15,
          -4,
          -44
        ],
        "s": [
          9,
          12,
          120
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -60
        ],
        "cameraTarget": [
          15,
          -3,
          -38
        ],
        "cameraFollowDistance": 14,
        "cameraFollowTargetHeight": 2.5
      }
    ],
    "attempt": "11-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 12,
    "name": "12 / Trampoline and airborne bounce crate",
    "brief": "Trampoline → airborne bounce crate → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "components": [
      {
        "t": "platform",
        "nm": "12 / Flat recovery courtyard",
        "p": [
          3,
          -0.5,
          -12
        ],
        "s": [
          32,
          1,
          56
        ],
        "color": "#849d87"
      },
      {
        "t": "checkpoint",
        "nm": "12 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "trampoline",
        "nm": "12 / First launcher",
        "p": [
          0,
          0.12,
          -8
        ],
        "s": [
          6,
          0.45,
          6
        ],
        "speed": 22,
        "amp": 1.25
      },
      {
        "t": "crate",
        "nm": "12 / Airborne bounce crate",
        "kind": "metalbounce",
        "p": [
          4,
          8,
          -12
        ]
      },
      {
        "t": "platform",
        "nm": "12 / High receiver",
        "p": [
          8.5,
          13.7,
          -12
        ],
        "s": [
          4,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "12 / Trampoline and airborne bounce crate",
        "p": [
          8.5,
          14.2,
          -12
        ]
      },
      {
        "t": "camnode",
        "nm": "12 / Both launchers and receiver",
        "p": [
          3,
          7,
          -12
        ],
        "s": [
          44,
          50,
          70
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          3,
          17,
          10
        ],
        "cameraTarget": [
          3,
          7,
          -18
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 8,
        "cameraFov": 70
      }
    ],
    "attempt": "12-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 13,
    "name": "13 / Two climbing ropes",
    "brief": "Climbing rope → raised rest → second climbing rope → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "second-rope",
        "position": [
          0,
          9.35,
          -32
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "13 / Flat recovery courtyard",
        "p": [
          0,
          -0.5,
          -24
        ],
        "s": [
          28,
          1,
          76
        ],
        "color": "#849d87"
      },
      {
        "t": "checkpoint",
        "nm": "13 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "ropeswing",
        "nm": "13 / First climbing rope",
        "p": [
          0,
          14,
          -18
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 0,
        "yaw": 90
      },
      {
        "t": "platform",
        "nm": "13 / Raised resting platform",
        "p": [
          0,
          8.7,
          -31
        ],
        "s": [
          6,
          1,
          14
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "ropeswing",
        "nm": "13 / Second climbing rope",
        "p": [
          0,
          23.2,
          -37
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 1.7,
        "yaw": 90
      },
      {
        "t": "platform",
        "nm": "13 / High receiver",
        "p": [
          0,
          17.9,
          -46
        ],
        "s": [
          6,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "13 / Two climbing ropes",
        "p": [
          0,
          18.4,
          -47
        ]
      },
      {
        "t": "camnode",
        "nm": "13 / Both ropes and their receiving platforms",
        "p": [
          0,
          8,
          -15
        ],
        "s": [
          40,
          48,
          48
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          17,
          10
        ],
        "cameraTarget": [
          0,
          7,
          -20
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 8,
        "cameraFov": 70
      },
      {
        "t": "camnode",
        "nm": "13 / Upper climb and receiver",
        "p": [
          0,
          16,
          -43
        ],
        "s": [
          40,
          32,
          40
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          23,
          -17
        ],
        "cameraTarget": [
          0,
          16,
          -44
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 65
      }
    ],
    "attempt": "13-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 14,
    "name": "14 / Timed platforms and resting island",
    "brief": "Three timed steps → fixed rest → three timed steps → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "upper-steps",
        "position": [
          0,
          6.35,
          -35
        ]
      },
      {
        "name": "lower-return",
        "position": [
          15,
          -7.85,
          -21
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "14 / Waiting bank",
        "p": [
          0,
          -0.5,
          3
        ],
        "s": [
          18,
          1,
          16
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "14 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -30
        ],
        "s": [
          40,
          1,
          100
        ],
        "color": "#929e94"
      },
      {
        "t": "checkpoint",
        "nm": "14 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "phasepad",
        "nm": "14 / Lower timed step 1",
        "p": [
          0,
          1.5,
          -10
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0
      },
      {
        "t": "phasepad",
        "nm": "14 / Lower timed step 2",
        "p": [
          0,
          3,
          -17
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.76
      },
      {
        "t": "phasepad",
        "nm": "14 / Lower timed step 3",
        "p": [
          0,
          4.5,
          -24
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.52
      },
      {
        "t": "platform",
        "nm": "14 / Permanent resting island",
        "p": [
          0,
          5.7,
          -33
        ],
        "s": [
          8,
          1,
          12
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "phasepad",
        "nm": "14 / Upper timed step 1",
        "p": [
          0,
          7.7,
          -44
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 9,
        "amp": 0.55,
        "phase": 0
      },
      {
        "t": "phasepad",
        "nm": "14 / Upper timed step 2",
        "p": [
          0,
          9.2,
          -51
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 9,
        "amp": 0.55,
        "phase": 0.78
      },
      {
        "t": "phasepad",
        "nm": "14 / Upper timed step 3",
        "p": [
          0,
          10.7,
          -58
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 9,
        "amp": 0.55,
        "phase": 0.56
      },
      {
        "t": "platform",
        "nm": "14 / High receiver",
        "p": [
          0,
          11.9,
          -67
        ],
        "s": [
          8,
          1,
          8
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "14 / Timed platforms and resting island",
        "p": [
          0,
          12.4,
          -68
        ]
      },
      {
        "t": "ramp",
        "nm": "14 / Return ramp",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 5,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "14 / Return junction",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          8,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "14 / Timed platforms view",
        "p": [
          0,
          7,
          -29
        ],
        "s": [
          21,
          44,
          92
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          15,
          0
        ],
        "cameraTarget": [
          0,
          6,
          -29
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4,
        "cameraFov": 65
      },
      {
        "t": "camnode",
        "nm": "14 / Return view",
        "p": [
          15,
          -4,
          -34
        ],
        "s": [
          9,
          12,
          100
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -50
        ],
        "cameraTarget": [
          15,
          -3,
          -28
        ],
        "cameraFollowDistance": 14,
        "cameraFollowTargetHeight": 2.5
      }
    ],
    "attempt": "14-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 15,
    "name": "15 / TNT, switch and revealed route",
    "brief": "TNT → enclosed switch → revealed steps and bounce crate → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "tnt-and-switch",
        "position": [
          -5,
          0.15,
          -9
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "15 / Flat courtyard",
        "p": [
          0,
          -0.5,
          -18
        ],
        "s": [
          34,
          1,
          68
        ],
        "color": "#849d87"
      },
      {
        "t": "checkpoint",
        "nm": "15 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crate",
        "nm": "15 / TNT trigger",
        "kind": "tnt",
        "p": [
          0,
          0,
          -10
        ]
      },
      {
        "t": "crate",
        "nm": "15 / Enclosed switch",
        "kind": "bang",
        "p": [
          0,
          0,
          -13.1
        ],
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "15 / Transparent front panel",
        "p": [
          0,
          2.75,
          -10.65
        ],
        "s": [
          6,
          5.5,
          0.2
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "15 / Transparent back panel",
        "p": [
          0,
          2.75,
          -15.6
        ],
        "s": [
          6,
          5.5,
          0.2
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "15 / Transparent left panel",
        "p": [
          -3,
          2.75,
          -13.1
        ],
        "s": [
          0.2,
          5.5,
          5.15
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "15 / Transparent right panel",
        "p": [
          3,
          2.75,
          -13.1
        ],
        "s": [
          0.2,
          5.5,
          5.15
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "15 / Enclosure roof",
        "p": [
          0,
          5.65,
          -13.1
        ],
        "s": [
          6.2,
          0.3,
          5.15
        ],
        "tex": "solid",
        "color": "#536c77",
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
        "grindTopTriangles": 2
      },
      {
        "t": "mesh",
        "nm": "15 / First revealed step",
        "p": [
          -7,
          1.7000000000000002,
          -21
        ],
        "s": [
          5,
          1,
          4
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
        "t": "mesh",
        "nm": "15 / Revealed spring terrace",
        "p": [
          -7,
          3.9000000000000004,
          -29
        ],
        "s": [
          6,
          1,
          6
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
        "nm": "15 / Revealed bounce crate",
        "kind": "metalbounce",
        "p": [
          -7,
          4.4,
          -29
        ],
        "outline": true,
        "grp": 2
      },
      {
        "t": "platform",
        "nm": "15 / High receiver",
        "p": [
          -1,
          9.7,
          -33
        ],
        "s": [
          5,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "15 / TNT, switch and revealed route",
        "p": [
          -1,
          10.2,
          -33
        ]
      },
      {
        "t": "camnode",
        "nm": "15 / TNT, switch and raised route view",
        "p": [
          -2,
          6,
          -20
        ],
        "s": [
          44,
          44,
          78
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          -2,
          14,
          10
        ],
        "cameraTarget": [
          -2,
          5,
          -22
        ],
        "cameraFollowDistance": 19,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 65
      }
    ],
    "attempt": "15-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 16,
    "name": "16 / Nitro frames and two launchers",
    "brief": "Trampoline → bounce crate between Nitro → narrow high landing.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "components": [
      {
        "t": "platform",
        "nm": "16 / Flat recovery courtyard",
        "p": [
          3,
          -0.5,
          -12
        ],
        "s": [
          32,
          1,
          56
        ],
        "color": "#849d87"
      },
      {
        "t": "checkpoint",
        "nm": "16 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "trampoline",
        "nm": "16 / First launcher",
        "p": [
          0,
          0.12,
          -8
        ],
        "s": [
          6,
          0.45,
          6
        ],
        "speed": 22,
        "amp": 1.25
      },
      {
        "t": "crate",
        "nm": "16 / Airborne bounce crate",
        "kind": "metalbounce",
        "p": [
          4,
          8,
          -12
        ]
      },
      {
        "t": "crate",
        "nm": "16 / Nitro beside airborne spring",
        "kind": "nitro",
        "p": [
          2,
          8,
          -12
        ]
      },
      {
        "t": "crate",
        "nm": "16 / Nitro beside airborne spring",
        "kind": "nitro",
        "p": [
          6,
          8,
          -12
        ]
      },
      {
        "t": "platform",
        "nm": "16 / Narrow high receiver",
        "p": [
          8.5,
          13.7,
          -12
        ],
        "s": [
          4,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crate",
        "nm": "16 / Nitro landing corner",
        "kind": "nitro",
        "p": [
          6.7,
          14.2,
          -14
        ]
      },
      {
        "t": "crate",
        "nm": "16 / Nitro landing corner",
        "kind": "nitro",
        "p": [
          6.7,
          14.2,
          -10
        ]
      },
      {
        "t": "crate",
        "nm": "16 / Nitro landing corner",
        "kind": "nitro",
        "p": [
          10.3,
          14.2,
          -14
        ]
      },
      {
        "t": "crate",
        "nm": "16 / Nitro landing corner",
        "kind": "nitro",
        "p": [
          10.3,
          14.2,
          -10
        ]
      },
      {
        "t": "crystal",
        "nm": "16 / Nitro frames and two launchers",
        "p": [
          8.5,
          14.2,
          -12
        ]
      },
      {
        "t": "camnode",
        "nm": "16 / Nitro windows and launchers",
        "p": [
          3,
          7,
          -12
        ],
        "s": [
          44,
          50,
          70
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          3,
          17,
          10
        ],
        "cameraTarget": [
          3,
          7,
          -18
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 8,
        "cameraFov": 70
      }
    ],
    "attempt": "16-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 17,
    "name": "17 / Rails, timed enemy and bounce crate",
    "brief": "Three offset rails → retracting enemy → bounce crate → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "enemy-and-bounce",
        "position": [
          0,
          3.25,
          -88
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "17 / Safe approach",
        "p": [
          0,
          -0.5,
          0
        ],
        "s": [
          18,
          1,
          22
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "17 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "rail",
        "nm": "17 / First rail",
        "p": [
          0,
          1.2,
          -17.5
        ],
        "len": 25
      },
      {
        "t": "rail",
        "nm": "17 / Right rail",
        "p": [
          3.2,
          1.2,
          -39
        ],
        "len": 34
      },
      {
        "t": "rail",
        "nm": "17 / Left rail",
        "p": [
          0,
          1.2,
          -64.5
        ],
        "len": 31
      },
      {
        "t": "pit",
        "nm": "17 / Rail transfer pit",
        "p": [
          0,
          -6,
          -49
        ],
        "s": [
          18,
          1,
          62
        ],
        "color": "#192e42"
      },
      {
        "t": "ramp",
        "nm": "17 / Return ramp",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 5,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "17 / Return junction",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          8,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "17 / Rail transfer view",
        "p": [
          0,
          4,
          -39
        ],
        "s": [
          21,
          38,
          110
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          11,
          -10
        ],
        "cameraTarget": [
          0,
          2,
          -39
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 2.5,
        "cameraFov": 62
      },
      {
        "t": "camnode",
        "nm": "17 / Return view",
        "p": [
          15,
          -4,
          -44
        ],
        "s": [
          9,
          12,
          120
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -60
        ],
        "cameraTarget": [
          15,
          -3,
          -38
        ],
        "cameraFollowDistance": 14,
        "cameraFollowTargetHeight": 2.5
      },
      {
        "t": "platform",
        "nm": "17 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -46
        ],
        "s": [
          40,
          1,
          136
        ],
        "color": "#929e94"
      },
      {
        "t": "platform",
        "nm": "17 / Enemy and spring terrace",
        "p": [
          0,
          2.6,
          -92
        ],
        "s": [
          12,
          1,
          20
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "enemy",
        "nm": "17 / Retracting enemy",
        "foe": "spinner",
        "p": [
          0,
          3.1,
          -94
        ],
        "range": 0,
        "speed": 1
      },
      {
        "t": "crate",
        "nm": "17 / Bounce crate",
        "kind": "metalbounce",
        "p": [
          0,
          3.1,
          -100
        ]
      },
      {
        "t": "platform",
        "nm": "17 / High receiver",
        "p": [
          6,
          8.8,
          -100
        ],
        "s": [
          5,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "17 / Rails, timed enemy and bounce crate",
        "p": [
          6,
          9.3,
          -100
        ]
      },
      {
        "t": "camnode",
        "nm": "17 / Enemy and high receiver view",
        "p": [
          0,
          7,
          -96
        ],
        "s": [
          25,
          28,
          30
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          8,
          14,
          -76
        ],
        "cameraTarget": [
          0,
          6,
          -97
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4,
        "cameraFov": 65
      }
    ],
    "attempt": "17-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 18,
    "name": "18 / Two ropes and moving platform",
    "brief": "Climbing rope → moving rest → second rope → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "moving-rest",
        "position": [
          0,
          9.35,
          -32
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "18 / Flat recovery courtyard",
        "p": [
          0,
          -0.5,
          -24
        ],
        "s": [
          28,
          1,
          76
        ],
        "color": "#849d87"
      },
      {
        "t": "checkpoint",
        "nm": "18 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "ropeswing",
        "nm": "18 / First climbing rope",
        "p": [
          0,
          14,
          -18
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 0,
        "yaw": 90
      },
      {
        "t": "mover",
        "nm": "18 / Moving rest",
        "p": [
          0,
          9.2,
          -31
        ],
        "s": [
          8,
          0.8,
          14
        ],
        "axis": "x",
        "amp": 3,
        "speed": 0.7,
        "phase": 0.4,
        "color": "#a8a3d8"
      },
      {
        "t": "ropeswing",
        "nm": "18 / Second climbing rope",
        "p": [
          0,
          23.2,
          -37
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 1.7,
        "yaw": 90
      },
      {
        "t": "platform",
        "nm": "18 / High receiver",
        "p": [
          0,
          17.9,
          -46
        ],
        "s": [
          6,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "18 / Two ropes and moving platform",
        "p": [
          0,
          18.4,
          -47
        ]
      },
      {
        "t": "camnode",
        "nm": "18 / Both ropes and their receiving platforms",
        "p": [
          0,
          8,
          -15
        ],
        "s": [
          40,
          48,
          48
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          17,
          10
        ],
        "cameraTarget": [
          0,
          7,
          -20
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 8,
        "cameraFov": 70
      },
      {
        "t": "camnode",
        "nm": "18 / Upper climb and receiver",
        "p": [
          0,
          16,
          -43
        ],
        "s": [
          40,
          32,
          40
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          23,
          -17
        ],
        "cameraTarget": [
          0,
          16,
          -44
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 65
      }
    ],
    "attempt": "18-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 19,
    "name": "19 / Crumbling steps and bounce crate",
    "brief": "Six crumbling steps with a rest → bounce crate → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "upper-steps",
        "position": [
          0,
          6.35,
          -35
        ]
      },
      {
        "name": "high-bounce",
        "position": [
          0,
          12.55,
          -65
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "19 / Waiting bank",
        "p": [
          0,
          -0.5,
          3
        ],
        "s": [
          18,
          1,
          16
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "19 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -30
        ],
        "s": [
          40,
          1,
          100
        ],
        "color": "#929e94"
      },
      {
        "t": "checkpoint",
        "nm": "19 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crumble",
        "nm": "19 / Lower crumbling step 1",
        "p": [
          0,
          1.5,
          -10
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0,
        "shake": 2.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "crumble",
        "nm": "19 / Lower crumbling step 2",
        "p": [
          0,
          3,
          -17
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.76,
        "shake": 2.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "crumble",
        "nm": "19 / Lower crumbling step 3",
        "p": [
          0,
          4.5,
          -24
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.52,
        "shake": 2.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "platform",
        "nm": "19 / Permanent resting island",
        "p": [
          0,
          5.7,
          -33
        ],
        "s": [
          8,
          1,
          12
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "crumble",
        "nm": "19 / Upper crumbling step 1",
        "p": [
          0,
          7.7,
          -44
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 9,
        "amp": 0.55,
        "phase": 0,
        "shake": 2.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "crumble",
        "nm": "19 / Upper crumbling step 2",
        "p": [
          0,
          9.2,
          -51
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 9,
        "amp": 0.55,
        "phase": 0.78,
        "shake": 2.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "crumble",
        "nm": "19 / Upper crumbling step 3",
        "p": [
          0,
          10.7,
          -58
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 9,
        "amp": 0.55,
        "phase": 0.56,
        "shake": 2.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "platform",
        "nm": "19 / High receiver",
        "p": [
          0,
          11.9,
          -67
        ],
        "s": [
          8,
          1,
          8
        ],
        "color": "#d8b26e"
      },
      {
        "t": "ramp",
        "nm": "19 / Return ramp",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 5,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "19 / Return junction",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          8,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "19 / Crumbling platforms view",
        "p": [
          0,
          7,
          -29
        ],
        "s": [
          21,
          44,
          92
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          15,
          0
        ],
        "cameraTarget": [
          0,
          6,
          -29
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4,
        "cameraFov": 65
      },
      {
        "t": "camnode",
        "nm": "19 / Return view",
        "p": [
          15,
          -4,
          -34
        ],
        "s": [
          9,
          12,
          100
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -50
        ],
        "cameraTarget": [
          15,
          -3,
          -28
        ],
        "cameraFollowDistance": 14,
        "cameraFollowTargetHeight": 2.5
      },
      {
        "t": "crate",
        "nm": "19 / Final bounce crate",
        "kind": "metalbounce",
        "p": [
          0,
          12.4,
          -68
        ]
      },
      {
        "t": "platform",
        "nm": "19 / Final receiver",
        "p": [
          6,
          18.1,
          -72
        ],
        "s": [
          5,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "19 / Crumbling steps and bounce crate",
        "p": [
          6,
          18.6,
          -72
        ]
      },
      {
        "t": "camnode",
        "nm": "19 / Final rebound view",
        "p": [
          0,
          17,
          -68
        ],
        "s": [
          25,
          26,
          24
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          6,
          23,
          -46
        ],
        "cameraTarget": [
          0,
          15,
          -68
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 67
      }
    ],
    "attempt": "19-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 20,
    "name": "20 / TNT and two switch groups",
    "brief": "TNT switch → revealed steps and spring → second switch → upper spring.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "second-switch",
        "position": [
          -1,
          10.35,
          -33
        ]
      }
    ],
    "components": [
      {
        "t": "checkpoint",
        "nm": "20 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crate",
        "nm": "20 / TNT trigger",
        "kind": "tnt",
        "p": [
          0,
          0,
          -10
        ]
      },
      {
        "t": "crate",
        "nm": "20 / Enclosed switch",
        "kind": "bang",
        "p": [
          0,
          0,
          -13.1
        ],
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "20 / Transparent front panel",
        "p": [
          0,
          2.75,
          -10.65
        ],
        "s": [
          6,
          5.5,
          0.2
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "20 / Transparent back panel",
        "p": [
          0,
          2.75,
          -15.6
        ],
        "s": [
          6,
          5.5,
          0.2
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "20 / Transparent left panel",
        "p": [
          -3,
          2.75,
          -13.1
        ],
        "s": [
          0.2,
          5.5,
          5.15
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "20 / Transparent right panel",
        "p": [
          3,
          2.75,
          -13.1
        ],
        "s": [
          0.2,
          5.5,
          5.15
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "20 / Enclosure roof",
        "p": [
          0,
          5.65,
          -13.1
        ],
        "s": [
          6.2,
          0.3,
          5.15
        ],
        "tex": "solid",
        "color": "#536c77",
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
        "grindTopTriangles": 2
      },
      {
        "t": "mesh",
        "nm": "20 / First revealed step",
        "p": [
          -7,
          1.7000000000000002,
          -21
        ],
        "s": [
          5,
          1,
          4
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
        "t": "mesh",
        "nm": "20 / Revealed spring terrace",
        "p": [
          -7,
          3.9000000000000004,
          -29
        ],
        "s": [
          6,
          1,
          6
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
        "nm": "20 / Revealed bounce crate",
        "kind": "metalbounce",
        "p": [
          -7,
          4.4,
          -29
        ],
        "outline": true,
        "grp": 2
      },
      {
        "t": "camnode",
        "nm": "20 / TNT, switch and raised route view",
        "p": [
          -2,
          6,
          -20
        ],
        "s": [
          44,
          44,
          78
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          -2,
          14,
          10
        ],
        "cameraTarget": [
          -2,
          5,
          -22
        ],
        "cameraFollowDistance": 19,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 65
      },
      {
        "t": "platform",
        "nm": "20 / Flat recovery courtyard",
        "p": [
          0,
          -0.5,
          -25
        ],
        "s": [
          34,
          1,
          90
        ],
        "color": "#849d87"
      },
      {
        "t": "platform",
        "nm": "20 / Second switch terrace",
        "p": [
          -1,
          9.7,
          -33
        ],
        "s": [
          7,
          1,
          10
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "crate",
        "nm": "20 / Second switch",
        "kind": "bang",
        "p": [
          1,
          10.2,
          -34
        ],
        "grp": 3
      },
      {
        "t": "mesh",
        "nm": "20 / Upper outlined step",
        "p": [
          -1,
          11.9,
          -42
        ],
        "s": [
          5,
          1,
          5
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
        "t": "mesh",
        "nm": "20 / Upper spring terrace",
        "p": [
          -1,
          14.1,
          -50
        ],
        "s": [
          6,
          1,
          6
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
        "t": "crate",
        "nm": "20 / Upper bounce crate",
        "kind": "metalbounce",
        "p": [
          -1,
          14.6,
          -50
        ],
        "outline": true,
        "grp": 3
      },
      {
        "t": "platform",
        "nm": "20 / High receiver",
        "p": [
          5,
          20.3,
          -54
        ],
        "s": [
          5,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "20 / TNT and two switch groups",
        "p": [
          5,
          20.8,
          -54
        ]
      },
      {
        "t": "camnode",
        "nm": "20 / Second switch and steps view",
        "p": [
          0,
          16,
          -43
        ],
        "s": [
          30,
          26,
          36
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          5,
          24,
          -18
        ],
        "cameraTarget": [
          0,
          14,
          -43
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 67
      }
    ],
    "attempt": "20-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 21,
    "name": "21 / Rails, trick gate, enemy and spring",
    "brief": "Rail transfers → kickflip gate → retracting enemy → bounce crate.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "trick-gate",
        "position": [
          0,
          3.25,
          -85
        ]
      },
      {
        "name": "enemy-and-bounce",
        "position": [
          0,
          3.25,
          -88
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "21 / Safe approach",
        "p": [
          0,
          -0.5,
          0
        ],
        "s": [
          18,
          1,
          22
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "21 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "rail",
        "nm": "21 / First rail",
        "p": [
          0,
          1.2,
          -17.5
        ],
        "len": 25
      },
      {
        "t": "rail",
        "nm": "21 / Right rail",
        "p": [
          3.2,
          1.2,
          -39
        ],
        "len": 34
      },
      {
        "t": "rail",
        "nm": "21 / Left rail",
        "p": [
          0,
          1.2,
          -64.5
        ],
        "len": 31
      },
      {
        "t": "pit",
        "nm": "21 / Rail transfer pit",
        "p": [
          0,
          -6,
          -49
        ],
        "s": [
          18,
          1,
          62
        ],
        "color": "#192e42"
      },
      {
        "t": "ramp",
        "nm": "21 / Return ramp",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 5,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "21 / Return junction",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          8,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "21 / Rail transfer view",
        "p": [
          0,
          4,
          -31
        ],
        "s": [
          21,
          38,
          94
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          11,
          -10
        ],
        "cameraTarget": [
          0,
          2,
          -39
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 2.5,
        "cameraFov": 62
      },
      {
        "t": "camnode",
        "nm": "21 / Return view",
        "p": [
          15,
          -4,
          -44
        ],
        "s": [
          9,
          12,
          120
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -60
        ],
        "cameraTarget": [
          15,
          -3,
          -38
        ],
        "cameraFollowDistance": 14,
        "cameraFollowTargetHeight": 2.5
      },
      {
        "t": "platform",
        "nm": "21 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -46
        ],
        "s": [
          40,
          1,
          136
        ],
        "color": "#929e94"
      },
      {
        "t": "platform",
        "nm": "21 / Enemy and spring terrace",
        "p": [
          0,
          2.6,
          -92
        ],
        "s": [
          12,
          1,
          20
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "enemy",
        "nm": "21 / Retracting enemy",
        "foe": "spinner",
        "p": [
          0,
          3.1,
          -94
        ],
        "range": 0,
        "speed": 1
      },
      {
        "t": "crate",
        "nm": "21 / Bounce crate",
        "kind": "metalbounce",
        "p": [
          0,
          3.1,
          -100
        ]
      },
      {
        "t": "platform",
        "nm": "21 / High receiver",
        "p": [
          6,
          8.8,
          -100
        ],
        "s": [
          5,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "21 / Rails, trick gate, enemy and spring",
        "p": [
          6,
          9.3,
          -100
        ]
      },
      {
        "t": "camnode",
        "nm": "21 / Enemy and high receiver view",
        "p": [
          0,
          7,
          -96
        ],
        "s": [
          25,
          28,
          40
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          20,
          16,
          -91
        ],
        "cameraTarget": [
          0,
          6,
          -97
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4,
        "cameraFov": 65
      },
      {
        "t": "trickgate",
        "nm": "21 / Kickflip gate",
        "p": [
          0,
          4.5,
          -80.5
        ],
        "s": [
          12,
          10,
          0.6
        ],
        "radius": 3,
        "trick": "kick",
        "yaw": 0
      }
    ],
    "attempt": "21-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 22,
    "name": "22 / Two ropes, timed steps and spring",
    "brief": "Two climbing ropes → timed steps → bounce crate → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "upper-timed-steps",
        "position": [
          0,
          18.55,
          -49
        ]
      },
      {
        "name": "final-spring",
        "position": [
          0,
          24.75,
          -77
        ]
      }
    ],
    "components": [
      {
        "t": "checkpoint",
        "nm": "22 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "ropeswing",
        "nm": "22 / First climbing rope",
        "p": [
          0,
          14,
          -18
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 0,
        "yaw": 90
      },
      {
        "t": "platform",
        "nm": "22 / Raised resting platform",
        "p": [
          0,
          8.7,
          -31
        ],
        "s": [
          6,
          1,
          14
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "ropeswing",
        "nm": "22 / Second climbing rope",
        "p": [
          0,
          23.2,
          -37
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 1.7,
        "yaw": 90
      },
      {
        "t": "camnode",
        "nm": "22 / Both ropes and their receiving platforms",
        "p": [
          0,
          8,
          -15
        ],
        "s": [
          40,
          48,
          48
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          17,
          10
        ],
        "cameraTarget": [
          0,
          7,
          -20
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 8,
        "cameraFov": 70
      },
      {
        "t": "camnode",
        "nm": "22 / Upper climb and receiver",
        "p": [
          0,
          16,
          -43
        ],
        "s": [
          40,
          32,
          40
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          23,
          -17
        ],
        "cameraTarget": [
          0,
          16,
          -44
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 65
      },
      {
        "t": "platform",
        "nm": "22 / Flat recovery courtyard",
        "p": [
          0,
          -0.5,
          -42
        ],
        "s": [
          32,
          1,
          112
        ],
        "color": "#849d87"
      },
      {
        "t": "platform",
        "nm": "22 / Upper resting platform",
        "p": [
          0,
          17.9,
          -47
        ],
        "s": [
          8,
          1,
          8
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "phasepad",
        "nm": "22 / Upper timed step 1",
        "p": [
          0,
          19.9,
          -56
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0
      },
      {
        "t": "phasepad",
        "nm": "22 / Upper timed step 2",
        "p": [
          0,
          21.4,
          -63
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.76
      },
      {
        "t": "phasepad",
        "nm": "22 / Upper timed step 3",
        "p": [
          0,
          22.9,
          -70
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.52
      },
      {
        "t": "platform",
        "nm": "22 / Upper spring terrace",
        "p": [
          0,
          24.1,
          -79
        ],
        "s": [
          8,
          1,
          8
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "crate",
        "nm": "22 / Final bounce crate",
        "kind": "metalbounce",
        "p": [
          0,
          24.6,
          -80
        ]
      },
      {
        "t": "platform",
        "nm": "22 / High receiver",
        "p": [
          6,
          30.3,
          -84
        ],
        "s": [
          5,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "22 / Two ropes, timed steps and spring",
        "p": [
          6,
          30.8,
          -84
        ]
      },
      {
        "t": "camnode",
        "nm": "22 / Timed flight and final spring view",
        "p": [
          0,
          25,
          -65
        ],
        "s": [
          30,
          30,
          58
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          4,
          32,
          -38
        ],
        "cameraTarget": [
          0,
          23,
          -66
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 70
      }
    ],
    "attempt": "22-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 23,
    "name": "23 / Two switch groups and climbing rope",
    "brief": "TNT → two revealed spring routes → climbing rope → high platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "upper-rope",
        "position": [
          5,
          20.95,
          -57
        ]
      }
    ],
    "components": [
      {
        "t": "checkpoint",
        "nm": "23 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crate",
        "nm": "23 / TNT trigger",
        "kind": "tnt",
        "p": [
          0,
          0,
          -10
        ]
      },
      {
        "t": "crate",
        "nm": "23 / Enclosed switch",
        "kind": "bang",
        "p": [
          0,
          0,
          -13.1
        ],
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "23 / Transparent front panel",
        "p": [
          0,
          2.75,
          -10.65
        ],
        "s": [
          6,
          5.5,
          0.2
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "23 / Transparent back panel",
        "p": [
          0,
          2.75,
          -15.6
        ],
        "s": [
          6,
          5.5,
          0.2
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "23 / Transparent left panel",
        "p": [
          -3,
          2.75,
          -13.1
        ],
        "s": [
          0.2,
          5.5,
          5.15
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "23 / Transparent right panel",
        "p": [
          3,
          2.75,
          -13.1
        ],
        "s": [
          0.2,
          5.5,
          5.15
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "23 / Enclosure roof",
        "p": [
          0,
          5.65,
          -13.1
        ],
        "s": [
          6.2,
          0.3,
          5.15
        ],
        "tex": "solid",
        "color": "#536c77",
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
        "grindTopTriangles": 2
      },
      {
        "t": "mesh",
        "nm": "23 / First revealed step",
        "p": [
          -7,
          1.7000000000000002,
          -21
        ],
        "s": [
          5,
          1,
          4
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
        "t": "mesh",
        "nm": "23 / Revealed spring terrace",
        "p": [
          -7,
          3.9000000000000004,
          -29
        ],
        "s": [
          6,
          1,
          6
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
        "nm": "23 / Revealed bounce crate",
        "kind": "metalbounce",
        "p": [
          -7,
          4.4,
          -29
        ],
        "outline": true,
        "grp": 2
      },
      {
        "t": "camnode",
        "nm": "23 / TNT, switch and raised route view",
        "p": [
          -2,
          6,
          -20
        ],
        "s": [
          44,
          44,
          78
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          -2,
          14,
          10
        ],
        "cameraTarget": [
          -2,
          5,
          -22
        ],
        "cameraFollowDistance": 19,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 65
      },
      {
        "t": "platform",
        "nm": "23 / Second switch terrace",
        "p": [
          -1,
          9.7,
          -33
        ],
        "s": [
          7,
          1,
          10
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "crate",
        "nm": "23 / Second switch",
        "kind": "bang",
        "p": [
          1,
          10.2,
          -34
        ],
        "grp": 3
      },
      {
        "t": "mesh",
        "nm": "23 / Upper outlined step",
        "p": [
          -1,
          11.9,
          -42
        ],
        "s": [
          5,
          1,
          5
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
        "t": "mesh",
        "nm": "23 / Upper spring terrace",
        "p": [
          -1,
          14.1,
          -50
        ],
        "s": [
          6,
          1,
          6
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
        "t": "crate",
        "nm": "23 / Upper bounce crate",
        "kind": "metalbounce",
        "p": [
          -1,
          14.6,
          -50
        ],
        "outline": true,
        "grp": 3
      },
      {
        "t": "camnode",
        "nm": "23 / Second switch and steps view",
        "p": [
          0,
          16,
          -43
        ],
        "s": [
          30,
          26,
          36
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          5,
          24,
          -18
        ],
        "cameraTarget": [
          0,
          14,
          -43
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 67
      },
      {
        "t": "platform",
        "nm": "23 / Flat recovery courtyard",
        "p": [
          0,
          -0.5,
          -33
        ],
        "s": [
          36,
          1,
          110
        ],
        "color": "#849d87"
      },
      {
        "t": "platform",
        "nm": "23 / Upper rope terrace",
        "p": [
          5,
          20.3,
          -59
        ],
        "s": [
          7,
          1,
          16
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "ropeswing",
        "nm": "23 / Upper climbing rope",
        "p": [
          5,
          34.8,
          -62
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 0.8,
        "yaw": 90
      },
      {
        "t": "platform",
        "nm": "23 / High receiver",
        "p": [
          5,
          29.5,
          -71
        ],
        "s": [
          6,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "23 / Two switch groups and climbing rope",
        "p": [
          5,
          30,
          -72
        ]
      },
      {
        "t": "camnode",
        "nm": "23 / Upper rope and receiver view",
        "p": [
          5,
          28,
          -66
        ],
        "s": [
          28,
          28,
          30
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          9,
          36,
          -40
        ],
        "cameraTarget": [
          5,
          27,
          -67
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 70
      }
    ],
    "attempt": "23-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 24,
    "name": "24 / Rails, enemy, spring, rope and timed steps",
    "brief": "Rail transfers and trick gate → enemy → spring → rope → timed steps.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "enemy-and-bounce",
        "position": [
          0,
          3.25,
          -88
        ]
      },
      {
        "name": "upper-rope",
        "position": [
          6,
          9.45,
          -105
        ]
      },
      {
        "name": "timed-finish",
        "position": [
          6,
          18.65,
          -121
        ]
      }
    ],
    "components": [
      {
        "t": "platform",
        "nm": "24 / Safe approach",
        "p": [
          0,
          -0.5,
          0
        ],
        "s": [
          18,
          1,
          22
        ],
        "color": "#789496"
      },
      {
        "t": "checkpoint",
        "nm": "24 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "rail",
        "nm": "24 / First rail",
        "p": [
          0,
          1.2,
          -17.5
        ],
        "len": 25
      },
      {
        "t": "rail",
        "nm": "24 / Right rail",
        "p": [
          3.2,
          1.2,
          -39
        ],
        "len": 34
      },
      {
        "t": "rail",
        "nm": "24 / Left rail",
        "p": [
          0,
          1.2,
          -64.5
        ],
        "len": 31
      },
      {
        "t": "pit",
        "nm": "24 / Rail transfer pit",
        "p": [
          0,
          -6,
          -49
        ],
        "s": [
          18,
          1,
          62
        ],
        "color": "#192e42"
      },
      {
        "t": "ramp",
        "nm": "24 / Return ramp",
        "p": [
          15,
          -8,
          -7.5
        ],
        "len": 25,
        "rise": 8,
        "w": 5,
        "yaw": 180
      },
      {
        "t": "platform",
        "nm": "24 / Return junction",
        "p": [
          13,
          -0.5,
          10
        ],
        "s": [
          8,
          1,
          10
        ],
        "color": "#789496"
      },
      {
        "t": "camnode",
        "nm": "24 / Rail transfer view",
        "p": [
          0,
          4,
          -31
        ],
        "s": [
          21,
          38,
          94
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          0,
          11,
          -10
        ],
        "cameraTarget": [
          0,
          2,
          -39
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 2.5,
        "cameraFov": 62
      },
      {
        "t": "camnode",
        "nm": "24 / Return view",
        "p": [
          15,
          -4,
          -44
        ],
        "s": [
          9,
          12,
          120
        ],
        "radius": 2,
        "yaw": 180,
        "cameraView": true,
        "cameraPosition": [
          15,
          1,
          -60
        ],
        "cameraTarget": [
          15,
          -3,
          -38
        ],
        "cameraFollowDistance": 14,
        "cameraFollowTargetHeight": 2.5
      },
      {
        "t": "platform",
        "nm": "24 / Enemy and spring terrace",
        "p": [
          0,
          2.6,
          -92
        ],
        "s": [
          12,
          1,
          20
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "enemy",
        "nm": "24 / Retracting enemy",
        "foe": "spinner",
        "p": [
          0,
          3.1,
          -94
        ],
        "range": 0,
        "speed": 1
      },
      {
        "t": "crate",
        "nm": "24 / Bounce crate",
        "kind": "metalbounce",
        "p": [
          0,
          3.1,
          -100
        ]
      },
      {
        "t": "camnode",
        "nm": "24 / Enemy and high receiver view",
        "p": [
          0,
          7,
          -90
        ],
        "s": [
          25,
          28,
          28
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          20,
          16,
          -91
        ],
        "cameraTarget": [
          0,
          6,
          -97
        ],
        "cameraFollowDistance": 18,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 4,
        "cameraFov": 65
      },
      {
        "t": "trickgate",
        "nm": "24 / Kickflip gate",
        "p": [
          0,
          4.5,
          -80.5
        ],
        "s": [
          12,
          10,
          0.6
        ],
        "radius": 3,
        "trick": "kick",
        "yaw": 0
      },
      {
        "t": "platform",
        "nm": "24 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -66
        ],
        "s": [
          40,
          1,
          180
        ],
        "color": "#929e94"
      },
      {
        "t": "platform",
        "nm": "24 / Upper rope terrace",
        "p": [
          6,
          8.8,
          -105
        ],
        "s": [
          7,
          1,
          16
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "ropeswing",
        "nm": "24 / Upper climbing rope",
        "p": [
          6,
          23.3,
          -109
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 0.8,
        "yaw": 90
      },
      {
        "t": "platform",
        "nm": "24 / Timed route waiting bank",
        "p": [
          6,
          18,
          -119
        ],
        "s": [
          8,
          1,
          8
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "phasepad",
        "nm": "24 / Timed finish step 1",
        "p": [
          6,
          20,
          -128
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0
      },
      {
        "t": "phasepad",
        "nm": "24 / Timed finish step 2",
        "p": [
          6,
          21.5,
          -135
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.76
      },
      {
        "t": "phasepad",
        "nm": "24 / Timed finish step 3",
        "p": [
          6,
          23,
          -142
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.52
      },
      {
        "t": "platform",
        "nm": "24 / High receiver",
        "p": [
          6,
          24.2,
          -151
        ],
        "s": [
          8,
          1,
          8
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crystal",
        "nm": "24 / Rails, enemy, spring, rope and timed steps",
        "p": [
          6,
          24.7,
          -152
        ]
      },
      {
        "t": "camnode",
        "nm": "24 / Upper rope view",
        "p": [
          6,
          15,
          -111
        ],
        "s": [
          22,
          30,
          28
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          10,
          25,
          -86
        ],
        "cameraTarget": [
          6,
          14,
          -112
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 70
      },
      {
        "t": "camnode",
        "nm": "24 / Timed finish view",
        "p": [
          6,
          22,
          -137
        ],
        "s": [
          22,
          28,
          42
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          10,
          31,
          -110
        ],
        "cameraTarget": [
          6,
          20,
          -138
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 70
      }
    ],
    "attempt": "24-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  },
  {
    "id": 25,
    "name": "25 / Switches, rope, timed steps and Nitro spring",
    "brief": "TNT and two switches → rope → six timed steps → Nitro-framed spring.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "timed-route",
        "position": [
          5,
          30.15,
          -74
        ]
      },
      {
        "name": "resting-island",
        "position": [
          5,
          36.35,
          -107
        ]
      },
      {
        "name": "nitro-spring",
        "position": [
          5,
          42.55,
          -136
        ]
      }
    ],
    "components": [
      {
        "t": "checkpoint",
        "nm": "25 / Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crate",
        "nm": "25 / TNT trigger",
        "kind": "tnt",
        "p": [
          0,
          0,
          -10
        ]
      },
      {
        "t": "crate",
        "nm": "25 / Enclosed switch",
        "kind": "bang",
        "p": [
          0,
          0,
          -13.1
        ],
        "grp": 2
      },
      {
        "t": "mesh",
        "nm": "25 / Transparent front panel",
        "p": [
          0,
          2.75,
          -10.65
        ],
        "s": [
          6,
          5.5,
          0.2
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "25 / Transparent back panel",
        "p": [
          0,
          2.75,
          -15.6
        ],
        "s": [
          6,
          5.5,
          0.2
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "25 / Transparent left panel",
        "p": [
          -3,
          2.75,
          -13.1
        ],
        "s": [
          0.2,
          5.5,
          5.15
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "25 / Transparent right panel",
        "p": [
          3,
          2.75,
          -13.1
        ],
        "s": [
          0.2,
          5.5,
          5.15
        ],
        "tex": "solid",
        "color": "#83c5d0",
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
        "opacity": 0.2
      },
      {
        "t": "mesh",
        "nm": "25 / Enclosure roof",
        "p": [
          0,
          5.65,
          -13.1
        ],
        "s": [
          6.2,
          0.3,
          5.15
        ],
        "tex": "solid",
        "color": "#536c77",
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
        "grindTopTriangles": 2
      },
      {
        "t": "mesh",
        "nm": "25 / First revealed step",
        "p": [
          -7,
          1.7000000000000002,
          -21
        ],
        "s": [
          5,
          1,
          4
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
        "t": "mesh",
        "nm": "25 / Revealed spring terrace",
        "p": [
          -7,
          3.9000000000000004,
          -29
        ],
        "s": [
          6,
          1,
          6
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
        "nm": "25 / Revealed bounce crate",
        "kind": "metalbounce",
        "p": [
          -7,
          4.4,
          -29
        ],
        "outline": true,
        "grp": 2
      },
      {
        "t": "camnode",
        "nm": "25 / TNT, switch and raised route view",
        "p": [
          -2,
          6,
          -20
        ],
        "s": [
          44,
          44,
          78
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          -2,
          14,
          10
        ],
        "cameraTarget": [
          -2,
          5,
          -22
        ],
        "cameraFollowDistance": 19,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 65
      },
      {
        "t": "platform",
        "nm": "25 / Second switch terrace",
        "p": [
          -1,
          9.7,
          -33
        ],
        "s": [
          7,
          1,
          10
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "crate",
        "nm": "25 / Second switch",
        "kind": "bang",
        "p": [
          1,
          10.2,
          -34
        ],
        "grp": 3
      },
      {
        "t": "mesh",
        "nm": "25 / Upper outlined step",
        "p": [
          -1,
          11.9,
          -42
        ],
        "s": [
          5,
          1,
          5
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
        "t": "mesh",
        "nm": "25 / Upper spring terrace",
        "p": [
          -1,
          14.1,
          -50
        ],
        "s": [
          6,
          1,
          6
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
        "t": "crate",
        "nm": "25 / Upper bounce crate",
        "kind": "metalbounce",
        "p": [
          -1,
          14.6,
          -50
        ],
        "outline": true,
        "grp": 3
      },
      {
        "t": "camnode",
        "nm": "25 / Second switch and steps view",
        "p": [
          0,
          16,
          -43
        ],
        "s": [
          30,
          26,
          36
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          5,
          24,
          -18
        ],
        "cameraTarget": [
          0,
          14,
          -43
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 67
      },
      {
        "t": "platform",
        "nm": "25 / Upper rope terrace",
        "p": [
          5,
          20.3,
          -59
        ],
        "s": [
          7,
          1,
          16
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "ropeswing",
        "nm": "25 / Upper climbing rope",
        "p": [
          5,
          34.8,
          -62
        ],
        "len": 12,
        "amp": 0.65,
        "speed": 0.85,
        "phase": 0.8,
        "yaw": 90
      },
      {
        "t": "camnode",
        "nm": "25 / Upper rope and receiver view",
        "p": [
          5,
          28,
          -66
        ],
        "s": [
          28,
          28,
          30
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          9,
          36,
          -40
        ],
        "cameraTarget": [
          5,
          27,
          -67
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 70
      },
      {
        "t": "platform",
        "nm": "25 / Flat recovery courtyard",
        "p": [
          0,
          -0.5,
          -68
        ],
        "s": [
          40,
          1,
          180
        ],
        "color": "#849d87"
      },
      {
        "t": "platform",
        "nm": "25 / Upper timed route bank",
        "p": [
          5,
          29.5,
          -72
        ],
        "s": [
          8,
          1,
          8
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "phasepad",
        "nm": "25 / Lower timed step 1",
        "p": [
          5,
          31.5,
          -81
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0
      },
      {
        "t": "phasepad",
        "nm": "25 / Lower timed step 2",
        "p": [
          5,
          33,
          -88
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.76
      },
      {
        "t": "phasepad",
        "nm": "25 / Lower timed step 3",
        "p": [
          5,
          34.5,
          -95
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 8,
        "amp": 0.55,
        "phase": 0.52
      },
      {
        "t": "platform",
        "nm": "25 / Permanent resting island",
        "p": [
          5,
          35.7,
          -104
        ],
        "s": [
          8,
          1,
          12
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "phasepad",
        "nm": "25 / Upper timed step 1",
        "p": [
          5,
          37.7,
          -115
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 9,
        "amp": 0.55,
        "phase": 0
      },
      {
        "t": "phasepad",
        "nm": "25 / Upper timed step 2",
        "p": [
          5,
          39.2,
          -122
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 9,
        "amp": 0.55,
        "phase": 0.78
      },
      {
        "t": "phasepad",
        "nm": "25 / Upper timed step 3",
        "p": [
          5,
          40.7,
          -129
        ],
        "s": [
          4,
          0.6,
          4
        ],
        "cycle": 9,
        "amp": 0.55,
        "phase": 0.56
      },
      {
        "t": "platform",
        "nm": "25 / Nitro spring terrace",
        "p": [
          5,
          41.9,
          -138
        ],
        "s": [
          8,
          1,
          8
        ],
        "color": "#a8b9a0"
      },
      {
        "t": "crate",
        "nm": "25 / Final bounce crate",
        "kind": "metalbounce",
        "p": [
          5,
          42.4,
          -139
        ]
      },
      {
        "t": "crate",
        "nm": "25 / Nitro beside final spring",
        "kind": "nitro",
        "p": [
          3,
          42.4,
          -139
        ]
      },
      {
        "t": "crate",
        "nm": "25 / Nitro beside final spring",
        "kind": "nitro",
        "p": [
          7,
          42.4,
          -139
        ]
      },
      {
        "t": "platform",
        "nm": "25 / Final receiver",
        "p": [
          11,
          48.1,
          -143
        ],
        "s": [
          5,
          1,
          6
        ],
        "color": "#d8b26e"
      },
      {
        "t": "crate",
        "nm": "25 / Nitro at receiver rear",
        "kind": "nitro",
        "p": [
          9.2,
          48.6,
          -145
        ]
      },
      {
        "t": "crate",
        "nm": "25 / Nitro at receiver rear",
        "kind": "nitro",
        "p": [
          12.8,
          48.6,
          -145
        ]
      },
      {
        "t": "crystal",
        "nm": "25 / Switches, rope, timed steps and Nitro spring",
        "p": [
          11,
          48.6,
          -143
        ]
      },
      {
        "t": "camnode",
        "nm": "25 / Lower timed flight view",
        "p": [
          5,
          35,
          -92
        ],
        "s": [
          30,
          28,
          44
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          9,
          43,
          -67
        ],
        "cameraTarget": [
          5,
          33,
          -93
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 70
      },
      {
        "t": "camnode",
        "nm": "25 / Upper timed flight and Nitro view",
        "p": [
          5,
          42,
          -127
        ],
        "s": [
          34,
          30,
          50
        ],
        "radius": 3,
        "cameraView": true,
        "cameraPresentationOnly": true,
        "cameraPosition": [
          9,
          50,
          -102
        ],
        "cameraTarget": [
          5,
          40,
          -128
        ],
        "cameraFollowDistance": 20,
        "cameraKeepDistance": true,
        "cameraFollowTargetHeight": 5,
        "cameraFov": 70
      }
    ],
    "attempt": "25-p",
    "reason": "Previous platforming layout; replaced by a route sized for continuous skating."
  }
];
