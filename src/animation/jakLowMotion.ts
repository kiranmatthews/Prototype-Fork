import type {InertiaShape} from './poseInertia';

/** How D moves between standing, the crouch and the crawl. The clips stay the
 * native ones; only the cuts between them change. In place of a five-frame
 * transition clip or a rapid crossfade, the body is carried across each cut
 * (`PoseInertia`) and let go part by part: the pelvis and legs together, so
 * the feet stay under him, then the spine, the head and the arms, each a
 * little later and each swinging past its rest once before it settles.
 *
 * Between the crouch and the crawl, and up off all fours, the legs cannot be
 * let go joint by joint: the two poses are a quarter turn of each leg apart,
 * and half way between them a shin points straight down through the floor.
 * Those cuts name a rate for the feet instead (the last pair of a shape), the
 * legs take the new motion at once, and the player carries each foot across
 * the floor to it.
 *
 * Rates are rad/s (a part is half way after about 2.7 / rate seconds); the
 * second number of a pair is its damping, under 1 for a bounce. `carry`
 * leaves the pelvis behind when the crawl starts and lets it run on when it
 * stops, since the crawl itself starts and stops on one frame. */
const shape=(body:[number,number],spine:[number,number],head:[number,number],arms:[number,number],
  carry:[number,number,number]=[0,0,0],legs:[number,number]=body,feet?:[number,number]):InertiaShape=>
  ({root:body,legs,spine,head,arms,lengths:[body[0],1],carry,...(feet?{feet}:{})});
export const JAK_LOW_CUTS={
  /** Standing down into the crouch: he sinks, dips a little under it and comes back. */
  crouch:shape([15,.5],[12,.45],[11,.45],[9.5,.42]),
  /** The crouch up to standing: up a little past it, then down. It is also the second of the two moves up
   * off all fours; the feet are then still on their way and go on being carried. */
  stand:shape([14,.45],[12,.45],[11,.45],[9.5,.4]),
  /** The crouch forward onto all fours as the crawl starts. */
  crawl:shape([16,.8],[14,.7],[13,.65],[15,1],[0,0,1],[11,.9],[11,.9]),
  /** The crawl back onto the heels as it stops. */
  rest:shape([15,.6],[12,.5],[11,.5],[10,.5],[0,0,1],[11,.8],[11,.9]),
  /** The first of the two moves up off all fours: toward the crouch, with the legs a little behind the
   * pelvis, so it has risen before the thighs come under it. */
  gather:shape([15,.6],[12,.5],[11,.5],[10,.5],[0,0,1],[11,.8],[11,.9]),
  /** All fours straight up to a stand or into a run, where something else (a landing) leaves no room for
   * the first of those two moves. */
  rise:shape([14,.55],[12,.5],[11,.5],[9.5,.42],[0,0,.5],[14,.55],[12,1]),
  /** A step off, a stop or a turn while one of those is still settling: quick, and no second bounce. */
  onward:shape([30,1],[26,1],[24,1],[22,1]),
  /** A jump or a fall out of the crawl, or while a crawl has only just begun or stopped. The body is then
   * prone, or a long way from where the clip it was being carried to has it, and a stock three-frame blend
   * from there to an upright jump is a jolt. It is carried on instead, briskly. Out of a settled crouch,
   * which is upright already, a jump is as sharp as it ever was. */
  leap:shape([26,1],[22,1],[20,1],[18,1]),
  /** How much of the feet's way has to be left for a crawl to count as only just begun or stopped. */
  leapFrom:.3,
  /** Up off all fours, the seconds he is carried toward the crouch before he is carried on to his feet:
   * long enough for the knees to come under him, short enough that he never settles there. */
  gatherSeconds:.16,
};
export type JakLowCuts=typeof JAK_LOW_CUTS;
