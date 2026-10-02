import * as THREE from 'three';
import { characterElasticityAmplitudes } from '../animation/elasticity';
import { enemyElasticPulse } from '../enemies/elasticity';
import { REEF_COLORS as C, ReefGeometry } from './reefGeometry';
import { REEF } from '../levels/crab-chief';

export interface ChiefPose {
  time: number; stateTime: number; phase: number; state: string;
  target: THREE.Vector3; left: boolean; exposed: boolean; defeated: boolean;
}
type Arm = { side: number; upper: THREE.Mesh; lower: THREE.Mesh; elbow: THREE.Mesh;
  claw: THREE.Group; finger: THREE.Group; wrist: THREE.Vector3; start: THREE.Vector3; };
type Leg = { hip: THREE.Vector3; knee: THREE.Vector3; foot: THREE.Vector3;
  upper: THREE.Mesh; lower: THREE.Mesh; joint: THREE.Mesh; toe: THREE.Group; };
export const CHIEF_ELASTICITY = { breath: 1.3, anticipation: 1.4, impact: 1.2, hit: 1.8, defeat: 1.4 };
const ease = (t: number) => { const v = THREE.MathUtils.clamp(t, 0, 1); return v * v * (3 - 2 * v); };

/** Original articulated, low-poly crab person. Shaft geometry deforms between
 * solved endpoints; toes and impact claws retain their authored ground contact. */
export class CrabChiefModel {
  readonly root = new THREE.Group();
  readonly chest = new THREE.Group();
  readonly head = new THREE.Group();
  readonly pearl = new THREE.Group();
  readonly crown = new THREE.Group();
  readonly arms: Arm[] = [];
  readonly legs: Leg[] = [];
  readonly cloth: THREE.Group[] = [];
  readonly crownPieces: THREE.Group[] = [];
  private readonly chestSkin: THREE.Mesh;
  private readonly pupils: THREE.Mesh[] = [];
  private readonly necklace: THREE.Mesh[] = [];
  private lastState = '';
  private readonly gold = new THREE.Color(C.gold);
  private readonly ember = new THREE.Color(C.light);
  constructor(readonly kit: ReefGeometry) {
    this.root.name = 'Tidebreak · articulated reef chief'; this.root.position.z = REEF.chiefZ;
    this.root.add(this.chest, this.head, this.pearl);
    this.chestSkin = kit.mesh(this.chest, 'round', C.shell, [0, 0, 0], [3.4, 2.4, 1.8]);
    this.chestSkin.userData.articulated = true;
    kit.mesh(this.chest, 'round', C.dark, [0, -.5, -.8], [3.65, 2, 1.9]);
    for (let i = 0; i < 5; i++) {
      const band = kit.mesh(this.chest, 'ball', i % 2 ? C.light : C.gold, [0, .7 - i * .62, 1.5], [2.4 - i * .13, .28, .55]);
      band.rotation.z = (i % 2 ? 1 : -1) * .035;
    }
    // Shoulder shields have their own sharp, asymmetric crab silhouette.
    for (const side of [-1, 1]) {
      kit.mesh(this.chest, 'ball', C.shell, [side * 3, .8, .05], [1.35, 1, 1.35]);
      for (let i = 0; i < 3; i++) {
        const horn = kit.mesh(this.chest, 'cone', C.gold, [side * (2.7 + i * .45), 1.8 - i * .22, -.25], [.35, 1.3 - i * .2, .35]);
        horn.rotation.z = -side * .6;
      }
      const upper = kit.segment(this.root, v(side * 3, 5, 0), v(side * 6, 3, 3), .72, C.dark);
      const lower = kit.segment(this.root, v(side * 6, 3, 3), v(side * 8, 2, 5), .85, C.shell);
      const elbow = kit.mesh(this.root, 'ball', C.gold, [side * 6, 3, 3], [.95, .95, .95]);
      const claw = new THREE.Group(), finger = new THREE.Group(); this.root.add(claw); claw.add(finger);
      const size = side < 0 ? 1.2 : .93;
      kit.mesh(claw, 'round', C.shell, [0, 0, 0], [2.4 * size, 1.2 * size, 1.8 * size]);
      kit.mesh(claw, 'ball', C.light, [.15 * side, .55, .2], [1.9 * size, .5, 1.5 * size]);
      kit.mesh(claw, 'ball', C.dark, [0, -.7, .6], [1.8 * size, .32, 1.3]);
      kit.mesh(claw, 'cone', C.cream, [-side * 1.2, .1, 1.4], [.5, 2.3, .5]).rotation.x = Math.PI / 2;
      finger.position.set(side * 1.25, 0, .5);
      kit.mesh(finger, 'ball', C.shell, [0, .1, .9], [.68, .8, 1.9]);
      kit.mesh(finger, 'cone', C.cream, [-side * .35, .05, 2.1], [.4, 1.4, .4]).rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) kit.mesh(claw, 'ball', C.gold, [side * (i - 1.5) * .65, .94, -.25], [.17, .17, .25]);
      kit.batch(claw); kit.batch(finger);
      this.arms.push({ side, upper, lower, elbow, claw, finger, wrist: v(side * 8, 2, 5), start: v(side * 8, 2, 5) });
      this.necklace.push(kit.segment(this.root, v(side * 2, 5, 1.5), v(0, 4, 2.7), .075, C.gold));
      for (let i = 0; i < 3; i++) {
        const hip = v(side * 2.1, 2.6, -1 + i * 1.5), knee = v(side * (4.1 + i * .55), 1.5, -3 + i * 3);
        const foot = v(side * (5.1 + i * .8), .13, -4 + i * 3.8);
        const upper = kit.segment(this.root, hip, knee, .35, C.shell), lower = kit.segment(this.root, knee, foot, .25, C.light, true);
        const joint = kit.mesh(this.root, 'ball', C.gold, knee.toArray(), [.48, .48, .48]);
        const toe = new THREE.Group(); toe.position.copy(foot); this.root.add(toe);
        kit.mesh(toe, 'ball', C.dark, [side * .18, .05, .25], [.6, .2, .9]);
        kit.mesh(toe, 'cone', C.cream, [side * .4, .03, .8], [.17, .8, .17]).rotation.x = Math.PI / 2;
        kit.batch(toe); this.legs.push({ hip, knee, foot, upper, lower, joint, toe });
      }
    }
    // Woven sea-grass skirt and cape: individual strips sway and settle.
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8, strip = new THREE.Group();
      strip.position.set(Math.sin(a) * 2.5, 2.3, Math.cos(a) * 1.6); this.root.add(strip);
      const panel = kit.mesh(strip, 'box', i % 3 ? C.wood : C.gold, [0, -.58, 0], [.52, 1.2 + (i % 2) * .2, .16]);
      panel.rotation.z = Math.sin(a) * -.12;
      for (const y of [-.32, -.73]) kit.mesh(strip, 'box', C.teal, [0, y, .09], [.5, .09, .035]);
      kit.batch(strip); this.cloth.push(strip);
    }
    // A face with a jaw, thick brows, a conch nose and independently tracking
    // eye-stalks keeps the chief expressive at a PS1-size render resolution.
    kit.mesh(this.head, 'round', C.light, [0, 0, 0], [1.7, 1.25, 1.22]);
    kit.mesh(this.head, 'ball', C.dark, [0, -.4, .95], [1.3, .42, .45]);
    kit.mesh(this.head, 'ball', C.cream, [0, -.28, 1.25], [.95, .1, .13]);
    kit.mesh(this.head, 'ball', C.gold, [0, .08, 1.17], [.4, .48, .48]);
    for (const side of [-1, 1]) {
      kit.segment(this.head, v(side * .95, .2, .4), v(side * 1.22, 1.03, .72), .23, C.dark);
      kit.mesh(this.head, 'round', C.cream, [side * 1.22, 1.03, .82], [.47, .45, .36]);
      const pupil = kit.mesh(this.head, 'ball', C.ink, [side * 1.22, 1.01, 1.15], [.19, .22, .12]);
      pupil.userData.articulated = true; this.pupils.push(pupil);
      const brow = kit.mesh(this.head, 'box', C.dark, [side * 1.22, 1.42, .95], [1.1, .22, .5]); brow.rotation.z = -side * .16;
      for (let i = 0; i < 3; i++) kit.mesh(this.head, 'cone', C.cream, [side * (.3 + i * .4), -.75, .8], [.18, .6, .18]).rotation.z = side * .25;
    }
    this.head.add(this.crown);
    kit.mesh(this.crown, 'shaft', C.gold, [0, 1.28, 0], [1.8, .28, 1.25]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - .5) * 2.9, ornament = new THREE.Group();
      ornament.position.set(Math.sin(a) * 1.65, 1.4, Math.cos(a) * .95); ornament.rotation.z = -a * .26;
      ornament.userData.home = ornament.position.clone(); this.crown.add(ornament); this.crownPieces.push(ornament);
      kit.mesh(ornament, 'cone', i % 2 ? C.teal : C.cream, [0, .6, 0], [.38, 1.45 + (3 - Math.abs(i - 3)) * .24, .23]);
      kit.mesh(ornament, 'ball', C.gold, [0, .2, .15], [.4, .22, .22]); kit.batch(ornament);
    }
    // Real geometric necklace; its larger pearl is lowered into the exact
    // vulnerable combat volume during recovery, with no floating HUD target.
    kit.mesh(this.pearl, 'round', C.cream, [0, 0, 0], [.9, .9, .9], .42);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      kit.mesh(this.pearl, 'ball', C.gold, [Math.cos(a) * 1.05, Math.sin(a) * 1.05, 0], [.22, .22, .22]);
    }
    kit.batch(this.pearl); kit.batch(this.chest); kit.batch(this.head); kit.batch(this.crown);
    this.pose({ time: 0, stateTime: 0, state: 'intro', phase: 1, target: v(0, 0, -14), left: true, exposed: false, defeated: false });
  }
  pose(frame: ChiefPose): void {
    const { state, stateTime: t, time, defeated } = frame;
    if (state !== this.lastState) { for (const arm of this.arms) arm.start.copy(arm.wrist); this.lastState = state; }
    const idle = characterElasticityAmplitudes('idle'), jump = characterElasticityAmplitudes('jump');
    const winding = state === 'slam-tell' ? ease(t / 1.15) : state === 'sweep-tell' ? ease(t / 1.3) : 0;
    const impact = state === 'slam' ? enemyElasticPulse(t, .55) * CHIEF_ELASTICITY.impact : 0;
    const hit = state === 'hurt' ? enemyElasticPulse(t, .9) * CHIEF_ELASTICITY.hit : 0;
    const kneel = defeated ? ease(t / 2.6) : 0;
    const breath = Math.sin(time * 2.3) * idle[0] * CHIEF_ELASTICITY.breath;
    const roar = state === 'phase' ? Math.sin(Math.PI * Math.min(1, t / 3)) : 0;
    const lowerPearl = state === 'recover' ? ease((t - .2) / .45) : 0;
    const chestY = 4.45 + breath * 3 - winding * .45 + impact * .7 + hit * .6 - kneel * 1.7 + roar * .7;
    this.chest.position.set(0, chestY, frame.exposed ? .65 : 0);
    this.chest.rotation.x = frame.exposed ? .22 : winding * -.09 + hit * -.24 + kneel * .18;
    this.chestSkin.scale.y = 2.4 * (1 + breath - winding * jump[0] * CHIEF_ELASTICITY.anticipation + impact * jump[0] + hit * jump[0]);
    this.head.position.set(0, chestY + 2.1, .42 + (frame.exposed ? .7 : 0));
    this.head.rotation.set(kneel * .38 + hit * -.25 - roar * .28, Math.atan2(frame.target.x, Math.max(8, frame.target.z - REEF.chiefZ)) * .22, Math.sin(time * 1.2) * .035);
    for (let i = 0; i < this.pupils.length; i++) this.pupils[i].position.x = (i ? 1 : -1) * 1.22 + THREE.MathUtils.clamp(frame.target.x * .012, -.12, .12);
    this.pearl.position.set(0, THREE.MathUtils.lerp(chestY - .5, REEF.pearl[1], lowerPearl),
      THREE.MathUtils.lerp(2.7, REEF.pearl[2] - REEF.chiefZ, lowerPearl));
    for (let i = 0; i < this.necklace.length; i++) this.kit.placeSegment(this.necklace[i], v((i ? 1 : -1) * 2, chestY + .65, 1.5), this.pearl.position, .075);
    this.pearl.rotation.z = frame.exposed ? time * .8 : Math.sin(time * 1.8) * .08;
    this.pearl.visible = !defeated || t < 1.6;
    const material = this.chestSkin.material as THREE.MeshStandardMaterial;
    material.color.copy(this.gold).lerp(this.ember, frame.phase === 1 ? 1 : frame.phase === 2 ? .85 : .62);
    for (const arm of this.arms) {
      const side = arm.side, active = (side < 0) === frame.left;
      const clawGround = side < 0 ? 1.48 : 1.17;
      const shoulder = v(side * 3, chestY + .7, .3), wrist = arm.wrist;
      wrist.set(side * 7.8, 2.15 + Math.sin(time * 2 + side) * .12, 5.4);
      if (active && (state === 'slam-tell' || state === 'slam')) {
        const target = v(frame.target.x, clawGround, frame.target.z - REEF.chiefZ);
        if (state === 'slam-tell') { wrist.lerp(target, ease(t / .85)); wrist.y = 2 + winding * 5; }
        else { wrist.lerpVectors(arm.start, target, ease(t / .18)); wrist.y += Math.max(0, impact) * .45; }
      } else if (state === 'sweep-tell' || state === 'sweep') {
        const a = state === 'sweep-tell' ? -1.55 : -1.55 + ease(t / 1.8) * 3.1;
        wrist.set(Math.sin(a + (side < 0 ? 0 : .2)) * 13, 1.05 + (state === 'sweep-tell' ? .5 : 0), 9 + Math.cos(a) * 6);
      } else if (state === 'volley-tell' || state === 'volley') {
        wrist.set(side * 6, 4 + Math.sin(time * 5) * .25, 7);
      } else if (frame.exposed) wrist.set(side * 5.7, clawGround, 8.2);
      else if (state === 'hurt') wrist.set(side * (8 + Math.max(0, hit)), 3 - hit, 4.5);
      else if (state === 'phase') wrist.set(side * (7 - roar * 1.8), 2 + roar * 5, 5);
      if (defeated) wrist.lerp(v(side * 5, clawGround, 6.5), kneel);
      if (state !== 'slam') wrist.lerpVectors(arm.start, wrist.clone(), ease(t / (state === 'recover' ? .6 : .35)));
      const midpoint = shoulder.clone().lerp(wrist, .48);
      midpoint.x += side * 1.4; midpoint.y -= .4 + winding * .5;
      this.kit.placeSegment(arm.upper, shoulder, midpoint, .72);
      this.kit.placeSegment(arm.lower, midpoint, wrist, .85);
      arm.elbow.position.copy(midpoint); arm.claw.position.copy(wrist);
      arm.claw.rotation.set(active && state === 'slam-tell' ? -.4 * winding : .08, side * -.16, side * (.1 + winding * .08));
      arm.finger.rotation.y = side * (.16 + (state.endsWith('tell') ? .48 * winding : .12 * Math.sin(time * 2)));
    }
    for (const leg of this.legs) {
      const hip = leg.hip.clone(); hip.y += chestY - 4.45;
      const knee = leg.knee.clone(); knee.y += (chestY - 4.45) * .35;
      // Only the actual shafts stretch. Fixed toe endpoints do not inherit
      // torso compression, and the enclosing actor always has scale (1,1,1).
      this.kit.placeSegment(leg.upper, hip, knee, .35);
      this.kit.placeSegment(leg.lower, knee, leg.foot, .25); leg.joint.position.copy(knee);
    }
    for (let i = 0; i < this.cloth.length; i++) this.cloth[i].rotation.x = defeated ? .12 * (1 - kneel) : Math.sin(time * 2.6 + i * .55) * .08 + winding * .14 + hit * .2;
    for (let i = 0; i < this.crownPieces.length; i++) {
      const piece = this.crownPieces[i], home = piece.userData.home as THREE.Vector3;
      piece.position.copy(home); piece.rotation.x = 0;
      if (defeated) { const u = THREE.MathUtils.clamp((t - .6) / 2.5, 0, 1); piece.position.x += (i - 3) * 1.3 * u;
        piece.position.y += Math.sin(u * Math.PI) * 3 - u * 5; piece.position.z += 4 * u; piece.rotation.x = u * 3.8; }
    }
  }
  get diagnostics() {
    let triangles = 0, meshes = 0;
    this.root.traverse(node => { const mesh = node as THREE.Mesh; if (!mesh.isMesh) return;
      meshes++; triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3; });
    return { triangles, meshes, rootScale: this.root.scale.toArray(), toes: this.legs.map(leg => leg.toe.position.toArray()),
      wrists: this.arms.map(arm => arm.wrist.clone().add(this.root.position).toArray()) };
  }
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
