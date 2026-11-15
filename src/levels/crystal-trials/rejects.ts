import type { RejectedCrystalTrial } from './types';

/** Abandoned layouts remain playable and editable in the rejects stage. */
export const REJECTED_CRYSTAL_TRIALS: RejectedCrystalTrial[] = [
  {
    "id": 1,
    "name": "1 / Bounce crate",
    "brief": "Bounce crate \u2192 airborne crystal.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "attempt": "01-a",
    "reason": "Full 1280x720 approach review: the crystal and its name are outside the camera. Replaced by an authored wider presentation view.",
    "components": [
      {
        "t": "platform",
        "nm": "Original landing floor",
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
        "nm": "Original checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crate",
        "nm": "Original arrow spring",
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
        "t": "platform",
        "nm": "Original rear rim",
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
    ]
  },
  {
    "id": 2,
    "name": "2 / Trampoline and high platform",
    "brief": "Trampoline \u2192 high platform.",
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
          4.2,
          -15.6
        ],
        "s": [
          0.8,
          8.4,
          0.8
        ],
        "color": "#536c77"
      },
      {
        "t": "platform",
        "nm": "02 / Right bell pillar",
        "p": [
          8.85,
          4.2,
          -15.6
        ],
        "s": [
          0.8,
          8.4,
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
    "attempt": "02-a",
    "reason": "Native full-resolution review showed that the arch lintel floated above its piers. The playable spring/balcony route passed. Replaced by full-height rear piers."
  },
  {
    "id": 3,
    "name": "3 / Long rail over a pit",
    "brief": "Long rail over a death pit \u2192 raised platform.",
    "spawn": [
      0,
      0.15,
      5
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
        "nm": "03 / Wide return landing",
        "p": [
          11,
          -0.5,
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
        "nm": "03 / Return promenade outside the pit",
        "p": [
          15,
          -0.5,
          -40
        ],
        "s": [
          6,
          1,
          82
        ],
        "color": "#789496"
      },
      {
        "t": "platform",
        "nm": "03 / Return joins the observation promenade",
        "p": [
          10,
          -0.5,
          5
        ],
        "s": [
          16,
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
          30,
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
      }
    ],
    "attempt": "03-a",
    "reason": "The ground-level return walkway allowed climbing onto the reward deck without riding the rail; its near join also intercepted the first grind with a platform edge. Replaced by a lower one-way return and a join farther from the rail catch."
  },
  {
    "id": 3,
    "name": "3 / Long rail over a pit",
    "brief": "Long rail over a death pit \u2192 raised platform.",
    "spawn": [
      0,
      0.15,
      5
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
          5
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
          30,
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
      }
    ],
    "attempt": "03-b",
    "reason": "The charged grind pop and crystal passed, but the flat return junction started before the rising ramp reached its height. Native walking caught the unintended lip. Moved the junction to the actual ramp top."
  },
  {
    "id": 6,
    "name": "6 / Climbing rope and high platform",
    "brief": "Climbing rope \u2192 high framed platform.",
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
          6.5,
          -25
        ],
        "s": [
          1.2,
          13,
          1.2
        ],
        "color": "#aa9875"
      },
      {
        "t": "platform",
        "nm": "06 / Window right pier",
        "p": [
          3.8,
          6.5,
          -25
        ],
        "s": [
          1.2,
          13,
          1.2
        ],
        "color": "#aa9875"
      },
      {
        "t": "platform",
        "nm": "06 / Window lintel",
        "p": [
          0,
          13,
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
    "attempt": "06-a",
    "reason": "The 13m lintel catches the normal climbed release at its apex and pulls the player onto the roof instead of through the intended window."
  },
  {
    "id": 7,
    "name": "7 / Timed steps",
    "brief": "Three timed steps \u2192 raised platform.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
      {
        "name": "lower-recovery",
        "position": [
          9,
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
          42,
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
      }
    ],
    "attempt": "07-a",
    "reason": "The initial camera keeps facing the goal during lower-route recovery; the entrance bank obscures the view back toward the retry ramp."
  },
  {
    "id": 7,
    "name": "7 / Timed steps",
    "brief": "Three timed steps \u2192 raised platform.",
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
          42,
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
          -1,
          -24
        ],
        "s": [
          9,
          26,
          62
        ],
        "radius": 2,
        "cameraView": true,
        "cameraPresentationOnly": true,
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
    "attempt": "07-b",
    "reason": "An added return camera was fully overlapped by the first camera volume, which wins equal-weight matches; its intended return view therefore could not activate."
  },
  {
    "id": 7,
    "name": "7 / Timed steps",
    "brief": "Three timed steps \u2192 raised platform.",
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
          24,
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
          -1,
          -24
        ],
        "s": [
          9,
          26,
          80
        ],
        "radius": 2,
        "cameraView": true,
        "cameraPresentationOnly": true,
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
    "attempt": "07-c",
    "reason": "The return view turns toward the ramp, but its presentation-only setting leaves movement axes facing the opposite direction. Replaced with an authored camera and matching 180-degree control frame."
  },
  {
    "id": 8,
    "name": "8 / Switch, steps and bounce crate",
    "brief": "Switch \u2192 two raised steps \u2192 bounce crate \u2192 high platform.",
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
        "t": "platform",
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
        "grp": 2
      },
      {
        "t": "platform",
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
        "grp": 2
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
    "attempt": "08-a",
    "reason": "The platform builder does not apply outline collision membership, so both proposed ghost steps remain solid before the switch is used. Replaced with supported outlined mesh boxes."
  },
  {
    "id": 0,
    "name": "0 / Ramp junction",
    "brief": "Flat floor, ramp and overlapping entrance landing.",
    "spawn": [
      0,
      -7.85,
      80
    ],
    "attempt": "0-b",
    "reason": "The landing overlaps the ramp before it reaches full height, creating a 0.2 m vertical step that blocks normal walking.",
    "components": [
      {
        "t": "platform",
        "nm": "0 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -20
        ],
        "s": [
          84,
          1,
          232
        ]
      },
      {
        "t": "ramp",
        "nm": "0 / Overlapping approach ramp",
        "p": [
          0,
          -8,
          32
        ],
        "len": 40,
        "rise": 8,
        "w": 8
      },
      {
        "t": "platform",
        "nm": "0 / Overlapping landing",
        "p": [
          0,
          -0.5,
          10
        ],
        "s": [
          18,
          1,
          6
        ]
      },
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
        "color": "#789496",
        "grp": 1
      },
      {
        "t": "checkpoint",
        "nm": "01 / First Lift start",
        "p": [
          -4,
          0,
          5
        ],
        "grp": 1
      },
      {
        "t": "crate",
        "nm": "01 / Reusable arrow spring",
        "kind": "metalbounce",
        "p": [
          0,
          0,
          -5
        ],
        "grp": 1
      },
      {
        "t": "crystal",
        "nm": "0 / Ramp junction",
        "p": [
          0,
          6.1,
          -5
        ],
        "grp": 1
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
        "cameraAspect": 1.7777777777777777,
        "grp": 1
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
        "color": "#d5b376",
        "grp": 1
      }
    ]
  },
  {
    "id": 3,
    "name": "3 / Long rail over a pit",
    "brief": "Long rail over a death pit \u2192 raised platform.",
    "spawn": [
      0,
      0.15,
      5
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
          30,
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
      }
    ],
    "attempt": "03-c",
    "reason": "The lower return camera faces the receiving crystal instead of the uphill return."
  },
  {
    "id": 4,
    "name": "4 / Moving platform and lift",
    "brief": "Moving platform \u2192 fixed island \u2192 lift \u2192 high platform.",
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
          38,
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
      }
    ],
    "attempt": "04-a",
    "reason": "The wide presentation volume keeps the lower return facing away from its ramp."
  },
  {
    "id": 10,
    "name": "10 / Folding bridge and small platform",
    "brief": "Spin-open bridge \u2192 timed crossing \u2192 small raised platform.",
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
          0,
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
    "attempt": "10-a",
    "reason": "The closed vertical bridge hides the small receiver and crystal in the straight-on approach view."
  },
  {
    "id": 0,
    "name": "0 / Overlapping flat landing",
    "brief": "Flat ramp landing overlapping the challenge floor.",
    "spawn": [
      0,
      -7.85,
      80
    ],
    "attempt": "0-c",
    "reason": "The entrance is walkable but its coplanar landing overlaps the first challenge floor and flickers.",
    "components": [
      {
        "t": "platform",
        "nm": "0 / Flat recovery floor",
        "p": [
          0,
          -8.5,
          -20
        ],
        "s": [
          84,
          1,
          232
        ]
      },
      {
        "t": "ramp",
        "nm": "0 / Overlapping approach ramp",
        "p": [
          0,
          -8,
          44
        ],
        "len": 40,
        "rise": 8,
        "w": 8
      },
      {
        "t": "platform",
        "nm": "0 / Overlapping landing",
        "p": [
          0,
          -0.5,
          16
        ],
        "s": [
          18,
          1,
          16
        ]
      },
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
        "color": "#789496",
        "grp": 1
      },
      {
        "t": "checkpoint",
        "nm": "01 / First Lift start",
        "p": [
          -4,
          0,
          5
        ],
        "grp": 1
      },
      {
        "t": "crate",
        "nm": "01 / Reusable arrow spring",
        "kind": "metalbounce",
        "p": [
          0,
          0,
          -5
        ],
        "grp": 1
      },
      {
        "t": "crystal",
        "nm": "0 / Overlapping flat landing",
        "p": [
          0,
          6.1,
          -5
        ],
        "grp": 1
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
        "cameraAspect": 1.7777777777777777,
        "grp": 1
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
        "color": "#d5b376",
        "grp": 1
      }
    ]
  },
  {
    "id": 17,
    "name": "17 / Rails, timed enemy and bounce crate",
    "brief": "Three offset rails \u2192 retracting enemy \u2192 bounce crate \u2192 high platform.",
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
        "nm": "17 // Safe approach",
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
        "nm": "17 // Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "rail",
        "nm": "17 // First rail",
        "p": [
          0,
          1.2,
          -17.5
        ],
        "len": 25
      },
      {
        "t": "rail",
        "nm": "17 // Right rail",
        "p": [
          3.2,
          1.2,
          -39
        ],
        "len": 34
      },
      {
        "t": "rail",
        "nm": "17 // Left rail",
        "p": [
          0,
          1.2,
          -64.5
        ],
        "len": 31
      },
      {
        "t": "pit",
        "nm": "17 // Rail transfer pit",
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
        "nm": "17 // Return ramp",
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
        "nm": "17 // Return junction",
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
        "nm": "17 // Rail transfer view",
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
        "nm": "17 // Return view",
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
          -90
        ],
        "s": [
          12,
          1,
          24
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
    "attempt": "17-a",
    "reason": "The enlarged enemy terrace started too close to the last rail, so the normal pop hit its front face."
  },
  {
    "id": 12,
    "name": "12 / Trampoline and airborne bounce crate",
    "brief": "Trampoline \u2192 airborne bounce crate \u2192 high platform.",
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
        "cameraFollowTargetHeight": 6.5,
        "cameraFov": 67
      }
    ],
    "attempt": "12-a",
    "reason": "The high crystal clipped the top of the approach view."
  },
  {
    "id": 16,
    "name": "16 / Nitro frames and two launchers",
    "brief": "Trampoline \u2192 bounce crate between Nitro \u2192 narrow high landing.",
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
        "cameraFollowTargetHeight": 6.5,
        "cameraFov": 67
      }
    ],
    "attempt": "16-a",
    "reason": "The high Nitro receiver clipped the top of the approach view."
  },
  {
    "id": 19,
    "name": "19 / Crumbling steps and bounce crate",
    "brief": "Six crumbling steps with a rest \u2192 bounce crate \u2192 high platform.",
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
        "nm": "19 // Waiting bank",
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
        "nm": "19 // Flat recovery floor",
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
        "nm": "19 // Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crumble",
        "nm": "19 // Lower crumbling step 1",
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
        "shake": 1.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "crumble",
        "nm": "19 // Lower crumbling step 2",
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
        "shake": 1.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "crumble",
        "nm": "19 // Lower crumbling step 3",
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
        "shake": 1.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "platform",
        "nm": "19 // Permanent resting island",
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
        "nm": "19 // Upper crumbling step 1",
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
        "shake": 1.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "crumble",
        "nm": "19 // Upper crumbling step 2",
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
        "shake": 1.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "crumble",
        "nm": "19 // Upper crumbling step 3",
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
        "shake": 1.8,
        "speed": 30,
        "color": "#ae987d"
      },
      {
        "t": "platform",
        "nm": "19 // High receiver",
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
        "nm": "19 // Return ramp",
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
        "nm": "19 // Return junction",
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
        "nm": "19 // Crumbling platforms view",
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
        "nm": "19 // Return view",
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
    "attempt": "19-a",
    "reason": "The first crumbling platform fell before a measured walk-and-charge transfer could finish."
  },
  {
    "id": 20,
    "name": "20 / TNT and two switch groups",
    "brief": "TNT switch \u2192 revealed steps and spring \u2192 second switch \u2192 upper spring.",
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
        "t": "platform",
        "nm": "20 // Flat courtyard",
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
        "nm": "20 // Checkpoint",
        "p": [
          -4,
          0,
          5
        ]
      },
      {
        "t": "crate",
        "nm": "20 // TNT trigger",
        "kind": "tnt",
        "p": [
          0,
          0,
          -10
        ]
      },
      {
        "t": "crate",
        "nm": "20 // Enclosed switch",
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
        "nm": "20 // Transparent front panel",
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
        "nm": "20 // Transparent back panel",
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
        "nm": "20 // Transparent left panel",
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
        "nm": "20 // Transparent right panel",
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
        "nm": "20 // Enclosure roof",
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
        "nm": "20 // First revealed step",
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
        "nm": "20 // Revealed spring terrace",
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
        "nm": "20 // Revealed bounce crate",
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
        "nm": "20 // TNT, switch and raised route view",
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
    "attempt": "20-a",
    "reason": "The expanded courtyard duplicated the original floor and caused coplanar surfaces."
  },
  {
    "id": 13,
    "name": "13 / Two climbing ropes",
    "brief": "Climbing rope \u2192 raised rest \u2192 second climbing rope \u2192 high platform.",
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
        "cameraFollowTargetHeight": 6.5,
        "cameraFov": 67
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
    "attempt": "13-a",
    "reason": "The inherited lower rope view clipped the upper route at the top of the approach frame."
  },
  {
    "id": 18,
    "name": "18 / Two ropes and moving platform",
    "brief": "Climbing rope \u2192 moving rest \u2192 second rope \u2192 high platform.",
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
        "cameraFollowTargetHeight": 6.5,
        "cameraFov": 67
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
    "attempt": "18-a",
    "reason": "The inherited lower rope view clipped the upper route at the top of the approach frame."
  },
  {
    "id": 22,
    "name": "22 / Two ropes, timed steps and spring",
    "brief": "Two climbing ropes \u2192 timed steps \u2192 bounce crate \u2192 high platform.",
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
        "cameraFollowTargetHeight": 6.5,
        "cameraFov": 67
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
    "attempt": "22-a",
    "reason": "The inherited lower rope view clipped the upper route at the top of the approach frame."
  },
  {
    "id": 21,
    "name": "21 / Rails, trick gate, enemy and spring",
    "brief": "Rail transfers \u2192 kickflip gate \u2192 retracting enemy \u2192 bounce crate.",
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
    "attempt": "21-a",
    "reason": "The rail camera continued behind the trick gate and its frame obscured the enemy terrace."
  },
  {
    "id": 24,
    "name": "24 / Rails, enemy, spring, rope and timed steps",
    "brief": "Rail transfers and trick gate \u2192 enemy \u2192 spring \u2192 rope \u2192 timed steps.",
    "spawn": [
      0,
      0.15,
      5
    ],
    "reviewViews": [
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
    "attempt": "24-a",
    "reason": "The rail camera continued behind the trick gate and its frame obscured the enemy terrace."
  },
  {
    "id": 24,
    "name": "24 / Rails, enemy, spring, rope and timed steps",
    "brief": "Rail transfers and trick gate \u2192 enemy \u2192 spring \u2192 rope \u2192 timed steps.",
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
    "attempt": "24-b",
    "reason": "The gate-clearance camera extended into the upper rope terrace and pushed its receiving platform out of frame."
  }
];
