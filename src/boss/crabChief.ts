import * as THREE from 'three';
import { sfx } from '../audio';
import { REEF } from '../levels/crab-chief';
import { ChiefPhaseGeometry } from './phaseGeometry';
import type { Rail } from '../rails';
import { MeshyChiefModel } from './meshyChiefModel';
import { ReefScenery } from './reefScenery';
import { ReefGeometry, REEF_COLORS as C } from './reefGeometry';

export type ChiefState = 'waiting' | 'intro' | 'idle' | 'slam-tell' | 'slam' | 'volley-tell' |
  'volley' | 'sweep-tell' | 'sweep' | 'recover' | 'tongue-form' | 'tongue-open' | 'ramp-form' | 'ramp-open' | 'hurt' | 'phase' | 'defeated';
export interface BossPlayerSample {
  position: THREE.Vector3; state: string; speed: number; grounded: boolean;
  skating: boolean; grinding: boolean; attacking: boolean; spinning?: boolean; immune: boolean; shielded: boolean;
  rail?: Rail | null; support?: THREE.Object3D | null;
}
export interface BossStepResult { hurt: boolean; fatal: boolean; strike: boolean; }
type Wave = { mesh: THREE.Mesh; centre: THREE.Vector3; radius: number; previous: number; life: number; speed: number; };
type Bubble = { mesh: THREE.Mesh; velocity: THREE.Vector3; previous: THREE.Vector3; life: number; };
type Spark = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; total: number; };
export const CHIEF_PHASES = [
  { name: 'CLAWBREAKER', subtitle: 'Jump the ripples. Spin the lowered pearl.', color: '#f1b467' },
  { name: 'TONGUE RIDER', subtitle: 'Ride the unfurled tongue to the chief.', color: '#70e9db' },
  { name: 'SAND LAUNCH', subtitle: 'Use the formed sand kicker to reach the chief with a spin.', color: '#ffa7a0' },
] as const;
const blank = (): BossStepResult => ({ hurt: false, fatal: false, strike: false });
const clamp = THREE.MathUtils.clamp;

/** Deterministic combat driven from Player.step. It cannot alter movement
 * tuning, simulate a grind, or finish a run. Damage and victory consume the
 * production player's attack, rail-contact, position and invulnerability. */
export class CrabChiefEncounter {
  readonly root = new THREE.Group();
  readonly kit = new ReefGeometry();
  readonly model = new MeshyChiefModel();
  readonly phaseGeometry = new ChiefPhaseGeometry(this.root);
  readonly scenery = new ReefScenery();
  readonly target = new THREE.Vector3(0, 0, -14);
  readonly pearl = new THREE.Vector3(...REEF.pearl);
  readonly bodyBox = new THREE.Box3();
  state: ChiefState = 'waiting';
  stateTime = 0;
  time = 0;
  phase = 1;
  health = 9;
  charge = 0;
  hits = 0;
  playerHits = 0;
  grindDistance = 0;
  skateDistance = 0;
  readonly history: { time: number; state: ChiefState; phase: number; health: number }[] = [];
  readonly strikes: { time: number; phase: number; speed: number; skating: boolean; grinding: boolean; charged: boolean; kind: 'pearl' | 'tongue' | 'sand-spin'; tongueMetres:number; rampSpeed:number; }[] = [];
  private checkpointPhase = 1;
  private checkpointDefeated = false;
  private ordinal = 0;
  private left = true;
  private invulnerability = 0;
  private fired = 0;
  private volleyFinish = 1.6;
  private sweepPrevious = -1.3;
  private lastPosition: THREE.Vector3 | null = null;
  private actorPosition = new THREE.Vector3();
  private actorSkating = false;
  private tongueRun = 0;
  private attachedTongue = false;
  private rampSupported = false;
  private rampLipSpeed = 0;
  private launchTime = 0;
  private rampFormed = false;
  private readonly marker: THREE.Group;
  private readonly opening: THREE.Mesh;
  private readonly sweep: THREE.Group;
  private readonly shield: THREE.Group;
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
  get exposed(): boolean { return (this.phase===1&&this.state==='recover'&&this.stateTime>.7)||this.state==='tongue-open'||this.state==='ramp-open'; }
  get charged(): boolean { return this.charge >= 1; }
  get hint(): string {
    if (this.defeated) return this.canFinish ? 'THE REEF IS FREE · VICTORY' : 'THE CHIEF YIELDS';
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
    if (state === 'slam') { this.emitWave(this.target, this.phase === 3 ? 12 : 9, this.phase === 2 ? 3 : 4); this.burst(this.target, 12); sfx.play('tntBoom', .38, .8); }
    if (state === 'volley') { this.fired = 0; this.volleyFinish = 1.6; }
    if (state === 'sweep-tell') { this.sweepPrevious = -1.3; sfx.play('woosh2', .6, .65); }
    if (state === 'sweep') this.emitWave(new THREE.Vector3(0, 0, -23), 10);
  }
  private lockTarget(p: BossPlayerSample): void {
    // The tongue approach includes the front court. Lock the real position
    // at the tell, so standing outside the old pearl court is not a safe spot.
    if(this.phase===2)this.target.set(p.position.x,0,p.position.z);
    else this.target.set(clamp(p.position.x, -13.5, 13.5), 0, clamp(p.position.z, -22, -6));
  }
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
    this.attachedTongue = p.grinding && p.rail === this.phaseGeometry.tongueRail;
    if(this.attachedTongue && this.state==='tongue-open') {this.grindDistance+=movement;this.tongueRun+=movement;}
    const rampContact=p.grounded&&p.support===this.phaseGeometry.sandRamp;
    if(this.phase===3&&rampContact&&p.skating){
      this.skateDistance+=movement;
      if(this.phaseGeometry.launchZone.containsPoint(p.position)&&p.speed>=this.phaseGeometry.requiredSpeed)this.rampLipSpeed=p.speed;
    }
    if(this.rampSupported&&!p.grounded&&p.state==='air'&&this.rampLipSpeed>=this.phaseGeometry.requiredSpeed)this.launchTime=2.0;
    this.rampSupported=rampContact;
    this.launchTime=Math.max(0,this.launchTime-dt);
    if(p.grounded&&!rampContact){this.rampLipSpeed=0;this.launchTime=0;}
    this.charge=this.phase===2?Math.min(1,this.tongueRun/6):this.phase===3&&this.launchTime>0?1:0;
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
        if (t > (this.phase===2?3.15:.6)) this.beginOpening(); break;
      case 'volley-tell': if (t > 1.15) this.enter('volley'); break;
      case 'volley':
        if (t >= this.fired * .5 && this.fired < 3) { this.fireVolley(); this.fired++; }
        if (t > this.volleyFinish) this.beginOpening(); break;
      case 'sweep-tell': if (t > 1.4) this.enter('sweep'); break;
      case 'sweep': {
        const angle = -1.3 + clamp(t / 1.8, 0, 1) * 2.6;
        const dx = p.position.x, dz = p.position.z - REEF.chiefZ, distance = Math.hypot(dx, dz), a = Math.atan2(dx, dz);
        if (p.position.y < 1.05 && distance > 6 && distance < 21 && a > this.sweepPrevious - .09 && a < angle + .09) danger = true;
        if (this.sweepPrevious < 0 && angle >= 0) this.emitWave(new THREE.Vector3(0, 0, -23), 11);
        this.sweepPrevious = angle;
        if (t > 1.9) this.beginOpening(); break;
      }
      case 'recover': if (t > 6.5) this.enter('idle'); break;
      case 'tongue-form': if(t>1.2)this.enter('tongue-open'); break;
      case 'tongue-open': if(t>12&&!this.attachedTongue)this.enter('idle'); break;
      case 'ramp-form': if(t>1.8){this.rampFormed=true;this.enter('ramp-open');} break;
      case 'ramp-open': if(t>13)this.enter('idle'); break;
      case 'hurt': if (t > 1.05) {
        if (this.health > 0 && this.health % 3 === 0) { this.phase++; this.checkpointPhase = this.phase; this.charge = 0;
          this.clearAttacks(); this.enter('phase'); sfx.play('maskGet', .7, .8); }
        else this.enter('idle');
      } break;
      case 'phase': if (t > 3) this.enter('idle'); break;
      case 'defeated': break;
    }
    // Every opening accepts one fresh hit. A held spin cannot drain the bar,
    // a walk into the pearl cannot hurt it, and armor requires earned charge.
    const inReach = Math.hypot(p.position.x-this.pearl.x,p.position.z-this.pearl.z)<2.65&&p.position.y>-.2&&p.position.y<3.2;
    const attack=p.attacking||(p.skating&&p.speed>=8);
    const tongueHit=this.state==='tongue-open'&&this.attachedTongue&&this.tongueRun>=6&&this.phaseGeometry.tongueFraction(p.position)>.94;
    const sandHit=this.state==='ramp-open'&&this.launchTime>0&&p.state==='air'&&p.spinning===true&&p.position.y>=4&&p.position.y<=10&&
      Math.hypot(p.position.x-this.model.root.position.x,p.position.z-this.model.root.position.z)<3.3;
    if((this.phase===1&&this.exposed&&inReach&&attack)||tongueHit||sandHit){
      result.strike=true;this.hits++;this.health--;
      this.strikes.push({time:this.time,phase:this.phase,speed:p.speed,skating:p.skating,grinding:p.grinding,charged:this.phase>1,
        kind:this.phase===1?'pearl':this.phase===2?'tongue':'sand-spin',tongueMetres:this.tongueRun,rampSpeed:this.rampLipSpeed});
      this.charge=0;this.launchTime=0;this.clearAttacks();this.burst(tongueHit?this.phaseGeometry.tongueMouth:this.pearl,28);this.invulnerability=Math.max(this.invulnerability,.6);
      sfx.play('crateBreak1',.9,.65);
      if(this.health===0){this.checkpointDefeated=true;this.enter('defeated');this.burst(this.pearl,34);sfx.play('lifeGet',.9,.9);}
      else this.enter('hurt');danger=false;
    }
    if (danger && !this.defeated && !p.immune && this.invulnerability <= 0) {
      result.hurt = true; this.invulnerability = 1.65; this.playerHits++;
      result.fatal = !p.shielded;
      this.burst(p.position.clone().add(new THREE.Vector3(0, .8, 0)), 8); sfx.play('takeDamage', .65, .95);
    }
    return result;
  }
  private beginOpening():void {
    // Phase one keeps its original propagating slam ripple during recovery.
    if(this.phase>1)this.clearAttacks();
    this.tongueRun=0;this.rampLipSpeed=0;this.launchTime=0;
    this.enter(this.phase===1?'recover':this.phase===2?'tongue-form':this.rampFormed?'ramp-open':'ramp-form');
  }
  private clearAttacks(): void { for (const wave of this.waves) wave.life = 0; for (const bubble of this.bubbles) bubble.life = 0; }
  private emitWave(centre: THREE.Vector3, speed: number, life=4): void {
    const wave = this.waves.find(value => value.life <= 0); if (!wave) return;
    wave.centre.copy(centre); wave.radius = 0; wave.previous = 0; wave.life = life; wave.speed = speed;
  }
  private fireVolley(): void {
    const arm = this.model.arms[this.fired % 2], origin = arm.wrist.clone().add(this.model.root.position);
    origin.z += 1.5; // visible pincer tip, not an invisible floor emitter
    const base = Math.atan2(this.target.x - origin.x, this.target.z - origin.z);
    const distance = Math.hypot(this.target.x - origin.x, this.target.z - origin.z);
    const drop = (.85 - origin.y) / Math.max(4, distance);
    const travel = Math.hypot(distance,.85-origin.y)/8.5;
    // Let the last aimed row reach the locked player before clearing hazards
    // and presenting the tongue. The former 1.6s window deleted every row in
    // flight when the rider waited in the front court.
    const life = this.phase===2 ? travel+.55 : 5;
    if(this.phase===2)this.volleyFinish=Math.max(this.volleyFinish,this.stateTime+life+.15);
    for (let i = -2; i <= 2; i++) {
      const bubble = this.bubbles.find(value => value.life <= 0); if (!bubble) break;
      bubble.mesh.position.copy(origin); bubble.previous.copy(origin); bubble.life = life;
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
    if(this.model.diagnostics.ready)this.pearl.copy(this.model.pearl);
    const body=this.model.root.position;
    this.bodyBox.min.set(body.x-1.65,body.y,body.z-1.0);this.bodyBox.max.set(body.x+1.65,body.y+5.7,body.z+1.8);
    this.marker.visible = this.state === 'slam-tell' || this.state === 'slam'; this.marker.position.copy(this.target); this.marker.position.y = .07;
    this.marker.rotation.y = this.time * .9;
    this.opening.visible = this.exposed&&this.phase===1; this.opening.position.set(this.pearl.x,.06,this.pearl.z);this.opening.scale.setScalar(1 + Math.sin(this.time * 8) * .035);
    this.sweep.visible = this.state === 'sweep-tell' || this.state === 'sweep';
    // Arc dots stay stationary; only the large sweep line traverses the floor.
    const line = this.sweep.children[0]; line.rotation.y = this.state === 'sweep' ? this.sweepPrevious : -1.3;
    line.position.x = Math.sin(line.rotation.y) * 11; line.position.z = Math.cos(line.rotation.y) * 11;
    this.shield.visible = this.phase > 1 && !this.exposed && !this.defeated;this.shield.position.copy(this.pearl); this.shield.rotation.y = this.time;
    if(this.phase===2&&(this.state==='tongue-form'||this.state==='tongue-open'||(this.state==='hurt'&&this.attachedTongue))){
      const progress=this.state==='tongue-form'?clamp(this.stateTime/1.2,0,1):1;
      this.phaseGeometry.setTongue(this.model.root.position.clone().add(new THREE.Vector3(0,6.4,1)),progress,this.stateTime);
    }else this.phaseGeometry.hideTongue();
    if(this.phase===3&&!this.defeated){
      const progress=this.rampFormed?1:this.state==='ramp-form'?clamp(this.stateTime/1.8,0,1):0;
      this.phaseGeometry.setRamp(progress,this.stateTime);
    }else this.phaseGeometry.hideRamp();
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
    this.charge = 0; this.invulnerability = 0; this.ordinal = 0;
    this.lastPosition = null;this.tongueRun=0;this.attachedTongue=false;this.rampSupported=false;this.rampLipSpeed=0;this.launchTime=0;this.rampFormed=false;this.phaseGeometry.reset();this.clearAttacks(); this.enter('waiting');
    if (this.checkpointDefeated) { this.health = 0; this.enter('defeated'); this.stateTime = 4; }
    for (const spark of this.sparks) spark.life = 0;
    this.present(0);
  }
  prepareAssets():Promise<void> {return Promise.all([this.model.ready,this.scenery.ready]).then(()=>{});}
  dispose():void {this.phaseGeometry.dispose();this.model.dispose();this.scenery.dispose();}
  get diagnostics() { return { state: this.state, stateTime: this.stateTime, phase: this.phase, health: this.health,
    charged: this.charged, charge: this.charge, canFinish: this.canFinish,
    hits: this.hits, playerHits: this.playerHits, grindDistance: this.grindDistance, skateDistance: this.skateDistance,
    tongueRun:this.tongueRun,tongueActive:this.phaseGeometry.tongueActive,tongueProgress:this.phaseGeometry.tongueProgress,rampActive:this.phaseGeometry.rampActive,rampProgress:this.phaseGeometry.rampProgress,launchTime:this.launchTime,rampSpeed:this.rampLipSpeed,
    activeWaves: this.waves.filter(w => w.life > 0).map(w => ({ radius: w.radius, previous: w.previous, centre: w.centre.toArray() })),
    activeBubbles: this.bubbles.filter(b => b.life > 0).length,
    bubblePositions:this.bubbles.filter(b=>b.life>0).map(b=>b.mesh.position.toArray()), target: this.target.toArray(),
    history: [...this.history], strikes: [...this.strikes], model: this.model.diagnostics }; }
}
