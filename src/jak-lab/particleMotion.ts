import {Euler, Quaternion, Vector3} from 'three';
import type {ContactCallback, EffectDefinition, EffectItem, HostReplay, ParticleDefinition, ParticleField} from './types';

const ANGLE = Math.PI * 2 / 65536;
export const PARTICLE_STEP = 1 / 60;
const STEP_TICKS = 5;
type Values = Record<string, number>;
export interface LabParticle {
  id: number; alive: boolean; texture: string; values: Values; flags: Set<string>;
  definitionId: number;
  position: Vector3; orientation: Quaternion; orbit: Quaternion; radius: number;
  parent: LabParticle | null; child: LaunchState | null; is3d: boolean;
  callback: string; birth: string; age: number;
  blend: 'normal' | 'additive' | 'subtractive'; depthWrite: boolean;
  controlled: boolean;
}
interface LaunchState {
  item: EffectItem; active: boolean; launched: boolean; credit: number;
  parent: LabParticle | null; offset: number; spawnTime: number; origin: Vector3 | null; direct: boolean;
  definitionOverride?: ParticleDefinition; quaternion?: Quaternion;
}
const RACER_HEAT_SLICES = ['part-hud-zoomer-heat-slice-01-func', 'part-hud-zoomer-heat-slice-02-func', 'part-hud-zoomer-heat-slice-03-func'];
const RACER_SPEEDS = [0, 122880, 131072, 139264, 147456, 155648, 163840, 172032];
const RACER_ANGLES = [42780.445, 27488.71, 14927.645, 7281.778, -546.13336, -6371.5557, -10922.667, -15473.777];
const KNOWN_CALLBACKS = new Set(['sparticle-track-root', 'sparticle-track-root-prim',
  'part-tracker-track-root', 'eco-fadeout', 'eco-track-root-prim-fadeout', 'sparticle-track-root-money',
  'bird-bob-func', 'tra-bird-bob-func', 'snow-bird-bob-func',
  'sparticle-seagull-moon', 'tra-sparticle-seagull-moon', 'sparticle-snow-birds-moon',
  'part-tracker-track-target-joint', 'part-hud-racer-speed-func', 'part-hud-racer-heat-func', ...RACER_HEAT_SLICES]);
const KNOWN_BIRTH = new Set(['birth-func-random-next-time', 'birth-func-y->userdata',
  'birth-func-copy-rot-color', 'birth-func-copy2-rot-color', 'birth-func-copy-omega-to-z',
  'birth-func-ocean-height', 'birth-func-set-quat', 'birth-func-copy-target-y-rot',
  'birth-func-target-orient', 'birth-func-vector-orient', 'birth-func-random-rot']);
const UP = new Vector3(0, 1, 0);
const signed16 = (value: number) => (Math.trunc(value) << 16) >> 16;

// racer-part.gc:11 and trigonometry.gc:56. The angle table is deliberately
// nonlinear; source deg-seek quantizes before taking the signed shortest turn.
function racerSpeedAngle(speed: number): number {
  const speeds = RACER_SPEEDS, angles = RACER_ANGLES;
  let index = 1; while (index < speeds.length - 1 && speed > speeds[index]) index++;
  const t = Math.max(0, Math.min(1, (speed - speeds[index - 1]) / (speeds[index] - speeds[index - 1])));
  return Math.fround((1 - t) * angles[index - 1] + t * angles[index]);
}
function seekAngle(current: number, target: number, maximum: number): number {
  const start = signed16(current), end = signed16(target), difference = signed16(end - start);
  const step = Math.trunc(maximum);
  // The source 64-bit abs overflows for the exact half turn and takes +step.
  return difference === -32768 ? signed16(start + step) :
    Math.abs(difference) <= step ? end : signed16(start + Math.sign(difference) * step);
}

/** Explicit inspection inputs. Defaults are a stationary origin and flat water;
 * they are not inferred game object states. Source pointers become typed data. */
export interface ParticleHost {
  root: Vector3; primitive: Vector3; fadeOut: boolean; hudMoney: boolean;
  targetYaw: number | null; targetNormal: Vector3; vectorNormal: Vector3 | null;
  targetJoints: Map<number, Vector3>; particleQuaternion: Quaternion;
  oceanHeight: (position: Vector3) => number;
  /** Source units/second, heat/heat-max ratio, and integer HUD offset. */
  racerSpeed: number; racerHeat: number; racerHudOffset: number;
}

/** Source numeric field rules and launch graph. Units remain GOAL units until
 * rendering: 4096 units/metre, 65536/turn, 300 ticks/second. Context-dependent
 * callbacks are reported explicitly until their host-object ports exist. */
export class ParticleMotion {
  readonly particles: LabParticle[] = [];
  /** Source callback list stores live sprite pointers, read after integration. */
  readonly auxiliaryParticles: LabParticle[] = [];
  readonly issues = new Set<string>();
  readonly textureIds = new Set<string>();
  readonly referencedParticleIds = new Set<number>();
  readonly host: ParticleHost = {root: new Vector3(), primitive: new Vector3(), fadeOut: false, hudMoney: false,
    targetYaw: 0, targetNormal: UP.clone(), vectorNormal: null, targetJoints: new Map(),
    particleQuaternion: new Quaternion(), oceanHeight: () => 0,
    racerSpeed: 0, racerHeat: .5, racerHudOffset: 0};
  readonly hostInputs = new Set<string>();
  readonly soundEvents: {name: string; position: Vector3 | null}[] = [];
  clock = 0;
  dropped = 0;
  queueDrops = 0;
  auxiliaryDrops = 0;
  hour = 12;
  cameraDistance = 0; // GOAL units; zero disables distance attenuation in the lab.
  replay: HostReplay | null = null;
  /** Source host draw/update calls, executed once per simulation frame. */
  sourceEmitter: ((motion: ParticleMotion) => void) | null = null;
  private readonly states: LaunchState[];
  private randomState: number;
  private soundRandomState: number;
  private copyToggle = 0;
  private readonly directCredits = new Map<number, number>();
  private readonly queuedLaunches: {particle: number; is3d: boolean; position: Vector3}[] = [];
  private nextId = 0;
  private carry = 0;
  private readonly vector = new Vector3();
  private readonly turn = new Quaternion();

  constructor(readonly group: EffectDefinition, readonly definitions: Map<number, ParticleDefinition>,
    readonly capacity = 12000, readonly seed = 1, readonly callbackPrograms: Record<string, ContactCallback> = {}) {
    this.randomState = seed || 1;
    this.soundRandomState = (seed ^ 0x9e3779b9) || 1;
    this.states = group.items.map(item => ({item, active: !item.flags?.includes('start-dead'),
      launched: false, credit: 0, parent: null, offset: item.offset ?? 0, spawnTime: -30000,
      origin: null, direct: !!group.directLaunch}));
    const seen = this.referencedParticleIds;
    const visit = (id: number) => {
      if (seen.has(id)) return; seen.add(id);
      const definition = definitions.get(id);
      if (!definition) {this.issues.add(`Empty source launcher ${id}`); return;}
      for (const field of definition.fields) {
        if (field.field === 'texture') this.textureIds.add(String(field.value));
        if (field.field === 'func') {
          const name = String(field.value), program = callbackPrograms[name];
          if (program) {
            for (const action of program.actions) if (action.op === 'launch') visit(action.particle);
          } else if (!KNOWN_CALLBACKS.has(name) && field.op === 'value') this.issues.add(`Host callback: ${name}`);
          if (name.includes('track-root') || name.endsWith('bird-bob-func')) this.hostInputs.add('root');
          if (name.includes('track-root-prim')) this.hostInputs.add('primitive');
          if (name.includes('fadeout')) this.hostInputs.add('fade-out');
          if (name === 'part-tracker-track-target-joint') this.hostInputs.add('target joint transforms');
          if (name === 'part-hud-racer-speed-func') this.hostInputs.add('racer speed');
          if (name === 'part-hud-racer-heat-func' || RACER_HEAT_SLICES.includes(name)) this.hostInputs.add('racer heat');
        }
        if (field.field === 'birth-func' && !KNOWN_BIRTH.has(String(field.value))) this.issues.add(`Birth callback: ${field.value}`);
        if (field.field === 'birth-func') {
          const name = String(field.value);
          if (name.includes('target')) this.hostInputs.add('target yaw/normal');
          if (name === 'birth-func-vector-orient') this.hostInputs.add('userdata normal vector');
          if (name === 'birth-func-set-quat') this.hostInputs.add('particle quaternion');
          if (name === 'birth-func-ocean-height') this.hostInputs.add('ocean height');
        }
        if (field.field === 'flags' && (field.value as string[]).includes('aux-list')) this.hostInputs.add('root');
        if (field.field === 'flags' && (field.value as string[]).includes('bit12')) this.issues.add('Time-of-day host colour');
        if (field.field === 'next-launcher') visit(field.base ?? 0);
      }
    };
    group.items.forEach(item => visit(item.particle));
    if (group.flags?.includes('screen-space')) this.issues.add('Screen-space host layout');
  }
  private random(sound = false): number {
    let value = sound ? this.soundRandomState : this.randomState;
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    if (sound) this.soundRandomState = value >>> 0; else this.randomState = value >>> 0;
    return (value >>> 0) / 4294967296;
  }
  private evaluate(field: ParticleField, values: Values): number {
    if (field.op === 'copy') return values[String(field.value)] ?? 0;
    let random = field.range ? this.random() * (field.range + (field.op === 'float-int' ? 1 : 0)) : 0;
    if (field.op === 'int' || field.op === 'float-int') random = Math.trunc(random);
    return Math.fround((field.base ?? 0) + random * (field.mult ?? 1));
  }
  private assign(particle: LabParticle, definition: ParticleDefinition, relaunch = false): void {
    particle.definitionId = definition.id;
    if (relaunch) particle.values['next-launcher'] = 0;
    for (const field of definition.fields) {
      // Relaunch preserves all unspecified sprite/CPU fields. It does not rerun
      // launch count, texture, birth callbacks or emission-cone fields.
      if (field.field === 'num' || relaunch && ['texture', 'birth-func', 'sound'].includes(field.field)) continue;
      if (relaunch && /^(launchrot|conerot|rotate-y)/.test(field.field)) continue;
      if (field.op === 'value') {
        if (field.field === 'texture') particle.texture = String(field.value);
        else if (field.field === 'flags') particle.flags = new Set(field.value as string[]);
        else if (field.field === 'func') particle.callback = String(field.value);
        else if (field.field === 'birth-func') particle.birth = String(field.value);
      } else if (field.op !== 'data') {
        particle.values[field.field] = this.evaluate(field, particle.values);
        if (field.field === 'func' && particle.values.func === 0) particle.callback = '';
      }
    }
    if (!relaunch) {
      particle.blend = particle.flags.has('bit3') ? 'additive' : particle.flags.has('bit4') ? 'subtractive' : 'normal';
      particle.depthWrite = particle.flags.has('bit9');
    }
  }
  private rotation(values: Values, prefix: string, order: 'ZYX' | 'YXZ' = 'YXZ'): Quaternion {
    return this.turn.setFromEuler(new Euler((values[`${prefix}-x`] ?? 0) * ANGLE,
      (values[`${prefix}-y`] ?? 0) * ANGLE, (values[`${prefix}-z`] ?? 0) * ANGLE, order));
  }
  private setupAuxiliary(p: LabParticle, relaunch = false): void {
    if (!p.flags.has('aux-list')) return;
    if (p.is3d) {this.issues.add('Auxiliary sprite in a 3D particle system'); return;}
    // sp-launch-particles-var and sp-relaunch-particle-2d replace the callback,
    // suppress the ordinary quad, and prevent alpha-zero death. RGB is radii.
    p.callback = 'add-to-sprite-aux-list';
    p.values.a = p.values['fade-a'] = 0;
    p.flags.delete('bit2');
    // Initial launch clamps to [3,11]. A later invalid flag uses the draw-time
    // fallback to 11 instead; keep those two source rules distinct.
    if (!relaunch) p.values['rot-x'] = Math.max(3, Math.min(11, Math.trunc(p.values['rot-x'] ?? 0)));
  }
  private spawn(state: LaunchState, rate = 1): void {
    const definition = state.definitionOverride ?? this.definitions.get(state.item.particle); if (!definition) return;
    const num = definition.fields.find(field => field.field === 'num');
    if (!num) return;
    // Without a launch-state, native accumulation belongs to the launcher,
    // shared by every call site and both particle systems.
    if (state.direct) state.credit = this.directCredits.get(definition.id) ?? 0;
    state.credit += this.evaluate(num, {}) * rate;
    this.launchCredit(state, definition);
    if (state.direct) this.directCredits.set(definition.id, state.credit);
  }
  private launchCredit(state: LaunchState, definition: ParticleDefinition): void {
    while (state.credit >= 1) {
      state.credit--;
      if (this.particles.length >= this.capacity) {this.dropped++; continue;}
      const p: LabParticle = {id: ++this.nextId, definitionId: definition.id, alive: true, texture: '', values: {}, flags: new Set(),
        position: new Vector3(), orientation: new Quaternion(), orbit: new Quaternion(), radius: 0,
        parent: state.parent, child: null, is3d: state.item.flags?.includes('is-3d') ?? false,
        callback: '', birth: '', age: 0, blend: 'normal', depthWrite: false, controlled: !state.direct};
      this.assign(p, definition);
      const v = p.values;
      p.position.set(v.x ?? 0, v.y ?? 0, v.z ?? 0);
      const velocity = new Vector3(v['vel-x'] ?? 0, v['vel-y'] ?? 0, v['vel-z'] ?? 0);
      // GOAL matrices use row vectors: x then y then z is Three's ZYX.
      // Sprite quaternion-zxy! similarly corresponds to Three's YXZ.
      velocity.applyQuaternion(this.rotation(v, 'launchrot', 'ZYX')).applyQuaternion(this.rotation(v, 'conerot', 'ZYX'));
      this.vector.set(0, p.flags.has('launch-along-z') ? 0 : v['conerot-radius'] ?? 0,
        p.flags.has('launch-along-z') ? v['conerot-radius'] ?? 0 : 0).applyQuaternion(this.rotation(v, 'conerot', 'ZYX'));
      p.position.add(this.vector);
      this.turn.setFromAxisAngle(new Vector3(0, 1, 0), (v['rotate-y'] ?? 0) * ANGLE);
      p.position.applyQuaternion(this.turn); velocity.applyQuaternion(this.turn);
      if (!p.flags.has('use-global-acc')) {
        this.vector.set(v['accel-x'] ?? 0, v['accel-y'] ?? 0, v['accel-z'] ?? 0).applyQuaternion(this.turn);
        [v['accel-x'], v['accel-y'], v['accel-z']] = this.vector.toArray();
      }
      [v['vel-x'], v['vel-y'], v['vel-z']] = velocity.toArray();
      if (p.flags.has('set-conerot') && v['rotate-y']) v['rot-y'] = 16384 + v['rotate-y'];
      p.orientation.copy(this.rotation(v, 'rot'));
      if (p.flags.has('bit7') && p.parent) {
        p.radius = v.z ?? 0;
        this.vector.set(Math.cos((v.x ?? 0) * ANGLE), 0, -Math.sin((v.x ?? 0) * ANGLE));
        p.orbit.setFromAxisAngle(this.vector, (v.y ?? 0) * ANGLE);
      }
      p.position.add(p.parent?.position ?? state.origin ?? this.host.root);
      this.birth(p, state.quaternion);
      this.setupAuxiliary(p);
      if (state.item.binding) {
        const child = this.states.find(candidate => candidate.item.particle === state.item.binding && !candidate.active);
        if (child) {child.active = true; child.launched = false; child.parent = p; p.child = child;}
      }
      this.particles.push(p);
    }
  }
  private birth(p: LabParticle, quaternion?: Quaternion): void {
    const v = p.values;
    if (p.birth === 'birth-func-random-next-time') v['next-time'] = Math.trunc(this.random() * (v.userdata ?? 0));
    if (p.birth === 'birth-func-y->userdata') v.userdata = (v.userdata ?? 0) + p.position.y;
    if (p.birth === 'birth-func-copy-rot-color' && p.parent) {
      p.orientation.premultiply(this.turn.setFromAxisAngle(UP, (p.parent.values['rot-z'] ?? 0) * ANGLE));
      for (const channel of ['r', 'g', 'b']) v[channel] = p.parent.values[channel] ?? 0;
    }
    if (p.birth === 'birth-func-copy2-rot-color' && p.parent) {
      const parent = p.parent.values;
      const roll = signed16(16384 + (this.copyToggle++ & 1 ? -1 : 1) * (parent['scale-x'] ?? 0));
      p.orientation.setFromEuler(new Euler(0, (parent['rot-z'] ?? 0) * ANGLE, roll * ANGLE, 'YXZ'));
      for (const channel of ['r', 'g', 'b']) v[channel] = parent[channel] ?? 0;
    }
    if (p.birth === 'birth-func-copy-omega-to-z' && p.parent) {
      v['rot-z'] = -16384 + (v.omega ?? 0);
      v['next-time'] = p.parent.values['next-time'] ?? 0; v['scale-x'] = 163.85638 * v['next-time'];
    }
    if (p.birth === 'birth-func-ocean-height') p.position.y = this.host.oceanHeight(p.position) + (v.userdata ?? 0);
    if (p.birth === 'birth-func-set-quat') p.orientation.copy(quaternion ?? this.host.particleQuaternion).normalize();
    if (p.birth === 'birth-func-copy-target-y-rot' && this.host.targetYaw !== null)
      this.rotateMotion(p, this.host.targetYaw - 16384);
    if (p.birth === 'birth-func-target-orient' && this.host.targetYaw !== null) {
      this.normalOrientation(p.orientation, this.host.targetNormal);
      p.orientation.multiply(this.turn.setFromAxisAngle(UP, (32768 + (v.userdata ?? 0) + this.host.targetYaw) * ANGLE)).normalize();
    }
    if (p.birth === 'birth-func-vector-orient') {
      if (this.host.vectorNormal) this.normalOrientation(p.orientation, this.host.vectorNormal);
      else if (v.userdata) this.issues.add('Unresolved userdata normal pointer');
    }
    if (p.birth === 'birth-func-random-rot') {
      const angle = (v.userdata ?? 0) + this.random() * 65536;
      this.rotateMotion(p, angle);
      p.position.add(this.vector.set(116940.8, 0, 0).applyAxisAngle(UP, angle * ANGLE));
      p.orientation.premultiply(this.turn.setFromAxisAngle(UP, (16384 + angle) * ANGLE)).normalize();
    }
    if (['birth-func-copy-rot-color', 'birth-func-copy2-rot-color', 'birth-func-copy-omega-to-z'].includes(p.birth) && !p.parent)
      this.issues.add(`Missing source parent binding: ${p.birth}`);
  }
  private normalOrientation(out: Quaternion, normal: Vector3): void {
    this.vector.set(normal.z, 0, -normal.x);
    // A flat normal has no rotation axis. Keep the source identity in that case.
    if (this.vector.lengthSq() < 1e-16) {
      out.setFromAxisAngle(new Vector3(1, 0, 0), normal.y < 0 ? Math.PI : 0); return;
    }
    out.setFromAxisAngle(this.vector.normalize(), Math.acos(Math.max(-1, Math.min(1, normal.y))));
  }
  private rotateMotion(p: LabParticle, angle: number): void {
    for (const prefix of ['vel', 'accel']) {
      const v = p.values;
      this.vector.set(v[`${prefix}-x`] ?? 0, v[`${prefix}-y`] ?? 0, v[`${prefix}-z`] ?? 0).applyAxisAngle(UP, angle * ANGLE);
      [v[`${prefix}-x`], v[`${prefix}-y`], v[`${prefix}-z`]] = this.vector.toArray();
    }
  }
  private callback(p: LabParticle): void {
    const v = p.values, name = p.callback, program = this.callbackPrograms[name];
    if (name === 'add-to-sprite-aux-list') {
      if (this.auxiliaryParticles.length < 256) this.auxiliaryParticles.push(p);
      else this.auxiliaryDrops++;
      v.a = 0;
    } else if (program) {
      const below = p.position.y < (v.userdata ?? 0);
      if ((program.comparison === 'below' ? !below : below) || program.descending && (v['vel-y'] ?? 0) >= 0) return;
      for (const action of program.actions) {
        // Native callbacks run against scratchpad CPU info: killing writes zero
        // to the timer. This frame still integrates; next frame retires it.
        if (action.op === 'kill') v.timer = 0;
        else if (action.op === 'launch') {
          const position = p.position.clone();
          if (action.height === 'surface') position.y = v.userdata ?? 0;
          // The pinned source queue holds 32 entries, across 2D and 3D.
          if (this.queuedLaunches.length < 32) this.queuedLaunches.push({particle: action.particle, is3d: action.is3d, position});
          else this.queueDrops++;
        } else if (action.chance === undefined || this.random(true) < action.chance) {
          const position = action.height ? p.position.clone() : null;
          if (position && action.height === 'surface') position.y = v.userdata ?? 0;
          this.soundEvents.push({name: action.name, position});
        }
      }
    } else if (name === 'sparticle-track-root' || name === 'part-tracker-track-root') p.position.copy(this.host.root);
    else if (name === 'sparticle-track-root-prim' || name === 'eco-track-root-prim-fadeout') p.position.copy(this.host.primitive);
    else if (name === 'sparticle-track-root-money' && !this.host.hudMoney) p.position.copy(this.host.root).addScaledVector(UP, 2048);
    else if (name === 'bird-bob-func' || name === 'tra-bird-bob-func' || name === 'snow-bird-bob-func')
      p.position.y = this.host.root.y - 2048 * Math.sin(218.45334 * (this.clock % 300) * ANGLE);
    else if (name === 'sparticle-seagull-moon' || name === 'tra-sparticle-seagull-moon' || name === 'sparticle-snow-birds-moon')
      v['rot-z'] = signed16(-16384 + (v.omega ?? 0));
    else if (name === 'part-tracker-track-target-joint' && this.host.targetYaw !== null) {
      const joint = Math.trunc(v.userdata ?? 0), position = this.host.targetJoints.get(joint);
      if (position) p.position.copy(position); else this.issues.add(`Missing target joint transform: ${joint}`);
    } else if (name === 'part-hud-racer-speed-func') {
      const target = racerSpeedAngle(this.host.racerSpeed), current = v['rot-z'] ?? 0;
      v['rot-z'] = this.host.racerHudOffset < 10 ?
        seekAngle(current, target, (target < current ? 131072 : 32768) * PARTICLE_STEP) : target;
    } else if (name === 'part-hud-racer-heat-func' || RACER_HEAT_SLICES.includes(name)) {
      // Heat is the source heat/heat-max ratio. Do not clamp it: the native
      // callback extrapolates. Blink phase uses the lab's 60 Hz source clock.
      const heat = this.host.racerHeat, bright = !(Math.trunc(this.clock / STEP_TICKS) & 8);
      if (name === 'part-hud-racer-heat-func') {
        v['rot-z'] = Math.fround(182.04445 * (-45 + 215 * heat));
        v.r = 128; v.g = v.b = heat > .8 && bright ? 0 : 128;
      } else {
        const slice = RACER_HEAT_SLICES.indexOf(name) + 1;
        v['rot-z'] = Math.fround(182.04445 * (-45 - 90 * slice + 215 * heat));
        if (slice > 1) v['rot-z'] = Math.max(-24576, v['rot-z']);
        if (heat < .6) {v.r = Math.fround(213.33333 * heat); v.g = 128; v.b = 0;}
        else if (heat < .8) {v.r = 128; v.g = Math.fround(128 - 640 * (heat - .6)); v.b = 0;}
        else {v.r = 128; v.g = v.b = bright ? 0 : 100;}
      }
    }
    if ((name === 'eco-fadeout' || name === 'eco-track-root-prim-fadeout') && !this.host.fadeOut) v['next-time'] = STEP_TICKS * 2;
  }
  private retire(particle: LabParticle): void {
    particle.alive = false;
    if (particle.child) {particle.child.active = false; particle.child.parent = null; particle.child.launched = false;}
  }
  get replayPhase(): 'held' | 'emitting' | 'lingering' | 'finished' {
    if (!this.replay) return 'held';
    const hostTime = Math.max(0, this.clock - STEP_TICKS);
    if (hostTime < this.replay.duration) return 'emitting';
    return hostTime < this.replayCleanupTime ? 'lingering' : 'finished';
  }
  private get replayCleanupTime(): number {
    if (!this.replay) return Infinity;
    // The source while/suspend loops observe time in fixed-frame increments.
    // After linger, notify is followed by one final suspend before deactivation.
    return Math.ceil(Math.max(0, this.replay.duration) / STEP_TICKS) * STEP_TICKS +
      Math.ceil(Math.max(0, this.replay.linger) / STEP_TICKS) * STEP_TICKS + STEP_TICKS;
  }
  private step(): void {
    const previous = this.clock; this.clock += STEP_TICKS;
    this.soundEvents.length = 0;
    this.auxiliaryParticles.length = 0;
    this.sourceEmitter?.(this);
    if (this.replay && previous >= this.replayCleanupTime) {
      // kill-and-free-particles matches the launch-control key. Unkeyed
      // secondary callback splashes belong to the shared particle system.
      for (const particle of this.particles) if (particle.controlled) this.retire(particle);
    }
    // Source group launchers run in reverse order. A newly bound child can
    // therefore emit no earlier than the next group pass.
    for (let index = this.states.length - 1; index >= 0; index--) {
      if (this.replay && previous >= this.replay.duration) break;
      const state = this.states[index]; if (!state.active) continue;
      const item = state.item;
      const falloff = item['falloff-to'] ? Math.max(0, 1 - this.cameraDistance / item['falloff-to']) : 1;
      if (item.flags?.includes('launch-asap') || item.flags?.includes('bit6')) {
        if (!state.launched || item.flags.includes('bit6')) {
          if (falloff > 0) this.spawn(state, falloff);
          state.launched = true; state.spawnTime = this.clock;
        }
        continue;
      }
      if (((item['hour-mask'] ?? 0) & (1 << this.hour)) ||
        item['fade-after'] && this.cameraDistance >= item['fade-after']) continue;
      let overlap = STEP_TICKS;
      if (item.period) {
        const before = (previous + state.offset) % item.period, after = (this.clock + state.offset) % item.period;
        const length = item.length ?? 0;
        if (before < length && after < length) overlap = STEP_TICKS;
        else if (before < length) overlap = length - before;
        else if (after < length) overlap = after;
        else {
          if (!item.flags?.includes('bit1') || this.clock - state.spawnTime < item.period) continue;
          state.offset = item.period - after;
        }
      }
      state.spawnTime = this.clock; state.launched = true;
      if (overlap > 0 && falloff > 0) this.spawn(state, overlap / STEP_TICKS * falloff);
    }
    for (const p of this.particles) {
      const v = p.values;
      if (!p.alive) continue;
      if ((v.timer ?? 0) === 0) {this.retire(p); continue;}
      if (v.timer !== -1) v.timer = Math.max(0, v.timer - STEP_TICKS);
      p.age += STEP_TICKS;
      this.callback(p);
      if (v['next-launcher']) {
        v['next-time'] = (v['next-time'] ?? 0) - STEP_TICKS;
        if (v['next-time'] <= 0) {
          const next = this.definitions.get(v['next-launcher']);
          v['next-launcher'] = 0;
          if (next) {
            // These sprite fields alias the live position in the native layout.
            // A relaunch can replace one axis or copy the current value.
            [v.x, v.y, v.z] = p.position.toArray();
            if (p.is3d) v['rot-x'] = v['rot-y'] = v['rot-z'] = 0;
            this.assign(p, next, true);
            if (!p.is3d) this.setupAuxiliary(p, true);
            p.position.set(v.x, v.y, v.z);
            if (p.is3d) {
              const nextRotation = this.rotation(v, 'rot');
              if (p.flags.has('left-multiply-quat')) p.orientation.multiply(nextRotation);
              else if (p.flags.has('right-multiply-quat')) p.orientation.premultiply(nextRotation);
              else p.orientation.copy(nextRotation);
              p.orientation.normalize();
            }
          }
        }
      }
      for (const axis of ['x', 'y', 'z'] as const) {
        v[`vel-${axis}`] = ((v[`vel-${axis}`] ?? 0) + (v[`accel-${axis}`] ?? 0)) * (v.friction || 1);
        p.position[axis] += v[`vel-${axis}`] * STEP_TICKS;
      }
      for (const axis of ['x', 'y']) v[`scale-${axis}`] = (v[`scale-${axis}`] ?? 0) + (v[`scalevel-${axis}`] ?? 0) * STEP_TICKS;
      if (!p.is3d) {
        // Native 2D sprite rotation is quantized and wrapped to signed 16-bit.
        v['rot-z'] = (Math.trunc((v['rot-z'] ?? 0) + (v['rotvel-z'] ?? 0) * STEP_TICKS) << 16) >> 16;
      }
      for (const channel of ['r', 'g', 'b', 'a']) v[channel] = Math.max(0, (v[channel] ?? 0) + (v[`fade-${channel}`] ?? 0) * STEP_TICKS);
      if (p.is3d) {
        this.turn.setFromEuler(new Euler((v['rotvel-x'] ?? 0) * ANGLE * STEP_TICKS,
          (v['rotvel-y'] ?? 0) * ANGLE * STEP_TICKS, (v['rotvel-z'] ?? 0) * ANGLE * STEP_TICKS, 'YXZ'));
        p.orientation.multiply(this.turn).normalize();
      }
      if (p.flags.has('bit7') && p.parent) {
        v.omega = (v.omega ?? 0) + (v['vel-x'] ?? 0) * STEP_TICKS;
        p.radius += (v['vel-z'] ?? 0) * STEP_TICKS;
        const phase = v.omega * ANGLE;
        this.turn.setFromAxisAngle(this.vector.set(Math.cos(phase), 0, Math.sin(phase)), (v['vel-y'] ?? 0) * ANGLE);
        p.orbit.premultiply(this.turn).normalize();
        p.position.set(Math.sin(phase) * p.radius, 0, Math.cos(phase) * p.radius)
          .applyQuaternion(p.orbit).add(p.parent.position);
      }
      if (p.flags.has('bit2') && v.a <= 0 || p.flags.has('bit1') && v.r + v.g + v.b + v.a <= 0 ||
        p.flags.has('bit0') && (v['scale-x'] < 0 || v['scale-y'] < 0)) this.retire(p);
    }
    for (let index = this.particles.length - 1; index >= 0; index--)
      if (!this.particles[index].alive) this.particles.splice(index, 1);
    // process-particles clears the native launch queue after all particle
    // systems update. Secondary splashes are born here, never stepped twice.
    for (const launch of this.queuedLaunches) this.spawn({
      item: {particle: launch.particle, flags: launch.is3d ? ['is-3d'] : []}, active: true,
      launched: false, credit: 0, parent: null, origin: launch.position, direct: true, offset: 0, spawnTime: this.clock,
    });
    this.queuedLaunches.length = 0;
  }
  update(dt: number): void {
    this.carry += dt;
    while (this.carry >= PARTICLE_STEP) {this.step(); this.carry -= PARTICLE_STEP;}
  }
  triggerDirect(): void {
    if (!this.group.directLaunch) return;
    // A native direct launcher retains fractional birth credit between calls.
    for (const state of this.states) state.launched = false;
  }
  emitSource(id: number, origin: Vector3, is3d: boolean, quaternion?: Quaternion,
    initialValues: Readonly<Record<string, number>> = {}): void {
    const source = this.definitions.get(id); if (!source) throw new Error(`Missing source particle ${id}`);
    for (const [name, value] of Object.entries(initialValues)) {
      if (!Number.isFinite(value) || !source.fields.some(f => f.field === name && ['float','int','float-int'].includes(f.op)))
        throw new Error(`Unsupported source field override ${id}:${name}`);
    }
    // A host changes a launcher's initial value, retaining its authored random
    // range/type/order. Per-call copies avoid mutating the catalogue or another
    // exhibit, and source fractional credit stays shared by launcher ID.
    const definitionOverride = Object.keys(initialValues).length ? {...source, fields: source.fields.map(field =>
      Object.prototype.hasOwnProperty.call(initialValues, field.field) ? {...field, base: initialValues[field.field]} : field)} : source;
    this.spawn({item:{particle:id,flags:is3d?['is-3d']:[]},active:true,launched:false,credit:0,parent:null,
      offset:0,spawnTime:this.clock,origin,direct:true,definitionOverride,quaternion});
  }
  reset(): void {
    this.particles.length = 0; this.clock = this.carry = this.nextId = this.dropped = this.queueDrops = 0; this.randomState = this.seed || 1;
    this.soundRandomState = (this.seed ^ 0x9e3779b9) || 1; this.copyToggle = 0;
    this.directCredits.clear(); this.queuedLaunches.length = 0; this.soundEvents.length = 0;
    this.auxiliaryParticles.length = 0; this.auxiliaryDrops = 0;
    for (const state of this.states) {
      state.active = !state.item.flags?.includes('start-dead'); state.launched = false; state.credit = 0; state.parent = null;
      state.offset = state.item.offset ?? 0; state.spawnTime = -30000;
    }
  }
}
