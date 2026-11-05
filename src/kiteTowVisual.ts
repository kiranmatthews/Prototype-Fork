import * as THREE from 'three';
import { solveTwoBoneIk } from './animation/ik';
import { KITE_ATTACHMENT_SITES, kiteCanopyPoint, loadKiteArt } from './kiteArt';

type Arm = {root: THREE.Object3D; mid: THREE.Object3D; end: THREE.Object3D; grip?: THREE.Object3D};
const UP = new THREE.Vector3(0, 1, 0);

/** Weathered flame canopy, wooden bar and a four-line SLE-style bridle layout.
 * Kept outside the character hierarchy so the sail never enlarges its hitbox. */
export class KiteTowVisual {
  readonly root = new THREE.Group();
  readonly sail = new THREE.Group();
  readonly bar = new THREE.Group();
  private readonly lines: THREE.Mesh[] = [];
  private readonly leaders: THREE.Mesh[] = [];
  private readonly origins: THREE.Vector3[] = [];
  private readonly endpoints: THREE.Vector3[] = [];
  private loading?: Promise<void>;
  private readonly a = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly delta = new THREE.Vector3();
  private readonly target = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  readonly gripErrors = [0, 0];
  hangingHand: number | null = null;
  private hangingSide = -1;
  private readonly handBase = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
  private readonly headBounds = new THREE.Box3();
  flyingAway = false;
  deathAge = 0;

  /** Destination loading waits for both parts before revealing Beach Street. */
  prepare(): Promise<void> {
    return this.loading ??= loadKiteArt().then(({canopy, bar}) => {
      this.sail.add(canopy); this.bar.add(bar);
      this.root.userData.kiteArtReady = true;
    }).catch(error => {this.loading = undefined; throw error;});
  }

  reset(): void { this.flyingAway = false; this.deathAge = 0; this.root.visible = false; this.hangingHand = null; }
  beginFlyaway(): void { this.flyingAway = true; this.deathAge = 0; this.root.visible = true; }
  stepFlyaway(dt:number): void {
    if (!this.flyingAway) return;
    this.deathAge += dt;
    if (this.deathAge >= 5) { this.flyingAway = false; this.root.visible = false; return; }
    this.root.position.z -= (8 + this.deathAge * 18) * dt;
    this.root.position.y += (2 + this.deathAge * 4) * dt;
    this.root.position.x += Math.sin(this.deathAge * 2) * dt;
    this.root.rotation.z = Math.sin(this.deathAge * 2.3) * .08;
    this.root.updateMatrixWorld(true);
  }

  constructor() {
    this.root.name = 'Beach Street towing kite';
    this.root.add(this.sail, this.bar);
    const rope = new THREE.MeshStandardMaterial({color: '#bda47b', roughness: .98});
    const webbing = new THREE.MeshStandardMaterial({color: '#66503a', roughness: .97});
    const brass = new THREE.MeshStandardMaterial({color: '#aa8951', metalness: .5, roughness: .64});
    const lineMaterial = new THREE.MeshBasicMaterial({color: '#e7d9b8'});
    const front = new THREE.Vector3(0, 0, 1);
    const ringGeometry = new THREE.TorusGeometry(.065, .018, 5, 12);
    const lineGeometry = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
    const segment = (name: string, a: THREE.Vector3, b: THREE.Vector3, radius: number, parent: THREE.Group, material: THREE.Material = rope) => {
      const mesh = new THREE.Mesh(lineGeometry, material); mesh.name = name;
      mesh.position.copy(a).add(b).multiplyScalar(.5);
      const delta = b.clone().sub(a);
      mesh.scale.set(radius, delta.length(), radius);
      mesh.quaternion.setFromUnitVectors(UP, delta.normalize()); parent.add(mesh);
      return mesh;
    };
    const attachments = KITE_ATTACHMENT_SITES.map(site => {
      const point = kiteCanopyPoint(site.point), normal = new THREE.Vector3(...site.normal);
      const mount = new THREE.Group(); mount.name = site.name + ' reinforced attachment';
      mount.position.copy(point); mount.quaternion.setFromUnitVectors(front, normal);
      // The base intersects the measured cloth/tube face; the loop projects
      // towards the rider, rather than leaving a line stuck into empty air.
      const patch = new THREE.Mesh(new THREE.BoxGeometry(.20, .26, .025), webbing);
      patch.position.z = .005; mount.add(patch);
      const loop = new THREE.Mesh(ringGeometry, rope); loop.scale.y = 1.3;
      loop.rotation.x = Math.PI / 2;
      loop.position.set(0, -.035, .07); mount.add(loop); this.sail.add(mount);
      const knot = new THREE.Vector3(0, -.035, .1545).applyQuaternion(mount.quaternion).add(point);
      return knot;
    });
    const junctions = [new THREE.Vector3(-1.95, -.35, 4.6), new THREE.Vector3(1.9, -.35, 4.6)];
    for (let side = 0; side < 2; side++) {
      const junction = junctions[side];
      for (const index of side === 0 ? [1, 2] : [3, 4])
        segment(`front bridle ${side}:${index}`, attachments[index], junction, .016, this.sail);
      const knot = new THREE.Mesh(new THREE.SphereGeometry(.042, 7, 5), rope);
      knot.name = `front bridle junction ${side}`; knot.position.copy(junction); this.sail.add(knot);
    }
    // Bar ends steer the wingtips. The central load lines feed the two short
    // leading-edge bridles, through a distinct depower guide and lower loop.
    const guide = new THREE.Mesh(new THREE.TorusGeometry(.064, .017, 6, 14), brass);
    guide.name = 'center depower guide'; guide.position.set(0, .02, -.13); this.bar.add(guide);
    const guideFoot = new THREE.Mesh(new THREE.BoxGeometry(.08, .04, .10), brass);
    guideFoot.name = 'guide mounting foot'; guideFoot.position.set(0, -.045, -.09); this.bar.add(guideFoot);
    const split = new THREE.Vector3(0, .17, -.72);
    segment('central depower line', new THREE.Vector3(0, .02, -.13), split, .022, this.bar);
    const swivel = new THREE.Mesh(new THREE.SphereGeometry(.043, 7, 5), brass);
    swivel.name = 'front-line split swivel'; swivel.position.copy(split); this.bar.add(swivel);
    const loopPoints = [[0,.02,-.13],[0,-.14,-.14],[0,-.29,.16],[0,-.38,.31],[0,-.36,.39],[0,-.25,.38],[0,-.14,-.14]]
      .map(p => new THREE.Vector3(...p));
    const lowerLoop = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(loopPoints), 16, .019, 5, false), rope);
    lowerLoop.name = 'depower retention loop'; this.bar.add(lowerLoop);
    const release = new THREE.Mesh(new THREE.CylinderGeometry(.04, .045, .12, 7), new THREE.MeshStandardMaterial({color: '#c25a35', roughness: .8}));
    release.position.set(0, -.14, -.14); release.name = 'worn release collar'; this.bar.add(release);
    for (const side of [-1, 1]) {
      const loop = new THREE.Mesh(ringGeometry, rope); loop.scale.setScalar(.65);
      loop.rotation.x = Math.PI / 2;
      loop.position.set(side * .61, 0, -.115); loop.name = side < 0 ? 'left bar leader loop' : 'right bar leader loop'; this.bar.add(loop);
    }
    const origins = [new THREE.Vector3(-.61, 0, -.15), new THREE.Vector3(.61, 0, -.15),
      new THREE.Vector3(-.024, .17, -.72), new THREE.Vector3(.024, .17, -.72)];
    const endpoints = [attachments[0], attachments[5], ...junctions];
    const names = ['left steering line', 'right steering line', 'left front load line', 'right front load line'];
    for (let i = 0; i < 4; i++) {
      this.origins.push(origins[i]); this.endpoints.push(endpoints[i]);
      const line = new THREE.Mesh(lineGeometry, lineMaterial); line.name = names[i];
      line.scale.set(.010, 1, .010); line.frustumCulled = false;
      this.root.add(line); this.lines.push(line);
      const leader = new THREE.Mesh(lineGeometry, rope); leader.name = names[i] + ' leader';
      leader.scale.set(.022, 1, .022); leader.frustumCulled = false;
      this.root.add(leader); this.leaders.push(leader);
    }
    this.root.visible = false;
  }

  pose(pos: THREE.Vector3, time: number, steer: number, lift: number, wind: number, left: Arm | null, right: Arm | null, aspect = 1.6, hang = 0, barHand = 0, head?: THREE.Object3D): void {
    this.root.position.copy(pos);
    this.root.rotation.set(0, 0, 0);
    // The foil flies above and well ahead of the rider. Keep it at its wind
    // height through a jump, with extra line length in narrow views.
    const setback = 28 * Math.max(1, 1.6 / Math.max(.35, aspect));
    this.sail.position.set(1.2 + steer * .65 + wind * 4.8 + Math.sin(time * 1.4) * .15, 8.5 - lift * .75 + Math.sin(time*1.8)*.12, -setback);
    this.sail.rotation.set(.38 + wind * .06, -.08 * steer, -.10 * steer - wind * .40);
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
    if(hang>0){
      if(this.hangingHand===null)this.hangingSide=barHand===leftIndex?-1:1;
      this.hangingHand=barHand;
      // The held grip sits above the body, allowing the rider to turn under
      // it without orbiting the bar or swapping hands halfway through a spin.
      this.bar.position.x-=this.hangingSide*.34*hang;
      let hangingY=this.bar.position.y+.75;
      if(head){this.headBounds.setFromObject(head);hangingY=Math.max(hangingY,this.headBounds.max.y-pos.y+.18);}
      this.bar.position.y=THREE.MathUtils.lerp(this.bar.position.y,hangingY,hang);
      this.bar.position.z+=.40*hang;
    }else this.hangingHand=null;
    this.bar.rotation.z = -.07 * steer - wind * .04;
    this.root.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) {
      const arm = arms[i]; if (!arm) continue;
      const joints=[arm.root,arm.mid,arm.end];
      for(let j=0;j<3;j++)this.handBase[j].copy(joints[j].quaternion);
      // The two shoulders define the two sides. Comparing each with the
      // player's origin could assign BOTH hands to the same end while leaning.
      arm.root.getWorldPosition(this.a);
      const side = hang>0?(i===barHand?this.hangingSide:-this.hangingSide):(i === leftIndex ? -1 : 1);
      this.target.set(side * .34, 0, 0); this.bar.localToWorld(this.target);
      this.pole.copy(this.a).add(this.delta.set(side*.5, -.45, .05));
      for (let pass = 0; pass < 3; pass++) solveTwoBoneIk({root: arm.root, mid: arm.mid, end: arm.end,
        effector: arm.grip, target: this.target, pole: this.pole, accountForParentScale: true, tolerance: .002});
      // SkateAnimation owns the trailing-hand Indy contact. Release that
      // hand from the bar smoothly, then re-grip only as the unwind settles.
      if(hang>0&&i!==barHand)for(let j=0;j<3;j++)joints[j].quaternion.slerp(this.handBase[j],hang);
      arm.root.updateWorldMatrix(true,true);
      (arm.grip ?? arm.end).getWorldPosition(this.a);
      this.gripErrors[i] = this.a.distanceTo(this.target);
    }
    for (let i = 0; i < this.lines.length; i++) {
      this.a.copy(this.origins[i]); this.bar.localToWorld(this.a); this.a.sub(pos);
      this.b.copy(this.endpoints[i]); this.sail.localToWorld(this.b); this.b.sub(pos);
      const line = this.lines[i]; line.position.copy(this.a).add(this.b).multiplyScalar(.5);
      this.delta.copy(this.b).sub(this.a); line.scale.y = this.delta.length();
      line.quaternion.setFromUnitVectors(UP, this.delta.normalize());
      const leader = this.leaders[i]; leader.scale.y = .42;
      leader.position.copy(this.a).addScaledVector(this.delta, .21);
      leader.quaternion.copy(line.quaternion);
    }
  }
}
