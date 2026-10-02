import * as THREE from 'three';
import { sfx } from '../audio';
import { REEF } from '../levels/crab-chief';
import { CrabChiefModel } from './crabChiefModel';
import { ReefScenery } from './reefScenery';
import { ReefGeometry, REEF_COLORS as C } from './reefGeometry';

export type ChiefState = 'waiting' | 'intro' | 'idle' | 'slam-tell' | 'slam' | 'volley-tell' |
  'volley' | 'sweep-tell' | 'sweep' | 'recover' | 'hurt' | 'phase' | 'defeated';
export interface BossPlayerSample {
  position: THREE.Vector3; state: string; speed: number; grounded: boolean;
  skating: boolean; grinding: boolean; attacking: boolean; immune: boolean; shielded: boolean;
}
export interface BossStepResult { hurt: boolean; fatal: boolean; strike: boolean; }
type Wave = { mesh: THREE.Mesh; centre: THREE.Vector3; radius: number; previous: number; life: number; speed: number; };
type Bubble = { mesh: THREE.Mesh; velocity: THREE.Vector3; previous: THREE.Vector3; life: number; };
type Spark = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; total: number; };
export const CHIEF_PHASES = [
  { name: 'CLAWBREAKER', subtitle: 'Jump the ripples. Spin the lowered pearl.', color: '#f1b467' },
  { name: 'REEF RIDER', subtitle: 'Grind a pearl rail, then strike the opening.', color: '#70e9db' },
  { name: 'STORM CROWN', subtitle: 'Charge by grinding or fast skating. Jump the sweep.', color: '#ffa7a0' },
] as const;
const blank = (): BossStepResult => ({ hurt: false, fatal: false, strike: false });
const clamp = THREE.MathUtils.clamp;

/** Deterministic combat driven from Player.step. It cannot alter movement
 * tuning, simulate a grind, or finish a run. Damage and victory consume the
 * production player's attack, rail-contact, position and invulnerability. */
export class CrabChiefEncounter {
  readonly root = new THREE.Group();
  readonly kit = new ReefGeometry();
  readonly model = new CrabChiefModel(this.kit);
  readonly scenery = new ReefScenery(this.kit);
  readonly target = new THREE.Vector3(0, 0, -14);
  readonly pearl = new THREE.Vector3(...REEF.pearl);
  state: ChiefState = 'waiting';
  stateTime = 0;
  time = 0;
  phase = 1;
  health = 9;
  playerHealth = 3;
  charge = 0;
  hits = 0;
  playerHits = 0;
  grindDistance = 0;
  skateDistance = 0;
  readonly history: { time: number; state: ChiefState; phase: number; health: number }[] = [];
  readonly strikes: { time: number; phase: number; speed: number; skating: boolean; grinding: boolean; charged: boolean; }[] = [];
  private checkpointPhase = 1;
  private checkpointDefeated = false;
  private ordinal = 0;
  private left = true;
  private invulnerability = 0;
  private fired = 0;
  private sweepPrevious = -1.3;
  private lastPosition: THREE.Vector3 | null = null;
  private actorPosition = new THREE.Vector3();
  private actorSkating = false;
  private readonly marker: THREE.Group;
  private readonly opening: THREE.Mesh;
  private readonly sweep: THREE.Group;
  private readonly shield: THREE.Group;
  private readonly seal: THREE.Group;
  private readonly aura: THREE.Group;
  private readonly waves: Wave[] = [];
  private readonly bubbles: Bubble[] = [];
  private readonly sparks: Spark[] = [];
  constructor(parent: THREE.Object3D) {
    this.root.name = 'Tidebreak boss encounter'; parent.add(this.root); this.root.add(this.scenery.root, this.model.root);
    const torus = (radius: number, tube: number, color: string, emission = .5) =>
      new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 4, 48), this.kit.material(color, emission));
    this.marker = new THREE.Group(); this.root.add(this.marker);
    for (const radius of [3.15, 2.85]) { const ring = torus(radius, .07, '#ff7564', .7); ring.rotation.x = Math.PI / 2; this.marker.add(ring); }
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4;
      const tooth = this.kit.mesh(this.marker, 'cone', C.cream, [Math.sin(a) * 3.15, .05, Math.cos(a) * 3.15], [.18, .65, .18], .3);
      tooth.rotation.x = Math.PI / 2; tooth.rotation.z = -a; }
    this.opening = torus(2.65, .1, C.gold); this.opening.rotation.x = Math.PI / 2;
    this.opening.position.set(0, .06, REEF.pearl[2]); this.root.add(this.opening);
    this.sweep = new THREE.Group(); this.sweep.position.set(0, .07, REEF.chiefZ); this.root.add(this.sweep);
    this.kit.mesh(this.sweep, 'box', '#ff7564', [0, 0, 11], [.35, .04, 20], .7);
    for (const side of [-1, 1]) for (let i = 0; i < 15; i++) {
      const a = side * (i / 14) * 1.3;
      const dot = this.kit.mesh(this.sweep, 'ball', '#d35d5e', [Math.sin(a) * 18, .01, Math.cos(a) * 18], [.18, .05, .18], .3);
      dot.userData.arc = true;
    }
    this.shield = new THREE.Group(); this.shield.position.copy(this.pearl); this.root.add(this.shield);
    for (let i = 0; i < 6; i++) {
      const ring = torus(1.55, .045, C.teal, .6); ring.rotation.y = i * Math.PI / 3; this.shield.add(ring);
    }
    this.seal = new THREE.Group(); this.seal.position.set(0, 2.4, -48.5); this.root.add(this.seal);
    const ring = torus(3.1, .12, C.teal); this.seal.add(ring);
    for (let i = 0; i < 9; i++) { const a = i * Math.PI * 2 / 9;
      this.kit.mesh(this.seal, 'ball', C.cream, [Math.sin(a) * 3.1, Math.cos(a) * 3.1, 0], [.23, .23, .23], .4); }
    for (let i = -2; i <= 2; i++) this.kit.mesh(this.seal, 'box', C.teal, [i * .85, 0, 0], [.04, 5.2 - Math.abs(i) * .5, .04], .5);
    this.aura = new THREE.Group(); this.root.add(this.aura);
    for (const tilt of [-.6, .6]) { const ring = torus(.85, .05, C.teal, .8); ring.rotation.x = tilt; this.aura.add(ring); }
    for (let i = 0; i < 5; i++) {
      const mesh = torus(1, .22, C.teal, .7); mesh.rotation.x = Math.PI / 2; mesh.visible = false; mesh.frustumCulled = false;
      mesh.geometry.userData.waveRest = new Float32Array(mesh.geometry.getAttribute('position').array); this.root.add(mesh);
      this.waves.push({ mesh, centre: new THREE.Vector3(), radius: 0, previous: 0, life: 0, speed: 10 });
    }
    for (let i = 0; i < 18; i++) {
      const mesh = this.kit.mesh(this.root, 'round', i % 2 ? '#65d4cf' : '#b4f5eb', [0, 0, 0], [.42, .42, .42], .45);
      mesh.visible = false; this.bubbles.push({ mesh, velocity: new THREE.Vector3(), previous: new THREE.Vector3(), life: 0 });
    }
    for (let i = 0; i < 64; i++) { const mesh = this.kit.mesh(this.root, 'ball', i % 3 ? C.gold : C.teal,
      [0, 0, 0], [.1, .1, .1], .35); mesh.visible = false; this.sparks.push({ mesh, velocity: new THREE.Vector3(), life: 0, total: 1 }); }
    this.present(0);
  }
  get defeated(): boolean { return this.state === 'defeated'; }
  get canFinish(): boolean { return this.defeated && this.stateTime >= 3.4; }
  get exposed(): boolean { return this.state === 'recover' && this.stateTime > .7; }
  get charged(): boolean { return this.charge >= 1; }
  get hint(): string {
    if (this.defeated) return this.canFinish ? 'THE REEF IS FREE · Skate through the shell arch' : 'THE CHIEF YIELDS';
    if (this.state === 'waiting' || this.state === 'intro') return 'TIDEBREAK · Chief of the Reef';
    if (this.state === 'phase') return `PHASE ${this.phase} · ${CHIEF_PHASES[this.phase - 1].name}`;
    if (this.state === 'hurt') return 'PEARL CRACKED!';
    if (this.state === 'slam-tell') return 'CLAW INCOMING · Leave the marked circle';
    if (this.state === 'sweep-tell' || this.state === 'sweep') return this.actorSkating
      ? 'LOW SWEEP · Hold, then release to ollie' : 'LOW SWEEP · Jump over the red line';
    if (this.exposed && (this.phase === 1 || this.charged)) return 'OPENING! · Spin or skate into the golden pearl';
    if (this.exposed) return 'SHIELDED · Charge on a pearl rail first';
    if (this.state === 'volley-tell' || this.state === 'volley') return 'BUBBLE VOLLEY · Keep carving sideways';
    if (this.charged) return 'REEF CHARGE READY · Strike the next opening';
    return this.phase === 1 ? 'Jump the ripples · Strike after the slam' : this.phase === 2 ? 'Grind either pearl rail to charge your strike' : 'Grind or skate fast to charge · Watch the storm';
  }
  private enter(state: ChiefState): void {
    this.state = state; this.stateTime = 0;
    this.history.push({ time: this.time, state, phase: this.phase, health: this.health });
    if (this.history.length > 160) this.history.shift();
    if (state === 'slam-tell') { this.left = !this.left; sfx.play('woosh', .5, .55); }
    if (state === 'slam') { this.emitWave(this.target, this.phase === 3 ? 12 : 9); this.burst(this.target, 12); sfx.play('tntBoom', .38, .8); }
    if (state === 'volley') this.fired = 0;
    if (state === 'sweep-tell') { this.sweepPrevious = -1.3; sfx.play('woosh2', .6, .65); }
    if (state === 'sweep') this.emitWave(new THREE.Vector3(0, 0, -23), 10);
  }
  private lockTarget(p: BossPlayerSample): void { this.target.set(clamp(p.position.x, -13.5, 13.5), 0, clamp(p.position.z, -22, -6)); }
  private nextAttack(p: BossPlayerSample): void {
    this.ordinal++; this.lockTarget(p);
    this.enter(this.phase === 1 ? 'slam-tell' : this.phase === 2 ? (this.ordinal % 2 ? 'volley-tell' : 'slam-tell') :
      ['sweep-tell', 'slam-tell', 'volley-tell'][this.ordinal % 3] as ChiefState);
  }
  step(dt: number, p: BossPlayerSample): BossStepResult {
    const result = blank();
    // Terminal player paths and menu pauses never advance combat behind a
    // death fade. Level.update can still render its last authored pose.
    if (!['ride', 'air', 'grind', 'hang', 'rope', 'swim'].includes(p.state)) return result;
    dt = clamp(dt, 0, .05); this.time += dt; this.stateTime += dt; this.invulnerability = Math.max(0, this.invulnerability - dt);
    this.actorPosition.copy(p.position);
    this.actorSkating = p.skating;
    const movement = this.lastPosition ? Math.min(this.lastPosition.distanceTo(p.position), p.speed * dt * 1.3) : 0;
    this.lastPosition ??= p.position.clone(); this.lastPosition.copy(p.position);
    if (!this.defeated) {
      const before = this.charge;
      if (p.grinding && p.speed > 1) { this.grindDistance += movement; this.charge = Math.min(1, this.charge + movement / 8); }
      else if (this.phase === 3 && p.skating && p.grounded && p.speed >= 10) { this.skateDistance += movement; this.charge = Math.min(1, this.charge + movement / 26); }
      if (before < 1 && this.charged) { this.burst(p.position.clone().add(new THREE.Vector3(0, 1, 0)), 12); sfx.play('railLand', .7, 1.5); }
    }
    let danger = false;
    for (const wave of this.waves) if (wave.life > 0) {
      wave.previous = wave.radius; wave.radius += dt * wave.speed; wave.life -= dt;
      const distance = Math.hypot(p.position.x - wave.centre.x, p.position.z - wave.centre.z);
      if (wave.life > 0 && p.position.y < .72 && distance >= wave.previous - .65 && distance <= wave.radius + .65) danger = true;
    }
    for (const bubble of this.bubbles) if (bubble.life > 0) {
      bubble.previous.copy(bubble.mesh.position); bubble.mesh.position.addScaledVector(bubble.velocity, dt); bubble.life -= dt;
      const centre = p.position.clone().add(new THREE.Vector3(0, .8, 0));
      const segment = new THREE.Line3(bubble.previous, bubble.mesh.position), nearest = segment.closestPointToPoint(centre, true, new THREE.Vector3());
      if (bubble.life > 0 && nearest.distanceTo(centre) < .86) { danger = true; bubble.life = 0; }
      else if (bubble.mesh.position.y < .28) { this.burst(bubble.mesh.position, 3); bubble.life = 0; }
    }
    const t = this.stateTime;
    switch (this.state) {
      case 'waiting': if (p.position.z < 6 && Math.abs(p.position.x) < 23) this.enter('intro'); break;
      case 'intro': if (t > 2.2) this.enter('idle'); break;
      case 'idle': if (t > .85) this.nextAttack(p); break;
      case 'slam-tell': if (t > (this.phase === 3 ? .95 : 1.3)) this.enter('slam'); break;
      case 'slam':
        if (t > .17 && t < .4 && p.position.y < 2.3 && Math.hypot(p.position.x - this.target.x, p.position.z - this.target.z) < 3.05) danger = true;
        if (t > .6) this.enter('recover'); break;
      case 'volley-tell': if (t > 1.15) this.enter('volley'); break;
      case 'volley':
        if (t >= this.fired * .5 && this.fired < 3) { this.fireVolley(); this.fired++; }
        if (t > 1.6) this.enter('recover'); break;
      case 'sweep-tell': if (t > 1.4) this.enter('sweep'); break;
      case 'sweep': {
        const angle = -1.3 + clamp(t / 1.8, 0, 1) * 2.6;
        const dx = p.position.x, dz = p.position.z - REEF.chiefZ, distance = Math.hypot(dx, dz), a = Math.atan2(dx, dz);
        if (p.position.y < 1.05 && distance > 6 && distance < 21 && a > this.sweepPrevious - .09 && a < angle + .09) danger = true;
        if (this.sweepPrevious < 0 && angle >= 0) this.emitWave(new THREE.Vector3(0, 0, -23), 11);
        this.sweepPrevious = angle;
        if (t > 1.9) this.enter('recover'); break;
      }
      case 'recover': if (t > 6.5) this.enter('idle'); break;
      case 'hurt': if (t > 1.05) {
        if (this.health > 0 && this.health % 3 === 0) { this.phase++; this.checkpointPhase = this.phase; this.charge = 0;
          this.playerHealth = 3; this.clearAttacks(); this.enter('phase'); sfx.play('maskGet', .7, .8); }
        else this.enter('idle');
      } break;
      case 'phase': if (t > 3) this.enter('idle'); break;
      case 'defeated': break;
    }
    // Every opening accepts one fresh hit. A held spin cannot drain the bar,
    // a walk into the pearl cannot hurt it, and armor requires earned charge.
    const inReach = Math.hypot(p.position.x - this.pearl.x, p.position.z - this.pearl.z) < 2.65 && p.position.y > -.2 && p.position.y < 3.2;
    const attacking = p.attacking || (p.skating && p.speed >= 8);
    if (this.exposed && inReach && attacking && (this.phase === 1 || this.charged)) {
      result.strike = true; this.hits++; this.health--;
      this.strikes.push({ time: this.time, phase: this.phase, speed: p.speed, skating: p.skating, grinding: p.grinding, charged: this.charged });
      this.charge = 0; this.clearAttacks(); this.burst(this.pearl, 28); this.invulnerability = Math.max(this.invulnerability, .6);
      sfx.play('crateBreak1', .9, .65);
      if (this.health === 0) { this.checkpointDefeated = true; this.enter('defeated'); this.playerHealth = 3; this.burst(this.pearl, 34); sfx.play('lifeGet', .9, .9); }
      else this.enter('hurt');
      danger = false;
    }
    if (danger && !this.defeated && !p.immune && this.invulnerability <= 0) {
      result.hurt = true; this.invulnerability = 1.65; this.playerHits++;
      if (!p.shielded) this.playerHealth--;
      result.fatal = this.playerHealth <= 0;
      this.burst(p.position.clone().add(new THREE.Vector3(0, .8, 0)), 8); sfx.play('takeDamage', .65, .95);
    }
    return result;
  }
  private clearAttacks(): void { for (const wave of this.waves) wave.life = 0; for (const bubble of this.bubbles) bubble.life = 0; }
  private emitWave(centre: THREE.Vector3, speed: number): void {
    const wave = this.waves.find(value => value.life <= 0); if (!wave) return;
    wave.centre.copy(centre); wave.radius = 0; wave.previous = 0; wave.life = 4; wave.speed = speed;
  }
  private fireVolley(): void {
    const arm = this.model.arms[this.fired % 2], origin = arm.wrist.clone().add(this.model.root.position);
    origin.z += 1.5; // visible pincer tip, not an invisible floor emitter
    const base = Math.atan2(this.target.x - origin.x, this.target.z - origin.z);
    const drop = (.85 - origin.y) / Math.max(4, Math.hypot(this.target.x - origin.x, this.target.z - origin.z));
    for (let i = -2; i <= 2; i++) {
      const bubble = this.bubbles.find(value => value.life <= 0); if (!bubble) break;
      bubble.mesh.position.copy(origin); bubble.previous.copy(origin); bubble.life = 5;
      const angle = base + i * .22; bubble.velocity.set(Math.sin(angle), drop, Math.cos(angle)).setLength(8.5);
    }
    this.burst(origin, 5); sfx.play('woosh3', .4, 1.6);
  }
  private burst(at: THREE.Vector3, count: number): void {
    let index = 0;
    for (const spark of this.sparks) { if (spark.life > 0) continue;
      const a = (index * 2.399) + this.time; spark.mesh.position.copy(at); spark.mesh.position.y += .2;
      spark.velocity.set(Math.sin(a) * (2 + index % 4), 3 + index % 5, Math.cos(a) * (2 + index % 3));
      spark.total = spark.life = .65 + (index % 4) * .15; if (++index >= count) break;
    }
  }
  present(dt: number): void {
    this.scenery.update(this.time, this.phase === 3 ? 1 : 0);
    this.model.pose({ time: this.time, stateTime: this.stateTime, state: this.state, phase: this.phase,
      target: this.target, left: this.left, exposed: this.exposed, defeated: this.defeated });
    this.marker.visible = this.state === 'slam-tell' || this.state === 'slam'; this.marker.position.copy(this.target); this.marker.position.y = .07;
    this.marker.rotation.y = this.time * .9;
    this.opening.visible = this.exposed; this.opening.scale.setScalar(1 + Math.sin(this.time * 8) * .035);
    this.sweep.visible = this.state === 'sweep-tell' || this.state === 'sweep';
    // Arc dots stay stationary; only the large sweep line traverses the floor.
    const line = this.sweep.children[0]; line.rotation.y = this.state === 'sweep' ? this.sweepPrevious : -1.3;
    line.position.x = Math.sin(line.rotation.y) * 11; line.position.z = Math.cos(line.rotation.y) * 11;
    this.shield.visible = this.phase > 1 && this.exposed && !this.charged; this.shield.rotation.y = this.time;
    this.seal.visible = !this.canFinish; this.seal.rotation.z = this.time * .18;
    this.aura.visible = this.charged && !this.defeated; this.aura.position.copy(this.actorPosition); this.aura.position.y += .9; this.aura.rotation.y = this.time * 3;
    for (const wave of this.waves) { wave.mesh.visible = wave.life > 0; wave.mesh.position.copy(wave.centre); wave.mesh.position.y = .15;
      if (wave.life <= 0) continue;
      const positions = wave.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const rest = wave.mesh.geometry.userData.waveRest as Float32Array;
      for (let i = 0; i < positions.count; i++) { const x = rest[i * 3], y = rest[i * 3 + 1], r = Math.hypot(x, y);
        const radius = Math.max(.01, wave.radius + r - 1); positions.setXYZ(i, x / r * radius, y / r * radius, rest[i * 3 + 2]); }
      positions.needsUpdate = true;
    }
    for (const bubble of this.bubbles) { bubble.mesh.visible = bubble.life > 0; bubble.mesh.rotation.y += dt * 2;
      const scale = .42 * (1 + Math.sin(this.time * 7 + bubble.life) * .12); bubble.mesh.scale.setScalar(scale); }
    for (const spark of this.sparks) { spark.life = Math.max(0, spark.life - dt); spark.mesh.visible = spark.life > 0;
      if (spark.life <= 0) continue; spark.velocity.y -= dt * 9; spark.mesh.position.addScaledVector(spark.velocity, dt);
      spark.mesh.rotation.x += dt * 5; spark.mesh.scale.setScalar(.14 * Math.min(1, spark.life / .25)); }
  }
  reset(hard: boolean): void {
    if (hard) { this.checkpointPhase = 1; this.checkpointDefeated = false; this.hits = this.playerHits = this.grindDistance = this.skateDistance = 0;
      this.history.length = this.strikes.length = 0; this.time = 0; }
    this.phase = this.checkpointPhase; this.health = (4 - this.phase) * 3;
    this.playerHealth = 3; this.charge = 0; this.invulnerability = 0; this.ordinal = 0;
    this.lastPosition = null; this.clearAttacks(); this.enter('waiting');
    if (this.checkpointDefeated) { this.health = 0; this.enter('defeated'); this.stateTime = 4; }
    for (const spark of this.sparks) spark.life = 0;
    this.present(0);
  }
  get diagnostics() { return { state: this.state, stateTime: this.stateTime, phase: this.phase, health: this.health,
    playerHealth: this.playerHealth, charged: this.charged, charge: this.charge, canFinish: this.canFinish,
    hits: this.hits, playerHits: this.playerHits, grindDistance: this.grindDistance, skateDistance: this.skateDistance,
    activeWaves: this.waves.filter(w => w.life > 0).map(w => ({ radius: w.radius, previous: w.previous, centre: w.centre.toArray() })),
    activeBubbles: this.bubbles.filter(b => b.life > 0).length, target: this.target.toArray(),
    history: [...this.history], strikes: [...this.strikes], model: this.model.diagnostics }; }
}
