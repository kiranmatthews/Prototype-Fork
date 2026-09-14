const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => { const t=clamp(n,0,1); return t*t*(3-2*t); };

export const SKATE_REVERT_DURATION = .52;
/** One half-turn: load, unweight, turn, then cushion the new stance. */
export function sampleSkateRevert(age:number) {
  const u=clamp(age/SKATE_REVERT_DURATION,0,1);
  const air=clamp((u-.12)/.76,0,1),lift=.22*Math.sin(Math.PI*air);
  const load=Math.sin(Math.PI*clamp(u/.24,0,1));
  const land=Math.sin(Math.PI*clamp((u-.80)/.20,0,1));
  const reach=smooth((u-.12)/.18)*(1-smooth((u-.74)/.24));
  return {turn:smooth((u-.14)/.66),lift,knee:.65*load+.70*reach+.70*land,
    reach,compression:load+.6*land,rebound:Math.sin(Math.PI*clamp((u-.92)/.08,0,1))};
}

// The rail anchor and its clearance probe share the deeper hanging position.
export const SKATE_UNDER_RAIL_DEPTH = 3.15;
export const SKATE_UNDER_RAIL_HEADROOM = .17;

/** Foot flick → hop clear → descend beside the rail → late truck catch.
 * Return and release have their own contact timing; they are not backwards
 * playback of the catch. Values drive both the native anchor and the rig. */
export function sampleUnderRailMotion(progress:number,returning=false,releasing=false) {
  const u=clamp(progress,0,1),r=1-u;
  if(releasing)return {
    boardTurn:1-smooth((r-.20)/.80),boardSwing:smooth(r/.24)*(1-smooth((r-.80)/.20)),bodyDrop:smooth(u),swing:0,hop:0,dip:0,
    footContact:smooth((r-.90)/.10),airFeet:0,handContact:1-smooth(r/.16),
    armReach:1-smooth(r/.55),armExtra:0,
    phase:'release',
  };
  if(returning)return {
    boardTurn:1-smooth((r-.76)/.24),boardSwing:0,bodyDrop:1-smooth((r-.20)/.50),
    swing:smooth(r/.25)*(1-smooth((r-.70)/.20)),hop:0,dip:0,
    footContact:smooth((r-.75)/.18),airFeet:smooth((r-.50)/.16)*(1-smooth((r-.82)/.15)),handContact:1-smooth((r-.48)/.16),
    armReach:1-smooth((r-.60)/.30),armExtra:1.2*Math.sin(Math.PI*clamp(r/.65,0,1)),
    phase:'return',
  };
  return {
    boardTurn:smooth(u/.28),boardSwing:0,bodyDrop:smooth((u-.38)/.34),
    swing:smooth((u-.20)/.20)*(1-smooth((u-.74)/.20)),
    hop:Math.sin(Math.PI*clamp((u-.18)/.28,0,1)),dip:Math.sin(Math.PI*clamp((u-.70)/.30,0,1)),
    footContact:1-smooth((u-.28)/.10),airFeet:smooth((u-.28)/.10)*(1-smooth((u-.74)/.20)),handContact:smooth((u-.83)/.12),
    armReach:smooth((u-.65)/.28),armExtra:0,
    phase:u<.28?'flick':u<.83?'jump':u<.96?'catch':'hang',
  };
}

export interface SkateBodyMotionInput {
  grounded: boolean;
  charge: number;
  verticalVelocity: number;
  launchVelocity: number;
  contactBounce: number;
  mount: number;
  manual?: boolean;
}

/** Nominal knee flex for the dimension/contact solve, not a root scale.
 * These are presentation phases; neither the spring nor its clock moves physics. */
export function skateBodyFlexTarget(p: SkateBodyMotionInput): number {
  if (p.grounded) return clamp((p.manual ? .55 : .65) + .45*smooth(p.charge) + .24*p.mount + .55*p.contactBounce, .52, 1.24);
  const launch = Math.max(1, Math.abs(p.launchVelocity));
  if (p.verticalVelocity > 0) {
    const rise = 1-clamp(p.verticalVelocity/launch,0,1);
    return .62 + .40*smooth((rise-.35)/.65); // extend out of load, gather at apex
  }
  return 1.02 - .27*smooth(-p.verticalVelocity/launch); // relax into the catch
}

/** Pop the physical nose, hold that uphill attitude through ascent, then
 * slide the front foot forward to level around the apex. */
export function skateOlliePitch(age: number, verticalVelocity: number, launchVelocity: number): number {
  const ascent = verticalVelocity / Math.max(1, Math.abs(launchVelocity));
  return -.55 * smooth(age / .05) * smooth((ascent + .12) / .38);
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
    const bounded = clamp(this.value,input.manual ? .52 : .62,1.24);
    if (bounded!==this.value) this.velocity=0;
    return this.value=bounded;
  }
}
