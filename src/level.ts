// A long linear test course structured like Crash 1's N. Sanity Beach: a wide
// "beach" intro, a funnel into corridor sections with crate/enemy rhythm,
// gaps, two grind rails over pits, checkpoints, and a fast downhill finish.
// The course runs along -Z, roughly 860 units, ~1-2 minutes of play.

import * as THREE from 'three';
import { Rail } from './rails';

export interface Crate {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  alive: boolean;
  nitro?: boolean; // green, bobbing, ANY touch = death; cannot be broken safely
  bouncy?: boolean; // yellow arrow crate: stomp = super bounce, never breaks
}

export interface Enemy {
  group: THREE.Group;
  box: THREE.Box3;
  alive: boolean;
  x0: number;
  x1: number;
  dir: number;
  speed: number;
}

export interface Checkpoint {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  active: boolean;
  spawnPos: THREE.Vector3;
  savedAlive: boolean[]; // crate alive-states captured when this was broken
  savedCratesBroken: number; // crate counter captured when this was broken
  savedFruit: number; // wumpa counter captured when this was broken
}

export const LEVEL_NAMES = ['Test Course', 'N. Sanity Beach', 'The Great Gate'];

export class Level {
  groundMeshes: THREE.Mesh[] = [];
  crates: Crate[] = [];
  enemies: Enemy[] = [];
  checkpoints: Checkpoint[] = [];
  rails: Rail[] = [];
  finishBox = new THREE.Box3();
  finishZ = -1005;
  endWallZ = -1021; // authored hard stop after the finish gate
  spawnPos = new THREE.Vector3(0, 0.1, 0);
  currentSpawn = new THREE.Vector3(0, 0.1, 0); // last activated checkpoint
  activeCheckpoint: Checkpoint | null = null; // owns the respawn snapshot
  walls: THREE.Box3[] = []; // solid barriers: bump = full stop, never break
  halfpipeLipY = -6.2; // top of the halfpipe transition (vert launch height)
  killY = -48; // per-level death height
  name = LEVEL_NAMES[0];

  private scene: THREE.Scene;
  private root = new THREE.Group(); // everything the level owns, for disposal
  private pops: { obj: THREE.Object3D; t: number }[] = [];
  private time = 0;
  private arrowTex: THREE.CanvasTexture | null = null;

  constructor(scene: THREE.Scene, courseId = 0) {
    this.scene = scene;
    scene.add(this.root);
    this.name = LEVEL_NAMES[courseId] ?? LEVEL_NAMES[0];
    if (courseId === 1) this.buildNSanity();
    else if (courseId === 2) this.buildGreatGate();
    else this.buildTestCourse();
  }

  dispose(): void {
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.scene.remove(this.root);
  }

  get totalCrates(): number {
    return this.crates.filter((c) => !c.nitro && !c.bouncy).length;
  }

  update(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.group.position.x += e.dir * e.speed * dt;
      if (e.group.position.x > e.x1) {
        e.group.position.x = e.x1;
        e.dir = -1;
      } else if (e.group.position.x < e.x0) {
        e.group.position.x = e.x0;
        e.dir = 1;
      }
      e.group.rotation.y = e.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      e.box.setFromCenterAndSize(
        e.group.position.clone().add(new THREE.Vector3(0, 0.55, 0)),
        new THREE.Vector3(1.3, 1.1, 1.3),
      );
    }
    // Unbroken checkpoint boxes idle-spin so they read as special.
    for (const c of this.checkpoints) {
      if (!c.active) c.mesh.rotation.y += dt * 1.2;
    }
    // Nitro crates bob menacingly.
    this.time += dt;
    for (const c of this.crates) {
      if (!c.nitro) continue;
      c.mesh.position.y =
        (c.mesh.userData.baseY as number) + Math.sin(this.time * 4 + c.mesh.position.z) * 0.12;
    }
    // Quick scale-pop for broken crates / squashed enemies.
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t -= dt;
      const s = Math.max(p.t / 0.12, 0.001);
      p.obj.scale.setScalar(s);
      if (p.t <= 0) {
        p.obj.visible = false;
        this.pops.splice(i, 1);
      }
    }
  }

  breakCrate(crate: Crate): void {
    crate.alive = false;
    this.pops.push({ obj: crate.mesh, t: 0.12 });
  }

  killEnemy(enemy: Enemy): void {
    enemy.alive = false;
    this.pops.push({ obj: enemy.group, t: 0.12 });
  }

  // Broken (spun/stomped) like a normal box; banks the respawn point and a
  // snapshot of exactly which crates are broken + the counter at this moment.
  activateCheckpoint(cp: Checkpoint, cratesBroken: number, fruit = 0): void {
    cp.active = true;
    cp.savedAlive = this.crates.map((c) => c.alive);
    cp.savedCratesBroken = cratesBroken;
    cp.savedFruit = fruit;
    this.currentSpawn.copy(cp.spawnPos);
    this.activeCheckpoint = cp;
    cp.mesh.scale.setScalar(1);
    this.pops.push({ obj: cp.mesh, t: 0.12 }); // break it like a crate
  }

  // Soft reset (death): restore the crate world to the last checkpoint's
  // snapshot — boxes broken before it stay broken, boxes broken after it come
  // back; banked checkpoints stay consumed. Hard reset (R / new run) revives
  // everything and relights every checkpoint box.
  reset(hard: boolean): void {
    this.pops.length = 0;

    if (!hard && this.activeCheckpoint) {
      const snap = this.activeCheckpoint.savedAlive;
      this.crates.forEach((c, i) => {
        c.alive = snap[i];
        c.mesh.visible = snap[i];
        c.mesh.scale.setScalar(1);
      });
    } else {
      for (const c of this.crates) {
        c.alive = true;
        c.mesh.visible = true;
        c.mesh.scale.setScalar(1);
      }
    }

    for (const e of this.enemies) {
      e.alive = true;
      e.group.visible = true;
      e.group.scale.setScalar(1);
      e.group.position.x = (e.x0 + e.x1) / 2;
      e.dir = 1;
      e.box.makeEmpty();
    }

    for (const cp of this.checkpoints) {
      cp.mesh.scale.setScalar(1);
      if (hard) {
        cp.active = false;
        cp.mesh.visible = true;
      } else {
        cp.mesh.visible = !cp.active; // consumed checkpoints stay broken
      }
    }

    if (hard) {
      this.activeCheckpoint = null;
      this.currentSpawn.copy(this.spawnPos);
    }
  }

  // ---------------------------------------------------------------- build --

  private buildTestCourse(): void {
    const matA = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
    const matB = new THREE.MeshLambertMaterial({ color: 0x767b87 });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0x7d95a5 });
    const matBeach = new THREE.MeshLambertMaterial({ color: 0x9a9678 });
    const matFinish = new THREE.MeshLambertMaterial({ color: 0x9a8f6e });

    // --- decks (N. Sanity flow: beach -> funnel -> corridors -> finish) ---
    this.slab('beach', 14, -40, 0, 20, matBeach);

    // --- practice pen: walled rail playground east of the beach ---
    const penMesh = new THREE.Mesh(
      new THREE.BoxGeometry(30, 1, 54),
      new THREE.MeshLambertMaterial({ color: 0x86937e }),
    );
    penMesh.position.set(25, -0.5, -13);
    penMesh.name = 'practice pen';
    this.root.add(penMesh);
    this.groundMeshes.push(penMesh);
    // Perimeter walls (also backstop the beach so you can't fall off the start).
    this.wall(15, 15, 52, 1, 0); // north, spans beach + pen
    this.wall(-10.5, -13, 1, 54, 0); // west edge of the beach
    this.wall(40.5, -13, 1, 54, 0); // east edge of the pen
    this.wall(25, -40.5, 30, 1, 0); // south edge of the pen
    this.ramp('funnel slope', -40, 0, -80, -5, 14, matRamp);
    this.slab('corridor A', -80, -150, -5, 12, matA);
    // gap 1: -150 .. -165
    this.slab('corridor B', -165, -235, -5.5, 12, matB);
    this.ramp('big slope', -235, -5.5, -275, -13, 12, matRamp);
    // gap 2: -275 .. -297 (carry speed)
    this.slab('corridor C', -297, -350, -13, 12, matA);
    // rail 1 pit: -350 .. -410
    this.slab('rail 1 landing', -410, -465, -13, 12, matB);
    this.ramp('kicker', -465, -13, -475, -10.2, 12, matRamp);
    // gap 3: -475 .. -505 (jump off the kicker lip)
    this.slab('corridor D', -505, -575, -13, 12, matA);
    // rail 2 pit: -575 .. -655
    this.slab('rail 2 landing', -655, -710, -13.5, 12, matB);
    // halfpipe: tall curved transitions (4 segments each side approximating a
    // quarter-pipe), lips are grindable rails. Carving over the lip with
    // outward input pops a LOCKED vert air (see player.ts). slideRate rolls
    // you back down toward the flat when you're not pushing outward.
    this.slab('halfpipe floor', -710, -770, -13.5, 6, matA);
    const profile: [number, number, number, number, number][] = [
      // xIn, xOut, yBase, yTop, slideRate
      [3.0, 4.6, -13.5, -12.8, 1],
      [4.6, 5.9, -12.8, -11.2, 4],
      [5.9, 6.8, -11.2, -8.9, 8],
      [6.8, 7.4, -8.9, -6.2, 11],
    ];
    for (const [xIn, xOut, yBase, yTop, slideRate] of profile) {
      for (const side of [1, -1]) {
        const wall = this.bank(
          'halfpipe wall',
          -710,
          -770,
          side * xIn,
          side * xOut,
          yBase,
          yTop,
          matRamp,
        );
        wall.userData.hpWall = true;
        wall.userData.slideRate = slideRate;
      }
    }
    // rail yard entry deck, then a pit crossed by three parallel rails
    this.slab('rail yard entry', -770, -778, -13.5, 14, matB);
    // pit: -778 .. -850
    this.slab('rail yard landing', -850, -885, -13.5, 14, matA);
    this.ramp('final downhill', -885, -13.5, -940, -22, 12, matRamp);
    // gap 4: -940 .. -966 (fast)
    this.slab('finish run', -966, -1025, -22, 12, matFinish);

    // --- death pit floor (visual only, below killY) ---
    const pit = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshBasicMaterial({ color: 0x461420 }),
    );
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(0, -60, -420);
    this.root.add(pit);

    // --- grind rails ---
    const rail1 = new Rail([
      new THREE.Vector3(0, -12, -346),
      new THREE.Vector3(0, -11, -380),
      new THREE.Vector3(0, -11.8, -414),
    ]);
    // S-curve rail: the balance test.
    const rail2 = new Rail([
      new THREE.Vector3(0, -11.8, -571),
      new THREE.Vector3(2.5, -11, -595),
      new THREE.Vector3(-2.5, -10.5, -620),
      new THREE.Vector3(0, -11.5, -659),
    ]);
    // Halfpipe lip rails along both top edges.
    const lipL = new Rail([new THREE.Vector3(-7.5, -6, -712), new THREE.Vector3(-7.5, -6, -766)]);
    const lipR = new Rail([new THREE.Vector3(7.5, -6, -712), new THREE.Vector3(7.5, -6, -766)]);
    // Rail yard: three parallel rails over the pit — jump between them.
    const yardL = new Rail([new THREE.Vector3(-3.5, -12.6, -776), new THREE.Vector3(-3.5, -12.6, -852)]);
    const yardC = new Rail([new THREE.Vector3(0, -12.6, -776), new THREE.Vector3(0, -12.6, -852)]);
    const yardR = new Rail([new THREE.Vector3(3.5, -12.6, -776), new THREE.Vector3(3.5, -12.6, -852)]);
    // Practice pen rails: straight, zigzag, and a high line.
    const penStraight = new Rail([new THREE.Vector3(18, 1, -2), new THREE.Vector3(18, 1, -32)]);
    const penZigzag = new Rail([
      new THREE.Vector3(26, 1.2, 2),
      new THREE.Vector3(30, 1.6, -10),
      new THREE.Vector3(24, 1.4, -22),
      new THREE.Vector3(28, 1.2, -34),
    ]);
    const penHigh = new Rail([new THREE.Vector3(35, 2.8, -4), new THREE.Vector3(35, 2.8, -30)]);

    for (const rail of [rail1, rail2, lipL, lipR, yardL, yardC, yardR, penStraight, penZigzag, penHigh]) {
      this.rails.push(rail);
      this.root.add(rail.object);
    }

    // --- crates ---
    // Beach: one dead-ahead (bump = full stop now: spin it or hop on it).
    this.crate(0, 0, -25);
    this.crate(5, 0, -32);
    this.crate(6.5, 0, -32);
    // Corridor A: full-width wall — spin through, or jump on top to bounce.
    for (let i = 0; i < 9; i++) this.crate(-5.2 + i * 1.3, -5, -100);
    this.crate(-4.5, -5, -132);
    this.crate(-4.5, -3.8, -132); // stack
    this.crate(4.5, -5, -145);
    this.crate(4.5, -3.8, -145); // stack
    // Corridor B: risky edge lines between the enemies.
    this.crate(5, -5.5, -205);
    this.crate(5, -5.5, -208);
    this.crate(-5, -5.5, -222);
    // Corridor C: center cluster + risky pair before the first rail.
    this.crate(-1.5, -13, -315);
    this.crate(0, -13, -315);
    this.crate(1.5, -13, -315);
    this.crate(0, -11.8, -315); // stack
    this.crate(5.2, -13, -330);
    this.crate(5.2, -13, -333);
    // Rail 1 entry flanks.
    this.crate(-2.4, -13, -342);
    this.crate(2.4, -13, -342);
    // Corridor D: second full-width wall + edge stacks.
    for (let i = 0; i < 9; i++) this.crate(-5.2 + i * 1.3, -13, -520);
    this.crate(-4.8, -13, -565);
    this.crate(-4.8, -11.8, -565); // stack
    this.crate(4.8, -13, -565);
    this.crate(4.8, -11.8, -565); // stack
    // Rail 2 entry flanks.
    this.crate(-2.4, -13, -567);
    this.crate(2.4, -13, -567);
    // Practice pen toys.
    this.crate(14, 0, -20);
    this.crate(31, 0, -28);
    this.crate(37, 0, -12, 'bouncy');
    // Halfpipe: bouncy arrow crate launches you up to the lip rails.
    this.crate(-2.2, -13.5, -735, 'bouncy');
    this.crate(0, -13.5, -755); // wumpa snack on the floor line
    // Rail yard: crates and nitro at grind height above the rails.
    // Center rail: two smashables, then a nitro you must jump, then a snack.
    this.crate(0, -12.8, -790);
    this.crate(0, -12.8, -800);
    this.crate(0, -12.8, -815, 'nitro');
    this.crate(0, -12.8, -835);
    // Left rail: nitro early, then safe smashables.
    this.crate(-3.5, -12.8, -795, 'nitro');
    this.crate(-3.5, -12.8, -820);
    this.crate(-3.5, -12.8, -828);
    // Right rail: smashable, nitro, smashable.
    this.crate(3.5, -12.8, -788);
    this.crate(3.5, -12.8, -822, 'nitro');
    this.crate(3.5, -12.8, -840);
    // Rail yard landing: a bouncy crate off the racing line, for fun.
    this.crate(2.5, -13.5, -868, 'bouncy');
    // Final downhill: offset dodge crates (thread between them at speed).
    this.crate(-2.2, this.downhillY(-905), -905);
    this.crate(2.2, this.downhillY(-925), -925);

    // --- enemies (patrolling across the corridor) ---
    this.enemy(-3.5, 3.5, -5, -120, 5);
    this.enemy(-4, 4, -5, -138, 7);
    this.enemy(-4, 4, -5.5, -200, 6);
    this.enemy(-4, 4, -5.5, -215, 8);
    this.enemy(-3, 3, -5.5, -228, 5);
    this.enemy(-4.5, 4.5, -13, -340, 9);
    this.enemy(-4, 4, -13, -445, 7);
    this.enemy(-4.5, 4.5, -13, -540, 8);
    this.enemy(-4, 4, -13, -562, 6);
    this.enemy(-4, 4, -13.5, -690, 7);

    // --- checkpoints ---
    this.checkpoint(-5.5, -185);
    this.checkpoint(-13, -425);
    this.checkpoint(-13.5, -670);
    this.checkpoint(-13.5, -862);

    // --- extra enemy guarding the rail yard landing ---
    this.enemy(-4, 4, -13.5, -876, 6);

    // --- finish gate + end wall ---
    this.finishGate(-22, this.finishZ);
    this.endWall(-22);
  }

  // Deck height along the final downhill ramp (for crate placement).
  private downhillY(z: number): number {
    return THREE.MathUtils.mapLinear(z, -885, -940, -13.5, -22);
  }

  // Crash 1 level 1: beach -> winding jungle path -> forked ruin path ->
  // water gaps -> stone ruins -> uphill to the exit gate. Gentle, crab-heavy.
  private buildNSanity(): void {
    const matSand = new THREE.MeshLambertMaterial({ color: 0xc9b87a });
    const matJungle = new THREE.MeshLambertMaterial({ color: 0x6f8f5e });
    const matStone = new THREE.MeshLambertMaterial({ color: 0x7d8288 });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0x8aa06a });

    this.killY = -30;
    this.finishZ = -440;
    this.endWallZ = -464;

    // water far below the gaps
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshBasicMaterial({ color: 0x1a3448 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -40, -230);
    this.root.add(sea);

    // beach start (walled at the back and sides, like the cove)
    this.slab('beach', 14, -30, 0, 22, matSand);
    this.wall(0, 15.5, 26, 1, 0);
    this.wall(-11.5, -8, 1, 48, 0);
    this.wall(11.5, -8, 1, 48, 0);
    this.crate(3, 0, -5);
    this.crate(4.5, 0, -5);
    this.crate(3.75, 1.2, -5); // little beach pyramid

    // sand path inland
    this.slab('sand path', -30, -90, 0, 12, matSand);
    this.crate(2, 0, -45);
    this.crate(-3, 0, -60);
    this.crate(0, 0, -75);
    this.crate(0, 1.2, -75); // stack
    this.enemy(-3, 3, 0, -70, 3);

    // water gap 1
    // -90 .. -102
    this.ramp('jungle rise', -102, 0, -112, 1.5, 12, matRamp);
    this.slab('jungle path', -112, -150, 1.5, 10, matJungle);
    this.crate(-2.5, 1.5, -128);
    this.crate(2.5, 1.5, -140);
    this.enemy(-3.5, 3.5, 1.5, -135, 4);

    // forked path around a ruin block
    this.slab('forked path', -150, -205, 1.5, 14, matJungle);
    this.wall(0, -177, 4, 40, 1.5, 3); // the ruin wall splitting the lanes
    this.crate(-4, 1.5, -165);
    this.crate(-4, 1.5, -185);
    this.crate(4, 1.5, -172);
    this.crate(3.5, 1.5, -190, 'nitro'); // right lane is the greedy lane
    this.enemy(-5, -2.5, 1.5, -196, 3);

    // rejoin, checkpoint, more crabs
    this.slab('ruin approach', -205, -250, 1.5, 12, matJungle);
    this.checkpoint(1.5, -215);
    this.enemy(-4, 4, 1.5, -230, 5);
    this.crate(0, 1.5, -240);
    this.crate(0, 2.7, -240); // stack

    // water gap 2 with an optional log rail
    // -250 .. -264
    const logRail = new Rail([new THREE.Vector3(0, 2.4, -248), new THREE.Vector3(0, 2.4, -266)]);
    this.rails.push(logRail);
    this.root.add(logRail.object);

    // stone ruins
    this.slab('stone ruins', -264, -310, 1.5, 12, matStone);
    for (let i = 0; i < 7; i++) this.crate(-3.9 + i * 1.3, 1.5, -285); // ruin crate wall
    this.crate(4, 1.5, -300, 'bouncy');

    // climb to the exit
    this.ramp('temple ramp', -310, 1.5, -340, 6, 10, matRamp);
    this.slab('temple top', -340, -420, 6, 12, matStone);
    this.enemy(-4, 4, 6, -370, 6);
    this.checkpoint(6, -390);
    this.crate(-4.5, 6, -405, 'nitro');
    this.crate(4.5, 6, -405, 'nitro');
    this.crate(0, 6, -405);

    this.slab('exit', -420, -470, 6, 14, matSand);
    this.finishGate(6, this.finishZ);
    this.endWall(6);
  }

  // Crash 1 level 2: climb the great wall. Ascending walkways with gaps, a
  // rising scaffold rail, stair-step hops, and a nitro rampart near the top.
  private buildGreatGate(): void {
    const matWood = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
    const matWood2 = new THREE.MeshLambertMaterial({ color: 0x75593c });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });

    this.killY = -20;
    this.finishZ = -415;
    this.endWallZ = -428;

    // hazy ground far below the wall
    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshBasicMaterial({ color: 0x2b2137 }),
    );
    haze.rotation.x = -Math.PI / 2;
    haze.position.set(0, -32, -220);
    this.root.add(haze);

    // base of the gate
    this.slab('gate base', 10, -20, 0, 14, matWood);
    this.wall(0, 11, 16, 1, 0);
    this.wall(-7.5, -5, 1, 32, 0);
    this.wall(7.5, -5, 1, 32, 0);
    this.crate(-3, 0, -10);
    this.crate(3, 0, -14);

    // ascent A: two ramps with a gap between
    this.ramp('rampart A', -20, 0, -58, 4, 8, matRamp);
    // gap: -58 .. -66
    this.ramp('rampart A2', -66, 4.4, -100, 8, 8, matRamp);

    // rest platform 1
    this.slab('landing 1', -100, -125, 8, 10, matWood2);
    this.checkpoint(8, -110);
    this.crate(-3, 8, -105);
    this.crate(3, 8, -105);
    this.enemy(-3, 3, 8, -118, 4);

    // ascent B: gap mid-way, with a rising scaffold rail as the smooth line
    this.ramp('rampart B', -125, 8, -160, 13, 8, matRamp);
    // gap: -160 .. -170
    this.ramp('rampart B2', -170, 13.5, -205, 18, 8, matRamp);
    const scaffold = new Rail([
      new THREE.Vector3(5, 8.8, -128),
      new THREE.Vector3(5, 13.6, -164),
      new THREE.Vector3(5, 18.6, -202),
    ]);
    this.rails.push(scaffold);
    this.root.add(scaffold.object);

    // rest platform 2
    this.slab('landing 2', -205, -230, 18, 10, matWood2);
    this.checkpoint(18, -212);
    for (let i = 0; i < 7; i++) this.crate(-3.9 + i * 1.3, 18, -221); // plank wall
    this.enemy(-3, 3, 18, -227, 5);

    // stair steps up (hop, or bounce the arrow crate to skip two)
    const steps: [number, number][] = [
      [-230, 20.2],
      [-244, 22.4],
      [-258, 24.6],
      [-272, 26.8],
      [-286, 29],
    ];
    for (const [z0, y] of steps) this.slab('step', z0, z0 - 8, y, 8, matWood);
    this.crate(0, 22.4, -248, 'bouncy');
    this.crate(2, 20.2, -234);

    // nitro rampart along the top, with a high bypass rail beside it
    this.slab('high rampart', -294, -360, 29, 8, matWood2);
    this.crate(0, 29, -310, 'nitro');
    this.crate(0, 29, -325, 'nitro');
    this.crate(0, 29, -340, 'nitro');
    this.crate(-3, 29, -330);
    this.crate(3, 29, -318);
    this.enemy(-3.2, 3.2, 29, -334, 6);
    const bypass = new Rail([new THREE.Vector3(-5, 30.8, -300), new THREE.Vector3(-5, 30.8, -358)]);
    this.rails.push(bypass);
    this.root.add(bypass.object);

    // crest of the gate
    this.ramp('crest ramp', -360, 29, -380, 33, 10, matRamp);
    this.slab('gate top', -380, -430, 33, 14, matWood);
    this.checkpoint(33, -390);
    this.crate(-4, 33, -400);
    this.crate(4, 33, -400);
    this.finishGate(33, this.finishZ);
    this.endWall(33);
  }

  // Flat deck. z0 is the near (higher z) edge, z1 the far edge, topY the
  // surface height the player rides on.
  private slab(name: string, z0: number, z1: number, topY: number, width: number, mat: THREE.Material): void {
    const depth = Math.abs(z1 - z0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1, depth), mat);
    mesh.position.set(0, topY - 0.5, (z0 + z1) / 2);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    this.curbs(z0, z1, topY, width);
  }

  // Sloped deck between two top-surface edge lines (z0,y0) -> (z1,y1).
  private ramp(name: string, z0: number, y0: number, z1: number, y1: number, width: number, mat: THREE.Material): void {
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dy, dz);
    const dyn = dy / len;
    const dzn = dz / len;
    // Box local +Z under rotation.x = a maps to (0, -sin a, cos a). The course
    // runs toward -Z, so align local +Z with the *reverse* travel direction.
    const alpha = Math.atan2(dyn, -dzn);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1, len), mat);
    mesh.rotation.x = alpha;
    const normal = new THREE.Vector3(0, -dzn, dyn);
    mesh.position
      .set(0, (y0 + y1) / 2, (z0 + z1) / 2)
      .addScaledVector(normal, -0.5);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
  }

  // Side-banked surface (halfpipe wall): top face runs from (xIn, yBase) up to
  // (xOut, yTop), constant along z. Box rotated about Z so a downward ray sees
  // the slope.
  private bank(
    name: string,
    z0: number,
    z1: number,
    xIn: number,
    xOut: number,
    yBase: number,
    yTop: number,
    mat: THREE.Material,
  ): THREE.Mesh {
    const dx = xOut - xIn;
    const dy = yTop - yBase;
    const len = Math.hypot(dx, dy);
    const alpha = Math.atan2(dy, dx); // local +X maps to (cos a, sin a, 0)
    const depth = Math.abs(z1 - z0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, 1, depth), mat);
    mesh.rotation.z = alpha;
    const normal = new THREE.Vector3(-dy / len, dx / len, 0);
    if (normal.y < 0) normal.negate();
    mesh.position
      .set((xIn + xOut) / 2, (yBase + yTop) / 2, (z0 + z1) / 2)
      .addScaledVector(normal, -0.5);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    return mesh;
  }

  // Solid barrier: visual box + collider. Bump = full stop, never breaks.
  private wall(cx: number, cz: number, w: number, d: number, baseY: number, h = 5): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: 0x5a5f6a }),
    );
    mesh.position.set(cx, baseY + h / 2, cz);
    this.root.add(mesh);
    this.walls.push(
      new THREE.Box3().setFromCenterAndSize(mesh.position.clone(), new THREE.Vector3(w, h, d)),
    );
  }

  // Dark edge strips so deck borders read at speed. Visual only.
  private curbs(z0: number, z1: number, topY: number, width: number): void {
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a4e58 });
    const depth = Math.abs(z1 - z0);
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, depth), mat);
      curb.position.set(side * (width / 2 - 0.2), topY + 0.11, (z0 + z1) / 2);
      this.root.add(curb);
    }
  }

  private crate(x: number, deckY: number, z: number, kind?: 'nitro' | 'bouncy'): void {
    const size = 1.2;
    let mat: THREE.MeshLambertMaterial;
    if (kind === 'nitro') {
      mat = new THREE.MeshLambertMaterial({ color: 0x35d054, emissive: 0x0c3a16 });
    } else if (kind === 'bouncy') {
      mat = new THREE.MeshLambertMaterial({ color: 0xe8c832, map: this.arrowTexture() });
    } else {
      mat = new THREE.MeshLambertMaterial({ color: 0xb08a4a });
    }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
    mesh.position.set(x, deckY + size / 2, z);
    mesh.userData.baseY = mesh.position.y;
    if (!kind) mesh.rotation.y = 0.15;
    this.root.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      mesh.position.clone(),
      new THREE.Vector3(size, size, size),
    );
    this.crates.push({ mesh, box, alive: true, nitro: kind === 'nitro', bouncy: kind === 'bouncy' });
  }

  // Chunky white up-arrow on the bouncy crates (shared texture).
  private arrowTexture(): THREE.CanvasTexture {
    if (this.arrowTex) return this.arrowTex;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#e8c832';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(16, 4);
    ctx.lineTo(27, 16);
    ctx.lineTo(20, 16);
    ctx.lineTo(20, 28);
    ctx.lineTo(12, 28);
    ctx.lineTo(12, 16);
    ctx.lineTo(5, 16);
    ctx.closePath();
    ctx.fill();
    this.arrowTex = new THREE.CanvasTexture(canvas);
    this.arrowTex.magFilter = THREE.NearestFilter;
    return this.arrowTex;
  }

  private enemy(x0: number, x1: number, deckY: number, z: number, speed: number): void {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1, 0.9, 1.1),
      new THREE.MeshLambertMaterial({ color: 0xa03a3a }),
    );
    body.position.y = 0.55;
    group.add(body);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const side of [-0.22, 0.22]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.1), eyeMat);
      eye.position.set(side, 0.75, 0.56);
      group.add(eye);
    }
    group.position.set((x0 + x1) / 2, deckY, z);
    this.root.add(group);
    this.enemies.push({ group, box: new THREE.Box3(), alive: true, x0, x1, dir: 1, speed });
  }

  // A distinct blue box that sits on the deck like a normal crate. Spin or
  // stomp it (bumping is a wall) to bank the checkpoint; its trigger matches
  // the box, so it can be dodged rather than being an unmissable gate.
  private checkpoint(deckY: number, z: number): void {
    const size = 1.4;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshLambertMaterial({ color: 0x4aa0e0, emissive: 0x123049 }),
    );
    mesh.position.set(0, deckY + size / 2, z);
    this.root.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      mesh.position.clone(),
      new THREE.Vector3(size, size, size),
    );
    this.checkpoints.push({
      mesh,
      box,
      active: false,
      spawnPos: new THREE.Vector3(0, deckY + 0.1, z),
      savedAlive: [],
      savedCratesBroken: 0,
      savedFruit: 0,
    });
  }

  private endWall(deckY: number): void {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(14, 4, 1),
      new THREE.MeshLambertMaterial({ color: 0x5a5f6a }),
    );
    wall.position.set(0, deckY + 2, this.endWallZ - 1);
    this.root.add(wall);
  }

  private finishGate(deckY: number, z: number): void {
    this.finishBox.setFromCenterAndSize(
      new THREE.Vector3(0, deckY + 15, z),
      new THREE.Vector3(14, 30, 2),
    );
    const postMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), postMat);
      post.position.set(side * 5.5, deckY + 3.5, z);
      this.root.add(post);
    }
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e8e8e8' : '#20242c';
        ctx.fillRect(x * 8, y * 8, 8, 8);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 1.2, 0.2),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    banner.position.set(0, deckY + 6.4, z);
    this.root.add(banner);
  }
}
