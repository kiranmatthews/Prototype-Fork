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
}

export class Level {
  groundMeshes: THREE.Mesh[] = [];
  crates: Crate[] = [];
  enemies: Enemy[] = [];
  checkpoints: Checkpoint[] = [];
  rails: Rail[] = [];
  finishBox = new THREE.Box3();
  finishZ = -830;
  endWallZ = -846; // authored hard stop after the finish gate
  spawnPos = new THREE.Vector3(0, 0.1, 0);
  currentSpawn = new THREE.Vector3(0, 0.1, 0); // last activated checkpoint

  private scene: THREE.Scene;
  private pops: { obj: THREE.Object3D; t: number }[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.build();
  }

  get totalCrates(): number {
    return this.crates.length;
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
    // Checkpoint crates idle-spin so they read as pickups.
    for (const c of this.checkpoints) {
      c.mesh.rotation.y += dt * 1.2;
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

  activateCheckpoint(cp: Checkpoint): void {
    cp.active = true;
    (cp.mesh.material as THREE.MeshLambertMaterial).color.setHex(0x59d47f);
    this.currentSpawn.copy(cp.spawnPos);
  }

  // Soft reset (death): crates and enemies come back, checkpoints stay lit.
  // Hard reset (R / new run): everything, including checkpoints and spawn.
  reset(hard: boolean): void {
    this.pops.length = 0;
    for (const c of this.crates) {
      c.alive = true;
      c.mesh.visible = true;
      c.mesh.scale.setScalar(1);
    }
    for (const e of this.enemies) {
      e.alive = true;
      e.group.visible = true;
      e.group.scale.setScalar(1);
      e.group.position.x = (e.x0 + e.x1) / 2;
      e.dir = 1;
      e.box.makeEmpty();
    }
    if (hard) {
      for (const cp of this.checkpoints) {
        cp.active = false;
        (cp.mesh.material as THREE.MeshLambertMaterial).color.setHex(0xf0f0f0);
      }
      this.currentSpawn.copy(this.spawnPos);
    }
  }

  // ---------------------------------------------------------------- build --

  private build(): void {
    const matA = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
    const matB = new THREE.MeshLambertMaterial({ color: 0x767b87 });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0x7d95a5 });
    const matBeach = new THREE.MeshLambertMaterial({ color: 0x9a9678 });
    const matFinish = new THREE.MeshLambertMaterial({ color: 0x9a8f6e });

    // --- decks (N. Sanity flow: beach -> funnel -> corridors -> finish) ---
    this.slab('beach', 14, -40, 0, 20, matBeach);
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
    this.ramp('final downhill', -710, -13.5, -765, -22, 12, matRamp);
    // gap 4: -765 .. -791 (fast)
    this.slab('finish run', -791, -850, -22, 12, matFinish);

    // --- death pit floor (visual only, below killY) ---
    const pit = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1400),
      new THREE.MeshBasicMaterial({ color: 0x461420 }),
    );
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(0, -60, -420);
    this.scene.add(pit);

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
    for (const rail of [rail1, rail2]) {
      this.rails.push(rail);
      this.scene.add(rail.object);
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
    // Final downhill: offset dodge crates (thread between them at speed).
    this.crate(-2.2, this.downhillY(-730), -730);
    this.crate(2.2, this.downhillY(-748), -748);

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

    // --- finish gate ---
    this.finishGate(-22, this.finishZ);
    this.finishBox.setFromCenterAndSize(
      new THREE.Vector3(0, -22 + 15, this.finishZ),
      new THREE.Vector3(12, 30, 2),
    );

    // --- end wall (visual for the authored hard stop) ---
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(12, 4, 1),
      new THREE.MeshLambertMaterial({ color: 0x5a5f6a }),
    );
    wall.position.set(0, -22 + 2, this.endWallZ - 1);
    this.scene.add(wall);
  }

  // Deck height along the final downhill ramp (for crate placement).
  private downhillY(z: number): number {
    return THREE.MathUtils.mapLinear(z, -710, -765, -13.5, -22);
  }

  // Flat deck. z0 is the near (higher z) edge, z1 the far edge, topY the
  // surface height the player rides on.
  private slab(name: string, z0: number, z1: number, topY: number, width: number, mat: THREE.Material): void {
    const depth = Math.abs(z1 - z0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, 1, depth), mat);
    mesh.position.set(0, topY - 0.5, (z0 + z1) / 2);
    mesh.name = name;
    this.scene.add(mesh);
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
    this.scene.add(mesh);
    this.groundMeshes.push(mesh);
  }

  // Dark edge strips so deck borders read at speed. Visual only.
  private curbs(z0: number, z1: number, topY: number, width: number): void {
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a4e58 });
    const depth = Math.abs(z1 - z0);
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, depth), mat);
      curb.position.set(side * (width / 2 - 0.2), topY + 0.11, (z0 + z1) / 2);
      this.scene.add(curb);
    }
  }

  private crate(x: number, deckY: number, z: number): void {
    const size = 1.2;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshLambertMaterial({ color: 0xb08a4a }),
    );
    mesh.position.set(x, deckY + size / 2, z);
    mesh.rotation.y = 0.15;
    this.scene.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      mesh.position.clone(),
      new THREE.Vector3(size, size, size),
    );
    this.crates.push({ mesh, box, alive: true });
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
    this.scene.add(group);
    this.enemies.push({ group, box: new THREE.Box3(), alive: true, x0, x1, dir: 1, speed });
  }

  // A floating white crate; touch it to set your respawn point. Trigger spans
  // the full corridor so you can't accidentally miss it.
  private checkpoint(deckY: number, z: number): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.4, 1.4),
      new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }),
    );
    mesh.position.set(0, deckY + 1.6, z);
    this.scene.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      new THREE.Vector3(0, deckY + 2, z),
      new THREE.Vector3(12, 5, 1.6),
    );
    this.checkpoints.push({
      mesh,
      box,
      active: false,
      spawnPos: new THREE.Vector3(0, deckY + 0.1, z),
    });
  }

  private finishGate(deckY: number, z: number): void {
    const postMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), postMat);
      post.position.set(side * 5.5, deckY + 3.5, z);
      this.scene.add(post);
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
    this.scene.add(banner);
  }
}
