import * as THREE from 'three';
import { solveTwoBoneIk } from './animation/ik';

type Arm = {root: THREE.Object3D; mid: THREE.Object3D; end: THREE.Object3D; grip?: THREE.Object3D};
const UP = new THREE.Vector3(0, 1, 0);

/** Inflated, curved foil with five sewn cells, struts and four taut flying lines.
 * Kept outside the character hierarchy so the sail never enlarges its hitbox. */
export class KiteTowVisual {
  readonly root = new THREE.Group();
  readonly sail = new THREE.Group();
  readonly bar = new THREE.Group();
  private readonly lines: THREE.Mesh[] = [];
  private readonly endpoints: THREE.Vector3[] = [];
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  readonly gripErrors = [0, 0];
  flyingAway = false;
  deathAge = 0;

  reset(): void { this.flyingAway = false; this.deathAge = 0; this.root.visible = false; }
  beginFlyaway(): void { this.flyingAway = true; this.deathAge = 0; this.root.visible = true; }
  stepFlyaway(dt:number): void {
    if (!this.flyingAway) return;
    this.deathAge += dt;
    this.root.position.z -= (8 + this.deathAge * 18) * dt;
    this.root.position.y += (2 + this.deathAge * 4) * dt;
    this.root.position.x += Math.sin(this.deathAge * 2) * dt;
    this.root.rotation.z = Math.sin(this.deathAge * 2.3) * .08;
    this.root.updateMatrixWorld(true);
  }

  constructor() {
    this.root.name = 'Beach Street towing kite';
    this.root.add(this.sail, this.bar);
    const dark = new THREE.MeshStandardMaterial({color: '#163c4d', roughness: .68});
    const lineMaterial = new THREE.MeshBasicMaterial({color: '#fff0c0'});
    const cloth = ['#ee754b', '#fff0ce', '#238b9d', '#fff0ce', '#ee754b'];
    const point = (u: number, v: number) => new THREE.Vector3(
      5.1 * Math.sin(u * 1.12),
      1.8 * Math.cos(u * 1.12) + .45 * Math.sin(v * Math.PI),
      v * 2.7 + .6 * u * u,
    );
    for (let cell = 0; cell < 5; cell++) {
      const vertices: number[] = [], indices: number[] = [];
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 10; j++) {
        vertices.push(...point(-1 + (cell + i / 8) * .4, j / 10).toArray());
        if (i < 8 && j < 10) {const k = i * 11 + j; indices.push(k, k+11, k+1, k+1, k+11, k+12);}
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({color: cloth[cell], side: THREE.DoubleSide, roughness: .78}));
      mesh.name = `sewn canopy cell ${cell+1}`; this.sail.add(mesh);
    }
    const tube = (points: THREE.Vector3[], radius: number) => {
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, radius, 8, false), dark);
      this.sail.add(mesh);
    };
    tube(Array.from({length: 33}, (_, i) => point(i/16-1, 0)), .12);
    tube(Array.from({length: 33}, (_, i) => point(i/16-1, 1)), .045);
    for (const u of [-1, -.6, -.2, .2, .6, 1]) tube(Array.from({length: 11}, (_, j) => point(u, j/10)), .055);
    const barMesh = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1.16, 10), dark);
    barMesh.rotation.z = Math.PI / 2; this.bar.add(barMesh);
    for (const x of [-.5, .5]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .22, 10), new THREE.MeshStandardMaterial({color: x < 0 ? '#ef7547' : '#f9e4a2'}));
      grip.rotation.z = Math.PI/2; grip.position.x = x; this.bar.add(grip);
    }
    for (const [u, v] of [[-1, .05], [1, .05], [-.65, .9], [.65, .9]]) {
      this.endpoints.push(point(u, v));
      const line = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1, 5), lineMaterial);
      line.frustumCulled = false; this.root.add(line); this.lines.push(line);
    }
    this.root.visible = false;
  }

  pose(pos: THREE.Vector3, time: number, steer: number, lift: number, wind: number, left: Arm | null, right: Arm | null): void {
    this.root.position.copy(pos);
    this.root.rotation.set(0, 0, 0);
    // The canopy stays in the wind as the rider rises toward it. Shortening
    // the flying lines also keeps the whole foil in frame through a jump.
    this.sail.position.set(1.2 + steer * .65 + wind * 2.8 + Math.sin(time * 1.4) * .15, 4.7 - lift * .75 + Math.sin(time*1.8)*.12, -16.5);
    this.sail.rotation.set(.38 + wind * .04, -.08 * steer, -.10 * steer - wind * .25);
    // Shoulder-relative bar placement works for the editable character's size.
    const arms = [left, right];
    this.bar.position.set(0, 1.3, -.55);
    let leftIndex = 0;
    if (left && right) {
      left.root.getWorldPosition(this.a); right.root.getWorldPosition(this.b);
      leftIndex = this.a.x < this.b.x ? 0 : 1;
      this.bar.position.copy(this.a).add(this.b).multiplyScalar(.5).sub(pos);
      this.bar.position.y -= .12; this.bar.position.z -= .48;
    }
    this.bar.rotation.z = -.07 * steer - wind * .04;
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const arm = arms[i]; if (!arm) continue;
      // The two shoulders define the two sides. Comparing each with the
      // player's origin could assign BOTH hands to the same end while leaning.
      arm.root.getWorldPosition(this.a);
      const side = i === leftIndex ? -1 : 1;
      this.target.set(side * .34, 0, 0); this.bar.localToWorld(this.target);
      this.pole.copy(this.a).add(this.delta.set(side*.5, -.45, .05));
      for (let pass = 0; pass < 3; pass++) solveTwoBoneIk({root: arm.root, mid: arm.mid, end: arm.end,
        effector: arm.grip, target: this.target, pole: this.pole, accountForParentScale: true, tolerance: .002});
      (arm.grip ?? arm.end).getWorldPosition(this.a);
      this.gripErrors[i] = this.a.distanceTo(this.target);
    }
    for (let i = 0; i < this.lines.length; i++) {
      this.a.set(i%2 ? .5 : -.5, 0, 0); this.bar.localToWorld(this.a); this.a.sub(pos);
      this.b.copy(this.endpoints[i]); this.sail.localToWorld(this.b); this.b.sub(pos);
      const line = this.lines[i]; line.position.copy(this.a).add(this.b).multiplyScalar(.5);
      this.delta.copy(this.b).sub(this.a); line.scale.y = this.delta.length();
      line.quaternion.setFromUnitVectors(UP, this.delta.normalize());
    }
  }
}
