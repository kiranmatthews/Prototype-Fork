// A long linear test course structured like Crash 1's N. Sanity Beach: a wide
// "beach" intro, a funnel into corridor sections with crate/enemy rhythm,
// gaps, two grind rails over pits, checkpoints, and a fast downhill finish.
// The course runs along -Z, roughly 860 units, ~1-2 minutes of play.

import * as THREE from 'three';
import { Rail } from './rails';
import { CONST } from './tuning';
import { sfx } from './audio';

export interface Crate {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  alive: boolean;
  nitro?: boolean; // green, bobbing, touch = instant detonation
  bouncy?: boolean; // yellow arrow crate: stomp = super bounce, never breaks
  tnt?: boolean; // red TNT: solid box; stomp lights the 3-2-1 fuse, spin/slam detonates
  fuse?: number; // seconds left on a lit TNT
  mask?: boolean; // Aku crate: breaking it grants a protective mask
}

export interface Enemy {
  group: THREE.Group;
  box: THREE.Box3;
  alive: boolean;
  x0: number; // patrol bounds — x for corridor levels, z for side-scroll levels
  x1: number;
  dir: number;
  speed: number;
  axis?: 'x' | 'z';
}

// Floating wumpa, Crash-style: touch to collect (side-scroll levels).
export interface Pickup {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  alive: boolean;
}

export interface Checkpoint {
  mesh: THREE.Mesh;
  box: THREE.Box3;
  active: boolean;
  spawnPos: THREE.Vector3;
  savedAlive: boolean[]; // crate alive-states captured when this was broken
  savedCratesBroken: number; // crate counter captured when this was broken
  savedFruit: number; // wumpa counter captured when this was broken
  savedMasks: number;
  savedPoints: number;
}

export const LEVEL_NAMES = ['Test Course', 'N. Sanity Beach', 'The Great Gate', 'Sideways', 'Random'];

export class Level {
  groundMeshes: THREE.Mesh[] = [];
  crates: Crate[] = [];
  enemies: Enemy[] = [];
  checkpoints: Checkpoint[] = [];
  pickups: Pickup[] = [];
  rails: Rail[] = [];
  // Travel zones: rectangular regions where the course itself runs along X
  // instead of -Z (a real right-angle turn in the path). The camera never
  // yaws — the turned path is what makes those stretches side-scrolling.
  zones: { xMin: number; xMax: number; zMin: number; zMax: number; dir: 'E' | 'W' }[] = [];
  finishBox = new THREE.Box3();
  finishZ = -1005;
  endWallZ = -1021; // authored hard stop after the finish gate
  spawnPos = new THREE.Vector3(0, 0.1, 0);
  currentSpawn = new THREE.Vector3(0, 0.1, 0); // last activated checkpoint
  activeCheckpoint: Checkpoint | null = null; // owns the respawn snapshot
  walls: THREE.Box3[] = []; // solid barriers: bump = full stop, never break
  halfpipeLipY = -7.6; // top of the halfpipe transition (vert launch height)
  halfpipeLipX = 10.3; // outer edge of the transition walls
  killY = -48; // per-level death height
  name = LEVEL_NAMES[0];

  // safe = triggered by the player's own spin/slam: breaks the world, not them
  explosions: { center: THREE.Vector3; t: number; radius: number; safe: boolean }[] = [];

  private scene: THREE.Scene;
  private root = new THREE.Group(); // everything the level owns, for disposal
  private pops: { obj: THREE.Object3D; t: number }[] = [];
  private time = 0;
  private arrowTex: THREE.CanvasTexture | null = null;
  private tntTexCache = new Map<string, THREE.CanvasTexture>();
  private maskTex: THREE.CanvasTexture | null = null;
  private blastMeshes: { outer: THREE.Mesh; inner: THREE.Mesh; ex: { center: THREE.Vector3; t: number; radius: number } }[] = [];
  private blastBroken: Crate[] = []; // crates broken by blasts, for the player to tally
  private static blastGeo = new THREE.SphereGeometry(1, 10, 8);
  private static pickupGeo = new THREE.SphereGeometry(0.24, 8, 6);
  private checkerTex: THREE.CanvasTexture | null = null;

  // Subtle checker tiles (tinted by each deck's color) so ground movement
  // reads even without landmarks — crucial on the side-scroll camera.
  private checkerTexture(): THREE.CanvasTexture {
    if (this.checkerTex) return this.checkerTex;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#cfcfcf';
        ctx.fillRect(x * 32, y * 32, 32, 32);
      }
    }
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 62, 62);
    this.checkerTex = new THREE.CanvasTexture(canvas);
    this.checkerTex.magFilter = THREE.NearestFilter;
    this.checkerTex.wrapS = THREE.RepeatWrapping;
    this.checkerTex.wrapT = THREE.RepeatWrapping;
    return this.checkerTex;
  }

  // Per-deck clone of a base material with the checker tiled to ~2u squares.
  private patterned(mat: THREE.Material, w: number, d: number): THREE.MeshLambertMaterial {
    const m = (mat as THREE.MeshLambertMaterial).clone();
    const tex = this.checkerTexture().clone();
    tex.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(d / 4)));
    tex.needsUpdate = true;
    m.map = tex;
    return m;
  }

  constructor(scene: THREE.Scene, courseId = 0) {
    this.scene = scene;
    scene.add(this.root);
    this.name = LEVEL_NAMES[courseId] ?? LEVEL_NAMES[0];
    if (courseId === 1) this.buildNSanity();
    else if (courseId === 2) this.buildGreatGate();
    else if (courseId === 3) this.buildSideways();
    else if (courseId === 4) this.buildRandom();
    else this.buildTestCourse();
  }

  dispose(): void {
    const disposeMat = (x: THREE.Material): void => {
      const map = (x as THREE.MeshLambertMaterial).map;
      if (map) map.dispose();
      x.dispose();
    };
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach(disposeMat);
      else if (mat) disposeMat(mat);
    });
    this.scene.remove(this.root);
  }

  get totalCrates(): number {
    return this.crates.filter((c) => !c.nitro && !c.bouncy && !c.tnt).length;
  }

  zoneAt(x: number, z: number): { dir: 'E' | 'W' } | null {
    for (const zn of this.zones) {
      if (x >= zn.xMin && x <= zn.xMax && z >= zn.zMin && z <= zn.zMax) return zn;
    }
    return null;
  }

  update(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.axis === 'z') {
        // side-scroll patrol: back and forth across the screen
        e.group.position.z += e.dir * e.speed * dt;
        if (e.group.position.z > e.x1) {
          e.group.position.z = e.x1;
          e.dir = -1;
        } else if (e.group.position.z < e.x0) {
          e.group.position.z = e.x0;
          e.dir = 1;
        }
        e.group.rotation.y = e.dir > 0 ? 0 : Math.PI;
      } else {
        e.group.position.x += e.dir * e.speed * dt;
        if (e.group.position.x > e.x1) {
          e.group.position.x = e.x1;
          e.dir = -1;
        } else if (e.group.position.x < e.x0) {
          e.group.position.x = e.x0;
          e.dir = 1;
        }
        e.group.rotation.y = e.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      e.box.setFromCenterAndSize(
        e.group.position.clone().add(new THREE.Vector3(0, 0.55, 0)),
        new THREE.Vector3(1.3, 1.1, 1.3),
      );
    }
    // Floating wumpa bob in place.
    for (const p of this.pickups) {
      if (!p.alive) continue;
      p.mesh.position.y =
        (p.mesh.userData.baseY as number) + Math.sin(this.time * 3 + p.mesh.position.z * 0.7) * 0.12;
      p.mesh.rotation.y += dt * 2;
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
    // Lit TNT fuses: pulse faster and faster, then blow.
    for (const c of this.crates) {
      if (!c.tnt || !c.alive || c.fuse === undefined) continue;
      c.fuse -= dt;
      const digit = Math.max(1, Math.ceil(c.fuse));
      if (c.mesh.userData.digit !== digit) {
        c.mesh.userData.digit = digit;
        (c.mesh.material as THREE.MeshLambertMaterial).map = this.tntTexture(String(digit));
        sfx.play(digit % 2 === 0 ? 'tntCount2' : 'tntCount', 0.7);
      }
      const urgency = 6 + (CONST.tntFuse - c.fuse) * 6;
      c.mesh.scale.setScalar(1 + Math.abs(Math.sin(this.time * urgency)) * 0.06);
      if (c.fuse <= 0) this.detonate(c);
    }

    // Expanding blasts: chain explosives, break crates, kill enemies.
    for (const ex of this.explosions) {
      ex.t += dt;
      if (ex.t <= CONST.blastGrow + 0.05) {
        const r = ex.radius * Math.min(1, ex.t / CONST.blastGrow);
        for (const c of this.crates) {
          if (!c.alive || c.bouncy) continue;
          if (c.mesh.position.distanceTo(ex.center) < r + 0.6) {
            if (c.nitro || c.tnt) this.detonate(c);
            else {
              this.breakCrate(c);
              this.blastBroken.push(c);
            }
          }
        }
        for (const e of this.enemies) {
          if (e.alive && e.group.position.distanceTo(ex.center) < r + 0.8) this.killEnemy(e);
        }
      }
    }
    for (let i = this.blastMeshes.length - 1; i >= 0; i--) {
      const b = this.blastMeshes[i];
      const r = Math.max(0.01, b.ex.radius * Math.min(1, b.ex.t / CONST.blastGrow));
      b.outer.scale.setScalar(r);
      b.inner.scale.setScalar(r * 0.55);
      const fade = Math.max(0, 1 - b.ex.t / 0.6);
      (b.outer.material as THREE.MeshBasicMaterial).opacity = 0.55 * fade;
      (b.inner.material as THREE.MeshBasicMaterial).opacity = 0.9 * fade;
      if (b.ex.t > 0.6) {
        this.root.remove(b.outer);
        this.root.remove(b.inner);
        (b.outer.material as THREE.Material).dispose();
        (b.inner.material as THREE.Material).dispose();
        this.blastMeshes.splice(i, 1);
      }
    }
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      if (this.explosions[i].t > 0.7) this.explosions.splice(i, 1);
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
    sfx.play(Math.random() < 0.5 ? 'crateBreak1' : 'crateBreak2', 0.8);
  }

  lightFuse(c: Crate): void {
    if (c.alive && c.tnt && c.fuse === undefined) c.fuse = CONST.tntFuse;
  }

  // Blow up a nitro/TNT box: expanding blast that chains neighbors, breaks
  // normal crates, kills enemies, and (checked player-side) kills the rider.
  // safe=true (the player spun/slammed it themselves) spares the rider — but
  // anything it CHAINS detonates unsafe, so popping a stack up close is a risk.
  detonate(c: Crate, safe = false): void {
    if (!c.alive) return;
    c.alive = false;
    c.fuse = undefined;
    c.mesh.visible = false;
    const center = c.mesh.position.clone();
    const radius = c.tnt ? CONST.blastRadius * CONST.tntBlastScale : CONST.blastRadius;
    const ex = { center, t: 0, radius, safe };
    this.explosions.push(ex);
    sfx.play('tntBoom', 0.9);
    const outer = new THREE.Mesh(
      Level.blastGeo,
      new THREE.MeshBasicMaterial({ color: 0xff7a28, transparent: true, opacity: 0.55 }),
    );
    const inner = new THREE.Mesh(
      Level.blastGeo,
      new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.9 }),
    );
    outer.position.copy(center);
    inner.position.copy(center);
    outer.scale.setScalar(0.01);
    inner.scale.setScalar(0.01);
    this.root.add(outer);
    this.root.add(inner);
    this.blastMeshes.push({ outer, inner, ex });
  }

  consumeBlastBroken(): Crate[] {
    const b = this.blastBroken;
    this.blastBroken = [];
    return b;
  }

  killEnemy(enemy: Enemy): void {
    enemy.alive = false;
    this.pops.push({ obj: enemy.group, t: 0.12 });
    sfx.play('enemyDown', 0.7);
  }

  // Broken (spun/stomped) like a normal box; banks the respawn point and a
  // snapshot of exactly which crates are broken + the counter at this moment.
  activateCheckpoint(cp: Checkpoint, cratesBroken: number, fruit = 0, masks = 0, points = 0): void {
    cp.active = true;
    cp.savedAlive = this.crates.map((c) => c.alive);
    cp.savedCratesBroken = cratesBroken;
    cp.savedFruit = fruit;
    cp.savedMasks = masks;
    cp.savedPoints = points;
    this.currentSpawn.copy(cp.spawnPos);
    this.activeCheckpoint = cp;
    cp.mesh.scale.setScalar(1);
    this.pops.push({ obj: cp.mesh, t: 0.12 }); // break it like a crate
    sfx.play('lifeGet', 0.8);
  }

  private restoreTntFace(c: Crate): void {
    if (c.tnt && c.mesh.userData.digit !== undefined) {
      c.mesh.userData.digit = undefined;
      (c.mesh.material as THREE.MeshLambertMaterial).map = this.tntTexture('TNT');
    }
  }

  // Soft reset (death): restore the crate world to the last checkpoint's
  // snapshot — boxes broken before it stay broken, boxes broken after it come
  // back; banked checkpoints stay consumed. Hard reset (R / new run) revives
  // everything and relights every checkpoint box.
  reset(hard: boolean): void {
    this.pops.length = 0;
    this.explosions.length = 0;
    this.blastBroken.length = 0;
    for (const b of this.blastMeshes) {
      this.root.remove(b.outer);
      this.root.remove(b.inner);
      (b.outer.material as THREE.Material).dispose();
      (b.inner.material as THREE.Material).dispose();
    }
    this.blastMeshes.length = 0;

    if (!hard && this.activeCheckpoint) {
      const snap = this.activeCheckpoint.savedAlive;
      this.crates.forEach((c, i) => {
        c.alive = snap[i];
        c.mesh.visible = snap[i];
        c.mesh.scale.setScalar(1);
        c.fuse = undefined;
        this.restoreTntFace(c);
      });
    } else {
      for (const c of this.crates) {
        c.alive = true;
        c.mesh.visible = true;
        c.mesh.scale.setScalar(1);
        c.fuse = undefined;
        this.restoreTntFace(c);
      }
    }

    for (const e of this.enemies) {
      e.alive = true;
      e.group.visible = true;
      e.group.scale.setScalar(1);
      if (e.axis === 'z') e.group.position.z = (e.x0 + e.x1) / 2;
      else e.group.position.x = (e.x0 + e.x1) / 2;
      e.dir = 1;
      e.box.makeEmpty();
    }

    // Floating wumpa always comes back (the fruit counter reverts with the
    // checkpoint snapshot, so it stays collectable).
    for (const p of this.pickups) {
      p.alive = true;
      p.mesh.visible = true;
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
    this.slab('beach', 14, -40, 0, 20, matBeach, false);

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
    // Halfpipe, THPS fake physics: lateral speed built on the flat carries up
    // the transition (player.ts pipeVel), bleeds against the steepness, and
    // whatever is left at the lip converts into a locked vert air. The walls
    // approximate a radius-7.3 quarter-pipe; lips are grindable rails.
    const hpFloor = this.slab('halfpipe floor', -710, -770, -13.5, 6, matA, false);
    hpFloor.userData.hpFloor = true;
    const profile: [number, number, number, number][] = [
      // xIn, xOut, yBase, yTop — circle points, steepening toward the lip
      [3.0, 4.8, -13.5, -13.27],
      [4.8, 6.3, -13.27, -12.71],
      [6.3, 7.5, -12.71, -11.95],
      [7.5, 8.7, -11.95, -10.76],
      [8.7, 9.6, -10.76, -9.32],
      [9.6, 10.3, -9.32, -7.4],
    ];
    for (const [xIn, xOut, yBase, yTop] of profile) {
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
      }
    }
    this.halfpipeLipY = -7.6;
    this.halfpipeLipX = 10.3;
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
    const lipL = new Rail([new THREE.Vector3(-10.4, -7.2, -712), new THREE.Vector3(-10.4, -7.2, -766)]);
    const lipR = new Rail([new THREE.Vector3(10.4, -7.2, -712), new THREE.Vector3(10.4, -7.2, -766)]);
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
    this.crate(-3, -5, -95, 'mask');
    this.crate(2.5, -13.5, -872, 'mask');
    this.crate(5, 0, -32);
    this.crate(6.5, 0, -32);
    // Corridor A: full-width wall — spin through, or jump on top to bounce.
    for (let i = 0; i < 9; i++) this.crate(-5.2 + i * 1.3, -5, -100);
    this.crate(-4.5, -5, -132);
    this.crate(-4.5, -3.8, -132); // stack
    this.crate(4.5, -5, -145);
    this.crate(4.5, -3.8, -145); // stack
    // Corridor B: a 4-story step string on the right with crate rewards.
    this.stepBlock(4, -192, 4, 6, -5.5, -3.3);
    this.crate(4, -3.3, -192);
    this.stepBlock(4, -199, 4, 6, -5.5, -1.1);
    this.crate(4, -1.1, -199);
    this.stepBlock(4, -206, 4, 6, -3, 1.1);
    this.crate(4, 1.1, -206);
    this.stepBlock(4, -213, 4, 6, -1, 3.3);
    this.crate(4, 3.3, -213);
    // Corridor B: risky edge lines between the enemies.
    this.crate(5, -5.5, -205);
    this.crate(5, -5.5, -208);
    this.crate(-5, -5.5, -222);
    this.crate(-5, -5.5, -195, 'mask');
    // Corridor C: center cluster + risky pair before the first rail.
    this.crate(-1.5, -13, -315);
    this.crate(0, -13, -315);
    this.crate(1.5, -13, -315);
    this.crate(0, -11.8, -315); // stack
    this.crate(5.2, -13, -330);
    this.crate(5.2, -13, -333);
    this.crate(-5, -13, -322, 'mask');
    // Rail 1 entry flanks.
    this.crate(-2.4, -13, -342);
    this.crate(2.4, -13, -342);
    // Corridor D: second full-width wall + edge stacks.
    for (let i = 0; i < 9; i++) this.crate(-5.2 + i * 1.3, -13, -520);
    this.crate(-4.8, -13, -565);
    this.crate(-4.8, -11.8, -565); // stack
    this.crate(4.8, -13, -565);
    this.crate(4.8, -11.8, -565); // stack
    this.crate(4.8, -13, -545, 'mask');
    // Rail 2 entry flanks.
    this.crate(-2.4, -13, -567);
    this.crate(2.4, -13, -567);
    // Practice pen toys — including a mask row for testing triple-mask mode.
    this.crate(22, 0, -6, 'mask');
    this.crate(25, 0, -6, 'mask');
    this.crate(28, 0, -6, 'mask');
    this.crate(14, 0, -20);
    this.crate(31, 0, -28);
    this.crate(37, 0, -12, 'bouncy');
    this.towerClimb(-8, 0, 4, 34); // staggered tower: four stories, crates up top
    this.stairClimb(10, 0, 7, 13, 7); // flush guarded stair: seven stories, hard to fall off
    // Halfpipe: bouncy arrow crate launches you up to the lip rails.
    this.crate(-2.2, -13.5, -735, 'bouncy');
    this.crate(0, -13.5, -755); // wumpa snack on the floor line
    this.crate(2.2, -13.5, -745, 'mask');
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
    // Corridor D: a big mixed explosive block off the left lane — spin the
    // TNT to pop it (your own pop is safe, the chained nitro blast is NOT).
    this.crate(-2.6, -13, -530, 'tnt');
    this.crate(-2.6, -11.8, -530, 'nitro');
    this.crate(-1.3, -13, -530, 'tnt');
    this.crate(-3.9, -13, -530);
    // Rail yard landing: a bouncy crate off the racing line, and a 2x2 nitro
    // block guarding the left side.
    this.crate(2.5, -13.5, -868, 'bouncy');
    this.crate(-3, -13.5, -866, 'nitro');
    this.crate(-4.3, -13.5, -866, 'nitro');
    this.crate(-3, -12.3, -866, 'nitro');
    this.crate(-4.3, -12.3, -866, 'nitro');
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
    this.slab('beach', 14, -30, 0, 22, matSand, false);
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
    this.crate(-2, 0, -50, 'mask');
    this.crate(0, 0, -75);
    this.crate(0, 1.2, -75); // stack
    this.enemy(-3, 3, 0, -70, 3);

    // water gap 1
    // -90 .. -102
    this.ramp('jungle rise', -102, 0, -112, 1.5, 12, matRamp);
    this.slab('jungle path', -112, -150, 1.5, 10, matJungle);
    this.crate(-2.5, 1.5, -128);
    this.crate(2.5, 1.5, -140);
    this.crate(3, 1.5, -146, 'mask');
    this.enemy(-3.5, 3.5, 1.5, -135, 4);

    // forked path around a ruin block
    this.slab('forked path', -150, -205, 1.5, 14, matJungle);
    this.wall(0, -177, 4, 40, 1.5, 3); // the ruin wall splitting the lanes
    this.crate(-4, 1.5, -165);
    this.crate(-4, 1.5, -175, 'tnt'); // brush it and keep moving
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
    // step platform up the ruin wall
    this.stepBlock(-4, -292, 4, 6, 1.5, 3.6);
    this.crate(-4, 3.6, -292);
    this.crate(-4, 1.5, -300, 'mask');
    // big nitro block stacked in the ruin corner
    this.crate(4.5, 1.5, -272, 'nitro');
    this.crate(4.5, 2.7, -272, 'nitro');
    this.crate(3.2, 1.5, -272, 'nitro');

    // the temple stair: four flush guarded stories over the water
    const climb = this.stairClimb(-312, 1.5, 4);
    const top = climb.topY;
    this.slab('temple top', climb.endZ - 2, -420, top, 12, matStone);
    this.enemy(-4, 4, top, -370, 6);
    this.crate(2, top, -382, 'mask');
    this.checkpoint(top, -390);
    this.crate(-4.5, top, -405, 'nitro');
    this.crate(4.5, top, -405, 'nitro');
    this.crate(0, top, -405);

    this.slab('exit', -420, -470, top, 14, matSand);
    this.finishGate(top, this.finishZ);
    this.endWall(top);
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
    this.slab('gate base', 10, -20, 0, 14, matWood, false);
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
    this.crate(0, 8, -108, 'mask');
    this.crate(3, 8, -115, 'mask');
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
    this.crate(-3, 18, -214, 'mask');
    this.crate(2, 18, -217, 'tnt'); // light it and the blast clears the planks
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
    this.crate(0, 33, -395, 'mask');
    this.crate(-4, 33, -400);
    this.crate(4, 33, -400);
    this.finishGate(33, this.finishZ);
    this.endWall(33);
  }

  // The "Sideways" level is an L-shaped course now: a corridor intro heading
  // down -Z, a right-angle turn onto a stretch that runs along +X — which the
  // fixed camera therefore sees side-on (real side-scroll platforming, no
  // camera move) — then a second corner back onto -Z for the finish.
  private buildSideways(): void {
    const matA = new THREE.MeshLambertMaterial({ color: 0x7f8fa0 });
    const matGround = new THREE.MeshLambertMaterial({ color: 0x77955e });
    const matPlat = new THREE.MeshLambertMaterial({ color: 0x8a8f79 });
    const matStone = new THREE.MeshLambertMaterial({ color: 0x7d8288 });

    this.killY = -20;
    this.finishZ = -104;
    this.endWallZ = -116;

    // the turned stretch: path runs +X between the two corner decks
    this.zones = [{ xMin: 9, xMax: 146, zMin: -62, zMax: -38, dir: 'E' }];

    // cliff backdrop behind the sideways stretch, and the pit below it
    const cliff = new THREE.Mesh(
      new THREE.BoxGeometry(200, 60, 1.5),
      new THREE.MeshLambertMaterial({ color: 0x31543c }),
    );
    cliff.position.set(88, 8, -64);
    this.root.add(cliff);
    const pit = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshBasicMaterial({ color: 0x1c1220 }),
    );
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(80, -24, -60);
    this.root.add(pit);

    // corridor intro heading down -Z
    this.slab('start', 16, -12, 0, 10, matA, false);
    this.wall(0, 17, 12, 1, 0);
    this.crate(0, 0, -3, 'mask');
    this.fruitRow(-16, -22, 1.3, 4);
    this.slab('approach', -12, -38, 0, 10, matGround);
    this.crate(0, 0, -24);
    this.crate(0, 1.2, -24); // stack: spin, bounce, or headbutt
    this.enemy(-3, 3, 0, -31, 4);

    // CORNER 1: the path right-angles east; a wall dead ahead sells the turn
    this.slab('corner', -38, -56, 0, 18, matA, false, 4);
    this.wall(4, -57.5, 18, 1.5, 0);

    // the sideways stretch: everything below runs along +X at the z band -47
    const CZ = -47;
    this.slabX('ruin walk', 13, 34, 0, 9, matGround, CZ);
    this.crate(24, 0, CZ);
    this.crate(24, 1.2, CZ);
    this.crate(24, 2.4, CZ, 'mask'); // crown the stack
    this.fruitRowX(15, 21, 1.3, 4, CZ);
    // ascending floating platforms over the pit
    this.slabX('plat A', 40, 50, 1.5, 9, matPlat, CZ);
    this.crate(45, 1.5, CZ, 'tnt');
    this.slabX('plat B', 56, 66, 3, 9, matPlat, CZ);
    this.checkpoint(3, CZ, 61);
    // big pit: grind the rail across (fruit lines it), or hop the pads
    const pitRail = new Rail([new THREE.Vector3(66, 3.9, CZ), new THREE.Vector3(90, 3.3, CZ)]);
    this.rails.push(pitRail);
    this.root.add(pitRail.object);
    this.fruitRowX(70, 86, 5.2, 5, CZ);
    this.slabX('pit pad', 74, 80, 3, 9, matPlat, CZ);
    // landing shelf: nitro squats the lane, crab patrols the screen
    this.slabX('mid shelf', 90, 108, 3.2, 9, matGround, CZ);
    this.crate(98, 3.2, CZ, 'nitro');
    this.enemy(94, 106, 3.2, CZ, 5);
    // split: bounce the arrow crate up to the high ledge, or run the TNT road
    this.crate(107, 3.2, CZ, 'bouncy');
    this.slabX('high ledge', 110, 128, 8.4, 9, matPlat, CZ);
    this.crate(118, 8.4, CZ, 'mask');
    this.fruitRowX(112, 126, 9.7, 6, CZ);
    this.slabX('low road', 110, 132, 2.8, 9, matStone, CZ);
    this.crate(117, 2.8, CZ, 'tnt');
    this.crate(124, 2.8, CZ, 'tnt');
    // rejoin before the second corner
    this.slabX('rejoin', 136, 146, 3.6, 9, matGround, CZ);
    this.checkpoint(3.6, CZ, 141);

    // CORNER 2: the path turns back south toward the gate
    this.slab('corner 2', -38, -56, 3.6, 18, matA, false, 152);
    this.wall(161.5, -47, 1.5, 18, 3.6);
    this.wall(152, -37, 18, 1.5, 3.6); // north lip of the corner

    // corridor finish at the far end of the L
    this.slab('descent', -56, -70, 3.6, 10, matPlat, true, 152);
    this.slab('step down', -74, -84, 1.6, 10, matPlat, true, 152);
    this.slab('final run', -88, -120, 0, 12, matStone, true, 152);
    this.crate(149, 0, -91, 'mask');
    this.crate(152, 0, -94);
    this.crate(152, 1.2, -94);
    this.crate(152, 2.4, -94); // tower: spin through or bounce up
    this.enemy(148, 156, 0, -99, 5);
    this.fruitRow(-90, -96, 1.4, 4, 149);
    this.finishGate(0, this.finishZ, 152);
    this.endWall(0, 152);
  }

  // Flat deck. z0 is the near (higher z) edge, z1 the far edge, topY the
  // surface height the player rides on. cx offsets the deck laterally.
  private slab(
    name: string,
    z0: number,
    z1: number,
    topY: number,
    width: number,
    mat: THREE.Material,
    grindEdges = true,
    cx = 0,
  ): THREE.Mesh {
    const depth = Math.abs(z1 - z0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1, depth),
      this.patterned(mat, width, depth),
    );
    mesh.position.set(cx, topY - 0.5, (z0 + z1) / 2);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    this.curbs(z0, z1, topY, width, cx);
    if (grindEdges) this.edgeRails(z0, topY, z1, topY, width, cx);
    return mesh;
  }

  // The curb lines themselves are grindable: invisible rails along both deck
  // edges, THPS ledge-style.
  private edgeRails(z0: number, y0: number, z1: number, y1: number, width: number, cx = 0): void {
    for (const side of [-1, 1]) {
      const x = cx + side * (width / 2 - 0.15);
      const rail = new Rail(
        [new THREE.Vector3(x, y0 + 0.05, z0), new THREE.Vector3(x, y1 + 0.05, z1)],
        false,
      );
      this.rails.push(rail);
    }
  }

  // Flat deck running along X (for turned, side-scrolling stretches).
  // x0 < x1; depth is the deck's size along z, centered on cz.
  private slabX(
    name: string,
    x0: number,
    x1: number,
    topY: number,
    depth: number,
    mat: THREE.Material,
    cz: number,
  ): THREE.Mesh {
    const len = Math.abs(x1 - x0);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len, 1, depth),
      this.patterned(mat, len, depth),
    );
    mesh.position.set((x0 + x1) / 2, topY - 0.5, cz);
    mesh.name = name;
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    return mesh;
  }

  private fruitRowX(x0: number, x1: number, y: number, n: number, z: number): void {
    for (let i = 0; i < n; i++) {
      this.pickup(THREE.MathUtils.lerp(x0, x1, n === 1 ? 0 : i / (n - 1)), y, z);
    }
  }

  // Sloped deck between two top-surface edge lines (z0,y0) -> (z1,y1).
  private ramp(name: string, z0: number, y0: number, z1: number, y1: number, width: number, mat: THREE.Material, cx = 0): void {
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dy, dz);
    const dyn = dy / len;
    const dzn = dz / len;
    // Box local +Z under rotation.x = a maps to (0, -sin a, cos a). The course
    // runs toward -Z, so align local +Z with the *reverse* travel direction.
    const alpha = Math.atan2(dyn, -dzn);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 1, len),
      this.patterned(mat, width, len),
    );
    mesh.rotation.x = alpha;
    const normal = new THREE.Vector3(0, -dzn, dyn);
    mesh.position
      .set(cx, (y0 + y1) / 2, (z0 + z1) / 2)
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

  // Solid raised platform: walkable top, solid sides (jump up onto it).
  private stepBlock(x: number, z: number, w: number, d: number, baseY: number, topY: number): void {
    const h = topY - baseY;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color: 0x6e7683 }),
    );
    mesh.position.set(x, baseY + h / 2, z);
    mesh.name = 'step block';
    this.root.add(mesh);
    this.groundMeshes.push(mesh);
    // Side collider stops a hair below the top so standing on it doesn't shove.
    this.walls.push(
      new THREE.Box3(
        new THREE.Vector3(x - w / 2, baseY - 1, z - d / 2),
        new THREE.Vector3(x + w / 2, topY - 0.2, z + d / 2),
      ),
    );
  }

  // Crash-style temple stair: staggered solid columns strung into a real
  // multi-story climb (each step ~2.6 up, small hop between). Returns where
  // the top block ends so the course can continue at height.
  private towerClimb(
    zStart: number,
    baseY: number,
    stories: number,
    xCenter = 0,
  ): { endZ: number; topY: number } {
    let y = baseY;
    let z = zStart;
    for (let i = 0; i < stories; i++) {
      y += 2.6;
      const x = xCenter + (i % 2 === 0 ? -2.2 : 2.2);
      this.stepBlock(x, z - 2.5, 5, 5, y - 9, y);
      if (i % 2 === 1 || i === stories - 1) this.crate(x, y, z - 2.5);
      z -= 7;
    }
    return { endZ: z, topY: y };
  }

  // Flush staircase: steps butt directly against each other (no gap to fall
  // through) with guard rails along both sides — the safe way to gain real
  // height. Bonk the riser, hop up, repeat.
  private stairClimb(
    zStart: number,
    baseY: number,
    stories: number,
    xCenter = 0,
    width = 8,
  ): { endZ: number; topY: number } {
    const depth = 5;
    let y = baseY;
    let z = zStart;
    for (let i = 0; i < stories; i++) {
      y += 2.6;
      this.stepBlock(xCenter, z - depth / 2, width, depth, y - 10, y);
      // guard rails so you can't slip off the sides
      for (const side of [-1, 1]) {
        this.wall(xCenter + side * (width / 2 + 0.3), z - depth / 2, 0.6, depth, y, 1.6);
      }
      if (i % 2 === 1) this.crate(xCenter, y, z - depth / 2);
      z -= depth;
    }
    return { endZ: z, topY: y };
  }

  // Dark edge strips so deck borders read at speed. Visual only.
  private curbs(z0: number, z1: number, topY: number, width: number, cx = 0): void {
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a4e58 });
    const depth = Math.abs(z1 - z0);
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, depth), mat);
      curb.position.set(cx + side * (width / 2 - 0.2), topY + 0.11, (z0 + z1) / 2);
      this.root.add(curb);
    }
  }

  private crate(x: number, deckY: number, z: number, kind?: 'nitro' | 'bouncy' | 'tnt' | 'mask'): void {
    const size = 1.2;
    let mat: THREE.MeshLambertMaterial;
    if (kind === 'nitro') {
      mat = new THREE.MeshLambertMaterial({ color: 0x35d054, emissive: 0x0c3a16 });
    } else if (kind === 'bouncy') {
      mat = new THREE.MeshLambertMaterial({ color: 0xe8c832, map: this.arrowTexture() });
    } else if (kind === 'tnt') {
      mat = new THREE.MeshLambertMaterial({ color: 0xd04038, map: this.tntTexture('TNT') });
    } else if (kind === 'mask') {
      mat = new THREE.MeshLambertMaterial({ color: 0xd08a3a, map: this.maskTexture() });
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
    this.crates.push({
      mesh,
      box,
      alive: true,
      nitro: kind === 'nitro',
      bouncy: kind === 'bouncy',
      tnt: kind === 'tnt',
      mask: kind === 'mask',
    });
  }

  // Aku-style mask face (shared texture).
  private maskTexture(): THREE.CanvasTexture {
    if (this.maskTex) return this.maskTex;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d08a3a';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#5a2d12';
    ctx.fillRect(6, 4, 20, 4); // headdress band
    ctx.fillRect(9, 12, 5, 6); // eyes
    ctx.fillRect(18, 12, 5, 6);
    ctx.fillRect(10, 23, 12, 3); // mouth
    this.maskTex = new THREE.CanvasTexture(canvas);
    this.maskTex.magFilter = THREE.NearestFilter;
    return this.maskTex;
  }

  // Classic red TNT face; lit fuses swap it for big 3 / 2 / 1 digits.
  private tntTexture(label: string): THREE.CanvasTexture {
    const cached = this.tntTexCache.get(label);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d04038';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = label.length > 1 ? 'bold 11px monospace' : 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 16, 18);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    this.tntTexCache.set(label, tex);
    return tex;
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

  private enemyGroup(): THREE.Group {
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
    this.root.add(group);
    return group;
  }

  private enemy(x0: number, x1: number, deckY: number, z: number, speed: number): void {
    const group = this.enemyGroup();
    group.position.set((x0 + x1) / 2, deckY, z);
    this.enemies.push({ group, box: new THREE.Box3(), alive: true, x0, x1, dir: 1, speed });
  }

  // Floating collectable wumpa.
  private pickup(x: number, y: number, z: number): void {
    const mesh = new THREE.Mesh(
      Level.pickupGeo,
      new THREE.MeshLambertMaterial({ color: 0xff9028, emissive: 0x4a2006 }),
    );
    mesh.position.set(x, y, z);
    mesh.userData.baseY = y;
    this.root.add(mesh);
    this.pickups.push({
      mesh,
      alive: true,
      box: new THREE.Box3().setFromCenterAndSize(
        mesh.position.clone(),
        new THREE.Vector3(1.2, 1.5, 1.2),
      ),
    });
  }

  private fruitRow(z0: number, z1: number, y: number, n: number, x = 0): void {
    for (let i = 0; i < n; i++) {
      this.pickup(x, y, THREE.MathUtils.lerp(z0, z1, n === 1 ? 0 : i / (n - 1)));
    }
  }

  // A distinct blue box that sits on the deck like a normal crate. Spin or
  // stomp it (bumping is a wall) to bank the checkpoint; its trigger matches
  // the box, so it can be dodged rather than being an unmissable gate.
  private checkpoint(deckY: number, z: number, x = 0): void {
    const size = 1.4;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshLambertMaterial({ color: 0x4aa0e0, emissive: 0x123049 }),
    );
    mesh.position.set(x, deckY + size / 2, z);
    this.root.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      mesh.position.clone(),
      new THREE.Vector3(size, size, size),
    );
    this.checkpoints.push({
      mesh,
      box,
      active: false,
      spawnPos: new THREE.Vector3(x, deckY + 0.1, z),
      savedAlive: [],
      savedCratesBroken: 0,
      savedFruit: 0,
      savedMasks: 0,
      savedPoints: 0,
    });
  }

  // Crude seedless random course: flats with random furniture, gaps, slopes,
  // rails over pits, kickers, step blocks — and the camera occasionally
  // swings sideways for a stretch. Re-select "Random" to reroll.
  private buildRandom(): void {
    const mats = [0x8a8f9a, 0x767b87, 0x7d95a5, 0x86937e].map(
      (c) => new THREE.MeshLambertMaterial({ color: c }),
    );
    const mat = () => mats[Math.floor(Math.random() * mats.length)];
    let z = 14;
    let y = 0;
    let minY = 0;
    let dist = 0;
    let lastGap = false;
    let cpDue = 170;
    let xc = 0; // course centerline: a sideways jog shifts everything after it
    let jogDone = false;
    this.slab('start', z, z - 30, y, 14, mat(), true, xc);
    z -= 30;
    while (dist < 800) {
      const roll = Math.random();
      if (!jogDone && !lastGap && dist > 150 && dist < 600 && roll < 0.12) {
        // SIDEWAYS JOG: the path right-angles east across floating pads, then
        // turns south again — the fixed camera sees the stretch side-on.
        const JOG = 70;
        this.slab('corner', z, z - 16, y, 16, mat(), false, xc + 3);
        this.wall(xc + 3, z - 17.5, 16, 1.5, y);
        this.zones.push({ xMin: xc + 9, xMax: xc + JOG - 9, zMin: z - 16, zMax: z, dir: 'E' });
        const cz = z - 8;
        for (let px = xc + 11; px + 9 <= xc + JOG - 8; px += 14) {
          this.slabX('side pad', px, px + 9, y, 9, mat(), cz);
          if (Math.random() < 0.4) this.crate(px + 4.5, y, cz);
          if (Math.random() < 0.5) this.fruitRowX(px + 2, px + 7, y + 1.3, 3, cz);
        }
        this.slab('corner', z, z - 16, y, 16, mat(), false, xc + JOG - 3);
        this.wall(xc + JOG + 6.5, z - 8, 1.5, 16, y);
        xc += JOG - 3;
        z -= 16;
        dist += 50;
        cpDue -= 16;
        lastGap = false;
        jogDone = true;
      } else if (roll < 0.34 || lastGap) {
        // flat deck with random furniture
        const len = 28 + Math.random() * 22;
        const w = 10 + Math.random() * 4;
        this.slab('deck', z, z - len, y, w, mat(), true, xc);
        const crates = Math.floor(Math.random() * 3);
        for (let i = 0; i < crates; i++) {
          this.crate(xc + Math.round(Math.random() * 8 - 4), y, z - 6 - Math.random() * (len - 12));
        }
        if (Math.random() < 0.5) this.enemy(xc - 3.5, xc + 3.5, y, z - len / 2, 3 + Math.random() * 5);
        if (Math.random() < 0.35) this.crate(xc + (Math.random() < 0.5 ? -4 : 4), y, z - len * 0.7, 'nitro');
        if (Math.random() < 0.22) this.crate(xc + (Math.random() < 0.5 ? -3 : 3), y, z - len * 0.4, 'tnt');
        if (Math.random() < 0.22) this.crate(xc + (Math.random() < 0.5 ? -2 : 2), y, z - len * 0.3, 'mask');
        if (Math.random() < 0.25) this.fruitRow(z - 8, z - len + 8, y + 1.4, 4, xc);
        if (Math.random() < 0.3) {
          const bx = xc + (Math.random() < 0.5 ? -2.5 : 2.5);
          this.stepBlock(bx, z - len * 0.5, 4, 5, y, y + 2.2);
          this.crate(bx, y + 2.2, z - len * 0.5);
        }
        if (cpDue <= 0) {
          this.checkpoint(y, z - len + 6, xc);
          cpDue = 200 + Math.random() * 80;
        }
        z -= len;
        dist += len;
        cpDue -= len;
        lastGap = false;
      } else if (roll < 0.49) {
        // gap over the void
        const len = 10 + Math.random() * 8;
        z -= len;
        dist += len;
        lastGap = true;
      } else if (roll < 0.64) {
        // slope (downhill-biased)
        const len = 28 + Math.random() * 12;
        const dy = Math.random() < 0.65 ? -(3 + Math.random() * 5) : 2 + Math.random() * 2.5;
        this.ramp('slope', z, y, z - len, y + dy, 10, mat(), xc);
        z -= len;
        y += dy;
        minY = Math.min(minY, y);
        dist += len;
        cpDue -= len;
        lastGap = false;
      } else if (roll < 0.82) {
        // rail over a pit (always follows solid ground)
        const len = 36 + Math.random() * 20;
        const rail = new Rail([
          new THREE.Vector3(xc, y + 0.9, z + 4),
          new THREE.Vector3(xc + Math.round(Math.random() * 5 - 2.5), y + 1.1, z - len / 2),
          new THREE.Vector3(xc, y + 0.9, z - len - 4),
        ]);
        this.rails.push(rail);
        this.root.add(rail.object);
        z -= len;
        dist += len;
        lastGap = true;
      } else if (roll < 0.9) {
        // flush temple stair over the void
        const t = this.stairClimb(z - 2, y, 4, xc);
        dist += z - t.endZ + 4;
        z = t.endZ - 4;
        y = t.topY;
        lastGap = true; // force a solid deck right after the top block
      } else {
        // kicker lip into a gap
        this.ramp('kicker', z, y, z - 10, y + 2.4, 10, mat(), xc);
        z -= 10 + 12 + Math.random() * 6;
        dist += 28;
        minY = Math.min(minY, y);
        lastGap = true;
      }
    }
    if (lastGap) {
      this.slab('landing', z, z - 30, y, 12, mat(), true, xc);
      z -= 30;
    }
    this.slab('finish run', z, z - 45, y, 14, mat(), true, xc);
    this.finishZ = z - 30;
    this.endWallZ = z - 42;
    this.finishGate(y, this.finishZ, xc);
    this.endWall(y, xc);
    this.killY = minY - 26;
    const pit = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshBasicMaterial({ color: 0x3a1a2e }),
    );
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(0, minY - 34, z / 2);
    this.root.add(pit);
  }

  private endWall(deckY: number, cx = 0): void {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(14, 4, 1),
      new THREE.MeshLambertMaterial({ color: 0x5a5f6a }),
    );
    wall.position.set(cx, deckY + 2, this.endWallZ - 1);
    this.root.add(wall);
  }

  private finishGate(deckY: number, z: number, cx = 0): void {
    this.finishBox.setFromCenterAndSize(
      new THREE.Vector3(cx, deckY + 15, z),
      new THREE.Vector3(14, 30, 2),
    );
    const postMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), postMat);
      post.position.set(cx + side * 5.5, deckY + 3.5, z);
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
    banner.position.set(cx, deckY + 6.4, z);
    this.root.add(banner);
  }
}
