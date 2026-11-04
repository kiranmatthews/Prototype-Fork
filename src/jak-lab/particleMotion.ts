import {Euler, Quaternion, Vector3} from 'three';
import type {EffectDefinition, EffectItem, ParticleDefinition, ParticleField} from './types';

const ANGLE = Math.PI * 2 / 65536;
export const PARTICLE_STEP = 1 / 60;
const STEP_TICKS = 5;
type Values = Record<string, number>;
export interface LabParticle {
  id: number; alive: boolean; texture: string; values: Values; flags: Set<string>;
  position: Vector3; orientation: Quaternion; orbit: Quaternion; radius: number;
  parent: LabParticle | null; child: LaunchState | null; is3d: boolean;
  callback: string; birth: string; age: number;
  blend: 'normal' | 'additive' | 'subtractive'; depthWrite: boolean;
}
interface LaunchState {
  item: EffectItem; active: boolean; launched: boolean; credit: number;
  parent: LabParticle | null; offset: number; spawnTime: number;
}
const KNOWN_CALLBACKS = new Set(['sparticle-track-root', 'sparticle-track-root-prim',
  'part-tracker-track-root', 'eco-fadeout', 'eco-track-root-prim-fadeout']);
const KNOWN_BIRTH = new Set(['birth-func-random-next-time', 'birth-func-y->userdata',
  'birth-func-copy-rot-color', 'birth-func-copy-omega-to-z']);
const ZERO = new Vector3();

/** Source numeric field rules and launch graph. Units remain GOAL units until
 * rendering: 4096 units/metre, 65536/turn, 300 ticks/second. Context-dependent
 * callbacks are reported explicitly until their host-object ports exist. */
export class ParticleMotion {
  readonly particles: LabParticle[] = [];
  readonly issues = new Set<string>();
  readonly textureIds = new Set<string>();
  readonly referencedParticleIds = new Set<number>();
  clock = 0;
  dropped = 0;
  hour = 12;
  cameraDistance = 0; // GOAL units; zero disables distance attenuation in the lab.
  private readonly states: LaunchState[];
  private randomState: number;
  private nextId = 0;
  private carry = 0;
  private readonly vector = new Vector3();
  private readonly turn = new Quaternion();

  constructor(readonly group: EffectDefinition, readonly definitions: Map<number, ParticleDefinition>,
    readonly capacity = 12000, readonly seed = 1) {
    this.randomState = seed || 1;
    this.states = group.items.map(item => ({item, active: !item.flags?.includes('start-dead'),
      launched: false, credit: 0, parent: null, offset: item.offset ?? 0, spawnTime: -30000}));
    const seen = this.referencedParticleIds;
    const visit = (id: number) => {
      if (seen.has(id)) return; seen.add(id);
      const definition = definitions.get(id);
      if (!definition) {this.issues.add(`Empty source launcher ${id}`); return;}
      for (const field of definition.fields) {
        if (field.field === 'texture') this.textureIds.add(String(field.value));
        if (field.field === 'func' && !KNOWN_CALLBACKS.has(String(field.value))) this.issues.add(`Host callback: ${field.value}`);
        if (field.field === 'birth-func' && !KNOWN_BIRTH.has(String(field.value))) this.issues.add(`Birth callback: ${field.value}`);
        if (field.field === 'flags' && (field.value as string[]).includes('aux-list')) this.issues.add('Sprite auxiliary geometry');
        if (field.field === 'flags' && (field.value as string[]).includes('bit12')) this.issues.add('Time-of-day host colour');
        if (field.field === 'next-launcher') visit(field.base ?? 0);
      }
    };
    group.items.forEach(item => visit(item.particle));
    if (group.flags?.includes('screen-space')) this.issues.add('Screen-space host layout');
  }
  private random(): number {
    let value = this.randomState;
    value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
    this.randomState = value >>> 0; return this.randomState / 4294967296;
  }
  private evaluate(field: ParticleField, values: Values): number {
    if (field.op === 'copy') return values[String(field.value)] ?? 0;
    let random = field.range ? this.random() * (field.range + (field.op === 'float-int' ? 1 : 0)) : 0;
    if (field.op === 'int' || field.op === 'float-int') random = Math.trunc(random);
    return Math.fround((field.base ?? 0) + random * (field.mult ?? 1));
  }
  private assign(particle: LabParticle, definition: ParticleDefinition, relaunch = false): void {
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
  private spawn(state: LaunchState, rate = 1): void {
    const definition = this.definitions.get(state.item.particle); if (!definition) return;
    const num = definition.fields.find(field => field.field === 'num');
    if (!num) return;
    state.credit += this.evaluate(num, {}) * rate;
    this.launchCredit(state, definition);
  }
  private launchCredit(state: LaunchState, definition: ParticleDefinition): void {
    while (state.credit >= 1) {
      state.credit--;
      if (this.particles.length >= this.capacity) {this.dropped++; continue;}
      const p: LabParticle = {id: ++this.nextId, alive: true, texture: '', values: {}, flags: new Set(),
        position: new Vector3(), orientation: new Quaternion(), orbit: new Quaternion(), radius: 0,
        parent: state.parent, child: null, is3d: state.item.flags?.includes('is-3d') ?? false,
        callback: '', birth: '', age: 0, blend: 'normal', depthWrite: false};
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
      p.position.add(p.parent?.position ?? ZERO);
      this.birth(p);
      if (state.item.binding) {
        const child = this.states.find(candidate => candidate.item.particle === state.item.binding && !candidate.active);
        if (child) {child.active = true; child.launched = false; child.parent = p; p.child = child;}
      }
      this.particles.push(p);
    }
  }
  private birth(p: LabParticle): void {
    const v = p.values;
    if (p.birth === 'birth-func-random-next-time') v['next-time'] = Math.trunc(this.random() * (v.userdata ?? 0));
    if (p.birth === 'birth-func-y->userdata') v.userdata = (v.userdata ?? 0) + p.position.y;
    if (p.birth === 'birth-func-copy-rot-color' && p.parent) {
      p.orientation.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (p.parent.values['rot-z'] ?? 0) * ANGLE));
      for (const channel of ['r', 'g', 'b']) v[channel] = p.parent.values[channel];
    }
    if (p.birth === 'birth-func-copy-omega-to-z' && p.parent) {
      v['rot-z'] = -16384 + (v.omega ?? 0);
      v['next-time'] = p.parent.values['next-time']; v['scale-x'] = 163.85638 * v['next-time'];
    }
  }
  private retire(particle: LabParticle): void {
    particle.alive = false;
    if (particle.child) {particle.child.active = false; particle.child.parent = null; particle.child.launched = false;}
  }
  private step(): void {
    const previous = this.clock; this.clock += STEP_TICKS;
    // Source group launchers run in reverse order. A newly bound child can
    // therefore emit no earlier than the next group pass.
    for (let index = this.states.length - 1; index >= 0; index--) {
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
      if (p.callback.includes('track-root')) p.position.copy(ZERO);
      if (p.callback === 'eco-fadeout' || p.callback === 'eco-track-root-prim-fadeout') v['next-time'] = 10;
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
  reset(): void {
    this.particles.length = 0; this.clock = this.carry = this.nextId = this.dropped = 0; this.randomState = this.seed || 1;
    for (const state of this.states) {
      state.active = !state.item.flags?.includes('start-dead'); state.launched = false; state.credit = 0; state.parent = null;
      state.offset = state.item.offset ?? 0; state.spawnTime = -30000;
    }
  }
}
