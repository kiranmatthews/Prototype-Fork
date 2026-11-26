// RUNNING UP A VERT ON FOOT.
//
// A walker who runs up a transition that ends vertical runs out of slope: past
// about 60° a running foot no longer holds. By then the run has him up on the
// wall with his pelvis some 1.5 m above that point, and what happens next
// depends on one measurement, the height of the lip above it:
//
//   up to 3.0 m   he CLIMBS OUT. That is a lip he can get his hands on from
//                 where the wall stops his run: a step up the wall, a hand
//                 and then the other on the coping, over it between his arms,
//                 and he is running on the deck. (A plain quarter's lip is at
//                 his hips by then, and it is a vault; a lip at the top of the
//                 band is two steps up the wall and a mantle.)
//   up to 3.9 m   he LEAPS and catches the lip at the top of the jump, at the
//                 full stretch of his arms, sags onto them, and hangs: from
//                 there it is the game's own ledge hang and clamber;
//   higher        he leaps the same metre, comes up short, slides down the
//                 wall watching the lip get away, is thrown over backwards by
//                 the transition, and rolls right over, out along the flat,
//                 onto his feet again.
//
// Everything here is plain geometry in the wall's own plane (`s` = metres
// toward the wall along the ground, `y` = world height) and plain numbers, so
// it can be measured without a renderer. The Player samples the real surface
// into a `VertWall`, asks for a plan, and each step reads one frame off it:
// where the pelvis is drawn, where the controller point is, how far through
// its clip the pose is, and what the hands and feet are holding.

export type VertRunOutcome = 'climb' | 'grab' | 'miss';

export const VERT_RUN_UP = {
  /** A running foot holds to a 60° wall: a surface normal with less y than this is "the vertical part". */
  runOutNormalY: 0.5,
  /** He has to be going up the wall at least this fast (m/s over the ground), with the stick held up it. */
  minSpeed: 4,
  /** A lip this far above the run-out point, or nearer, is climbed out of: he can get his hands on it from there. */
  climbRise: 3.0,
  /** A lip this far above it, or nearer, is leapt for and caught; higher is leapt for and missed.
   * (Where he stands on the wall, the metre of his leap, and the length of him from pelvis to fingers.) */
  grabRise: 3.9,
  /** Where the run has his pelvis when the wall stops it: this far above the run-out point. */
  stanceHips: 1.5,
  /** Running, his head leads his pelvis by this much and its centre is this far above the controller
   * point. Under a face that stands up straight the move begins before the run would put it in the wall. */
  headLead: 0.5,
  headOver: 2.7,
  /** What the spring off the wall is worth: how far a miss lifts his pelvis. */
  leapRise: 1.0,
  /** Standable deck there has to be behind the lip for it to be a ledge he can take: to climb out onto, or to hang from. */
  landingDepth: 0.9,
  /** A lip with no ledge behind it (a spine, a wall going on up, a top with no room on it) that is
   * no higher than this is left alone; higher, and he goes for it and comes up short. (At his hips
   * when the wall stops his run: under that there is nothing to leap for.) */
  vaultRise: 1.5,
  /** Pelvis height standing, and how far it sits out from a wall he is pressed to. */
  hipStand: 0.95,
  hipOut: 0.36,
  /** Sat back off the wall to load a leap: far enough that his head and knees have room. */
  loadOut: 0.66,
  /** At full stretch his grip is this far over his pelvis (measured on him): as high as a miss gets it. */
  reachDrop: 1.60,
  /** A grab takes the lip at the top of the jump with his pelvis this far under it; then his weight
   * comes onto his arms and he sags this far under it. Both are within his reach with no stretch in
   * his arms at all (1.45 m, measured on him): the stretch the clip puts into the catch is over and
   * above it, and is let out again before the hang takes him. (The game's own hang, with his
   * shoulders pulled up round his ears, lets him down further.) */
  catchDrop: 1.40,
  deadHang: 1.45,
  /** The sag takes this long. */
  sagSeconds: 0.08,
  /** A vert's coping is flush with the face under it, so there he hangs this far out from it. */
  hangOut: 0.32,
  /** The game's own ledge catch has a body at its dead hang this many seconds in (measured on it):
   * the leap hands him to it there, and what follows is its own pull up onto bent arms. */
  catchSettleFrom: 0.10,
  /** The leap is a throw: up at one speed and slowing all the way to the top, under this (m/s²). */
  leapGravity: 13,
  /** How long he takes to load his legs against the wall for it. */
  loadSeconds: 0.14,
  /** The fall back down is drawn under a softer gravity than the game's, so it can be read. */
  slideGravity: 21,
  /** Friction sliding down the face, rolling round the transition, and tumbling to a stop on the flat; drag per m/s. */
  slideFriction: 0.32,
  rollFriction: 0.16,
  tumbleFriction: 0.80,
  slideDrag: 0.55,
  /** Standing up out of the crouch the roll lands him in. */
  recoverSeconds: 0.34,
  /** A planted foot holds until the pelvis is this far from it (his leg, to the sole), and is gone a little past it. */
  legReach: 0.96,
  /** He runs on from a climb at this speed (m/s): what the mantle leaves him with. */
  climbExitSpeed: 4.4,
  /** His head, as the ball it very nearly is: its centre this far up from the head joint, and its radius. */
  headUp: 0.27,
  headRadius: 0.36,
  /** Where the plan's own moments sit on each clip (0..1): the poses are authored to these. */
  climb: { hands: 0.26, over: 0.58 },
  leap: { load: 0.25, catch: 0.86 },
  miss: { leap: 0.20, slide: 0.30, tumble: 0.86 },
} as const;

/**
 * The roll back, through the tumble beat (0..1): how far over backwards he has
 * gone (radians; a quarter turn is flat on his back, a whole turn is on his
 * feet again) and how far his pelvis rides off the ground there. He is thrown
 * back onto his seat, rolls on up his back and over his shoulders with his
 * knees at his chest, and his feet come down under him. His head is 0.8 m
 * across: going over it lifts his pelvis most of a metre, which is where the
 * heights come from. The clip takes its body pitch from this table and the
 * plan takes the pelvis height from it, so the two cannot drift apart.
 */
export const VERT_MISS_ROLL: readonly { at: number; back: number; off: number }[] = [
  { at: 0, back: 0.22, off: 0.44 },    // feet caught on the transition, knees gone
  { at: 0.12, back: 0.95, off: 0.34 }, // going over backwards
  { at: 0.24, back: 1.42, off: 0.22 }, // the seat hits
  { at: 0.40, back: 2.40, off: 0.58 }, // up his back onto his shoulders
  { at: 0.54, back: 3.25, off: 1.04 }, // over the top, on one shoulder and both hands, his head turned out of the way
  { at: 0.70, back: 4.10, off: 1.42 }, // piked over his hands, hips at their highest
  { at: 0.80, back: 4.80, off: 1.22 }, // feet down under him, his hands leaving the ground
  { at: 0.90, back: 5.65, off: 0.94 }, // the trunk coming up
  { at: 1, back: 6.12, off: 0.86 },    // on his feet, knees soft, nearly upright
];

/**
 * Which of the three it is, from the lip's height above the run-out point:
 * that one number, and whether there is a ledge up there at all. A top he
 * could not stand on or hang from (two verts back to back, a wall that goes on
 * up, a deck with something on it) is not a ledge: whatever its height, he
 * comes up short.
 */
export function vertRunOutcome(rise: number, ledge = true): VertRunOutcome {
  if (!ledge) return 'miss';
  return rise <= VERT_RUN_UP.climbRise ? 'climb' : rise <= VERT_RUN_UP.grabRise ? 'grab' : 'miss';
}

const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
const smooth = (v: number): number => { const t = clamp(v); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export interface WallPoint { s: number; y: number }

/**
 * The wall as it was sampled: the flat in front of it, the transition, any
 * straight vertical section, and the coping, as one line in (s, y). Lengths
 * are measured along that line from its first point (out on the flat).
 */
export class VertWall {
  readonly s: number[] = [];
  readonly y: number[] = [];
  readonly len: number[] = [];
  /** The coping. */
  readonly lipS: number;
  readonly lipY: number;
  readonly lipLen: number;
  /** Where the flat ends and the transition begins. */
  readonly footLen: number;
  readonly footS: number;
  readonly footY: number;
  /** The last place a running foot holds: where the surface passes 60°. */
  readonly runOutLen: number;
  readonly runOutS: number;
  readonly runOutY: number;
  /** Standable deck behind the lip, metres. */
  readonly deck: number;

  /**
   * `points` run from out on the flat up to the lip, in order; a straight
   * vertical section is two points at one `s`. The last point is the lip.
   */
  constructor(points: readonly WallPoint[], deck: number) {
    if (points.length < 3) throw new Error('a wall needs at least three sampled points');
    let total = 0;
    for (let i = 0; i < points.length; i++) {
      if (i > 0) total += Math.hypot(points[i].s - points[i - 1].s, points[i].y - points[i - 1].y);
      this.s.push(points[i].s); this.y.push(points[i].y); this.len.push(total);
    }
    const last = points.length - 1;
    this.lipS = this.s[last]; this.lipY = this.y[last]; this.lipLen = total;
    this.deck = deck;
    // The foot: the last point still on the flat (rising less than 4° to the next).
    let foot = 0;
    for (let i = 0; i < last; i++) {
      if (Math.atan2(this.y[i + 1] - this.y[i], Math.max(1e-6, this.s[i + 1] - this.s[i])) < 0.07) foot = i + 1; else break;
    }
    foot = Math.min(foot, last - 1);
    this.footLen = this.len[foot]; this.footS = this.s[foot]; this.footY = this.y[foot];
    // A drawn transition is a run of flat facets, and the looks down at it were taken every few
    // centimetres. How steep the wall is at a point is read between the MIDDLES of its facets, so
    // a wall of eight facets and a wall of eighty give the same answer: the curve they both stand for.
    const runs: { from: number; to: number }[] = [];
    let from = 0;
    for (let i = 0; i <= last; i++) {
      if (i < last && Math.abs(this.segmentSlope(i) - this.segmentSlope(from)) <= 0.03) continue;
      if (i > from) runs.push({ from, to: i });
      from = i;
    }
    runs.forEach((run, k) => {
      // One look that straddles the corner between two broad facets has a slope that belongs to
      // neither of them: it is left out. (Where the facets are no broader than the looks, every
      // run is a single look and each is as good as its neighbours.)
      const single = run.to - run.from === 1 && this.s[run.to] - this.s[run.from] > 1e-6;
      const between = k > 0 && k < runs.length - 1 && runs[k - 1].to - runs[k - 1].from >= 2 && runs[k + 1].to - runs[k + 1].from >= 2;
      if (single && between) return;
      this.knotLen.push((this.len[run.from] + this.len[run.to]) / 2); this.knotSlope.push(this.segmentSlope(run.from));
    });
    // The run-out point: the first place, going up, where the wall is steeper than 60°.
    const limit = Math.acos(VERT_RUN_UP.runOutNormalY);
    let runOut = this.lipLen;
    for (let k = 0; k < this.knotLen.length; k++) {
      if (this.knotLen[k] < this.footLen || this.knotSlope[k] < limit) continue;
      const before = k > 0 ? this.knotSlope[k - 1] : 0, prior = k > 0 ? this.knotLen[k - 1] : this.footLen;
      runOut = this.knotSlope[k] - before > 1e-6 ? lerp(prior, this.knotLen[k], clamp((limit - before) / (this.knotSlope[k] - before))) : this.knotLen[k];
      break;
    }
    this.runOutLen = Math.max(this.footLen, runOut);
    const at = this.at(this.runOutLen);
    this.runOutS = at.s; this.runOutY = at.y;
  }

  private readonly knotLen: number[] = [];
  private readonly knotSlope: number[] = [];

  /** How steep the wall is at a length along it: 0 on the flat, π/2 on a vertical face. */
  slopeAt(len: number): number {
    const K = this.knotLen, n = K.length;
    if (n === 0) return 0;
    if (len <= K[0]) return this.knotSlope[0];
    if (len >= K[n - 1]) return this.knotSlope[n - 1];
    let i = 0;
    while (i < n - 2 && len > K[i + 1]) i++;
    return lerp(this.knotSlope[i], this.knotSlope[i + 1], clamp((len - K[i]) / Math.max(1e-9, K[i + 1] - K[i])));
  }

  private segmentSlope(i: number): number {
    return Math.atan2(this.y[i + 1] - this.y[i], Math.max(0, this.s[i + 1] - this.s[i]));
  }

  /** The lip's height above the last place a running foot holds. */
  get rise(): number { return this.lipY - this.runOutY; }

  private segmentAt(len: number): number {
    const l = clamp(len, 0, this.lipLen);
    let lo = 0, hi = this.len.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.len[mid] <= l) lo = mid; else hi = mid; }
    return lo;
  }

  /** The surface at a length along it: the point, and how steep it is there (0 flat, π/2 vertical). */
  at(len: number, out: { s: number; y: number; slope: number } = { s: 0, y: 0, slope: 0 }): { s: number; y: number; slope: number } {
    const l = clamp(len, 0, this.lipLen), i = this.segmentAt(l);
    const span = this.len[i + 1] - this.len[i], t = span > 1e-9 ? (l - this.len[i]) / span : 0;
    out.s = lerp(this.s[i], this.s[i + 1], t); out.y = lerp(this.y[i], this.y[i + 1], t);
    out.slope = this.slopeAt(l);
    return out;
  }

  /** How far along the line the surface is at a height (on the flat: its near end). */
  lenAtY(y: number): number {
    if (y <= this.footY) return this.footLen;
    if (y >= this.lipY) return this.lipLen;
    for (let i = 0; i < this.y.length - 1; i++) {
      if (this.y[i + 1] >= y && this.y[i + 1] > this.y[i]) return lerp(this.len[i], this.len[i + 1], clamp((y - this.y[i]) / (this.y[i + 1] - this.y[i])));
    }
    return this.lipLen;
  }

  /** How far along the line the surface is under a point on the ground (`s`), short of the lip. */
  lenAtS(s: number): number {
    if (s <= this.s[0]) return 0;
    for (let i = 0; i < this.s.length - 1; i++) {
      if (this.s[i + 1] >= s && this.s[i + 1] > this.s[i]) return lerp(this.len[i], this.len[i + 1], clamp((s - this.s[i]) / (this.s[i + 1] - this.s[i])));
    }
    return this.lipLen;
  }

  /** Where the wall's face is at a height: the surface, or the lip's own `s` above the curve. */
  faceAt(y: number): number {
    if (y >= this.lipY) return this.lipS;
    if (y <= this.footY) return this.footS;
    return this.at(this.lenAtY(y)).s;
  }

  /** The height of the ground under a point: the surface, or the deck behind the lip. */
  groundAt(s: number): number {
    if (s >= this.lipS) return this.lipY;
    if (s <= this.s[0]) return this.y[0];
    for (let i = 0; i < this.s.length - 1; i++) {
      if (this.s[i + 1] >= s && this.s[i + 1] > this.s[i]) return lerp(this.y[i], this.y[i + 1], clamp((s - this.s[i]) / (this.s[i + 1] - this.s[i])));
    }
    return this.lipY;
  }
}

/** One hold: how firmly (0..1), and where. */
export interface VertRunHold { weight: number; s: number; y: number }

/** What one instant of the run-up looks like. */
export interface VertRunFrame {
  done: boolean;
  /** How far through its clip the pose is, 0..1. */
  progress: number;
  /** The beat he is in: for a footfall, a slap, a thud. */
  beat: VertRunBeat;
  /** Where the pelvis is drawn. */
  hipS: number; hipY: number;
  /** Where the controller point is. */
  posS: number; posY: number;
  /** Both hands (they hold the same line), then the leading foot and the trailing one. */
  hands: VertRunHold;
  /** How firmly the second hand has it: it arrives a moment after the first. */
  secondHand: number;
  /** How much his eyes are on the lip (0..1): it is wherever this wall has it, over his head or down at his knees. */
  look: number;
  feet: [VertRunHold, VertRunHold];
  /** Metres per second the pelvis is moving, for dust and for the hand-over at the end. */
  velS: number; velY: number;
}
export type VertRunBeat = 'step' | 'press' | 'over' | 'leap' | 'catch' | 'reach' | 'slide' | 'tumble' | 'rise';

export function emptyVertRunFrame(): VertRunFrame {
  return { done: false, progress: 0, beat: 'step', hipS: 0, hipY: 0, posS: 0, posY: 0,
    hands: { weight: 0, s: 0, y: 0 }, secondHand: 0, look: 0, feet: [{ weight: 0, s: 0, y: 0 }, { weight: 0, s: 0, y: 0 }], velS: 0, velY: 0 };
}

export interface VertRunStart {
  /** Where on the wall his feet are when it begins. */
  len: number;
  /** Where his pelvis is drawn at that moment, and how fast it is going. */
  hipS: number; hipY: number;
  velS: number; velY: number;
  /** How far out from a lip the game's hang holds the controller point, and how far under. */
  hangSkin: number;
  hangDepth: number;
  /** False when there is nothing behind the lip to stand on or hang from: the wall is only ever come up short on. */
  ledge?: boolean;
  /**
   * He did not run up it: he met the face in the air (a jump at the wall, a
   * drop from its lip) with the lip out of his reach. There is no leap in it.
   * It begins where the come-up-short's slide does, from wherever his pelvis
   * is: down the face, round the transition, and over backwards onto his feet.
   */
  fromAir?: boolean;
}

/**
 * A smooth curve through keyed values (monotone cubic: it never overshoots a
 * key, and its speed is continuous through every one of them). The clips are
 * built with the same curve, so a table read here and a pose keyed there agree
 * between the keys as well as on them.
 */
export function throughKeys(at: readonly number[], values: readonly number[], x: number): number {
  const n = at.length;
  if (x <= at[0]) return values[0];
  if (x >= at[n - 1]) return values[n - 1];
  let i = 0;
  while (i < n - 2 && x > at[i + 1]) i++;
  const span = at[i + 1] - at[i], t = clamp((x - at[i]) / span);
  const slope = (k: number): number => {
    if (k === 0 || k === n - 1) return 0;
    const a = (values[k] - values[k - 1]) / (at[k] - at[k - 1]), b = (values[k + 1] - values[k]) / (at[k + 1] - at[k]);
    return a * b <= 0 ? 0 : 2 * a * b / (a + b);
  };
  return (2 * t * t * t - 3 * t * t + 1) * values[i] + (t * t * t - 2 * t * t + t) * span * slope(i) +
    (-2 * t * t * t + 3 * t * t) * values[i + 1] + (t * t * t - t * t) * span * slope(i + 1);
}
const ROLL_AT = VERT_MISS_ROLL.map(key => key.at), ROLL_OFF = VERT_MISS_ROLL.map(key => key.off);

/** How far through a leap the hands take the lip. */
const LEAP_CATCH = VERT_RUN_UP.leap.catch;

/** One point of a timed path, with the velocity it is passed at. */
interface Key { t: number; s: number; y: number; vs: number; vy: number }

/** Cubic Hermite between two keys: position and velocity are both continuous across a key. */
function between(a: Key, b: Key, t: number, out: { s: number; y: number; vs: number; vy: number }): void {
  const span = Math.max(1e-6, b.t - a.t), u = clamp((t - a.t) / span);
  const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
  out.s = h00 * a.s + h10 * span * a.vs + h01 * b.s + h11 * span * b.vs;
  out.y = h00 * a.y + h10 * span * a.vy + h01 * b.y + h11 * span * b.vy;
  const d00 = (6 * u * u - 6 * u) / span, d10 = 3 * u * u - 4 * u + 1, d01 = -d00, d11 = 3 * u * u - 2 * u;
  out.vs = d00 * a.s + d10 * a.vs + d01 * b.s + d11 * b.vs;
  out.vy = d00 * a.y + d10 * a.vy + d01 * b.y + d11 * b.vy;
}
function along(keys: readonly Key[], t: number, out: { s: number; y: number; vs: number; vy: number }): void {
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  between(keys[i], keys[i + 1], clamp(t, keys[0].t, keys[keys.length - 1].t), out);
}

/**
 * A planned run-up: fixed the moment it begins, then read frame by frame.
 * Nothing in it is random and nothing depends on the frame rate.
 */
export class VertRunPlan {
  readonly outcome: VertRunOutcome;
  /** Seconds the whole of it takes (for a grab: until the hands have the lip). */
  duration = 0;
  /** Where the controller point ends: on the deck, in the hang, or on the flat he fell back to. */
  endS = 0;
  endY = 0;
  private readonly keys: Key[] = [];
  private readonly scratch = { s: 0, y: 0, vs: 0, vy: 0 };
  private readonly start: VertRunStart;
  private readonly stand: number;
  private readonly startClear: number;
  // the climb: when the hands have the coping, and when he is over it
  private readonly handsAt: number = 0;
  private readonly overAt: number = 0;
  // the leap: when his legs are loaded, and when he is at the top of it
  private readonly loadAt: number = 0;
  private readonly apexAt: number = 0;
  // the miss: its beats, and the slide down the wall worked out ahead of time
  private leapSeconds = 0;
  private slideSeconds = 0;
  private tumbleSeconds = 0;
  private readonly track: { len: number; v: number }[] = [];
  private readonly trackStep = 1 / 120;
  private apexLen = 0;
  private apexHipY = 0;
  private restLen = 0;

  constructor(readonly wall: VertWall, start: VertRunStart) {
    const W = wall, A = VERT_RUN_UP;
    this.start = start;
    this.outcome = start.fromAir ? 'miss' : vertRunOutcome(W.rise, start.ledge !== false);
    this.startClear = start.hipY < W.lipY ? W.faceAt(start.hipY) - start.hipS : Infinity;
    // Where he stands on the wall for it: as high as the run has him, or as high as it would have had him.
    this.stand = Math.max(start.hipY, W.runOutY + A.stanceHips);
    // He arrives going far faster than a body can be read at. What carries into the move is a
    // stride's worth: enough that the first frames go on the way he was going, not enough to
    // throw him past where the move wants him and back.
    const speed = Math.hypot(start.velS, start.velY), keep = speed > 3.4 ? 3.4 / speed : 1;
    const v0s = start.velS * keep, v0y = start.velY * keep;
    const first: Key = { t: 0, s: start.hipS, y: start.hipY, vs: v0s, vy: v0y };
    if (start.fromAir) {
      // Against the face already, with nothing to hold: the fall is all of it.
      this.keys.push(first);
      this.leapSeconds = 0;
      this.planFall(start.hipY, Math.min(6, Math.max(0, -start.velY) * 0.5));
      return;
    }
    if (this.outcome === 'climb') {
      // Hands on the coping. Under a high lip that is a pull-up's worth below it; he has run up a
      // lower one, and has it beside his hips; a lip under his waist he only bends to.
      const y1 = Math.max(start.hipY + 0.05, clamp(start.hipY + 0.30, W.lipY - 0.50, W.lipY + 0.05));
      const s1 = W.faceAt(Math.min(y1, W.lipY - 0.01)) - 0.36, overY = W.lipY + 0.64;
      // A higher lip is a longer run up the wall before the hands can press, and a longer press: each takes what its distance takes.
      const t1 = clamp(Math.hypot(s1 - start.hipS, y1 - start.hipY) / 4.6, 0.10, 0.42);
      const t2 = t1 + clamp((overY - y1) / 5.2, 0.20, 0.30), T = t2 + 0.25;
      const k1: Key = { t: t1, s: s1, y: y1, vs: 0, vy: 0 };
      // over the edge, folded on straight arms
      const k2: Key = { t: t2, s: W.lipS + 0.12, y: overY, vs: 0, vy: 0 };
      // stood up and running
      const k3: Key = { t: T, s: W.lipS + 0.98, y: W.lipY + A.hipStand, vs: A.climbExitSpeed, vy: 0 };
      k1.vs = 0.25 * (k2.s - first.s) / t2; k1.vy = 0.9 * (k2.y - first.y) / t2;
      // He comes over the edge already going the way he will run: one even gathering of speed
      // from there to the stride, never a pause on the deck.
      k2.vs = Math.max(1.2, 2 * (k3.s - k2.s) / (T - t2) - k3.vs); k2.vy = 0.55 * (k3.y - k1.y) / (T - t1);
      this.keys.push(first, k1, k2, k3);
      this.handsAt = t1; this.overAt = t2;
      this.duration = T; this.endS = k3.s; this.endY = W.lipY;
      return;
    }
    // A leap. A beat to load his legs against the wall, then up: thrown from the load at one
    // speed and slowing all the way to the top, as anything thrown does. A grab takes the lip
    // AT the top, at the full stretch of his arms; a miss gets exactly as high as the highest
    // grab would, and the lip is higher.
    const grab = this.outcome === 'grab', stand = this.stand;
    // (a lip he can all but reach from where he stands is still hopped at: he takes it on bent arms and drops the rest;
    // and a miss is a miss, however high the run left him: his fingers never get nearer than a hand's breadth)
    // (and a top with no ledge to it may be within his reach: there he does not sink to stay short of it. He springs
    // a hand's breadth, his palms meet the face under the coping, and there is nothing there to take)
    const apexY = grab ? Math.max(W.lipY - A.catchDrop, stand + 0.06)
      : Math.max(stand + 0.06, Math.min(stand + A.leapRise, W.lipY - A.reachDrop - 0.12));
    // (a lip he can all but reach from where he stands wants a dip of the knees, not a crouch)
    const loadY = stand - lerp(0.12, 0.30, smooth((apexY - stand + 0.1) / 0.6));
    const loadS = W.faceAt(loadY) - A.loadOut;
    const up = Math.max(0.05, apexY - loadY);
    // (begun early, under a straight face, he has the last of the transition to run up into the crouch)
    const tL = clamp(Math.hypot(loadS - start.hipS, loadY - start.hipY) / 6.5, A.loadSeconds, 0.24);
    const tau = clamp(Math.sqrt(2 * up / A.leapGravity), 0.17, 0.44), tA = tL + tau;
    const load: Key = { t: tL, s: loadS, y: loadY, vs: 0, vy: 2 * up / tau };
    const apex: Key = { t: tA, s: W.faceAt(apexY) - A.hangOut, y: apexY, vs: 0, vy: 0 };
    load.vs = 1.3 * (apex.s - load.s) / tau; apex.vs = 0.4 * (apex.s - load.s) / tau;
    this.keys.push(first, load, apex);
    this.loadAt = tL; this.apexAt = tA;
    if (grab) {
      // His weight comes onto his arms: the sag to the dead hang, where the game's own hang takes him.
      const hangY = W.lipY - A.deadHang, T = tA + clamp(0.9 * Math.sqrt(2 * (apexY - hangY) / A.leapGravity), A.sagSeconds, 0.22);
      this.keys.push({ t: T, s: W.faceAt(hangY) - A.hangOut, y: hangY, vs: 0, vy: 0 });
      this.leapSeconds = T;
      this.duration = T; this.endS = W.lipS - start.hangSkin; this.endY = W.lipY - start.hangDepth;
      return;
    }
    this.leapSeconds = tA;
    this.planFall(apexY, 0);
  }

  /**
   * The miss, from the top of it. His chest is on the wall and gravity has him:
   * down the face, round the transition and out along the flat, worked out now
   * so every beat has a length. `topY` is his pelvis as it begins, `speed` how
   * fast he is already going down the wall.
   */
  private planFall(topY: number, speed: number): void {
    const W = this.wall, A = VERT_RUN_UP;
    const point = { s: 0, y: 0, slope: 0 };
    // Dropped onto the transition where a body does not slide down a face (under about 55°), it is
    // his feet that are on the wall, and they are what it takes from under him.
    this.landed = this.start.fromAir === true && W.at(this.start.len, point).slope <= 0.96;
    this.apexHipY = topY;
    this.apexLen = this.landed ? this.start.len : W.lenAtY(topY - 0.25);
    let len = this.apexLen, v = speed, t = 0, tumbling = 0;
    // He is brought to rest no nearer the end of the sampled flat than this.
    const stopBy = Math.min(W.footLen - 0.4, Math.max(0.7, W.footLen - 4.2));
    this.track.push({ len, v });
    while (t < 6) {
      W.at(len, point);
      const steep = point.slope > 0.96; // about 55°: above it he slides, below it he is thrown over
      if (!steep && tumbling === 0) tumbling = t;
      // (on the transition he rolls, and keeps what the wall gave him; the flat is what stops him)
      const friction = steep ? A.slideFriction : lerp(A.tumbleFriction, A.rollFriction, smooth((point.slope - 0.10) / 0.35));
      let a = A.slideGravity * Math.sin(point.slope) - friction * A.slideGravity * Math.cos(point.slope) - A.slideDrag * v;
      // Near the end of the flat he has there is nothing left to roll on: brake to stop on it.
      if (len < stopBy + 1.2 && v > 0) a -= (v * v) / Math.max(0.2, 2 * (len - stopBy));
      v = Math.max(0, v + a * this.trackStep);
      len = Math.max(stopBy, len - v * this.trackStep);
      t += this.trackStep;
      this.track.push({ len, v });
      if (tumbling > 0 && (v < 0.05 || len <= stopBy) && point.slope < 0.2) break;
    }
    if (tumbling === 0) tumbling = t;
    // Each beat is long enough to be seen. (Landed on the transition, there is no slide to see.)
    this.slideSeconds = this.landed ? 0 : Math.max(0.12, tumbling);
    this.tumbleSeconds = Math.max(this.landed ? 0.62 : 0.42, t - (this.landed ? 0 : tumbling));
    this.restLen = len;
    this.duration = this.leapSeconds + this.slideSeconds + this.tumbleSeconds + A.recoverSeconds;
    const rest = W.at(len, point);
    this.endS = rest.s; this.endY = rest.y;
  }

  /** He met the wall in the air: there was no run up it, and no leap. */
  get fromAir(): boolean { return this.start.fromAir === true; }
  /** ...and came down ON it, on his feet, below where it stands up: there is no slide, only the roll. */
  private landed = false;

  /** The hang point this plan catches at (a grab): where the controller point is handed over. */
  get hangS(): number { return this.endS; }
  get hangY(): number { return this.endY; }

  sample(time: number, out: VertRunFrame = emptyVertRunFrame()): VertRunFrame {
    const W = this.wall, A = VERT_RUN_UP, t = clamp(time, 0, this.duration), h = this.scratch;
    out.done = time >= this.duration;
    out.hands.weight = 0; out.secondHand = 0; out.look = 0; out.feet[0].weight = 0; out.feet[1].weight = 0;
    // Where his feet are on the wall as it begins: one at the length of his leg under him, the leading one a high step up.
    const foot = W.at(W.lenAtY(this.stand - 0.93)), lead = W.at(Math.min(W.lipLen - 0.05, W.lenAtY(this.stand - 0.58)));
    const grip = { s: W.lipS + 0.05, y: W.lipY + 0.025 };
    // A planted foot holds for as long as his leg reaches it and peels off as the leg straightens: toes last.
    const reach = (at: { s: number; y: number }): number => 1 - smooth((Math.hypot(h.s - at.s, h.y - at.y) - A.legReach) / 0.13);
    if (this.outcome === 'climb') {
      const T = this.duration, C = A.climb;
      // The clip is authored to the plan's own moments, wherever a higher or a lower lip puts them in time.
      const p = t <= this.handsAt ? C.hands * t / this.handsAt
        : t <= this.overAt ? lerp(C.hands, C.over, (t - this.handsAt) / (this.overAt - this.handsAt))
        : lerp(C.over, 1, (t - this.overAt) / (T - this.overAt));
      along(this.keys, t, h);
      this.clear(h, this.easeIn(0.30, t));
      out.progress = p;
      out.beat = p < 0.20 ? 'step' : p < C.over ? 'press' : 'over';
      // The trailing foot drives off where he was. The leading one is planted higher and drives after it, then steps onto the deck.
      out.feet[1] = { weight: reach(foot) * (1 - smooth((p - 0.20) / 0.08)), s: foot.s, y: foot.y };
      const planted = smooth(p / 0.06) * reach(lead) * (1 - smooth((p - 0.34) / 0.08));
      // (on the deck it holds for as long as his leg reaches it, like every other planted foot: he steps off it, it is not let go of)
      // (a long step over the edge: far enough along the deck that his leg still reaches it as he stands up over it)
      const onDeck = { s: W.lipS + 0.80, y: W.lipY };
      const landed = smooth((p - 0.63) / 0.07) * reach(onDeck);
      out.feet[0] = p >= 0.63 ? { weight: landed, s: onDeck.s, y: onDeck.y } : { weight: planted, s: lead.s, y: lead.y };
      // The hands come up outside the edge and down onto the coping, never through its corner; one, then the other.
      // (a lip he already has beside him he goes straight to; one over his head he reaches for as he comes up under it;
      // and one the run has left down by his knees he does not stoop for at all: he bounds over it, and his arms swing)
      // (they are pushed off as his pelvis passes the height his straight arms hold it at: never left reaching back down for it)
      const onto = smooth((p - 0.15) / 0.10), off = (1 - smooth((p - 0.61) / 0.10)) * (1 - smooth((h.y - W.lipY - 0.10) / 0.20));
      const reachFrom = lerp(0.01, 0.06, smooth((W.lipY - this.start.hipY - 0.45) / 0.8));
      const needed = smooth((W.lipY - this.start.hipY + 0.45) / 0.5);
      out.hands = { weight: needed * smooth((p - reachFrom) / 0.11) * off, s: lerp(W.lipS - 0.18, grip.s, onto), y: lerp(grip.y + 0.10, grip.y, onto) };
      out.secondHand = needed * smooth((p - reachFrom - 0.04) / 0.12) * (1 - smooth((p - 0.64) / 0.10)) * (1 - smooth((h.y - W.lipY - 0.14) / 0.20));
      // His eyes are on the lip until his chest is over it; then they are along the deck.
      out.look = smooth(p / 0.06) * (1 - smooth((p - 0.30) / 0.14));
      // The controller point goes up the face first and over the lip after, rounding the corner.
      const from = W.at(this.start.len);
      out.posY = lerp(from.y, this.endY, smooth(p / 0.60));
      out.posS = lerp(from.s, this.endS, smooth((p - 0.32) / 0.68));
    } else if (this.leapSeconds > 0 && t <= this.leapSeconds) {
      // The clip's load and its catch are the plan's own, however long this wall makes the throw.
      const L = A.leap, T = this.leapSeconds;
      const p = t <= this.loadAt ? L.load * t / this.loadAt
        : t <= this.apexAt ? lerp(L.load, L.catch, (t - this.loadAt) / (this.apexAt - this.loadAt))
        : lerp(L.catch, 1, (t - this.apexAt) / Math.max(1e-6, T - this.apexAt));
      along(this.keys, t, h);
      // (close in under the lip only at the very top, where the catch has him against the face)
      this.clear(h, this.easeIn(lerp(0.34, A.hangOut - 0.02, smooth((p - 0.72) / 0.28)), t));
      // (a grab's catch is the top of the jump; a miss is at the wall with his hands a little before the top of his)
      out.beat = p < (this.outcome === 'grab' ? LEAP_CATCH : 0.66) ? 'leap' : this.outcome === 'grab' ? 'catch' : 'reach';
      // His eyes never leave the lip on the way up. (At the top the pose has his head back for it already.)
      out.look = smooth(p / 0.08) * (1 - smooth((p - 0.60) / 0.24));
      out.progress = this.outcome === 'grab' ? p : A.miss.leap * p / L.catch;
      // Both feet push off the wall, the higher one last.
      out.feet[1] = { weight: reach(foot), s: foot.s, y: foot.y };
      out.feet[0] = { weight: smooth(p / 0.08) * reach(lead), s: lead.s, y: lead.y };
      if (this.outcome === 'grab') {
        // Up the outside of the face, over the edge, and onto the coping: one hand, then the other.
        const up = smooth((p - 0.52) / 0.24), onto = smooth((p - 0.74) / (LEAP_CATCH - 0.74));
        out.hands = { weight: smooth((p - 0.50) / 0.32),
          s: lerp(lerp(W.lipS - 0.20, W.lipS - 0.12, up), grip.s, onto), y: lerp(lerp(W.lipY - 0.30, W.lipY + 0.12, up), grip.y, onto) };
        out.secondHand = smooth((p - 0.60) / 0.30);
      }
      else {
        // Fingertips on the face, as high as they go: under the lip.
        const tip = Math.min(this.apexHipY + A.reachDrop - 0.06, W.lipY - 0.10);
        out.hands = { weight: 0.85 * smooth((p - 0.56) / 0.28), s: W.faceAt(tip), y: tip };
        out.secondHand = 0.85 * smooth((p - 0.62) / 0.24);
      }
      const w = smooth((p - 0.18) / 0.82), from = W.at(this.start.len);
      let toS = this.endS, toY = this.endY;
      if (this.outcome === 'miss') { const top = W.at(this.apexLen); toS = top.s - Math.sin(top.slope) * 0.04; toY = top.y + Math.cos(top.slope) * 0.04; }
      out.posS = lerp(from.s, toS, w); out.posY = lerp(from.y, toY, w);
    } else {
      this.fall(t - this.leapSeconds, out);
      return out;
    }
    out.hipS = h.s; out.hipY = h.y; out.velS = h.vs; out.velY = h.vy;
    return out;
  }

  /** However near the wall the run had him, the move begins there: the room it keeps is eased to, not snapped to. */
  private easeIn(out: number, t: number): number {
    return this.startClear >= out ? out : lerp(this.startClear, out, smooth(t / 0.12));
  }

  /**
   * The pelvis never goes nearer the wall than `out`, whatever the curve through the keys does.
   * Up at the lip itself it is his belly that passes the coping, and that may be nearer: the
   * limit eases in over the last of the face and away over the first of the deck, so it never
   * lets go of him all at once.
   */
  private clear(h: { s: number; y: number }, out: number): void {
    const W = this.wall, near = Math.min(out, 0.16);
    if (h.y < W.lipY) h.s = Math.min(h.s, W.faceAt(h.y) - lerp(out, near, smooth((h.y - (W.lipY - 0.35)) / 0.35)));
    else if (h.y < W.lipY + 0.3) h.s = Math.min(h.s, W.lipS - near + 2.2 * smooth((h.y - W.lipY) / 0.3));
  }

  /** Where the fall has the pelvis `t` seconds after the top of the leap, and the surface under it. */
  private fallen(t: number, out: { len: number; v: number; s: number; y: number; slope: number; hipS: number; hipY: number }): void {
    const W = this.wall, A = VERT_RUN_UP;
    const moving = this.slideSeconds + this.tumbleSeconds;
    const index = clamp(t, 0, moving) / this.trackStep, i = Math.min(this.track.length - 2, Math.floor(index)), f = clamp(index - i);
    const a = this.track[Math.max(0, i)], b = this.track[Math.min(this.track.length - 1, i + 1)];
    out.len = t >= moving ? this.restLen : lerp(a.len, b.len, f); out.v = t >= moving ? 0 : lerp(a.v, b.v, f);
    const p = W.at(out.len);
    out.s = p.s; out.y = p.y; out.slope = p.slope;
    // How far the pelvis rides off the surface: peeling off the wall as he slides, then what the
    // roll has it at, then sat; and stood up again at the end.
    const recover = clamp((t - moving) / A.recoverSeconds);
    const tumble = clamp((t - this.slideSeconds) / this.tumbleSeconds);
    const off = t < this.slideSeconds ? lerp(A.hangOut, ROLL_OFF[0], smooth(t / this.slideSeconds))
      : t < moving ? throughKeys(ROLL_AT, ROLL_OFF, tumble)
      : lerp(ROLL_OFF[ROLL_OFF.length - 1], A.hipStand, smooth(recover));
    // Off the surface along its own normal: out from a wall, up from a floor.
    out.hipS = p.s - Math.sin(p.slope) * off; out.hipY = p.y + Math.cos(p.slope) * off;
    // The first of the fall starts from where the leap ended, not from the surface under it.
    const join = 1 - smooth(t / 0.16);
    if (join > 0) {
      const top = this.keys[this.keys.length - 1];
      out.hipS = lerp(out.hipS, top.s, join); out.hipY = lerp(out.hipY, top.y - 0.5 * A.slideGravity * 0.35 * t * t, join);
    }
  }
  private readonly fell = { len: 0, v: 0, s: 0, y: 0, slope: 0, hipS: 0, hipY: 0 };
  private readonly caught = { len: 0, v: 0, s: 0, y: 0, slope: 0, hipS: 0, hipY: 0 };

  /** The miss, after the top of the leap: `t` seconds since it. */
  private fall(t: number, out: VertRunFrame): void {
    const W = this.wall, A = VERT_RUN_UP, M = A.miss, F = this.fell;
    const moving = this.slideSeconds + this.tumbleSeconds;
    this.fallen(t, F);
    const recover = clamp((t - moving) / A.recoverSeconds);
    const tumble = clamp((t - this.slideSeconds) / this.tumbleSeconds);
    const nS = -Math.sin(F.slope), nY = Math.cos(F.slope);
    out.hipS = F.hipS; out.hipY = F.hipY;
    out.velS = -F.v * Math.cos(F.slope); out.velY = -F.v * Math.sin(F.slope);
    out.posS = F.s + nS * 0.04; out.posY = F.y + nY * 0.04;
    // His toes drag down the face under him, one a little above the other.
    const toes = (hipY: number, drop: number): { s: number; y: number } => W.at(W.lenAtY(hipY - drop));
    if (t < this.slideSeconds) {
      const k = t / this.slideSeconds;
      out.beat = 'slide';
      out.progress = lerp(M.leap, M.slide, k);
      // Palms drag down the face at the length of his arms: they come down only as fast as he does.
      const tip = Math.min(W.lipY - 0.05, F.hipY + lerp(A.reachDrop - 0.08, 1.42, smooth(k)));
      // (met in the air, his palms find the face over the first of the slide: they were not on it already)
      const held = 0.85 * (1 - smooth((k - 0.66) / 0.34)) * (this.start.fromAir ? smooth(t / 0.14) : 1);
      out.hands = { weight: held, s: W.faceAt(tip), y: tip };
      out.secondHand = held;
      const drag = 0.75 * smooth(k / 0.3) * (this.start.fromAir ? smooth(t / 0.12) : 1), a = toes(F.hipY, 0.80), b = toes(F.hipY, 0.93);
      out.feet[0] = { weight: drag, s: a.s, y: a.y }; out.feet[1] = { weight: drag, s: b.s, y: b.y };
      if (this.start.fromAir) {
        // The controller point comes onto the slide's own from where the air had it, not in a step.
        const from = W.at(this.start.len), w = smooth(t / 0.22);
        out.posS = lerp(from.s, out.posS, w); out.posY = lerp(from.y, out.posY, w);
      }
    } else if (t < moving) {
      out.beat = 'tumble';
      out.progress = lerp(M.slide, M.tumble, tumble);
      // The transition catches his feet where the slide left them, and he goes on down past them.
      const C = this.caught;
      this.fallen(this.slideSeconds, C);
      const stuck = 0.75 * (1 - smooth((tumble - 0.05) / 0.14)), a = toes(C.hipY, 0.80), b = toes(C.hipY, 0.93);
      out.feet[0] = { weight: stuck, s: a.s, y: a.y }; out.feet[1] = { weight: stuck, s: b.s, y: b.y };
      if (this.landed) {
        // (his feet are where he came down on them, until the wall has them from under him)
        const on = W.at(this.start.len), held = 0.85 * (1 - smooth((tumble - 0.04) / 0.12));
        out.feet[0] = { weight: held, s: on.s, y: on.y }; out.feet[1] = { weight: held, s: on.s, y: on.y };
      }
      // Going over the top his hands are on the ground by his ears, where they met it: he rolls over them.
      this.fallen(this.slideSeconds + 0.46 * this.tumbleSeconds, C);
      out.hands = { weight: 0.9 * smooth((tumble - 0.40) / 0.07) * (1 - smooth((tumble - 0.72) / 0.08)), s: C.s - 0.74, y: C.y + 0.03 };
      out.secondHand = out.hands.weight;
      // ...and his feet come down where he will stand, a little before the rest of him is over them.
      const land = smooth((tumble - 0.68) / 0.12), rest = W.at(this.restLen);
      if (land > 0) { out.feet[0] = { weight: land, s: rest.s + 0.16, y: rest.y }; out.feet[1] = { weight: land, s: rest.s - 0.12, y: rest.y }; }
    } else {
      out.beat = 'rise';
      out.progress = lerp(M.tumble, 1, recover);
      // Up out of the crouch, over the feet the roll put under him.
      out.feet[0] = { weight: 1, s: F.s + 0.16, y: F.y }; out.feet[1] = { weight: 1, s: F.s - 0.12, y: F.y };
      out.posS = F.s; out.posY = F.y;
    }
    if (out.done) { out.posS = this.endS; out.posY = this.endY; }
  }
}
