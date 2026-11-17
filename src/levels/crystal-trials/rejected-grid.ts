import type { CustomLevelData } from '../../level';

/** Preserved before the requested linear corridor replaced this grid. */
export const REJECTED_GRID: CustomLevelData = {
  "v": 1,
  "name": "Rejected layout 0 / Original grid",
  "spawn": [
    -24,
    0.15,
    20
  ],
  "killY": -24,
  "skatepark": false,
  "alwaysSkate": false,
  "crystalTrials": "archive",
  "startWarpPad": false,
  "hugeDropBail": false,
  "sky": "sunset",
  "groups": [
    {
      "id": 1,
      "nm": "01 / First Lift"
    },
    {
      "id": 101,
      "nm": "02 / Bell Tower"
    },
    {
      "id": 201,
      "nm": "03 / Needle Viaduct"
    },
    {
      "id": 301,
      "nm": "04 / Passing Platforms"
    },
    {
      "id": 401,
      "nm": "05 / Skylight"
    },
    {
      "id": 501,
      "nm": "06 / Vine Window"
    },
    {
      "id": 601,
      "nm": "07 / Vanishing Stairs"
    },
    {
      "id": 701,
      "nm": "08 / Outline Orchard"
    },
    {
      "id": 702,
      "nm": "08 / Outline Orchard"
    }
  ],
  "components": [
    {
      "t": "platform",
      "nm": "Arrival and exit garden",
      "p": [
        -26,
        -0.5,
        28
      ],
      "s": [
        40,
        1,
        32
      ],
      "color": "#789496"
    },
    {
      "t": "gate",
      "nm": "Return after the crystals",
      "p": [
        -28,
        0,
        29
      ]
    },
    {
      "t": "platform",
      "nm": "West promenade",
      "p": [
        -44,
        -0.5,
        -52
      ],
      "s": [
        12,
        1,
        256
      ],
      "color": "#789496"
    },
    {
      "t": "platform",
      "nm": "Wing 1 / observation promenade",
      "p": [
        180,
        -0.5,
        14
      ],
      "s": [
        512,
        1,
        12
      ],
      "color": "#b6a076"
    },
    {
      "t": "platform",
      "nm": "Wing 2 / observation promenade",
      "p": [
        84,
        -0.5,
        -114
      ],
      "s": [
        320,
        1,
        12
      ],
      "color": "#b6a076"
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
      "nm": "1 / Bounce crate",
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
    },
    {
      "t": "platform",
      "nm": "02 / Courtyard and local retry",
      "p": [
        99,
        -0.5,
        -10
      ],
      "s": [
        30,
        1,
        42
      ],
      "color": "#829a94",
      "grp": 101
    },
    {
      "t": "checkpoint",
      "nm": "02 / Bell Tower start",
      "p": [
        92,
        0,
        5
      ],
      "grp": 101
    },
    {
      "t": "trampoline",
      "nm": "02 / Bell spring",
      "p": [
        96,
        0.12,
        -8
      ],
      "s": [
        6,
        0.45,
        6
      ],
      "speed": 22,
      "amp": 1.25,
      "grp": 101
    },
    {
      "t": "platform",
      "nm": "02 / High bell balcony",
      "p": [
        102,
        7.9,
        -13
      ],
      "s": [
        4.6,
        1,
        5.2
      ],
      "color": "#d8b26e",
      "grp": 101
    },
    {
      "t": "crystal",
      "nm": "2 / Trampoline and high platform",
      "p": [
        102,
        8.4,
        -13
      ],
      "grp": 101
    },
    {
      "t": "platform",
      "nm": "02 / Left bell pillar",
      "p": [
        99.15,
        6.15,
        -15.6
      ],
      "s": [
        0.8,
        12.3,
        0.8
      ],
      "color": "#536c77",
      "grp": 101
    },
    {
      "t": "platform",
      "nm": "02 / Right bell pillar",
      "p": [
        104.85,
        6.15,
        -15.6
      ],
      "s": [
        0.8,
        12.3,
        0.8
      ],
      "color": "#536c77",
      "grp": 101
    },
    {
      "t": "platform",
      "nm": "02 / Bell arch lintel",
      "p": [
        102,
        12.6,
        -15.6
      ],
      "s": [
        6.5,
        0.6,
        0.8
      ],
      "color": "#d8b26e",
      "grp": 101
    },
    {
      "t": "camnode",
      "nm": "02 / Spring and bell balcony in one view",
      "p": [
        99,
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
        99,
        11,
        18
      ],
      "cameraTarget": [
        99,
        5,
        -10
      ],
      "cameraFollowDistance": 18,
      "cameraKeepDistance": true,
      "cameraFollowTargetHeight": 4.5,
      "cameraFov": 58,
      "cameraAspect": 1.7777777777777777,
      "grp": 101
    },
    {
      "t": "platform",
      "nm": "03 / Safe catch and balance practice",
      "p": [
        192,
        -0.5,
        -6
      ],
      "s": [
        18,
        1,
        32
      ],
      "color": "#809b9b",
      "grp": 201
    },
    {
      "t": "checkpoint",
      "nm": "03 / Viaduct start",
      "p": [
        188,
        0,
        5
      ],
      "grp": 201
    },
    {
      "t": "rail",
      "nm": "03 / Needle rail",
      "p": [
        192,
        1.2,
        -41
      ],
      "len": 72,
      "yaw": 0,
      "grp": 201
    },
    {
      "t": "pit",
      "nm": "03 / Visible pit beneath the silver line",
      "p": [
        192,
        -6,
        -50
      ],
      "s": [
        18,
        1,
        54
      ],
      "color": "#192e42",
      "grp": 201
    },
    {
      "t": "platform",
      "nm": "03 / Raised crystal receiver",
      "p": [
        192,
        2.6,
        -84
      ],
      "s": [
        8,
        1,
        12
      ],
      "color": "#d8b26e",
      "grp": 201
    },
    {
      "t": "crystal",
      "nm": "3 / Long rail over a pit",
      "p": [
        192,
        3.1,
        -84
      ],
      "grp": 201
    },
    {
      "t": "platform",
      "nm": "03 / Wide one-way return landing",
      "p": [
        203,
        -8.5,
        -84
      ],
      "s": [
        10,
        1,
        12
      ],
      "color": "#789496",
      "grp": 201
    },
    {
      "t": "platform",
      "nm": "03 / Lower return outside the pit",
      "p": [
        207,
        -8.5,
        -52
      ],
      "s": [
        6,
        1,
        64
      ],
      "color": "#789496",
      "grp": 201
    },
    {
      "t": "ramp",
      "nm": "03 / Return climb to the approach",
      "p": [
        207,
        -8,
        -7.5
      ],
      "len": 25,
      "rise": 8,
      "w": 6,
      "yaw": 180,
      "grp": 201
    },
    {
      "t": "platform",
      "nm": "03 / Return joins the observation promenade",
      "p": [
        205,
        -0.5,
        10
      ],
      "s": [
        10,
        1,
        10
      ],
      "color": "#789496",
      "grp": 201
    },
    {
      "t": "camnode",
      "nm": "03 / Read the pit, line and raised receiver",
      "p": [
        192,
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
        192,
        11,
        -14
      ],
      "cameraTarget": [
        192,
        2,
        -39
      ],
      "cameraFollowDistance": 16,
      "cameraKeepDistance": true,
      "cameraFollowTargetHeight": 2,
      "cameraFov": 58,
      "cameraAspect": 1.7777777777777777,
      "grp": 201
    },
    {
      "t": "platform",
      "nm": "04 / Ferry observation bank",
      "p": [
        288,
        -0.5,
        3
      ],
      "s": [
        18,
        1,
        16
      ],
      "color": "#809b9b",
      "grp": 301
    },
    {
      "t": "checkpoint",
      "nm": "04 / Passing Platforms start",
      "p": [
        284,
        0,
        5
      ],
      "grp": 301
    },
    {
      "t": "mover",
      "nm": "04 / Horizontal ferry",
      "p": [
        288,
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
      "color": "#a8a3d8",
      "grp": 301
    },
    {
      "t": "platform",
      "nm": "04 / Fixed island between moving transfers",
      "p": [
        288,
        -0.5,
        -29
      ],
      "s": [
        10,
        1,
        10
      ],
      "color": "#789496",
      "grp": 301
    },
    {
      "t": "mover",
      "nm": "04 / Gallery lift",
      "p": [
        288,
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
      "color": "#a8a3d8",
      "grp": 301
    },
    {
      "t": "platform",
      "nm": "04 / High crystal gallery",
      "p": [
        288,
        7.9,
        -49
      ],
      "s": [
        8,
        1,
        10
      ],
      "color": "#d8b26e",
      "grp": 301
    },
    {
      "t": "crystal",
      "nm": "4 / Moving platform and lift",
      "p": [
        288,
        8.4,
        -50
      ],
      "grp": 301
    },
    {
      "t": "pit",
      "nm": "04 / Water below the moving route",
      "p": [
        288,
        -6,
        -25
      ],
      "s": [
        16,
        1,
        42
      ],
      "color": "#192e42",
      "grp": 301
    },
    {
      "t": "platform",
      "nm": "04 / Broad lower return landing",
      "p": [
        303,
        -8.5,
        -50
      ],
      "s": [
        12,
        1,
        12
      ],
      "color": "#789496",
      "grp": 301
    },
    {
      "t": "platform",
      "nm": "04 / Lower return outside the pit",
      "p": [
        303,
        -8.5,
        -35
      ],
      "s": [
        6,
        1,
        30
      ],
      "color": "#789496",
      "grp": 301
    },
    {
      "t": "ramp",
      "nm": "04 / Return climb",
      "p": [
        303,
        -8,
        -7.5
      ],
      "len": 25,
      "rise": 8,
      "w": 6,
      "yaw": 180,
      "grp": 301
    },
    {
      "t": "platform",
      "nm": "04 / Upper return junction",
      "p": [
        301,
        -0.5,
        10
      ],
      "s": [
        10,
        1,
        10
      ],
      "color": "#789496",
      "grp": 301
    },
    {
      "t": "camnode",
      "nm": "04 / Observe both machines and their receivers",
      "p": [
        288,
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
        288,
        11,
        1
      ],
      "cameraTarget": [
        288,
        3.2,
        -25
      ],
      "cameraFollowDistance": 18,
      "cameraKeepDistance": true,
      "cameraFollowTargetHeight": 3.2,
      "cameraFov": 58,
      "cameraAspect": 1.7777777777777777,
      "grp": 301
    },
    {
      "t": "platform",
      "nm": "05 / Open halfpipe approach",
      "p": [
        384,
        -0.5,
        -5
      ],
      "s": [
        24,
        1,
        32
      ],
      "color": "#809b9b",
      "grp": 401
    },
    {
      "t": "checkpoint",
      "nm": "05 / Skylight start",
      "p": [
        380,
        0,
        5
      ],
      "grp": 401
    },
    {
      "t": "vertramp",
      "nm": "05 / Pumping halfpipe",
      "p": [
        384,
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
      "skateCamera": true,
      "grp": 401
    },
    {
      "t": "crystal",
      "nm": "5 / Halfpipe and high crystal",
      "p": [
        393,
        9.8,
        -33
      ],
      "grp": 401
    },
    {
      "t": "camnode",
      "nm": "05 / See the pipe and high crystal",
      "p": [
        384,
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
        384,
        13,
        8
      ],
      "cameraTarget": [
        384,
        4,
        -22
      ],
      "cameraFollowDistance": 22,
      "cameraKeepDistance": true,
      "cameraFollowTargetHeight": 4,
      "cameraFov": 65,
      "cameraAspect": 1.7777777777777777,
      "grp": 401
    },
    {
      "t": "platform",
      "nm": "06 / Rope courtyard and missed-release recovery",
      "p": [
        0,
        -0.5,
        -140
      ],
      "s": [
        26,
        1,
        50
      ],
      "color": "#849c8d",
      "grp": 501
    },
    {
      "t": "checkpoint",
      "nm": "06 / Vine Window start",
      "p": [
        -4,
        0,
        -123
      ],
      "grp": 501
    },
    {
      "t": "ropeswing",
      "nm": "06 / Climbing vine",
      "p": [
        0,
        14,
        -146
      ],
      "len": 12,
      "amp": 0.65,
      "speed": 0.85,
      "phase": 0,
      "yaw": 90,
      "grp": 501
    },
    {
      "t": "platform",
      "nm": "06 / High window gallery",
      "p": [
        0,
        8.7,
        -155
      ],
      "s": [
        6,
        1,
        6
      ],
      "color": "#d8b26e",
      "grp": 501
    },
    {
      "t": "platform",
      "nm": "06 / Window left pier",
      "p": [
        -3.8,
        7.6,
        -153
      ],
      "s": [
        1.2,
        15.2,
        1.2
      ],
      "color": "#aa9875",
      "grp": 501
    },
    {
      "t": "platform",
      "nm": "06 / Window right pier",
      "p": [
        3.8,
        7.6,
        -153
      ],
      "s": [
        1.2,
        15.2,
        1.2
      ],
      "color": "#aa9875",
      "grp": 501
    },
    {
      "t": "platform",
      "nm": "06 / Window lintel",
      "p": [
        0,
        15.2,
        -153
      ],
      "s": [
        8.8,
        0.8,
        1.2
      ],
      "color": "#aa9875",
      "grp": 501
    },
    {
      "t": "crystal",
      "nm": "6 / Climbing rope and high platform",
      "p": [
        0,
        9.2,
        -156
      ],
      "grp": 501
    },
    {
      "t": "camnode",
      "nm": "06 / Frame the climb and its high receiving window",
      "p": [
        0,
        7,
        -145
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
        -118
      ],
      "cameraTarget": [
        0,
        5,
        -147
      ],
      "cameraFollowDistance": 20,
      "cameraKeepDistance": true,
      "cameraFollowTargetHeight": 4.5,
      "cameraFov": 65,
      "cameraAspect": 1.7777777777777777,
      "grp": 501
    },
    {
      "t": "platform",
      "nm": "07 / Stair observation bank",
      "p": [
        96,
        -0.5,
        -125
      ],
      "s": [
        18,
        1,
        16
      ],
      "color": "#789496",
      "grp": 601
    },
    {
      "t": "checkpoint",
      "nm": "07 / Vanishing Stairs start",
      "p": [
        92,
        0,
        -123
      ],
      "grp": 601
    },
    {
      "t": "phasepad",
      "nm": "07 / Vanishing stair 1",
      "p": [
        96,
        1.5,
        -138
      ],
      "s": [
        4,
        0.6,
        4
      ],
      "cycle": 8,
      "amp": 0.55,
      "phase": 0,
      "grp": 601
    },
    {
      "t": "phasepad",
      "nm": "07 / Vanishing stair 2",
      "p": [
        96,
        3,
        -145
      ],
      "s": [
        4,
        0.6,
        4
      ],
      "cycle": 8,
      "amp": 0.55,
      "phase": 0.76,
      "grp": 601
    },
    {
      "t": "phasepad",
      "nm": "07 / Vanishing stair 3",
      "p": [
        96,
        4.5,
        -152
      ],
      "s": [
        4,
        0.6,
        4
      ],
      "cycle": 8,
      "amp": 0.55,
      "phase": 0.52,
      "grp": 601
    },
    {
      "t": "platform",
      "nm": "07 / Crystal balcony after the rhythm",
      "p": [
        96,
        5.7,
        -161
      ],
      "s": [
        8,
        1,
        8
      ],
      "color": "#d8b26e",
      "grp": 601
    },
    {
      "t": "crystal",
      "nm": "7 / Timed steps",
      "p": [
        96,
        6.2,
        -162
      ],
      "grp": 601
    },
    {
      "t": "platform",
      "nm": "07 / Missed-step recovery courtyard",
      "p": [
        96,
        -8.5,
        -148
      ],
      "s": [
        26,
        1,
        58
      ],
      "color": "#7d8b9c",
      "grp": 601
    },
    {
      "t": "platform",
      "nm": "07 / Lower return beside the stairs",
      "p": [
        111,
        -8.5,
        -161
      ],
      "s": [
        8,
        1,
        26
      ],
      "color": "#789496",
      "grp": 601
    },
    {
      "t": "ramp",
      "nm": "07 / Retry climb",
      "p": [
        111,
        -8,
        -135.5
      ],
      "len": 25,
      "rise": 8,
      "w": 6,
      "yaw": 180,
      "grp": 601
    },
    {
      "t": "platform",
      "nm": "07 / Upper return junction",
      "p": [
        109,
        -0.5,
        -118
      ],
      "s": [
        10,
        1,
        10
      ],
      "color": "#789496",
      "grp": 601
    },
    {
      "t": "camnode",
      "nm": "07 / Watch the whole rising rhythm",
      "p": [
        96,
        4,
        -148
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
        96,
        11,
        -122
      ],
      "cameraTarget": [
        96,
        2.5,
        -151
      ],
      "cameraFollowDistance": 20,
      "cameraKeepDistance": true,
      "cameraFollowTargetHeight": 3.5,
      "cameraFov": 62,
      "cameraAspect": 1.7777777777777777,
      "grp": 601
    },
    {
      "t": "camnode",
      "nm": "07 / Look along the retry ramp toward the entrance",
      "p": [
        111,
        -4,
        -152
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
        111,
        1,
        -168
      ],
      "cameraTarget": [
        111,
        -3,
        -146
      ],
      "cameraFollowDistance": 14,
      "cameraKeepDistance": true,
      "cameraFollowTargetHeight": 2.5,
      "cameraFov": 62,
      "cameraAspect": 1.7777777777777777,
      "grp": 601
    },
    {
      "t": "platform",
      "nm": "08 / Orchard courtyard and local retry",
      "p": [
        192,
        -0.5,
        -140
      ],
      "s": [
        26,
        1,
        52
      ],
      "color": "#849d87",
      "grp": 701
    },
    {
      "t": "checkpoint",
      "nm": "08 / Outline Orchard start",
      "p": [
        188,
        0,
        -123
      ],
      "grp": 701
    },
    {
      "t": "crate",
      "nm": "08 / Reveal switch",
      "kind": "bang",
      "p": [
        187,
        0,
        -135
      ],
      "grp": 702
    },
    {
      "t": "mesh",
      "nm": "08 / First revealed step",
      "p": [
        192,
        1.7000000000000002,
        -142
      ],
      "s": [
        5,
        1,
        4
      ],
      "color": "#a8b9a0",
      "outline": true,
      "grp": 702,
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
        192,
        3.9000000000000004,
        -150
      ],
      "s": [
        6,
        1,
        6
      ],
      "color": "#a8b9a0",
      "outline": true,
      "grp": 702,
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
        192,
        4.4,
        -150
      ],
      "outline": true,
      "grp": 702
    },
    {
      "t": "platform",
      "nm": "08 / High orchard gallery",
      "p": [
        198,
        9.7,
        -154
      ],
      "s": [
        5,
        1,
        6
      ],
      "color": "#d8b26e",
      "grp": 701
    },
    {
      "t": "crystal",
      "nm": "8 / Switch, steps and bounce crate",
      "p": [
        198,
        10.2,
        -154
      ],
      "grp": 701
    },
    {
      "t": "camnode",
      "nm": "08 / Read switch, outlines, arrow and high gallery",
      "p": [
        192,
        6,
        -146
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
        195,
        14,
        -118
      ],
      "cameraTarget": [
        195,
        5,
        -148
      ],
      "cameraFollowDistance": 20,
      "cameraKeepDistance": true,
      "cameraFollowTargetHeight": 4.5,
      "cameraFov": 63,
      "cameraAspect": 1.7777777777777777,
      "grp": 701
    }
  ]
};
