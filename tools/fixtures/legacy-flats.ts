// Frozen native Flats builder from ee9857a, for the input-only vert recording.
import * as THREE from 'three';
import { Rail } from '../../src/rails';
export function buildLegacyFlats(this: any): void {
    this.skyPreset = "day"; // the test course reads best in full light
    // Tropical resort noon over an endless blacktop lot: high sun, turquoise
    // horizon haze, parking-bay stripes to give the eye a texel scale.
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff }); // asphalt is full-colour
    // The Flats now floats as an elevated SKY-DECK over the sunset cloud sea:
    // a narrow-ish runway lifted to y=E, so past the deck edges you look DOWN
    // onto the below-horizon cloud detail instead of endless asphalt. Skate off
    // an edge and you drop into the sea (respawn).
    const E = 90; // deck elevation over the sea
    this.spawnPos.set(0, E + 0.1, 40);
    this.killY = E - 28; // below the deck: skate off the edge and you splash in
    // The run does not stop at the rail garden any more: the deck opens out
    // into the pipe park at its far end, and the line is drawn past THAT.
    this.finishZ = -420;
    this.endWallZ = -450;
    this.theme = {
      skyTop: "#159ecd",
      skyBottom: "#c9f0e4",
      sunColorHex: "#fff8dc",
      sunU: 0.68,
      sunV: 0.14,
      stars: false,
      fog: 0xbee8dd, // turquoise haze
      // The run is 460 units end to end now, so the haze has to reach: at the
      // old 320 the pipe park was a ghost from halfway down the runway. 400 is
      // the play draw distance, so this fades things out exactly as they clip.
      fogNear: 110,
      fogFar: 400,
      hemiSky: 0xeafcff,
      hemiGround: 0x94a294,
      hemiI: 1.2,
      sunColor: 0xfff6dc,
      sunI: 1.55,
    };
    // a finite runway deck (was a 4km lot); no 2km perimeter walls — the edges
    // just drop away to the sea on both sides.
    this.slab("the flats", 100, -250, E, 84, mat, false, 0, "asphalt");
    // --- wallride walls: tall faces just west of spawn. Skate at one, ollie (X)
    // and HOLD GRIND (E) to stick and ride along it, jump to kick off. Two
    // parallel walls let you transfer wall-to-wall. Doubled height (10) so the
    // wallie pop has room to climb the face.
    this.wall(-16, 0, 1.2, 70, E, 10);
    this.wall(-32, 0, 1.2, 70, E, 10);
    // a cross wall to the NE, for wallriding along the other axis
    this.wall(12, 28, 34, 1.2, E, 10);

    // --- rail garden: practice lines just south of spawn -------------------
    const V = (x: number, y: number, z: number): THREE.Vector3 =>
      new THREE.Vector3(x, y, z);
    // flat starter rail (0.9 above the deck: crates on the line DO clip a
    // grinder)
    const flatRail = new Rail([V(5, E + 0.9, -25), V(5, E + 0.9, -85)]);
    // sloped rail: grind it up to a high dismount (or bomb it back down)
    const slopeRail = new Rail([V(12, E + 0.9, -25), V(12, E + 6.5, -95)]);
    // three staggered parallel rails — hop rail-to-rail without touching down
    const parA = new Rail([V(-6, E + 0.9, -25), V(-6, E + 0.9, -110)]);
    const parB = new Rail([V(-10, E + 0.9, -40), V(-10, E + 0.9, -125)]);
    const parC = new Rail([V(-14, E + 0.9, -55), V(-14, E + 0.9, -140)]);
    for (const r of [flatRail, slopeRail, parA, parB, parC]) {
      this.rails.push(r);
      this.root.add(r.object);
    }
    // crates in the lanes between the parallel rails (smash practice)
    for (let z = -48; z >= -108; z -= 12) {
      this.crate(-8, E, z);
      this.crate(-12, E, z + 6);
    }
    // crates ON the center rail line: plain ones punish slow grinds, the
    // mask crate always pops (grind-through reward)
    this.crate(-10, E, -70);
    this.crate(-10, E, -100, "mask");
    // arrow crates with their classic floating fruit crate above
    this.crate(9, E, -40, "bouncy");
    this.crate(-2, E, -60, "bouncy");
    // a TNT and a nitro for blast testing, well apart
    this.crate(16, E, -60, "tnt");
    this.crate(20, E, -75, "nitro");

    // --- 6x6x6 CRATE CUBE: the stacking test rig ---------------------------
    // Six by six by six, on the flat so nothing else is in the way. Smash
    // anywhere into the base and the columns above collapse into the hole,
    // which is the settle path end to end — including the third-box-up case
    // that used to hang in the air. Every row on every face is also a
    // six-crate run, so every exposed edge is a grind line, and the ones you
    // open up by chewing into it become lines too.
    const CS = 0.96;
    const CUBE_X = 30; // clear of the rails, the ramps and the blast pair
    const CUBE_Z = -40;
    // Bottom layer FIRST: each crate seats on the one already under it.
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 6; col++)
        for (let dep = 0; dep < 6; dep++)
          this.crate(
            CUBE_X + (col - 2.5) * CS,
            E + row * CS,
            CUBE_Z + (dep - 2.5) * CS,
          );

    // --- LONG GRIND ROW: one box high, 24 long, nothing else near it -------
    // A clean line to actually ride, long enough to hold a grind through the
    // whole balance ramp rather than popping off two beats in.
    const ROW_X = 24;
    for (let i = 0; i < 24; i++) this.crate(ROW_X, E, -95 - i * CS);

    // --- BOUNCE TOWER: metal-bouncy base, wood middle, blank metal lid -----
    // Spin the wood box out of the middle and the metal slab on top drops onto
    // the arrow crate under it, which throws it straight back — and keeps
    // throwing it, at the same height, indefinitely. Standing under the slab
    // while it comes down is fatal: metal does not break and cannot be
    // stomped away.
    const TOWER_X = 16;
    const TOWER_Z = -100;
    this.crate(TOWER_X, E, TOWER_Z, "metalbounce");
    this.crate(TOWER_X, E + CS, TOWER_Z);
    this.crate(TOWER_X, E + CS * 2, TOWER_Z, "metal");

    // --- HAZARD ROW: the same idea with bombs in it ------------------------
    // Eight boxes with a nitro at 5 and a TNT at 7. It grinds like any other
    // ledge right up until it doesn't — riding onto either sets it off under
    // your feet with no fuse, so the line is a decision, not a freebie.
    const HAZ_X = 20;
    for (let i = 0; i < 8; i++)
      this.crate(
        HAZ_X,
        E,
        -95 - i * CS,
        i === 5 ? "nitro" : i === 7 ? "tnt" : undefined,
      );

    // --- ramp staircase: seven ramps of increasing steepness ---------------
    // grades 0.15 (8.5 deg) up to 1.9 (62 deg): walk, roll, and pump tests.
    const matRampF = new THREE.MeshLambertMaterial({ color: 0xaab4ba }); // skatepark concrete
    const grades = [0.15, 0.3, 0.5, 0.75, 1.0, 1.4, 1.9];
    for (let i = 0; i < grades.length; i++) {
      const x = -36 + i * 12; // spread ACROSS the narrow deck, not far off to the side
      const len = 8;
      this.ramp(
        `test ramp ${i + 1}`,
        -148,
        E,
        -148 - len,
        E + grades[i] * len,
        5,
        matRampF,
        x,
        "pavement",
      );
    }

    // --- dressing: palms lining the deck edges (elevated with the lot) ------
    for (let i = 0; i < 6; i++) {
      const z = 40 - i * 55;
      this.palm(-38, E, z, 5 + (i % 3) * 0.6, i % 2 === 0 ? 0.12 : -0.1);
      this.palm(38, E, z - 20, 5.3 - (i % 2) * 0.5, i % 2 === 0 ? -0.1 : 0.12);
    }
    for (let i = 0; i < 5; i++) {
      this.palm(-32 + i * 16, E, 70, 4.8 + (i % 2) * 0.7, 0.1 - (i % 3) * 0.08);
    }
    // --- foe sampler: one of each takedown, lined up down the centre lane past
    // the trick lanes (rail garden/ramps sit at x -20..115, z 0..-160) --------
    this.enemy(-6, 6, E, -166, 4, "x", "grunt");
    this.enemy(-6, 6, E, -172, 4, "x", "spiker"); // spin
    this.enemy(-6, 6, E, -178, 3, "x", "turtle"); // stomp
    this.enemy(-12, 12, E, -184, 5, "x", "charger"); // bull runway
    this.enemy(-6, 6, E, -190, 4, "x", "hopper");
    this.enemy(-8, 8, E, -196, 3.5, "x", "floater");
    this.enemy(0, 0, E, -175, 0, "x", "sentry"); // turret watching the lane
    this.enemy(0, 0, E, -187, 0, "x", "spinner");
    // planter islands, tucked at the deck corners (elevated with the lot)
    for (const [ix, iz] of [
      [-36, -30],
      [36, -110],
      [-34, 84],
    ] as const) {
      this.rock(ix, E, iz, 2.2);
      this.palm(ix + 2.5, E, iz + 2, 5.8, -0.12);
      this.fern(ix - 2.2, E, iz - 1.5, 1.3);
      this.fern(ix + 1.8, E, iz - 2.6, 1.1);
      this.flowers(ix - 1.5, E, iz + 2.2);
      this.planter(ix + 4, E, iz - 1);
    }
    // ...and the runway opens out into the pipe park, flush with the deck end.
    this.pipePark(E, -310);
  }
