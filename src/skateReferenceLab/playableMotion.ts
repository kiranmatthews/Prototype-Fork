import * as THREE from 'three';
import type {Player} from '../player';
import type {PlayerAnimationOverlayContext} from '../animation/bridge';
import {characterElasticityAmplitudes,ELASTIC_LENGTH_CONTROLS} from '../animation/elasticity';
import {solveTwoBoneIk} from '../animation/ik';
import {skateboardSettings} from '../skateboard/settings';
import {evaluateSkateboardSurfaceHeight} from '../skateboard/model';
import {SkateRetargeter, clipDuration, type MotionData, type SourceClip} from './retarget';
import {BoardScribbleSequence, MOUNT_CLEAR_DURATION, SCRIBBLE_DURATION, type BoardScribbleEffect} from './boardScribble';
import {TUNING} from '../tuning';
import {groundSpeedLimit} from '../softGround';
import {groundBoard,boardGroundClearance} from './boardGrounding';
import {DEFAULT_SKATE_STANCE} from '../skateMount';

type Pose = {p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3}[];
type FootContact = {side:'Left'|'Right';p:THREE.Vector3;q:THREE.Quaternion};
type Phase = 'foot' | 'mount' | 'ride' | 'push-enter' | 'push' | 'push-recover' | 'charge' | 'air' | 'land' | 'dismount';
const smooth = (x: number) => {x = THREE.MathUtils.clamp(x, 0, 1); return x*x*(3-2*x);};
const rideNames = {Relaxed:'R_IDLE_RIDE_N_0_CYC', Loose:'R_IDLE_RIDE_LOOSE_0_CYC', Aggressive:'R_IDLE_RIDE_AGGR_0_CYC'};
/** Riding is never a held pose. The source's own ride loops barely move, and
 * its charge was one frame held still, so the rider stands on a few springs:
 * how far down he is, which way he leans, and what the road last did to him.
 *
 * Down is the ollie crouch, which bounces by itself, folded on toward the low
 * point of the hard landing as the charge fills. A press dips him, the charge
 * takes him down on a spring that goes a little past and comes back, and at
 * full charge he keeps pumping on it. A kick from the road (a kerb, the foot
 * of a ramp) goes into the same spring. Steering leans him through the
 * source's own leaned stances, with a spring that swings a little wide, and
 * presses him down into the turn. With nothing asked of him he still shifts
 * his weight and drifts between two stances. */
const RIDE_LIFE = {
  /** Springs: [rate (1/s), damping ratio]. Under 1 swings past and settles. */
  crouch: [15, .46], lean: [7, .66], bump: [17, .36],
  /** How far the charge takes him down: on the press, and when it is full. */
  press: .36, full: 1,
  /** Share of the way to the low pose that `down = 1` is, leaving room to swing past it. */
  depth: .92,
  /** Share of the hard landing's low point in the low pose: at a dip, and at full charge. */
  fold: [.25, .78], foldFrame: 14,
  /** The pump at full charge: two beats that do not line up. [depth, radians per second, phase] */
  pump: [[.065, 10.4, 0], [.04, 6.3, 1.3]],
  /** How fast (1/s) he comes round to a change in the lie of the road. */
  road: 9,
  /** A kick's change of vertical speed (m/s) to spring speed, the seconds it is taken up over, and how far it may take him down or up. */
  kick: 3.6, kickSeconds: .045, bumpRange: [-.3, .55],
  /** At full charge his arms swing with the pump: the source's crouched pump, back and forth between two of its frames. [share, frame, frames, radians per second] */
  arms: [.34, 17, 13, 5.2],
  /** The lean a carve asks for per radian of the controller's own lean, how much of the source's leaned stance it is, and how far a turn presses him down. */
  carve: 1 / .28, tilt: .46, lowTilt: .7, press_into_turn: .2,
  /** With nothing asked of him: he shifts his weight ([lean, radians per second, phase]), gives at the knees
   * ([depth, radians per second]), lets his arms ride ([share, frame, frames, radians per second] of the
   * source's standing pump) and drifts toward the looser stance and back ([share, radians per second]). */
  sway: [[.4, 1.3, 0], [.24, 2.9, 2.1]], breath: [.085, 6.6], loose: [.42, 24, 12, 3.3], drift: [.3, .37],
} as const;
const ordinaryMotionHints = new Set(['player.idle','player.run','player.skate','player.jump-charge',
  'player.jump','player.fall','player.double-jump']);
// Zero-based 60 Hz source cues, checked against Bone Man's retargeted soles.
// Keep the deck visible until both feet clear. Very short pickups need a small
// ink tail after the catch so the burst survives real-time rendering.
const dismountInkFrames: Readonly<Record<string, {feetClear: number; catch: number}>> = {
  BR_DISMOUNT_LO_INTO_STAND_0: {feetClear: 24, catch: 26},
  BR_DISMOUNT_LO_INTO_RUN_FWD: {feetClear: 24, catch: 56},
};
// Enter after the source releases its carried board. The remaining footage is
// the actual step/hop onto the deck, followed by its compression and recovery.
// Starting at frame zero revealed a waist-high carried prop inside the ink.
const mountStarts: Readonly<Record<string, number>> = {
  BR_RUN_FWD_50_INTO_MOUNT: 11,
  BR_WALK_FWD_25_INTO_MOUNT: 18,
  BR_STAND_0_INTO_MOUNT: 28,
};
const mountUpperBody = /^(torsoRoot|spine|chest|neck|head|clavicle|shoulder|elbow|wrist)/;

/** Shared source-motion presentation. It observes native gameplay; it never
 * writes position, speed, grounded, input, charge, or a controller state. */
export class PlayableSkateMotion {
  enabled = true;
  private useScribbles = true;
  readonly boardScribble = new BoardScribbleSequence();
  private dismountInkStarted = false;
  private boardAlpha = 1;
  private baselineBoardVisible = false;
  private baselineBoardAlpha = 1;
  style: keyof typeof rideNames = 'Relaxed';
  phase: Phase = 'foot';
  time = 0;
  sourceName = '';
  readonly visits = new Map<string, number>();
  private readonly regularRetarget: SkateRetargeter;
  private readonly fakieRetarget: SkateRetargeter;
  private sourceStance = DEFAULT_SKATE_STANCE as number;
  private previousSkateStance = DEFAULT_SKATE_STANCE as number;
  private dismountRunBlend = 0;
  get retarget(): SkateRetargeter {return this.sourceStance===1?this.fakieRetarget:this.regularRetarget;}
  private readonly nodes: THREE.Object3D[];
  private readonly upperBodyNodes: ReadonlySet<THREE.Object3D>;
  private lastPose: Pose | null = null;
  private previousPose: Pose | null = null;
  private fromPose: Pose | null = null;
  private fromPreviousPose: Pose | null = null;
  private previousDt = 1/60;
  private transitionDt = 1/60;
  private transitionAge = 0;
  private fade = 1;
  private wasMounted = false;
  private wasGrounded = true;
  private mountHold = false;
  private pushFast = false;
  private speedRecoveryPush = false;
  private resetVersion = -1;
  private previousFootSpeed = 0;
  private mountPreparation = 0;
  private preparedMount = '';
  private mountStart = 0;
  private idleClock = 0;
  // What keeps a rider moving: its clock, three springs (value, speed), and the road under him last frame.
  private readonly life = {clock: 0, down: 0, downSpeed: 0, lean: 0, leanSpeed: 0, bump: 0, bumpSpeed: 0, height: Number.NaN, climb: 0, held: 0, kicked: 0, pumping: 0};
  private clip: SourceClip | null = null;
  // The lie of the road as the rider has caught up with it.
  private readonly road = new THREE.Quaternion();
  private roadKnown = false;
  private readonly clips: Map<string, SourceClip>;
  private readonly rider: THREE.Object3D;
  private readonly body: THREE.Object3D;
  private readonly bodyScale: THREE.Vector3;
  private readonly boardScale: THREE.Vector3;
  private readonly boardMount: THREE.Object3D;
  private readonly boardSupport = new THREE.Plane();
  private readonly boardLift = new THREE.Vector3();
  private boardGroundLift = 0;
  private nativeOwner: string | null = null;
  private iceBlend = 0;
  private iceFootError = 0;
  private stop: (() => void) | null = null;
  // These observations are private in the full game and intentionally exposed
  // only to this opt-in local study, as in jump-browser-review.ts.
  private readonly p: any;
  private readonly boardMaterials: {material: THREE.Material; opacity: number; transparent: boolean; depthWrite: boolean}[] = [];
  private readonly clonedBoardMeshes = new WeakSet<THREE.Mesh>();

  constructor(player: Player, data: MotionData, private readonly options: {continuousTransitions?: boolean} = {}) {
    this.p = player;
    const rig = player.enterAnimationPreview();
    player.applyAnimationDeformations({});
    player.syncCharacterAppearance({upperArmRestAngleWeight:0});
    const leg = rig.jointsById.get('kneeLeft')!.node.position.length() + rig.jointsById.get('ankleLeft')!.node.position.length();
    // The library leads with the opposite foot to Bone Man's regular (-1)
    // stance. Mirror the source, including prop/hand contacts,
    // so ice, fakie and native tricks keep the same anatomical lead foot.
    this.regularRetarget = new SkateRetargeter(rig, data, leg, {mirror:true});
    this.fakieRetarget = new SkateRetargeter(rig, data, leg);
    this.body = rig.root;
    this.bodyScale = this.body.scale.clone();
    this.boardScale = this.retarget.board.scale.clone();
    this.boardMount = this.retarget.board.parent!;
    this.rider = rig.root.getObjectByName('procedural-rider')!;
    this.nodes = [...new Set([this.body, this.rider, this.boardMount, ...rig.joints.map(j => j.node), this.retarget.board])];
    this.upperBodyNodes=new Set(rig.joints.filter(j=>mountUpperBody.test(j.id)).map(j=>j.node));
    this.clips = new Map(data.clips.map(c => [c.name, c]));
    this.opacity(1);
    player.exitAnimationPreview();
    this.setActive(true);
  }

  /** A/B/C/D switches remove the overlay entirely. Rejoining on a moving board
   * blends into riding without inventing a mount, pickup, or ink event. */
  setActive(active: boolean): void {
    if (active === Boolean(this.stop)) return;
    if (!active) {
      this.stop?.(); this.stop=null; this.reset();
      // The bridge restore boundary also contains the foot animation document.
      // Resolve that still-running document at dt=0 for a paused A/B switch.
      if(this.p.rawInput)this.p.syncVisual(this.p.rawInput,0);
      this.p.collapseRenderInterpolation();return;
    }
    this.reset();
    this.resetVersion=this.p.animationResetVersion;
    this.wasMounted=Boolean(this.p.freeSkate||!this.p.grounded&&this.p.airFromSkate);
    this.wasGrounded=this.p.grounded;
    // Joining D while already on ice should preserve the current native pose.
    if(this.nativePoseOwner==='ice balance'&&this.p.groundHit?.slippy||this.nativePoseOwner==='switch stance')this.iceBlend=1;
    this.stop = this.p.setFinalPoseOverlay((context: PlayerAnimationOverlayContext) => {
      const previousPhase = this.phase;
      const previousPose = this.lastPose;
      this.update(context);
      if(context.deltaSeconds>1e-6){
        this.previousPose=this.lastPose?previousPose:null;
        this.previousDt=context.deltaSeconds;
      }
      this.baselineBoardVisible = this.retarget.board.visible;
      this.baselineBoardAlpha = this.boardAlpha;
      this.updateScribble(context.deltaSeconds, previousPhase);
      this.applyBoardPresentation();
    });
  }

  get active(): boolean {return Boolean(this.stop);}
  prepareRender(camera: THREE.Camera, effect: BoardScribbleEffect): void {
    if(!this.active||!this.p.group.visible||this.p.playerAnimationBridge.previewActive){
      effect.sprite.visible=false;return;
    }
    this.constrainRenderPose();
    effect.update(camera,this.p.grounded&&this.p.groundHit
      ?this.boardSupport.setFromNormalAndCoplanarPoint(this.p.groundHit.normal,this.p.pos):undefined);
    effect.sprite.updateMatrixWorld(true);
  }
  get mountProgress(): number {
    return this.phase==='mount'&&this.clip?THREE.MathUtils.clamp(this.time/(clipDuration(this.clip)-this.mountStart),0,1):0;
  }

  /** The imported library covers ordinary mounts, riding, ollies and pickups.
   * Native actions, contacts and their finite releases keep the complete pose
   * already solved by Player. Input/score alone is not enough: replacing that
   * final pose also erased spins, switch stance and a releasing grab's hand. */
  private get nativePoseOwner(): string | null {
    const p=this.p;
    if(!['ride','air'].includes(p.state))return p.state;
    if(p.isBailing||p.bailing||p.ragActive||p.ragBlend>.001||p.bailRiseAge>=0)return 'bail recovery';
    if(p.boardAbandonActive||p.animationClipHint==='player.roll-land')return 'abandon ship';
    if(p.spinning)return 'spin';
    if(p.flipT>0||p.specialFlip)return 'deck trick';
    if(p.grabPhase!=='none'||p.grabPose>.001||p.specialGrab)return 'grab / release';
    if(!p.grounded&&Math.abs(p.grabSpinAngle)>.0001)return 'air spin';
    if(p.manualing||Math.abs(p.manualPitch)>.001)return 'manual / release';
    if(p.revertPoseT>0)return 'revert';
    if(p.wallriding||p.wallridePose>.001)return 'wallride / release';
    if(p.lipStallT>0||Math.abs(p.lipYawPose)>.001)return 'lip stall / release';
    if(p.vertAir||p.pipeHang||p.freeSkate&&p.grounded&&p.onTransition)return 'vert / transition';
    if(p.nativeAirPresentation||p.launchPresentation)return 'special launch';
    if(p.kiteTowing||p.kiteReleased||p.kiteBonusDocked)return 'kite';
    if(p.sliding||p.crawling||p.slidePose>.001||p.crawlPose>.001)return 'slide / crouch';
    if(p.slamActive||p.slamFlatT>0||p.slamSquash>0||p.starTimer>0||p.starPose>.001)return 'slam / split jump';
    if(p.slipping||p.teetering||p.teeterPose>.001)return 'surface balance';
    if(p.sketchyT>0)return 'sketchy landing';
    if(p.competitionFinishT>=0||p.resultsPose||p.worldMapBaseScale!=null)return 'course presentation';
    if(!ordinaryMotionHints.has(p.animationClipHint))return p.animationClipHint;
    if(this.retarget.board.userData.iceSkateMotion)return 'ice balance';
    // These source clips have one authored stance/deck orientation. Preserve
    // actual switch/reversed riding until a deliberate new mount resets it.
    if(p.freeSkate||!p.grounded&&p.airFromSkate){
      if(p.stance!==DEFAULT_SKATE_STANCE)return 'switch stance';
      if(Math.abs(Math.atan2(Math.sin(p.deckYawOffset),Math.cos(p.deckYawOffset)))>.0001)return 'reversed deck';
    }
    return null;
  }

  /** Interpolating two clear, differently tilted decks can put a tip below
   * ground between fixed ticks. Re-solve only the displayed prop/contacts;
   * Player.restoreRenderPose restores the authoritative fixed pose afterward. */
  constrainRenderPose(): void {
    if(!this.active||!this.p.grounded||!['mount','dismount'].includes(this.phase))return;
    this.boardSupport.setFromNormalAndCoplanarPoint(this.p.groundHit?.normal??new THREE.Vector3(0,1,0),this.p.pos);
    if(boardGroundClearance(this.retarget.board,this.boardSupport)<.002)this.fitEquipmentGround();
  }

  get scribbles(): boolean {return this.useScribbles;}
  set scribbles(value: boolean) {
    this.useScribbles = value;
    this.boardScribble.enabled = value && this.enabled && this.active;
    // A/B also works while paused. It changes only the prop presentation;
    // the source clock, pose and controller never advance or restart.
    if(this.active)this.applyBoardPresentation();
  }

  private updateScribble(dt: number, previous: Phase): void {
    const p=this.p,ink=this.boardScribble;
    ink.enabled=this.scribbles&&this.enabled;
    const interrupted=!this.enabled||this.nativeOwner!==null;
    if(interrupted){ink.cancel();this.dismountInkStarted=false;return;}
    if(this.phase!==previous){
      this.dismountInkStarted=false;
      if(this.phase==='mount'){
        const prepared=ink.preparing;
        ink.start(true,prepared?MOUNT_CLEAR_DURATION:SCRIBBLE_DURATION,prepared?0:8);
        return;
      }
      if(!ink.preparing)ink.cancel();
    }
    const holding=this.phase==='foot'&&this.preparingMount;
    if(holding){ink.prepare(dt,TUNING.skateHoldTime);return;}
    if(ink.preparing){
      // Cancelling a pending mount winds its existing ink back at the last
      // ground attachment, even if release also launches the native foot jump.
      ink.unwind();ink.step(dt);return;
    }
    if(!p.grounded){ink.cancel();this.dismountInkStarted=false;return;}
    ink.step(dt);
    if(this.phase==='dismount'&&!this.dismountInkStarted&&this.clip){
      const cue=dismountInkFrames[this.sourceName],start=cue.feetClear/this.clip.fps;
      const duration=Math.max(.2,(cue.catch-cue.feetClear)/this.clip.fps);
      if(this.time+1e-7>=start){
        // Standing grows for two ticks and switches at its hand catch. Running
        // has a longer pickup: eight ticks in, one full drawing, then out.
        ink.start(false,duration,this.sourceName==='BR_DISMOUNT_LO_INTO_STAND_0'?2:8);
        ink.step(Math.max(0,this.time-start));this.dismountInkStarted=true;
      }
    }
  }

  private applyBoardPresentation(): void {
    this.opacity(this.baselineBoardAlpha);
    this.retarget.board.visible = this.baselineBoardVisible;
    const ink = this.boardScribble;
    // Keep the vanished prop gone through the remaining carry/settle. Restoring
    // baseline visibility when the shorter burst ends would make it reappear.
    if (this.scribbles && this.enabled && this.phase === 'dismount' && this.dismountInkStarted) {
      this.opacity(1); this.retarget.board.visible = ink.active && ink.boardVisible; return;
    }
    if (!ink.active) return;
    if (ink.preparing) {this.retarget.board.visible=false;return;}
    if (this.phase === 'mount' && ink.targetVisible) {
      this.opacity(1); this.retarget.board.visible = ink.boardVisible;
    }
  }

  dispose(): void {this.setActive(false);}
  reset(): void {
    this.boardScribble.reset();
    this.nativeOwner=null;
    this.iceBlend=this.iceFootError=0;
    this.boardGroundLift=0;
    this.dismountInkStarted = this.baselineBoardVisible = false;
    this.baselineBoardAlpha = 1;
    this.phase = 'foot'; this.time = 0; this.clip = null;
    this.sourceName='';this.previousFootSpeed=0;this.mountHold=false;this.visits.clear();
    this.mountPreparation=this.mountStart=0;this.preparedMount='';
    this.speedRecoveryPush=false;
    this.sourceStance=this.previousSkateStance=DEFAULT_SKATE_STANCE;
    this.dismountRunBlend=0;
    Object.assign(this.life,{down:0,downSpeed:0,lean:0,leanSpeed:0,bump:0,bumpSpeed:0,height:Number.NaN,climb:0,held:0,kicked:0,pumping:0});
    this.roadKnown=false;
    this.lastPose = this.previousPose = this.fromPose = this.fromPreviousPose = null; this.fade = 1;
    this.transitionAge=0;
    this.wasMounted = false; this.wasGrounded = true; this.opacity(1);
  }
  private capture(): Pose {return this.nodes.map(n => ({p:n.position.clone(),q:n.quaternion.clone(),s:n.scale.clone()}));}
  private blend(from: Pose, weight: number): void {
    this.nodes.forEach((n,i) => {
      n.position.lerp(from[i].p, 1-weight);
      n.quaternion.slerp(from[i].q, 1-weight);
      n.scale.lerp(from[i].s, 1-weight);
    });
  }
  private blendTransition(dt: number): void {
    if (!this.fromPose || this.fade>=1) return;
    this.transitionAge+=dt;
    if (!this.options.continuousTransitions || !this.fromPreviousPose) {
      this.blend(this.fromPose,smooth(this.fade)); return;
    }
    // Continue the outgoing velocity briefly instead of holding a still pose.
    // Its travel decays to a finite limit as the new clip takes over. Source
    // clocks, contacts, dimensions, and the native controller keep their timing.
    const tau=(this.phase==='land'?.07:.18)*.25;
    const travel=tau*(1-Math.exp(-this.transitionAge/tau))/this.transitionDt;
    const weight=smooth(this.fade), delta=new THREE.Quaternion(),q=new THREE.Quaternion();
    this.nodes.forEach((n,i)=>{
      const from=this.fromPose![i],previous=this.fromPreviousPose![i];
      n.position.lerp(from.p.clone().addScaledVector(from.p.clone().sub(previous.p),travel),1-weight);
      delta.copy(previous.q).invert().multiply(from.q);
      q.identity().slerp(delta,travel).premultiply(from.q);
      n.quaternion.slerp(q,1-weight);
      n.scale.lerp(from.s.clone().addScaledVector(from.s.clone().sub(previous.s),travel).max(new THREE.Vector3(.001,.001,.001)),1-weight);
    });
  }
  private opacity(alpha: number): void {
    this.boardAlpha = alpha;
    // The full board model can arrive after Player construction. Adopt each
    // arriving mesh once, without fading shared materials used by other riders.
    this.retarget.board.traverse(node=>{
      if(!(node instanceof THREE.Mesh)||this.clonedBoardMeshes.has(node))return;
      this.clonedBoardMeshes.add(node);
      node.material=Array.isArray(node.material)?node.material.map(m=>m.clone()):node.material.clone();
      for(const material of Array.isArray(node.material)?node.material:[node.material])
        this.boardMaterials.push({material,opacity:material.opacity,transparent:material.transparent,depthWrite:material.depthWrite});
    });
    for (const m of this.boardMaterials) {
      const transparent = alpha < .999 || m.transparent;
      if (m.material.transparent !== transparent) {m.material.transparent = transparent; m.material.needsUpdate = true;}
      m.material.opacity = m.opacity * alpha;
      m.material.depthWrite = alpha < .999 ? false : m.depthWrite;
    }
  }
  /** Advance the rider's springs. They run whenever he is on the board, so a
   * push, a landing or an ollie hands back a body that is already moving. */
  private advanceLife(dt: number, riding: boolean, charging: boolean): void {
    const p=this.p,life=this.life;
    if(!(dt>0))return;
    life.clock+=dt;
    const charge=charging?THREE.MathUtils.clamp(p.chargePose??0,0,1):0;
    // A dip on the press, down as the charge fills, and at full charge two beats that never settle.
    const pumping=life.pumping=smooth((charge-.9)/.1);
    const pump=RIDE_LIFE.pump.reduce((sum,[depth,rate,phase])=>sum+depth*Math.sin(life.clock*rate+phase),0);
    const carve=riding?THREE.MathUtils.clamp((p.lean??0)*RIDE_LIFE.carve,-1,1):0;
    const sway=riding&&!charging?RIDE_LIFE.sway.reduce((sum,[size,rate,phase])=>sum+size*Math.sin(life.clock*rate+phase),0):0;
    const breath=riding&&!charging?RIDE_LIFE.breath[0]*(1+Math.sin(life.clock*RIDE_LIFE.breath[1])):0;
    // (A charge taken over from a landing starts where the landing had him, and is not let up to fill again.)
    if(!charging)life.held=0;
    const down=charging?Math.max(life.held,RIDE_LIFE.press+(RIDE_LIFE.full-RIDE_LIFE.press)*smooth((charge-.3)/.7))+pumping*pump
      :breath+Math.abs(carve)*RIDE_LIFE.press_into_turn;
    // The road: how his climb changed in one frame. Leaving it, or meeting it again, is a landing's business.
    let kick=0;
    if(riding&&p.grounded){
      if(Number.isFinite(life.height)){const climb=(p.pos.y-life.height)/dt;kick=THREE.MathUtils.clamp(climb-life.climb,-4,4);life.climb=climb;}
      life.height=p.pos.y;
    }else{life.height=Number.NaN;life.climb=0;}
    // A kerb is a step in one frame; his knees take it up over a few.
    life.kicked+=kick;
    const taken=life.kicked*(1-Math.exp(-dt/RIDE_LIFE.kickSeconds));
    life.kicked-=taken;life.bumpSpeed+=taken*RIDE_LIFE.kick;
    const spring=(value:number,speed:number,target:number,[rate,damping]:readonly [number,number]):[number,number]=>{
      // Small fixed steps: the same swing at 30 Hz as at 120.
      const steps=Math.max(1,Math.ceil(dt*240)),h=dt/steps;
      for(let i=0;i<steps;i++){speed+=(rate*rate*(target-value)-2*damping*rate*speed)*h;value+=speed*h;}
      return [value,speed];
    };
    [life.down,life.downSpeed]=spring(life.down,life.downSpeed,down,RIDE_LIFE.crouch);
    [life.lean,life.leanSpeed]=spring(life.lean,life.leanSpeed,carve+sway,RIDE_LIFE.lean);
    [life.bump,life.bumpSpeed]=spring(life.bump,life.bumpSpeed,0,RIDE_LIFE.bump);
    life.bump=THREE.MathUtils.clamp(life.bump,RIDE_LIFE.bumpRange[0],RIDE_LIFE.bumpRange[1]);
  }

  /** The riding pose, upright or charging: several of the source's stances
   * mixed by the rider's springs. The last one sampled is always a stance
   * with both feet on the deck, which is what the contact fit reads. */
  private sampleRide(): Record<string, number> {
    const rt=this.retarget,life=this.life,options={travel:false,rest:false};
    const loop=(name:string,clock=this.idleClock)=>{const clip=this.clips.get(name)!;return rt.apply(clip,clock%clipDuration(clip),options);};
    const still=(name:string,frame:number)=>{const clip=this.clips.get(name)!;return rt.apply(clip,frame/clip.fps,options);};
    // The pose just sampled, `weight` of the way from `from`.
    const mix=(from:Pose,was:Record<string,number>,now:Record<string,number>,weight:number)=>{
      this.blend(from,weight);
      const out:Record<string,number>={};
      for(const key of new Set([...Object.keys(was),...Object.keys(now)]))out[key]=THREE.MathUtils.lerp(was[key]??1,now[key]??1,weight);
      return out;
    };
    // (The controller's lean is positive toward the side the source calls N.)
    const lean=THREE.MathUtils.clamp(life.lean,-1,1),tilt=Math.abs(lean),toward=lean>=0?'N100':'P100';
    const down=THREE.MathUtils.clamp(life.down+Math.max(0,life.bump),0,1/RIDE_LIFE.depth);
    // Upright: the ride loop, drifting toward the looser stance and back, leaned into a turn, lifted off a crest.
    let scalars=loop(rideNames[this.style]);
    const drift=this.style==='Relaxed'?RIDE_LIFE.drift[0]*(.5+.5*Math.sin(life.clock*RIDE_LIFE.drift[1]))*(1-smooth(down*2)):0;
    if(drift>.004){const from=this.capture();scalars=mix(from,scalars,loop(rideNames.Loose),drift);}
    if(tilt>.004){const from=this.capture();scalars=mix(from,scalars,loop(`R_IDLE_HCOM_${toward}`),tilt*RIDE_LIFE.tilt);}
    // His arms ride loose while he coasts, and lift off a crest.
    const swing=(share:number,frame:number,frames:number,rate:number,phase=0)=>[share,frame+frames*Math.sin(life.clock*rate+phase)] as const;
    const [loose,looseFrame]=swing(...RIDE_LIFE.loose),lifted=Math.min(.6,Math.max(0,-life.bump)*2);
    const arms=Math.max(lifted,loose*(1-smooth(down*3))*(1-life.pumping));
    if(arms>.004){
      const from=this.capture();
      scalars=mix(from,scalars,still('R_PUMP_STR_HCOM_0_N',THREE.MathUtils.lerp(looseFrame,30,lifted/arms)),arms);
    }
    if(down>.004){
      const upright=this.capture(),uprightScalars=scalars;
      // Down: the ollie crouch, on its own bounce; leaned as he steers; folded on toward the hard landing's low point.
      scalars=loop('R_ANTIC_OLLIE_N_0_CYC',life.clock);
      if(tilt>.004){const from=this.capture();scalars=mix(from,scalars,loop(`R_ANTIC_OLLIE_${lean>=0?'L':'R'}_0_CYC`,life.clock),tilt*RIDE_LIFE.lowTilt);}
      const fold=THREE.MathUtils.lerp(RIDE_LIFE.fold[0],RIDE_LIFE.fold[1],smooth(life.down));
      {const from=this.capture();scalars=mix(from,scalars,still('L_LAND_HIGH_AGGR_1_N',RIDE_LIFE.foldFrame),fold);}
      // At full charge his arms swing with the pump.
      const [pumped,pumpFrame]=swing(...RIDE_LIFE.arms,.6);
      if(life.pumping>.004){const from=this.capture();scalars=mix(from,scalars,still('R_PUMP_STR_CROUCH_0_N',pumpFrame),pumped*life.pumping);}
      scalars=mix(upright,uprightScalars,scalars,down*RIDE_LIFE.depth);
    }
    return scalars;
  }
  /** For the studies and checks: the rider's springs as they stand. */
  get lifeDiagnostics() {
    const life=this.life;
    return {down:+life.down.toFixed(4),lean:+life.lean.toFixed(4),bump:+life.bump.toFixed(4)};
  }

  private enter(phase: Phase, name = ''): void {
    this.fromPose = this.lastPose ?? this.capture(); this.fade = 0;
    this.fromPreviousPose=this.previousPose;this.transitionDt=this.previousDt;this.transitionAge=0;
    this.phase = phase; this.time = 0; this.sourceName = name;
    if(phase==='dismount')this.dismountRunBlend=0;
    this.clip = name ? this.clips.get(name)! : null;
    if (name && !this.clip) throw new Error(`Missing playable source clip: ${name}`);
    this.visits.set(phase, (this.visits.get(phase) ?? 0) + 1);
  }
  private ride(): void {this.enter('ride', rideNames[this.style]);}
  private pushName(part: string): string {return `R_PUSH${this.pushFast?'HSP':'LSP'}_HSTR_N_0_${part}`;}
  private get preparingMount(): boolean {
    const p=this.p,input=p.rawInput;
    return this.enabled&&p.grounded&&!p.freeSkate&&!p.boardMountBlocked&&p.charging
      &&input.jumpHeld&&!input.jumpCancelled&&!input.grabHeld&&(input.moveX!==0||input.moveY!==0);
  }
  private mountName(speed: number): string {
    return speed>6?'BR_RUN_FWD_50_INTO_MOUNT':speed>1.5?'BR_WALK_FWD_25_INTO_MOUNT':'BR_STAND_0_INTO_MOUNT';
  }
  private sourceFrame(): void {
    this.body.position.set(0,0,0);this.body.scale.copy(this.bodyScale);
    this.body.rotation.set(0,this.p.visualYaw,0);
    this.boardMount.position.set(0,0,0);this.boardMount.quaternion.identity();this.boardMount.scale.setScalar(1);
    this.retarget.board.scale.copy(this.boardScale);
    this.rider.position.set(0,0,0);this.rider.quaternion.identity();
  }
  private placeMountBoard(world: THREE.Matrix4, sourceHips: THREE.Vector3): void {
    const board=this.retarget.board;
    // Preserve source board-to-rider travel while the incoming torso/root are
    // still blended with native locomotion. Its height stays ground-relative.
    const hips=this.retarget.rig.jointsById.get('hips')!.node.getWorldPosition(new THREE.Vector3());
    world.elements[12]+=hips.x-sourceHips.x;world.elements[14]+=hips.z-sourceHips.z;
    board.parent!.updateWorldMatrix(true,false);
    new THREE.Matrix4().copy(board.parent!.matrixWorld).invert().multiply(world)
      .decompose(board.position,board.quaternion,board.scale);
  }
  private prepareMount(dt: number, applyDeformations: PlayerAnimationOverlayContext['applyDeformations']): void {
    const holding=this.preparingMount;
    if(holding&&!this.preparedMount)this.preparedMount=this.mountName(this.previousFootSpeed);
    this.mountPreparation=THREE.MathUtils.clamp(this.mountPreparation+(holding?dt/Math.max(1/60,TUNING.skateHoldTime):-dt/.18),0,1);
    if(!this.mountPreparation){this.preparedMount='';return;}
    // Keep native running feet, charge compression and turn behaviour. Only the
    // source's reaching/balancing upper body eases in, and reverses on cancel.
    const lengths=Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id])=>[id,this.p.playerAnimationBridge.deformationValue(id)]));
    applyDeformations({});
    const native=this.capture();
    this.sourceFrame();
    const clip=this.clips.get(this.preparedMount)!;
    this.retarget.apply(clip,mountStarts[clip.name]/clip.fps,{travel:false,rest:false});
    const source=this.capture(),board=this.retarget.board;
    board.updateWorldMatrix(true,false);const boardWorld=board.matrixWorld.clone();
    const sourceHips=this.retarget.rig.jointsById.get('hips')!.node.getWorldPosition(new THREE.Vector3());
    this.blend(native,0);
    const weight=smooth(this.mountPreparation)*.8;
    for(const joint of this.retarget.rig.joints){
      if(!mountUpperBody.test(joint.id))continue;
      joint.node.quaternion.slerp(source[this.nodes.indexOf(joint.node)].q,weight);
    }
    applyDeformations(lengths);
    // The preparation uses the upcoming released deck, never the unrelated
    // hidden prop under the native crouch. Keep it independent of pelvis bob.
    if(holding){
      this.placeMountBoard(boardWorld,sourceHips);
      this.boardSupport.setFromNormalAndCoplanarPoint(this.p.groundHit?.normal??new THREE.Vector3(0,1,0),this.p.pos);
      groundBoard(board,this.boardSupport,this.boardLift);
    }
  }

  private update({deltaSeconds: dt, applyDeformations}: PlayerAnimationOverlayContext): void {
    this.boardGroundLift=0;
    this.iceFootError=0;
    const p = this.p, mounted = Boolean(p.freeSkate || (!p.grounded && p.airFromSkate));
    // Startup/course reveals may present a mounted rider before its first input.
    const input = p.rawInput ?? {};
    if(this.resetVersion!==p.animationResetVersion){
      this.reset();this.resetVersion=p.animationResetVersion;
      this.wasMounted=mounted;this.wasGrounded=p.grounded;
    }
    // X already powers the native controller. Show that effort with the push
    // cycle below cruising speed, including a neutral/sideways stick. Separate
    // enter/exit thresholds prevent a low-speed boundary from chattering.
    const recoverySpeed=Math.max(0,Math.min(TUNING.cruiseSpeed,TUNING.maxSpeed,groundSpeedLimit(p.groundHit)));
    const recoveryEligible=this.enabled&&mounted&&p.grounded&&input.jumpHeld
      &&!input.jumpCancelled&&!input.grabHeld;
    const finishingPush=this.speedRecoveryPush&&(this.phase==='push-enter'||
      this.phase==='push'&&this.clip!==null&&this.time+dt<clipDuration(this.clip));
    this.speedRecoveryPush=recoveryEligible&&recoverySpeed>0&&(finishingPush||Math.abs(p.speed)<
      recoverySpeed*(this.speedRecoveryPush?.98:.65));
    if(mounted)this.sourceStance=this.previousSkateStance=p.stance;
    this.nativeOwner=this.nativePoseOwner;
    if(!mounted||!p.grounded||!this.enabled)this.iceBlend=0;
    const ice=this.nativeOwner==='ice balance';
    const fakie=this.nativeOwner==='switch stance';
    if((this.nativeOwner!==null&&!ice&&!fakie) || (!this.enabled&&(ice||fakie))){
      // Do not even clear/reapply proportions under a different pose owner.
      // Clear outgoing source poses immediately; recovery blends from the
      // current native pose without inventing a mount, pickup or ink event.
      this.phase='foot';this.sourceName='';this.clip=null;this.time=0;this.fade=1;
      this.fromPose=this.fromPreviousPose=null;
      // The controller resets stance for the NEXT mount when feet go down.
      // Remember the actual outgoing native pose (especially fakie), before
      // that reset can turn a pickup's first frame through 180 degrees.
      p.clearCharacterAppearance();this.lastPose=this.capture();p.syncCharacterAppearance();
      this.iceBlend=p.stance!==DEFAULT_SKATE_STANCE?1:0;
      this.mountPreparation=0;this.preparedMount='';
      this.wasMounted=mounted;this.wasGrounded=p.grounded;this.opacity(1);return;
    }
    // Fakie retains native riding. Only its speed-recovery push borrows the
    // opposite source stance, through the same contact-preserving handoff as
    // ice. A completed push blends back rather than snapping at the speed cap.
    const iceTarget=ice&&p.groundHit?.slippy||fakie&&!this.speedRecoveryPush?1:0;
    this.iceBlend=THREE.MathUtils.clamp(this.iceBlend+(iceTarget?1:-1)*Math.max(0,dt)/(iceTarget ? .24 : .28),0,1);
    if(this.iceBlend===1){
      // Once settled, native ice owns its exact live pose and elasticity.
      this.phase='foot';this.sourceName='';this.clip=null;this.time=0;this.fade=1;
      p.clearCharacterAppearance();this.lastPose=this.capture();p.syncCharacterAppearance();
      this.fromPose=this.fromPreviousPose=null;
      this.idleClock+=dt;this.wasMounted=mounted;this.wasGrounded=p.grounded;this.opacity(1);return;
    }
    if(!this.enabled && this.phase==='foot' && this.fade>=1) {
      this.wasMounted=mounted;this.wasGrounded=p.grounded;this.lastPose=null;return;
    }
    // Crossfades store animation-space transforms. Capturing the persistent
    // Character Lab offsets here would apply the neck/hip offsets twice at
    // every transition. Reapply that design exactly once after the pose.
    p.clearCharacterAppearance();
    const iceWeight=smooth(this.iceBlend);
    const nativeFeet=iceWeight>0?this.captureFootContacts():null;
    const pickup=!mounted&&(this.wasMounted||this.phase==='dismount');
    const nativeLengths=iceWeight>0||pickup?Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id])=>
      [id,p.playerAnimationBridge.deformationValue(id)])):null;
    // Blend undeformed poses, then apply the interpolated independent lengths
    // once. Otherwise endpoint translation would receive the stretch twice.
    if(nativeLengths)applyDeformations({});
    const nativePose=iceWeight>0||pickup?this.capture():null;
    const wanted = this.enabled;
    const entered = mounted && !this.wasMounted, left = !mounted && this.wasMounted;
    const landed = p.grounded && !this.wasGrounded;
    this.wasMounted = mounted; this.wasGrounded = p.grounded;
    this.idleClock += dt; this.time += dt;
    this.fade = Math.min(1, this.fade + dt / (this.phase === 'land' ? .07 : .18));
    this.advanceLife(dt, wanted && mounted && (this.phase === 'ride' || this.phase === 'charge'), wanted && this.phase === 'charge');

    if (!wanted) {
      if (this.phase !== 'foot') this.enter('foot');
    } else if (entered && p.grounded) {
      this.sourceStance=p.stance;
      this.mountHold = Boolean(input.jumpHeld);
      this.enter('mount', this.preparedMount||this.mountName(this.previousFootSpeed));
      this.mountStart=mountStarts[this.sourceName]/this.clip!.fps;
      this.mountPreparation=0;this.preparedMount='';
    } else if (left && p.grounded) {
      this.sourceStance=this.previousSkateStance;
      this.enter('dismount', p.walkVelocity.length()>2 ? 'BR_DISMOUNT_LO_INTO_RUN_FWD' : 'BR_DISMOUNT_LO_INTO_STAND_0');
    } else if (mounted && !p.grounded) {
      if (this.phase !== 'air') this.enter('air','OLLIE_LOW_A');
    } else if (mounted && landed) {
      this.enter('land', this.style==='Loose'?'L_LAND_HIGH_LOOSE_1_N':'L_LAND_HIGH_AGGR_1_N');
    } else if (!mounted && !p.grounded) {
      if(this.phase!=='foot')this.enter('foot');
    } else if (this.phase === 'land' && mounted && this.time >= RIDE_LIFE.foldFrame / this.clip!.fps &&
        input.jumpHeld && !input.jumpCancelled && !this.speedRecoveryPush) {
      // Held through a landing, the charge takes him at the landing's own low
      // point instead of letting him stand up first to crouch again.
      this.mountHold = false;
      this.enter('charge','R_ANTIC_OLLIE_N_0_CYC');
      this.life.down = this.life.held = RIDE_LIFE.full; this.life.downSpeed = 0;
    } else if (this.phase === 'mount' || this.phase === 'dismount' || this.phase === 'land') {
      if (this.time >= clipDuration(this.clip!)-(this.phase==='mount'?this.mountStart:0)) {
        if (mounted) this.ride(); else {
          const alreadyRunning=this.phase==='dismount'&&this.dismountRunBlend>=1;
          this.enter('foot');
          // The live gait has already taken over; do not fade from a frozen
          // stride a second time or restart its phase at the clip boundary.
          if(alreadyRunning){this.fromPose=null;this.fade=1;}
        }
      }
    } else if (mounted) {
      if (this.phase === 'foot' || this.phase === 'air') this.ride();
      if (!input.jumpHeld) this.mountHold = false;
      const charge = input.jumpHeld && !input.jumpCancelled && !this.mountHold && !this.speedRecoveryPush;
      const pushing = !input.grabHeld && (this.speedRecoveryPush || !charge && input.moveY > .25);
      const pushSpeedAllowed = this.speedRecoveryPush || Math.abs(p.speed)<19;
      // Riding and charging are one body on the same springs: going from one
      // to the other is not a cut, so nothing is faded.
      if (charge && this.phase !== 'charge') {
        const riding = this.phase === 'ride';
        this.enter('charge','R_ANTIC_OLLIE_N_0_CYC');
        if (riding) {this.fromPose = null; this.fade = 1;}
      } else if (!charge && this.phase === 'charge') {this.ride(); this.fromPose = null; this.fade = 1;}
      else if (pushing && pushSpeedAllowed && this.phase === 'ride') {
        this.pushFast = Math.abs(p.speed) > 10; this.enter('push-enter',this.pushName('INTO'));
      } else if (!pushing && (this.phase === 'push' || this.phase === 'push-enter')) {
        this.enter('push-recover','R_PUSH_H_N_OUT_MIDFRONT');
      } else if (this.phase === 'push-enter' && this.time >= clipDuration(this.clip!)) this.enter('push',this.pushName('CYC2'));
      else if (this.phase === 'push' && this.time >= clipDuration(this.clip!)) {
        // Cycle2 is a graph leaf, not a closed loop: blend across its seam.
        if (pushing && pushSpeedAllowed) this.enter('push',this.pushName('CYC2'));
        else this.enter('push-recover','R_PUSH_H_N_OUT_MIDFRONT');
      } else if (this.phase === 'push-recover' && this.time >= clipDuration(this.clip!)) this.ride();
      else if (this.phase === 'ride' && this.sourceName !== rideNames[this.style]) this.ride();
    } else if (this.phase !== 'foot') this.enter('foot');

    if(!mounted)this.previousFootSpeed=p.walkVelocity.length();
    if (this.phase === 'foot') {
      this.opacity(1);
      if(nativeLengths)applyDeformations(nativeLengths);
      this.blendTransition(dt);
      this.prepareMount(dt,applyDeformations);
      this.lastPose = this.capture();
      p.syncCharacterAppearance();
      return;
    }

    applyDeformations({});
    // Native skating adds a side-on root turn. Source hips already contain it.
    this.sourceFrame();
    let sampleTime = this.time+(this.phase==='mount'?this.mountStart:0);
    if (this.phase === 'air') sampleTime = Math.min(clipDuration(this.clip!), this.time);
    const riding = this.phase === 'ride' || this.phase === 'charge';
    let scalars = riding ? this.sampleRide() : this.retarget.apply(this.clip!,sampleTime,{travel:false,rest:false});
    if(this.phase==='air' && p.vVel<0) {
      const airPose=this.capture(),airScalars=scalars;
      const weight=smooth(-p.vVel/7);
      scalars=this.retarget.apply(this.clips.get('L_LAND_HIGH_AGGR_1_N')!,0,{travel:false,rest:false});
      this.blend(airPose,weight);
      for(const key of Object.keys(scalars))scalars[key]=THREE.MathUtils.lerp(airScalars[key]??1,scalars[key],weight);
    }
    // The shared profile adds a small, finite chest settle. Source limb stretch
    // stays intact, and no parent/skeleton squash is used.
    const amplitude = characterElasticityAmplitudes(this.phase==='land'?'land':'skate')[0];
    const beat = this.phase==='land' ? -Math.sin(Math.min(1,this.time/clipDuration(this.clip!))*Math.PI*2)
      : this.phase==='mount' ? Math.sin(this.time/(clipDuration(this.clip!)-this.mountStart)*Math.PI*2) : 0;
    scalars['deform.torso.length'] = 1 + amplitude * beat;
    applyDeformations(scalars);
    this.fitSourceContacts();
    // Source samples carry their ground height. Terrain orientation belongs to
    // the native support frame; do not tilt on-foot pickup around a deck axis.
    if (mounted && this.phase!=='mount' && p.grounded && p.groundHit?.normal) {
      const support = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),p.groundHit.normal);
      const turn = this.body.quaternion.clone();
      this.body.quaternion.premultiply(support);
      // The board takes the road as it comes. He takes it late: over the foot
      // of a ramp or a hump the deck tips under him and he comes round to it
      // after, where he used to be thrown over with it in a single frame.
      if (!this.roadKnown) {this.road.copy(support); this.roadKnown = true;}
      else this.road.slerp(support, 1 - Math.exp(-Math.max(0, dt) * RIDE_LIFE.road));
      if (this.road.angleTo(support) > 1e-4) {
        this.rider.quaternion.premultiply(this.body.quaternion.clone().invert().multiply(this.road).multiply(turn));
        // His soles go back onto the deck as it now lies.
        this.fitSourceContacts();
      }
    } else this.roadKnown = false;
    this.retarget.board.updateWorldMatrix(true,false);
    const mountBoard=this.phase==='mount'?this.retarget.board.matrixWorld.clone():null;
    const mountHips=mountBoard?this.retarget.rig.jointsById.get('hips')!.node.getWorldPosition(new THREE.Vector3()):null;
    this.blendTransition(dt);
    // Body anticipation blends into the hop; the released board follows its
    // source path continuously instead of blending back through a carried pose.
    if(mountBoard&&mountHips){
      this.placeMountBoard(mountBoard,mountHips);
      // Retargeted contacts were solved before the outgoing running legs were
      // blended in. Refit the displayed soles as those source contacts take
      // ownership, otherwise a trailing heel passes through the visible deck.
      p.syncCharacterAppearance({upperArmRestAngleWeight:0});
      this.fitSourceContacts(smooth(this.fade*1.5));
    }
    this.fitEquipmentGround();
    if(this.phase==='dismount'&&nativePose&&nativeLengths) {
      const cue=dismountInkFrames[this.sourceName];
      const feetClear=this.time>=cue.feetClear/this.clip!.fps;
      if(feetClear&&(p.walkVelocity.length()>.15||this.dismountRunBlend>0))
        this.dismountRunBlend=Math.min(1,this.dismountRunBlend+Math.max(0,dt)/.18);
      const gait=smooth(this.dismountRunBlend);
      const upper=gait*smooth((this.time-cue.catch/this.clip!.fps)/.18);
      if(gait>0) {
        applyDeformations({});
        this.nodes.forEach((node,i)=>{
          if(node===this.retarget.board||node===this.boardMount)return;
          const weight=this.upperBodyNodes.has(node)?upper:gait;
          node.position.lerp(nativePose[i].p,weight);
          node.quaternion.slerp(nativePose[i].q,weight);
          node.scale.lerp(nativePose[i].s,weight);
        });
        const lengths=Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id])=>[id,
          THREE.MathUtils.lerp(scalars[id]??1,nativeLengths[id],id.startsWith('deform.leg.')?gait:upper)]));
        applyDeformations(lengths);
        this.fitSourceBoardGrip();this.fitEquipmentGround();
      }
    }
    if(nativePose&&nativeFeet&&nativeLengths){
      const sourceFeet=this.captureFootContacts();
      applyDeformations({});
      this.blend(nativePose,1-iceWeight);
      const lengths=Object.fromEntries(ELASTIC_LENGTH_CONTROLS.map(([id])=>
        [id,THREE.MathUtils.lerp(scalars[id]??1,nativeLengths[id],iceWeight)]));
      applyDeformations(lengths);
      this.boardSupport.setFromNormalAndCoplanarPoint(p.groundHit?.normal??new THREE.Vector3(0,1,0),p.pos);
      this.boardGroundLift=groundBoard(this.retarget.board,this.boardSupport,this.boardLift);
      this.fitBlendedFeet(sourceFeet,nativeFeet,iceWeight);
    }
    this.opacity(this.phase==='mount' ? smooth(this.time/.10)
      : this.phase==='dismount' ? smooth((clipDuration(this.clip!)-this.time)/.14) : 1);
    this.retarget.board.visible = true;
    // Contacts include the actual shoe size and limb proportions. Strip only
    // those editable offsets before storing the corrected animation pose.
    if(mountBoard)p.clearCharacterAppearance();
    this.lastPose = this.capture();
    p.syncCharacterAppearance({upperArmRestAngleWeight:iceWeight*(p.characterUpperArmRestAngleWeight??0)});
  }

  private captureFootContacts(): FootContact[] {
    const board=this.retarget.board;
    board.updateWorldMatrix(true,true);
    const inverse=board.getWorldQuaternion(new THREE.Quaternion()).normalize().invert();
    return (['Left','Right'] as const).map(side=>{
      const ankle=this.retarget.rig.jointsById.get(`ankle${side}`)!.node;
      const socket=ankle.getObjectByName(`socket-foot-${side.toLowerCase()}`)!;
      return {side,p:board.worldToLocal(socket.getWorldPosition(new THREE.Vector3())),
        q:inverse.clone().multiply(ankle.getWorldQuaternion(new THREE.Quaternion()).normalize()).normalize()};
    });
  }

  private fitBlendedFeet(source:FootContact[],native:FootContact[],weight:number):void {
    const board=this.retarget.board,rig=this.retarget.rig;
    board.updateWorldMatrix(true,true);
    const boardQ=board.getWorldQuaternion(new THREE.Quaternion()).normalize();
    for(let i=0;i<source.length;i++){
      const {side}=source[i],root=rig.jointsById.get(`hip${side}`)!.node,mid=rig.jointsById.get(`knee${side}`)!.node;
      const ankle=rig.jointsById.get(`ankle${side}`)!.node,socket=ankle.getObjectByName(`socket-foot-${side.toLowerCase()}`)!;
      const target=board.localToWorld(source[i].p.clone().lerp(native[i].p,weight));
      const orientation=boardQ.clone().multiply(source[i].q.clone().slerp(native[i].q,weight)).normalize();
      const pole=mid.getWorldPosition(new THREE.Vector3());
      // Reorienting a scaled shoe moves its sole socket. Iterate to contact,
      // rather than assuming three passes suffice at every blend fraction.
      for(let n=0;n<8;n++){
        ankle.quaternion.copy(ankle.parent!.getWorldQuaternion(new THREE.Quaternion()).normalize().invert()).multiply(orientation).normalize();
        ankle.updateWorldMatrix(true,true);
        const end=target.clone().sub(socket.getWorldPosition(new THREE.Vector3())).add(ankle.getWorldPosition(new THREE.Vector3()));
        solveTwoBoneIk({root,mid,end:ankle,target:end,pole,solveSpace:root.parent!,tolerance:.0005});
        ankle.quaternion.copy(ankle.parent!.getWorldQuaternion(new THREE.Quaternion()).normalize().invert()).multiply(orientation).normalize();
        ankle.updateWorldMatrix(true,true);
        if(socket.getWorldPosition(new THREE.Vector3()).distanceToSquared(target)<.0005**2)break;
      }
      ankle.quaternion.copy(ankle.parent!.getWorldQuaternion(new THREE.Quaternion()).normalize().invert()).multiply(orientation).normalize();
      ankle.updateWorldMatrix(true,true);
      this.iceFootError=Math.max(this.iceFootError,socket.getWorldPosition(new THREE.Vector3()).distanceTo(target));
    }
  }

  private fitEquipmentGround(): void {
    this.boardGroundLift=0;
    const p=this.p;
    if(!p.grounded || (this.phase!=='mount'&&this.phase!=='dismount'))return;
    this.boardSupport.setFromNormalAndCoplanarPoint(p.groundHit?.normal ?? new THREE.Vector3(0,1,0),p.pos);
    this.boardGroundLift=groundBoard(this.retarget.board,this.boardSupport,this.boardLift);
    if(this.boardGroundLift<=0)return;
    const rt=this.retarget,rig=rt.rig;
    const src=(name:string)=>new THREE.Vector3(...rt.sampled[rt.data.bones.findIndex(b=>b.name===name)].slice(0,3));
    const sourceBoard=src('SKATEBOARD_ROOT');
    // Carry only existing contacts along with the board. The other planted
    // foot and the torso keep their source pose; never lift the whole rider.
    const hands=(['Left','Right'] as const).map(side=>({side,d:src(side==='Left'?'LEFTHAND':'RIGHTHAND').distanceTo(sourceBoard)}));
    const nearest=hands.sort((a,b)=>a.d-b.d)[0];
    const grip=smooth((sourceBoard.y-.24)/.22)*(1-smooth((nearest.d-.18)/.20));
    const follow=(side:'Left'|'Right',arm:boolean,weight:number)=>{
      if(weight<.001)return;
      const root=rig.jointsById.get(`${arm?'shoulder':'hip'}${side}`)!.node;
      const mid=rig.jointsById.get(`${arm?'elbow':'knee'}${side}`)!.node;
      const end=rig.jointsById.get(`${arm?'wrist':'ankle'}${side}`)!.node;
      const orientation=end.getWorldQuaternion(new THREE.Quaternion());
      const target=end.getWorldPosition(new THREE.Vector3()).addScaledVector(this.boardLift,weight);
      const pole=mid.getWorldPosition(new THREE.Vector3());
      solveTwoBoneIk({root,mid,end,target,pole,accountForParentScale:true,tolerance:.001});
      end.quaternion.copy(end.parent!.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(orientation);
      end.updateWorldMatrix(false,true);
    };
    follow(nearest.side,true,grip);
    for(const side of ['Left','Right'] as const){
      const foot=src(side==='Left'?'LEFTFOOT':'RIGHTFOOT').sub(sourceBoard);
      const deck=this.sourceDeckContact(sourceBoard.y,foot);
      follow(side,false,deck);
    }
  }

  private sourceDeckContact(boardHeight:number,foot:THREE.Vector3):number {
    // In the step-on clips the rear ankle is outside the deck while the sole
    // reaches across it. An ankle-only width test misread this as a ground
    // contact and pulled the planted shoe underneath the deck.
    const width=this.phase==='mount'?.17:.095;
    return (1-smooth((boardHeight-.16)/.16))*(1-smooth((Math.abs(foot.x)-width)/.065))*(1-smooth((foot.y-.13)/.10));
  }

  private fitSourceBoardGrip(): void {
    if(this.clip?.bank!=='OffBoard')return;
    const rt=this.retarget,src=(name:string)=>new THREE.Vector3(...rt.sampled[rt.data.bones.findIndex(b=>b.name===name)].slice(0,3));
    const sourceBoard=src('SKATEBOARD_ROOT');
    // Re-evaluate the hand after blending into locomotion. The board follows
    // its pickup hand, while the live gait keeps ownership of both legs.
    const hands=[['LEFTHAND','wristLeft'],['RIGHTHAND','wristRight']] as const;
    const nearest=hands.map(([s,t])=>({s,t,d:src(s).distanceTo(sourceBoard)})).sort((a,b)=>a.d-b.d)[0];
    const grip=smooth((sourceBoard.y-.24)/.22)*(1-smooth((nearest.d-.18)/.20));
    if(grip>0) {
      const hand=rt.rig.jointsById.get(nearest.t)!.node.getWorldPosition(new THREE.Vector3());
      const desired=this.body.worldToLocal(hand).sub(src(nearest.s).sub(sourceBoard).multiplyScalar(rt.translationScale));
      rt.board.position.lerp(desired,grip);rt.board.updateWorldMatrix(true,true);
    }
  }

  private fitSourceContacts(contactWeight=1): void {
    const rt=this.retarget, rig=rt.rig, samples=rt.sampled, data=rt.data;
    const src=(name:string)=>new THREE.Vector3(...samples[data.bones.findIndex(b=>b.name===name)].slice(0,3));
    const sourceBoard=src('SKATEBOARD_ROOT'), board=rt.board;
    this.body.updateWorldMatrix(true,true);
    this.fitSourceBoardGrip();
    const contacts=(['Left','Right'] as const).map(side=>{
      const source=src(side==='Left'?'LEFTFOOT':'RIGHTFOOT').sub(sourceBoard);
      const ankle=rig.jointsById.get(`ankle${side}`)!.node;
      const socket=ankle.getObjectByName(`socket-foot-${side.toLowerCase()}`)!;
      const position=socket.getWorldPosition(new THREE.Vector3());
      const local=board.worldToLocal(position.clone());
      const settings=skateboardSettings.value,scale=settings.overallScale;
      const deck=this.sourceDeckContact(sourceBoard.y,source);
      const ground=(1-deck)*(1-smooth((sourceBoard.y+source.y-.12)/.11));
      const weight=deck+ground;
      const height=(settings.boardToGroundDistance+evaluateSkateboardSurfaceHeight(settings,local.x/scale,local.z/scale))*scale;
      const target=position.clone().setY(this.p.pos.y+.005).lerp(board.localToWorld(local.clone().setY(height)),deck/Math.max(.001,weight));
      return {side,ankle,socket,position,target,weight:weight*contactWeight};
    });
    const supported=contacts.filter(c=>c.weight>.001);
    if(!supported.length || this.phase==='air')return;
    // Lower the pelvis as one translation before the per-leg solve. No leg
    // length scaling or whole-character compression is needed to meet the deck.
    const correction=supported.reduce((sum,c)=>sum+(c.target.y-c.position.y)*c.weight,0)/Math.max(1,supported.reduce((sum,c)=>sum+c.weight,0));
    this.rider.position.y+=THREE.MathUtils.clamp(correction/this.bodyScale.y,-.28,.16);
    this.body.updateWorldMatrix(true,true);
    for(const c of supported) {
      const root=rig.jointsById.get(`hip${c.side}`)!.node, mid=rig.jointsById.get(`knee${c.side}`)!.node;
      const rootQ=root.quaternion.clone(),midQ=mid.quaternion.clone(),ankleQ=c.ankle.quaternion.clone();
      const endQ=c.ankle.getWorldQuaternion(new THREE.Quaternion());
      const pole=mid.getWorldPosition(new THREE.Vector3());
      for(let i=0;i<3;i++) {
        c.ankle.quaternion.copy(c.ankle.parent!.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(endQ);
        c.ankle.updateWorldMatrix(true,true);
        const target=c.target.clone().sub(c.socket.getWorldPosition(new THREE.Vector3())).add(c.ankle.getWorldPosition(new THREE.Vector3()));
        solveTwoBoneIk({root,mid,end:c.ankle,target,pole,accountForParentScale:true,tolerance:.001});
      }
      c.ankle.quaternion.copy(c.ankle.parent!.getWorldQuaternion(new THREE.Quaternion()).invert()).multiply(endQ);
      root.quaternion.slerp(rootQ,1-c.weight);mid.quaternion.slerp(midQ,1-c.weight);c.ankle.quaternion.slerp(ankleQ,1-c.weight);
    }
  }

  get diagnostics() {
    const p=this.p;
    return {phase:this.phase, source:this.sourceName, time:+this.time.toFixed(3), fade:+this.fade.toFixed(3),
      enabled:this.enabled, nativeOwner:this.nativeOwner, speed:+p.speed.toFixed(3), grounded:p.grounded, mounted:p.freeSkate,
      speedRecoveryPush:this.speedRecoveryPush,
      iceBlend:+smooth(this.iceBlend).toFixed(4),iceFootError:+this.iceFootError.toFixed(5),
      sourceStance:this.sourceStance,dismountRunBlend:+smooth(this.dismountRunBlend).toFixed(4),
      mountPreparation:+this.mountPreparation.toFixed(4),mountProgress:+this.mountProgress.toFixed(4),mountSourceStart:this.phase==='mount'?this.mountStart:0,
      boardVisible:this.retarget.board.visible, boardGroundLift:+this.boardGroundLift.toFixed(4), position:p.pos.toArray(), visits:Object.fromEntries(this.visits)};
  }
}
