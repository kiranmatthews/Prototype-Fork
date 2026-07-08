// One short linear Crash 2 / THPS2 test course, built from authored greybox
// slabs. The course runs along -Z: start pad -> downhill ramp -> gap over a
// death pit -> landing -> grind rail over a big pit -> enemy/crate deck ->
// kicker ramp -> final gap -> finish gate.

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

const DECK_W = 12;

export class Level {
  groundMeshes: THREE.Mesh[] = [];
  crates: Crate[] = [];
  enemies: Enemy[] = [];
  rails: Rail[] = [];
  finishBox = new THREE.Box3();
  finishZ = -240;
  endWallZ = -257; // authored hard stop after the finish gate
  spawnPos = new THREE.Vector3(0, 0.1, 0);
  spawnHeading = Math.PI; // facing -Z

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

  reset(): void {
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
    }
  }

  // ---------------------------------------------------------------- build --

  private build(): void {
    const matA = new THREE.MeshLambertMaterial({ color: 0x8a8f9a });
    const matB = new THREE.MeshLambertMaterial({ color: 0x767b87 });
    const matRamp = new THREE.MeshLambertMaterial({ color: 0x7d95a5 });
    const matStart = new THREE.MeshLambertMaterial({ color: 0x7a9a7d });
    const matFinish = new THREE.MeshLambertMaterial({ color: 0x9a8f6e });

    // --- decks ---
    this.slab('start pad', 6, -26, 0, matStart);
    this.ramp('downhill ramp', -26, 0, -62, -9, matRamp);
    this.slab('runout', -62, -88, -9, matA);
    // gap 1: z -88 .. -100 (death pit, must jump)
    this.slab('landing', -100, -128, -9.5, matB);
    // big pit: z -128 .. -166 (rail only)
    this.slab('rail landing', -166, -198, -10, matA);
    this.ramp('kicker', -198, -10, -206, -7.8, matRamp);
    // gap 3: z -206 .. -218 (need speed off the kicker)
    this.slab('finish run', -218, -260, -10, matFinish);

    // --- death pit floor (visual only, way below killY) ---
    const pit = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 600),
      new THREE.MeshBasicMaterial({ color: 0x461420 }),
    );
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(0, -34, -130);
    this.scene.add(pit);

    // --- grind rail over the big pit ---
    const rail = new Rail([
      new THREE.Vector3(0, -8.5, -124),
      new THREE.Vector3(0, -7.8, -147),
      new THREE.Vector3(0, -8.3, -170),
    ]);
    this.rails.push(rail);
    this.scene.add(rail.object);

    // --- crates ---
    // Spin-through wall on the runout (safe line goes around, flow line goes through).
    this.crate(-1.5, -9, -74);
    this.crate(0, -9, -74);
    this.crate(1.5, -9, -74);
    this.crate(0, -7.8, -74); // stacked
    // Risky pair on the right edge just before the first death gap.
    this.crate(4.7, -9, -84);
    this.crate(4.7, -9, -86.5);
    // Flanking the rail entry to signpost it.
    this.crate(-2.4, -9.5, -120);
    this.crate(2.4, -9.5, -120);
    // Risky line on the left edge of the landing deck.
    this.crate(-4.7, -9.5, -108);
    this.crate(-4.7, -9.5, -111);
    // After the rail, center flow line...
    this.crate(0, -10, -174);
    this.crate(1.6, -10, -174);
    // ...and a risky pair near the right edge before the kicker.
    this.crate(4.7, -10, -190);
    this.crate(4.7, -10, -192.5);

    // --- enemy patrolling the deck after the rail ---
    this.enemy(-3, 3, -10, -182);

    // --- finish gate ---
    this.finishGate(-10, this.finishZ);
    this.finishBox.setFromCenterAndSize(
      new THREE.Vector3(0, -10 + 2.5, this.finishZ),
      new THREE.Vector3(DECK_W, 5, 2),
    );

    // --- end wall (visual for the authored hard stop) ---
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(DECK_W, 4, 1),
      new THREE.MeshLambertMaterial({ color: 0x5a5f6a }),
    );
    wall.position.set(0, -10 + 2, this.endWallZ - 1);
    this.scene.add(wall);
  }

  // Flat deck. z0 is the near (higher z) edge, z1 the far edge, topY the
  // surface height the player rides on.
  private slab(name: string, z0: number, z1: number, topY: number, mat: THREE.Material): void {
    const depth = Math.abs(z1 - z0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(DECK_W, 1, depth), mat);
    mesh.position.set(0, topY - 0.5, (z0 + z1) / 2);
    mesh.name = name;
    this.scene.add(mesh);
    this.groundMeshes.push(mesh);
    this.curbs(z0, z1, topY);
  }

  // Sloped deck between two top-surface edge lines (z0,y0) -> (z1,y1).
  private ramp(name: string, z0: number, y0: number, z1: number, y1: number, mat: THREE.Material): void {
    const dy = y1 - y0;
    const dz = z1 - z0;
    const len = Math.hypot(dy, dz);
    const dyn = dy / len;
    const dzn = dz / len;
    // Box local +Z under rotation.x = a maps to (0, -sin a, cos a). The course
    // runs toward -Z, so align local +Z with the *reverse* travel direction.
    const alpha = Math.atan2(dyn, -dzn);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(DECK_W, 1, len), mat);
    mesh.rotation.x = alpha;
    // Push the center half a thickness below the top surface, along the
    // surface normal.
    const normal = new THREE.Vector3(0, -dzn, dyn);
    mesh.position
      .set(0, (y0 + y1) / 2, (z0 + z1) / 2)
      .addScaledVector(normal, -0.5);
    mesh.name = name;
    this.scene.add(mesh);
    this.groundMeshes.push(mesh);
  }

  // Dark edge strips so deck borders read at speed. Visual only.
  private curbs(z0: number, z1: number, topY: number): void {
    const mat = new THREE.MeshLambertMaterial({ color: 0x4a4e58 });
    const depth = Math.abs(z1 - z0);
    for (const side of [-1, 1]) {
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, depth), mat);
      curb.position.set(side * (DECK_W / 2 - 0.2), topY + 0.11, (z0 + z1) / 2);
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
    mesh.rotation.y = 0.15; // slight tilt so stacks read as crates
    this.scene.add(mesh);
    const box = new THREE.Box3().setFromCenterAndSize(
      mesh.position.clone(),
      new THREE.Vector3(size, size, size),
    );
    this.crates.push({ mesh, box, alive: true });
  }

  private enemy(x0: number, x1: number, deckY: number, z: number): void {
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
    this.enemies.push({
      group,
      box: new THREE.Box3(),
      alive: true,
      x0,
      x1,
      dir: 1,
      speed: 3.5,
    });
  }

  private finishGate(deckY: number, z: number): void {
    const postMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 5, 0.5), postMat);
      post.position.set(side * 5.5, deckY + 2.5, z);
      this.scene.add(post);
    }
    // Checkered banner via a tiny canvas texture.
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
    banner.position.set(0, deckY + 4.6, z);
    this.scene.add(banner);
  }
}
