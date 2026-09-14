const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const smooth = (n: number) => { const t=clamp(n,0,1); return t*t*(3-2*t); };

export const SKATE_REVERT_DURATION = .52;
/** One grounded half-turn: crouch into the slide, then rise in the new stance. */
export function sampleSkateRevert(age:number) {
  const u=clamp(age/SKATE_REVERT_DURATION,0,1);
  const ease=(n:number)=>{const t=clamp(n,0,1);return t*t*t*(10+t*(-15+6*t));};
  const charge=ease(u/.20)*(1-ease((u-.48)/.44));
  const settle=clamp((u-.44)/.56,0,1);
  const rebound=Math.sin(3*Math.PI*settle)*Math.exp(-2.5*settle)*ease(settle/.10)*(1-ease((settle-.78)/.22));
  const reach=ease(u/.24)*(1-ease((u-.58)/.42));
  return {turn:ease((u-.16)/.68),knee:clamp(charge-.20*rebound,0,1),
    reach,compression:clamp(charge-.12*rebound,0,1),rebound};
}

/** Presentation-only balance corrections. Integrate phase so a changing
 * balance value cannot multiply the entire run clock into a vibrating arm. */
export class SkateBalanceArms {
  private phase=0;
  private weight=0;
  private danger=0;
  private critical=0;
  private tilt=0;
  reset():void {this.phase=this.weight=this.danger=this.critical=this.tilt=0;}
  step(dt:number,active:boolean,balance:number,pegged:boolean) {
    const ease=1-Math.exp(-8*Math.max(0,dt));
    this.weight+=((active?1:0)-this.weight)*ease;
    this.danger+=(smooth((Math.abs(balance)-.35)/.65)-this.danger)*ease;
    this.critical+=((active&&pegged?1:0)-this.critical)*ease;
    this.tilt+=((active?clamp(balance,-1,1):0)-this.tilt)*ease;
    this.phase=(this.phase+Math.PI*2*(1.10+.45*this.danger+.15*this.critical)*Math.max(0,dt))%(Math.PI*2);
    const amplitude=(.10*this.danger+.12*this.danger*this.danger+.05*this.critical)*this.weight;
    return {tilt:this.tilt,swing:Math.sin(this.phase)*amplitude};
  }
}

// The rail anchor and its clearance probe share the deeper hanging position.
export const SKATE_UNDER_RAIL_DEPTH = 3.15;
export const SKATE_UNDER_RAIL_HEADROOM = .17;
export const SKATE_UNDER_RAIL_TRANSITION = .48;

/** Overlapping turn/drop/reach, with a finite elastic catch. The pelvis
 * falls vertically; the torso ducks past the coping as the board glides ahead. */
export function sampleUnderRailMotion(progress:number,returning=false,releasing=false) {
  const u=clamp(progress,0,1),r=1-u;
  if(releasing)return {
    boardTurn:1-smooth((r-.20)/.80),boardSwing:smooth(r/.24)*(1-smooth((r-.80)/.20)),bodyDrop:smooth(u),swing:0,hop:0,dip:0,
    footContact:smooth((r-.90)/.10),airFeet:0,handContact:1-smooth(r/.16),
    armReach:1-smooth(r/.55),armExtra:0,
    torsoDuck:0,boardAdvance:0,springY:0,phase:'release',
  };
  if(returning)return {
    boardTurn:1-smooth(r/.85),boardSwing:0,bodyDrop:1-smooth(smooth(r/.9)),
    swing:0,hop:0,dip:0,
    footContact:smooth((r-.78)/.22),airFeet:smooth(r/.12)*(1-smooth((r-.78)/.22)),handContact:1-smooth(r/.30),
    armReach:1-smooth(r/.8),armExtra:1.2*Math.sin(Math.PI*clamp(r/.65,0,1)),
    torsoDuck:smooth(r/.12)*(1-smooth((r-.70)/.30)),
    boardAdvance:1.15*smooth(r/.16)*(1-smooth((r-.75)/.25)),springY:0,
    phase:'return',
  };
  const settle=clamp((u-.58)/.42,0,1);
  const pulse=Math.sin(3*Math.PI*settle)*Math.exp(-3*settle)*(1-smooth((settle-.70)/.30));
  const springY=pulse>=0?-.27*pulse:-.10*pulse;
  return {
    boardTurn:smooth(u/.30),boardSwing:0,bodyDrop:smooth(smooth(u/.58)),
    swing:0,hop:0,dip:0,
    footContact:1-smooth(u/.12),airFeet:smooth(u/.10)*(1-smooth((u-.62)/.38)),handContact:smooth((u-.12)/.52),
    armReach:smooth(u/.62),armExtra:.35*Math.sin(Math.PI*smooth(u/.70))+.6*Math.max(0,-springY),
    torsoDuck:smooth(u/.18)*(1-smooth((u-.38)/.22)),
    boardAdvance:1.15*smooth(u/.12)*(1-smooth((u-.42)/.24)),springY,
    phase:u<.58?'drop':u<1?'catch':'hang',
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
