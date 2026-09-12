const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => { const t=clamp(n,0,1); return t*t*(3-2*t); };

export interface SkateBodyMotionInput {
  grounded: boolean;
  charge: number;
  verticalVelocity: number;
  launchVelocity: number;
  contactBounce: number;
  mount: number;
}

/** Nominal knee flex for the dimension/contact solve, not a root scale.
 * These are presentation phases; neither the spring nor its clock moves physics. */
export function skateBodyFlexTarget(p: SkateBodyMotionInput): number {
  if (p.grounded) return clamp(.65 + .45*smooth(p.charge) + .24*p.mount + .55*p.contactBounce, .62, 1.24);
  const launch = Math.max(1, Math.abs(p.launchVelocity));
  if (p.verticalVelocity > 0) {
    const rise = 1-clamp(p.verticalVelocity/launch,0,1);
    return .62 + .40*smooth((rise-.35)/.65); // extend out of load, gather at apex
  }
  return 1.02 - .27*smooth(-p.verticalVelocity/launch); // relax into the catch
}

/** Exact damped-spring step gives charge/release and landing a soft overshoot
 * without an FPS-dependent Euler simulation or a second squash layer. */
export class SkateBodySpring {
  value = .65;
  private velocity = 0;
  reset(charge = 0): void { this.value = .65+.45*smooth(charge); this.velocity = 0; }
  step(dt: number, input: SkateBodyMotionInput): number {
    const target = skateBodyFlexTarget(input);
    const t = clamp(Number.isFinite(dt)?dt:0,0,.1);
    const omega = 2*Math.PI*4.5, decay = omega*.7, frequency = omega*Math.sqrt(1-.7*.7);
    const x = this.value-target, v = this.velocity;
    const envelope = Math.exp(-decay*t), c = Math.cos(frequency*t), s = Math.sin(frequency*t);
    this.value = target + envelope*(x*c+(v+decay*x)/frequency*s);
    this.velocity = envelope*(v*c-(decay*v+omega*omega*x)/frequency*s);
    const bounded = clamp(this.value,.62,1.24);
    if (bounded!==this.value) this.velocity=0;
    return this.value=bounded;
  }
}
