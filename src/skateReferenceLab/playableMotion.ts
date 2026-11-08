import * as THREE from 'three';
import type {Player} from '../player';
import type {PlayerAnimationOverlayContext} from '../animation/bridge';
import {characterElasticityAmplitudes} from '../animation/elasticity';
import {solveTwoBoneIk} from '../animation/ik';
import {skateboardSettings} from '../skateboard/settings';
import {evaluateSkateboardSurfaceHeight} from '../skateboard/model';
import {SkateRetargeter, clipDuration, type MotionData, type SourceClip} from './retarget';
import {BoardScribbleSequence, MOUNT_CLEAR_DURATION, SCRIBBLE_DURATION} from './boardScribble';
import {TUNING} from '../tuning';
import {groundBoard,boardGroundClearance} from './boardGrounding';

type Pose = {p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3}[];
type Phase = 'foot' | 'mount' | 'ride' | 'push-enter' | 'push' | 'push-recover' | 'charge' | 'air' | 'land' | 'dismount';
const smooth = (x: number) => {x = THREE.MathUtils.clamp(x, 0, 1); return x*x*(3-2*x);};
const rideNames = {Relaxed:'R_IDLE_RIDE_N_0_CYC', Loose:'R_IDLE_RIDE_LOOSE_0_CYC', Aggressive:'R_IDLE_RIDE_AGGR_0_CYC'};
// Zero-based 60 Hz source cues, checked against Bone Man's retargeted soles.
// Keep the deck visible until both feet clear. Very short pickups need a small
// ink tail after the catch so the burst survives real-time rendering.
const dismountInkFrames: Readonly<Record<string, {feetClear: number; catch: number}>> = {
  BR_DISMOUNT_LO_INTO_STAND_0: {feetClear: 24, catch: 26},
  BR_DISMOUNT_LO_INTO_RUN_FWD: {feetClear: 24, catch: 56},
};

/** Local source-motion presentation only. It observes native gameplay; it never
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
  readonly retarget: SkateRetargeter;
  private readonly nodes: THREE.Object3D[];
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
  private previousFootSpeed = 0;
  private idleClock = 0;
  private clip: SourceClip | null = null;
  private readonly clips: Map<string, SourceClip>;
  private readonly rider: THREE.Object3D;
  private readonly body: THREE.Object3D;
  private readonly bodyScale: THREE.Vector3;
  private readonly boardScale: THREE.Vector3;
  private readonly boardMount: THREE.Object3D;
  private readonly boardSupport = new THREE.Plane();
  private readonly boardLift = new THREE.Vector3();
  private boardGroundLift = 0;
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
    this.retarget = new SkateRetargeter(rig, data, leg);
    this.body = rig.root;
    this.bodyScale = this.body.scale.clone();
    this.boardScale = this.retarget.board.scale.clone();
    this.boardMount = this.retarget.board.parent!;
    this.rider = rig.root.getObjectByName('procedural-rider')!;
    this.nodes = [...new Set([this.body, this.rider, this.boardMount, ...rig.joints.map(j => j.node), this.retarget.board])];
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
    this.wasMounted=Boolean(this.p.freeSkate||!this.p.grounded&&this.p.airFromSkate);
    this.wasGrounded=this.p.grounded;
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
    const p=this.p,ink=this.boardScribble,input=p.rawInput;
    ink.enabled=this.scribbles&&this.enabled;
    const interrupted=!this.enabled||p.isBailing||p.ragActive||p.bailing
      ||!['ride','air'].includes(p.state)||p.crawling||p.sliding||p.wallriding
      ||p.grabbing||p.flipT>0||p.manualing||p.vertAir
      ||p.boardAbandonActive||p.animationClipHint==='player.roll-land';
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
    const holding=this.phase==='foot'&&p.grounded&&!p.freeSkate&&!p.boardMountBlocked
      &&p.charging&&input.jumpHeld&&!input.jumpCancelled&&!input.grabHeld
      &&(input.moveX!==0||input.moveY!==0);
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
    this.boardGroundLift=0;
    this.dismountInkStarted = this.baselineBoardVisible = false;
    this.baselineBoardAlpha = 1;
    this.phase = 'foot'; this.time = 0; this.clip = null;
    this.sourceName='';this.previousFootSpeed=0;this.mountHold=false;this.visits.clear();
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
  private enter(phase: Phase, name = ''): void {
    this.fromPose = this.lastPose ?? this.capture(); this.fade = 0;
    this.fromPreviousPose=this.previousPose;this.transitionDt=this.previousDt;this.transitionAge=0;
    this.phase = phase; this.time = 0; this.sourceName = name;
    this.clip = name ? this.clips.get(name)! : null;
    if (name && !this.clip) throw new Error(`Missing playable source clip: ${name}`);
    this.visits.set(phase, (this.visits.get(phase) ?? 0) + 1);
  }
  private ride(): void {this.enter('ride', rideNames[this.style]);}
  private pushName(part: string): string {return `R_PUSH${this.pushFast?'HSP':'LSP'}_HSTR_N_0_${part}`;}

  private update({deltaSeconds: dt, applyDeformations}: PlayerAnimationOverlayContext): void {
    this.boardGroundLift=0;
    const p = this.p, mounted = Boolean(p.freeSkate || (!p.grounded && p.airFromSkate));
    const nativeAbandon = p.boardAbandonActive || p.animationClipHint === 'player.roll-land';
    const blocked = p.isBailing || !['ride','air'].includes(p.state) || p.crawling || p.sliding || p.wallriding || p.grabbing || p.flipT > 0 || p.manualing || p.vertAir;
    if(nativeAbandon||this.options.continuousTransitions&&blocked){
      // Do not even clear/reapply proportions under a different pose owner.
      // Abandon Ship ejects a real loose board. Neither a mount/pickup fade nor
      // its carried-board ink may overwrite the original flip and landing roll.
      this.phase='foot';this.sourceName='';this.clip=null;this.time=0;this.fade=1;
      this.lastPose=this.previousPose=this.fromPose=this.fromPreviousPose=null;
      this.wasMounted=mounted;this.wasGrounded=p.grounded;this.opacity(1);return;
    }
    if(!this.enabled && this.phase==='foot' && this.fade>=1) {
      this.wasMounted=mounted;this.wasGrounded=p.grounded;this.lastPose=null;return;
    }
    // Crossfades store animation-space transforms. Capturing the persistent
    // Character Lab offsets here would apply the neck/hip offsets twice at
    // every transition. Reapply that design exactly once after the pose.
    p.clearCharacterAppearance();
    const input = p.rawInput;
    const wanted = this.enabled && !blocked;
    const entered = mounted && !this.wasMounted, left = !mounted && this.wasMounted;
    const landed = p.grounded && !this.wasGrounded;
    this.wasMounted = mounted; this.wasGrounded = p.grounded;
    this.idleClock += dt; this.time += dt;
    this.fade = Math.min(1, this.fade + dt / (this.phase === 'land' ? .07 : .18));

    if (!wanted) {
      if (this.phase !== 'foot') this.enter('foot');
    } else if (entered && p.grounded) {
      this.mountHold = Boolean(input.jumpHeld);
      this.enter('mount', this.previousFootSpeed>6 ? 'BR_RUN_FWD_0_INTO_MOUNT' : 'BR_STAND_0_INTO_MOUNT');
    } else if (left && p.grounded) {
      this.enter('dismount', p.walkVelocity.length()>2 ? 'BR_DISMOUNT_LO_INTO_RUN_FWD' : 'BR_DISMOUNT_LO_INTO_STAND_0');
    } else if (mounted && !p.grounded) {
      if (this.phase !== 'air') this.enter('air','OLLIE_LOW_A');
    } else if (mounted && landed) {
      this.enter('land', this.style==='Loose'?'L_LAND_HIGH_LOOSE_1_N':'L_LAND_HIGH_AGGR_1_N');
    } else if (!mounted && !p.grounded) {
      if(this.phase!=='foot')this.enter('foot');
    } else if (this.phase === 'mount' || this.phase === 'dismount' || this.phase === 'land') {
      if (this.time >= clipDuration(this.clip!)) {
        if (mounted) this.ride(); else this.enter('foot');
      }
    } else if (mounted) {
      if (this.phase === 'foot' || this.phase === 'air') this.ride();
      if (!input.jumpHeld) this.mountHold = false;
      const charge = input.jumpHeld && !this.mountHold;
      const pushing = !charge && !input.grabHeld && input.moveY > .25;
      if (charge && this.phase !== 'charge') this.enter('charge','R_ANTIC_CROUCH_HIGHOLLIE_N_0_INTO');
      else if (!charge && this.phase === 'charge') this.ride();
      else if (pushing && Math.abs(p.speed)<19 && this.phase === 'ride') {
        this.pushFast = Math.abs(p.speed) > 10; this.enter('push-enter',this.pushName('INTO'));
      } else if (!pushing && (this.phase === 'push' || this.phase === 'push-enter')) {
        this.enter('push-recover','R_PUSH_H_N_OUT_MIDFRONT');
      } else if (this.phase === 'push-enter' && this.time >= clipDuration(this.clip!)) this.enter('push',this.pushName('CYC2'));
      else if (this.phase === 'push' && this.time >= clipDuration(this.clip!)) {
        // Cycle2 is a graph leaf, not a closed loop: blend across its seam.
        if (pushing && Math.abs(p.speed)<19) this.enter('push',this.pushName('CYC2'));
        else this.enter('push-recover','R_PUSH_H_N_OUT_MIDFRONT');
      } else if (this.phase === 'push-recover' && this.time >= clipDuration(this.clip!)) this.ride();
      else if (this.phase === 'ride' && this.sourceName !== rideNames[this.style]) this.ride();
    } else if (this.phase !== 'foot') this.enter('foot');

    if(!mounted)this.previousFootSpeed=p.walkVelocity.length();
    if (this.phase === 'foot') {
      this.opacity(1);
      this.blendTransition(dt);
      this.lastPose = this.capture();
      p.syncCharacterAppearance();
      return;
    }

    applyDeformations({});
    this.body.position.set(0,0,0);
    this.body.scale.copy(this.bodyScale);
    this.boardMount.position.set(0,0,0);this.boardMount.quaternion.identity();this.boardMount.scale.setScalar(1);
    this.retarget.board.scale.copy(this.boardScale);
    // Native skating adds a side-on root turn. Source hips already contain it.
    this.body.rotation.set(0,p.visualYaw,0);
    this.rider.position.set(0,0,0); this.rider.quaternion.identity();
    let sampleTime = this.time;
    if (this.phase === 'ride') sampleTime = this.idleClock % clipDuration(this.clip!);
    if (this.phase === 'charge') sampleTime = Math.min(clipDuration(this.clip!), this.time);
    if (this.phase === 'air') sampleTime = Math.min(clipDuration(this.clip!), this.time);
    let scalars = this.retarget.apply(this.clip!,sampleTime,{travel:false,rest:false});
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
      : this.phase==='mount' ? Math.sin(this.time/clipDuration(this.clip!)*Math.PI*2) : 0;
    scalars['deform.torso.length'] = 1 + amplitude * beat;
    applyDeformations(scalars);
    this.fitSourceContacts();
    // Source samples carry their ground height. Terrain orientation belongs to
    // the native support frame; do not tilt on-foot pickup around a deck axis.
    if (mounted && this.phase!=='mount' && p.grounded && p.groundHit?.normal) {
      const support = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),p.groundHit.normal);
      this.body.quaternion.premultiply(support);
    }
    this.blendTransition(dt);
    this.fitEquipmentGround();
    this.opacity(this.phase==='mount' ? smooth(this.time/.10)
      : this.phase==='dismount' ? smooth((clipDuration(this.clip!)-this.time)/.14) : 1);
    this.retarget.board.visible = true;
    this.lastPose = this.capture();
    p.syncCharacterAppearance({upperArmRestAngleWeight:0});
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
      const deck=(1-smooth((sourceBoard.y-.16)/.16))*(1-smooth((Math.abs(foot.x)-.095)/.065))*(1-smooth((foot.y-.13)/.10));
      follow(side,false,deck);
    }
  }

  private fitSourceContacts(): void {
    const rt=this.retarget, rig=rt.rig, samples=rt.sampled, data=rt.data;
    const src=(name:string)=>new THREE.Vector3(...samples[data.bones.findIndex(b=>b.name===name)].slice(0,3));
    const sourceBoard=src('SKATEBOARD_ROOT'), board=rt.board;
    this.body.updateWorldMatrix(true,true);
    if(this.clip?.bank==='OffBoard') {
      // The source prop was built for human arm lengths. Keep its authored
      // hand-relative transform while actually held by Bone Man's longer arms.
      const hands=[['LEFTHAND','wristLeft'],['RIGHTHAND','wristRight']] as const;
      const nearest=hands.map(([s,t])=>({s,t,d:src(s).distanceTo(sourceBoard)})).sort((a,b)=>a.d-b.d)[0];
      const grip=smooth((sourceBoard.y-.24)/.22)*(1-smooth((nearest.d-.18)/.20));
      if(grip>0) {
        const hand=rig.jointsById.get(nearest.t)!.node.getWorldPosition(new THREE.Vector3());
        const desired=this.body.worldToLocal(hand).sub(src(nearest.s).sub(sourceBoard).multiplyScalar(rt.translationScale));
        board.position.lerp(desired,grip);board.updateWorldMatrix(true,true);
      }
    }
    const contacts=(['Left','Right'] as const).map(side=>{
      const source=src(side==='Left'?'LEFTFOOT':'RIGHTFOOT').sub(sourceBoard);
      const ankle=rig.jointsById.get(`ankle${side}`)!.node;
      const socket=ankle.getObjectByName(`socket-foot-${side.toLowerCase()}`)!;
      const position=socket.getWorldPosition(new THREE.Vector3());
      const local=board.worldToLocal(position.clone());
      const settings=skateboardSettings.value,scale=settings.overallScale;
      const deck=(1-smooth((sourceBoard.y-.16)/.16))*(1-smooth((Math.abs(source.x)-.095)/.065))*(1-smooth((source.y-.13)/.10));
      const ground=(1-deck)*(1-smooth((sourceBoard.y+source.y-.12)/.11));
      const weight=deck+ground;
      const height=(settings.boardToGroundDistance+evaluateSkateboardSurfaceHeight(settings,local.x/scale,local.z/scale))*scale;
      const target=position.clone().setY(this.p.pos.y+.005).lerp(board.localToWorld(local.clone().setY(height)),deck/Math.max(.001,weight));
      return {side,ankle,socket,position,target,weight};
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
      enabled:this.enabled, speed:+p.speed.toFixed(3), grounded:p.grounded, mounted:p.freeSkate,
      boardVisible:this.retarget.board.visible, boardGroundLift:+this.boardGroundLift.toFixed(4), position:p.pos.toArray(), visits:Object.fromEntries(this.visits)};
  }
}
