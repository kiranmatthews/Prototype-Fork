import * as THREE from 'three';
import {characterElasticityAmplitudes,ELASTIC_LENGTH_CONTROLS,CHARACTER_ELASTICITY_REVISION} from './elasticity';
import {curve} from './pancakeSlam';
import type {Key} from './pancakeSlam';
import type {InertiaShape} from './poseInertia';
import type {AnimationClip,AnimationTrack,RigDefinition,QuaternionTuple} from './types';

/** D's slide and slide jump, keyed one channel at a time: a low, feet-first
 * skid and a high, upright, knees-up jump out of it. Nothing is mirrored. He
 * sweeps down onto his right hip with the right leg long, the left knee up
 * and its foot under him, the body laid back and turned a little, and the
 * arms left trailing at different heights.
 *
 * Every part moves on one eased arc with its own timing, so the spine, head
 * and hands arrive after the hips, pass their rest once and settle. The clips
 * are cut into parts that each run on their own clock; the runtime carries
 * the pose across every cut (`PoseInertia`), so no part has to end where the
 * next begins.
 *
 * Slide: `0..hold` sweeps down onto the hip, `hold..rise` is a quiet sway
 * that loops for as long as the skid lasts, and `rise..end` is the get-up.
 * Slide jump: `0..apex` follows the climb, `apex..apex+fall` opens for the
 * ground and then holds, and `land..end` is the touchdown. */
const HOLD=.46,RISE=1.06;
const r=(age:number)=>RISE+age;
export const JAK_SLIDE={hold:HOLD,rise:RISE,
  /** Seconds after the skid: weight on the feet, and upright. */
  crouch:.24,stand:.50,
  /** Seconds movement stays locked after a plain skid, and the loose tail after that. */
  lock:.65,tail:.32,
  /** The left sole finds its mark during the sweep down and keeps it; the
   * hip settles onto the floor and leaves it again as he gets up. */
  solePlant:[.05,.16],seat:[.10,.20],unseat:[.07,.22],
  /** The right foot comes back under him over this part of the get-up. */
  step:[.04,.30]} as const;
/** The jump out of it: `0..apex` follows the climb, the rest is seconds. */
const A=.40,FALL=.26,LAND=.80;
const a=(age:number)=>A+age,l=(age:number)=>LAND+age;
export const JAK_SLIDE_JUMP={apex:A,fall:FALL,land:LAND,
  /** Seconds after the touchdown: the bottom of the dip, upright, the end. */
  dip:.08,stand:.27,settle:.88} as const;

/** Pelvis heights: standing, and seated on the floor. Standing is where the
 * source idle ends up once the on-foot seating has brought it down from its
 * own, higher root, so the handover to it is level. */
export const JAK_STAND=.56;
/** And where the run that a slide starts from carries it. */
const STAND=JAK_STAND,STRIDE=.541,SEAT=.12;

// Degrees unless noted. `pelvis`/`back` are root height/setback in rig units;
// `reach*` is a thigh's pitch in the body's frame, whatever the hips are
// doing; `torso`/`arms*`/`legs*` are signed loads on the elasticity profile;
// `plant*` levels a sole under its leg and `toes` is its heel lift.
const CHANNELS=['pelvis','back','hips','yaw','roll','spine','twist','chest','neck','look','torso','toes',
  'armPitchL','armRollL','elbowL','armsL','reachL','splayL','kneeL','ankleL','plantL','legsL',
  'armPitchR','armRollR','elbowR','armsR','reachR','splayR','kneeR','ankleR','plantR','legsR'] as const;
type Channel=typeof CHANNELS[number];
/** One keyed clip: a list of keys for each channel it moves. Shared by D's other keyed clips. */
export type JakKeys=Partial<Record<Channel,readonly Key[]>>;
type Keys=JakKeys;
/** The same value at both ends of the looping sway. */
const sit=(value:number,drift=0):Key[]=>[[HOLD,value],[(HOLD+RISE)/2,value+drift],[RISE,value]];

const SLIDE:Keys={
  // One sweep down: the hip eases onto the floor instead of hitting it, and
  // the bounce is left to the spine, head and arms above it. The get-up
  // rocks forward onto the feet, rises a little past standing and sinks back.
  pelvis:[[0,STRIDE,'out'],[.16,SEAT+.003],[.25,SEAT+.016],[.36,SEAT],...sit(SEAT),[r(.06),SEAT+.004],[r(.22),.215],[r(.36),.431],[r(.50),STAND+.041],[r(.66),STAND-.023],[r(.84),STAND]],
  back:[[0,0,'out'],[.17,-.32],[.29,-.30],...sit(-.30),[r(.10),-.25],[r(.27),-.05],[r(.44),0]],
  hips:[[0,6,'out'],[.17,-67],[.28,-60],[.38,-62],...sit(-62,1.5),[r(.07),-57],[r(.19),-14],[r(.29),19],[r(.42),5],[r(.54),-2],[r(.68),.5],[r(.82),0]],
  yaw:[[0,0,'out'],[.19,-27],[.31,-24],...sit(-24),[r(.16),-9],[r(.34),3],[r(.52),0]],
  roll:[[0,0,'out'],[.18,14],[.30,12],...sit(12),[r(.14),3],[r(.30),-2],[r(.46),0]],
  // The spine and chest are still going forward as the hips sweep back, and
  // curl forward first on the way up.
  spine:[[0,4],[.08,13],[.17,15],[.26,6],[.35,11],[.44,10],...sit(10,-1.5),[r(.09),19],[r(.22),16],[r(.39),2],[r(.53),-2],[r(.68),1],[r(.84),0]],
  twist:[[0,0],[.21,-10],[.33,-8],...sit(-8),[r(.20),3],[r(.42),0]],
  chest:[[0,4],[.09,17],[.18,19],[.28,7],[.37,13],[.46,12],...sit(12,-1.5),[r(.10),23],[r(.24),18],[r(.41),2],[r(.55),-3],[r(.70),1],[r(.86),0]],
  neck:[[0,0],[.10,14],[.20,30],[.30,18],[.39,23],[.46,22],...sit(22,2),[r(.13),28],[r(.31),13],[r(.47),6],[r(.63),-1],[r(.82),0]],
  look:[[0,0],[.21,20],[.33,18],...sit(18),[r(.20),4],[r(.40),0]],
  torso:[[0,0],[.08,.25],[.18,-.55],[.28,.15],[.38,0],...sit(0),[r(.18),-.45],[r(.38),.3],[r(.50),.4],[r(.65),-.2],[r(.82),0]],
  toes:[[r(.30),0],[r(.48),14],[r(.66),0]],

  // Right leg: thrown long along the floor; it folds back under him as he rises.
  reachR:[[0,-14,'out'],[.07,-62],[.16,-86],[.27,-83],...sit(-84),[r(.12),-80],[r(.26),-62],[r(.50),-2],[r(.65),-9],[r(.82),0]],
  splayR:[[0,3],[.16,9],...sit(8),[r(.26),7],[r(.50),5],[r(.82),6]],
  kneeR:[[0,30],[.05,48],[.14,6],[.23,12],[.33,8],...sit(8),[r(.12),50],[r(.26),96],[r(.50),4],[r(.65),18],[r(.82),6]],
  ankleR:[[0,0],[.14,-22],[.25,-12],[.35,-14],...sit(-14,2),[r(.10),4]],
  plantR:[[r(0),0],[r(.10),1]],
  legsR:[[0,0],[.10,.5],[.18,-.2],[.28,0]],
  // Left leg: the knee comes up and the foot stays under him.
  reachL:[[0,16,'out'],[.08,-44],[.18,-106],[.29,-102],...sit(-102),[r(.12),-104],[r(.26),-72],[r(.50),-2],[r(.65),-9],[r(.82),0]],
  splayL:[[0,3],[.17,26],[.28,24],...sit(24),[r(.26),10],[r(.50),5],[r(.82),6]],
  kneeL:[[0,20,'out'],[.08,84],[.18,108],[.28,103],...sit(103),[r(.12),108],[r(.26),100],[r(.50),4],[r(.65),18],[r(.82),6]],
  ankleL:[[0,0],[.10,-12]],
  plantL:[[.06,0],[.15,1]],
  legsL:[[0,0],[.12,-.3],[.22,.1],[.32,0]],

  // The arms are left behind by the drop: they lift, sweep back past the
  // hips and trail, the right one first and lower. On the way up they swing
  // forward for balance and fall to his sides in turn.
  armPitchR:[[0,10],[.07,-32],[.13,-42],[.25,22],[.34,8],[.43,12],...sit(12,-3),[r(.12),-4],[r(.27),-36],[r(.45),-9],[r(.59),9],[r(.74),-3],[r(.90),0]],
  armRollR:[[0,10],[.10,44],[.23,90],[.33,86],...sit(86),[r(.14),60],[r(.29),27],[r(.47),13],[r(.72),10]],
  elbowR:[[0,-30],[.08,-62],[.21,-32],[.31,-46],[.41,-42],...sit(-42),[r(.14),-54],[r(.29),-60],[r(.47),-28],[r(.63),-11],[r(.82),-14]],
  armsR:[[0,0],[.13,.45],[.23,-.2],[.33,0],...sit(0),[r(.27),.3],[r(.42),-.1],[r(.56),0]],
  armPitchL:[[0,-10],[.09,-42],[.15,-54],[.28,62],[.37,45],[.46,50],...sit(50,4),[r(.15),20],[r(.31),-30],[r(.49),-6],[r(.63),11],[r(.79),-4],[r(.95),0]],
  armRollL:[[0,10],[.12,40],[.26,60],[.37,56],...sit(56),[r(.17),44],[r(.33),25],[r(.51),13],[r(.76),10]],
  elbowL:[[0,-30],[.10,-66],[.24,-24],[.34,-39],[.44,-35],...sit(-35,-4),[r(.17),-48],[r(.33),-56],[r(.51),-26],[r(.67),-11],[r(.86),-14]],
  armsL:[[0,0],[.15,.5],[.26,-.2],[.37,0],...sit(0),[r(.31),.3],[r(.46),-.1],[r(.60),0]],
};

// The jump unfolds off the floor in one stretch, both arms thrown up after
// the body, and stays upright: the knees gather under him one after the
// other, the turn of the skid unwinds, and the arms float wide at different
// heights. It hangs gathered over the top, then the legs reach down in turn
// while the arms are left up. The touchdown gives at the knees, the body
// rocks over the feet and springs back up a little past standing. The dip
// itself is the pelvis running on into the stop (`carry`), so a longer fall
// gives more.
const JUMP:Keys={
  pelvis:[[0,SEAT],[.13,.50],[.24,.575],[.34,.558],[A,.555],[a(.12),.565],[a(.22),.56],[LAND,.56],[l(.27),STAND+.035],[l(.45),STAND-.019],[l(.64),STAND]],
  back:[[0,-.30],[.15,-.04],[.24,0],[LAND,0],[l(.10),.03],[l(.28),-.01],[l(.46),0]],
  hips:[[0,-62],[.14,-8],[.24,6],[.33,4],[A,2],[a(.11),-4],[a(.22),-6],[LAND,-6],[l(.10),16],[l(.26),3],[l(.40),-1.5],[l(.56),.5],[l(.70),0]],
  yaw:[[0,-24],[.15,9],[.27,5],[A,-4],[a(.16),0]],
  roll:[[0,12],[.15,-8],[.28,-6],[A,3],[a(.18),0]],
  spine:[[0,10],[.10,2],[.22,12],[.33,10],[A,6],[a(.12),-2],[a(.23),0],[LAND,0],[l(.12),10],[l(.29),0],[l(.43),-2],[l(.59),.5],[l(.74),0]],
  twist:[[0,-8],[.19,6],[A,-3],[a(.15),0]],
  chest:[[0,12],[.11,2],[.24,14],[.35,12],[A,6],[a(.13),-3],[a(.24),0],[LAND,0],[l(.13),12],[l(.31),0],[l(.45),-2],[l(.61),.5],[l(.78),0]],
  neck:[[0,22],[.12,6],[.26,14],[.36,10],[A,12],[a(.14),4],[a(.25),6],[LAND,6],[l(.06),-4],[l(.16),14],[l(.33),6],[l(.47),3],[l(.63),-1],[l(.82),0]],
  look:[[0,18],[.15,0]],
  torso:[[0,0],[.08,.6],[.19,-.3],[.32,-.15],[A,0],[a(.10),.35],[a(.21),.2],[LAND,.2],[l(.08),-.7],[l(.23),.3],[l(.37),-.12],[l(.54),0]],
  toes:[[l(.15),0],[l(.27),13],[l(.44),0]],

  reachR:[[0,-84],[.08,-24],[.20,-98],[.32,-88],[A,-76],[a(.11),-18],[a(.21),2],[LAND,2],[l(.10),-40],[l(.27),-2],[l(.45),-8],[l(.64),0]],
  splayR:[[0,8],[.19,15],[A,12],[a(.13),6]],
  kneeR:[[0,8],[.08,10],[.20,122],[.32,110],[A,98],[a(.11),30],[a(.21),16],[LAND,16],[l(.10),74],[l(.27),4],[l(.45),16],[l(.64),6]],
  ankleR:[[0,-14],[.09,28],[.20,-8],[A,-4],[a(.12),14],[a(.21),8]],
  plantR:[[LAND,0],[l(.05),1]],
  legsR:[[0,0],[.08,.7],[.19,-.45],[.32,-.35],[A,-.35],[a(.10),.45],[a(.21),.2],[LAND,.2],[l(.04),0]],
  reachL:[[0,-102],[.09,-20],[.22,-66],[.33,-84],[a(.02),-76],[a(.13),-44],[a(.23),-28],[LAND,-28],[l(.10),-40],[l(.27),-2],[l(.45),-8],[l(.64),0]],
  splayL:[[0,24],[.09,8],[.21,19],[A,16],[a(.14),8]],
  kneeL:[[0,103],[.09,14],[.23,92],[.33,108],[a(.02),100],[a(.13),62],[a(.23),42],[LAND,42],[l(.10),74],[l(.27),4],[l(.45),16],[l(.64),6]],
  ankleL:[[0,-10],[.10,28],[.23,-8],[a(.02),-4],[a(.14),14],[a(.23),8]],
  plantL:[[0,1],[.05,0],[LAND,0],[l(.05),1]],
  legsL:[[0,0],[.09,.7],[.21,-.45],[.33,-.35],[a(.02),-.35],[a(.12),.45],[a(.23),.2],[LAND,.2],[l(.04),0]],

  armPitchR:[[0,12],[.14,-56],[.25,-72],[.35,-54],[A,-44],[a(.11),-64],[a(.23),-48],[LAND,-48],[l(.06),-62],[l(.20),22],[l(.34),-10],[l(.48),6],[l(.64),-2],[l(.80),0]],
  armRollR:[[0,86],[.14,58],[.25,72],[.36,84],[A,88],[a(.12),80],[a(.23),62],[LAND,62],[l(.07),66],[l(.22),24],[l(.38),12],[l(.64),10]],
  elbowR:[[0,-42],[.12,-30],[.25,-58],[.36,-44],[A,-50],[a(.12),-30],[a(.23),-38],[LAND,-38],[l(.07),-22],[l(.22),-52],[l(.38),-22],[l(.54),-10],[l(.74),-14]],
  armsR:[[0,0],[.12,.6],[.24,-.25],[.35,0],[A,-.15],[a(.12),.3],[a(.23),0],[LAND,0],[l(.07),.35],[l(.20),-.15],[l(.34),0]],
  armPitchL:[[0,50],[.16,-120],[.28,-166],[.37,-152],[a(.02),-140],[a(.13),-156],[a(.25),-100],[LAND,-100],[l(.08),-116],[l(.23),28],[l(.37),-14],[l(.52),8],[l(.68),-3],[l(.86),0]],
  armRollL:[[0,56],[.16,30],[.28,34],[.38,30],[a(.02),40],[a(.14),34],[a(.25),46],[LAND,46],[l(.08),56],[l(.25),28],[l(.42),12],[l(.69),10]],
  elbowL:[[0,-35],[.14,-18],[.28,-40],[.38,-28],[a(.02),-36],[a(.14),-18],[a(.25),-30],[LAND,-30],[l(.08),-20],[l(.25),-56],[l(.42),-24],[l(.60),-10],[l(.80),-14]],
  armsL:[[0,0],[.14,.6],[.26,-.25],[.36,0],[a(.02),-.15],[a(.14),.3],[a(.25),0],[LAND,0],[l(.08),.35],[l(.23),-.15],[l(.38),0]],
};

type Pose=Record<Channel,number>;
function sampler(keys:Keys):(time:number)=>Pose {
  // A part's last key may share its time with the next part's first.
  const curves=CHANNELS.map(channel=>[channel,keys[channel]
    ?curve(keys[channel]!.filter((key,i,all)=>i===all.length-1||all[i+1][0]-key[0]>1e-6)):()=>0] as const);
  return time=>{
    const pose=Object.fromEntries(curves.map(([channel,at])=>[channel,at(time)])) as Pose;
    // A planted sole stays level under its leg, apart from its own heel lift.
    for(const side of ['L','R'] as const)
      pose[`ankle${side}`]=THREE.MathUtils.lerp(pose[`ankle${side}`],pose.toes-(pose[`reach${side}`]+pose[`knee${side}`]),pose[`plant${side}`]);
    for(const channel of CHANNELS)if(!Number.isFinite(pose[channel]))throw new Error(`keyed slide: ${channel} has no value at ${time}`);
    return pose;
  };
}

/** Bakes a keyed clip's channels into joint tracks at 120 Hz, with the elastic lengths of `profile`. */
export function bakeJakKeys(original:AnimationClip,rig:RigDefinition,label:string,keys:Keys,end:number,profile:string):AnimationTrack[] {
  const id=original.id,amplitudes=characterElasticityAmplitudes(profile),sample=sampler(keys);
  const hipsY=rig.joints.find(j=>j.id==='hips')!.rest.position[1],rad=THREE.MathUtils.degToRad;
  const frames=Array.from({length:Math.round(end*120)+1},(_,i)=>{const time=Math.min(end,i/120);return {time,pose:sample(time)};});
  const euler=(angles:number[])=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...angles.map(rad) as [number,number,number]));
  const rotations:Record<string,(pose:Pose)=>number[]>={
    root:()=>[0,0,0],hips:p=>[p.hips,p.yaw,p.roll],torsoRoot:()=>[0,0,0],spine:p=>[p.spine,p.twist*.5,0],
    chest:p=>[p.chest,p.twist*.5,0],neck:p=>[p.neck,p.look,0],head:()=>[0,0,0],
  };
  for(const [side,s,sign] of [['Left','L',1],['Right','R',-1]] as const){
    rotations[`clavicle${side}`]=()=>[0,0,0];
    rotations[`shoulder${side}`]=p=>[p[`armPitch${s}`],0,sign*p[`armRoll${s}`]];
    rotations[`elbow${side}`]=p=>[p[`elbow${s}`],0,0];
    rotations[`wrist${side}`]=()=>[0,0,0];
    rotations[`hip${side}`]=p=>[p[`reach${s}`]-p.hips,0,sign*p[`splay${s}`]];
    rotations[`knee${side}`]=p=>[p[`knee${s}`],0,0];
    rotations[`ankle${side}`]=p=>[p[`ankle${s}`],0,0];
    rotations[`toe${side}`]=()=>[0,0,0];
  }
  const tracks:AnimationTrack[]=Object.entries(rotations).map(([target,angles])=>({id:`${id}:${label}:${target}`,kind:'quaternion',target,
    keys:frames.map(({time,pose},i)=>({id:`${target}:${i}`,time,value:euler(angles(pose)).toArray() as QuaternionTuple,interpolation:'linear' as const}))}));
  tracks.push({id:`${id}:${label}:root-position`,kind:'position',target:'root',keys:frames.map(({time,pose},i)=>({
    id:`root:${i}`,time,value:[0,pose.pelvis-hipsY,pose.back],interpolation:'linear' as const}))});
  for(const [target,part] of ELASTIC_LENGTH_CONTROLS){
    const s=target.includes('.left.')?'L':target.includes('.right.')?'R':null;
    tracks.push({id:`${id}:${label}:${target}`,kind:'scalar',target,keys:frames.map(({time,pose},i)=>({
      id:`${target}:${i}`,time,interpolation:'linear' as const,
      value:1+amplitudes[part]*(s===null?pose.torso:part<3?pose[`arms${s}`]:pose[`legs${s}`])}))});
  }
  return tracks;
}

// How each part of the body takes a cut. Into the skid and off the floor are
// quick. Down into a crouch the body folds forward part by part, the spine,
// head and arms each arriving later and settling once; onto all fours the
// chest leads, so he dives over his feet instead of standing up first.
// `carry` leaves the pelvis behind when the travel itself jumps: the slide's
// burst pulls his feet out from under him, the leap lifts him off the floor a
// moment late, and the dead stop of the landing sinks him over his knees.
export const jakShape=(rates:[number,number,number,number,number],carry:[number,number,number]=[0,0,0],
  zeta:[number,number,number,number,number]=[1,1,1,1,1]):InertiaShape=>({
  root:[rates[0],zeta[0]],legs:[rates[1],zeta[1]],spine:[rates[2],zeta[2]],head:[rates[3],zeta[3]],arms:[rates[4],zeta[4]],
  lengths:[Math.max(rates[0],rates[1]),1],carry});
const shape=jakShape;
const ENTER=shape([46,52,40,36,32],[0,0,1]),CROSS=shape([38,40,34,31,28]);
const LEAP=shape([50,54,43,37,33],[0,.5,.5]),TOUCH=shape([23,60,46,40,34],[0,.3,.35],[.55,1,1,1,1]);
// Running on out of the jump, the legs are a run's at once and the arms come
// down behind them.
const RUN_ON=shape([40,54,34,30,21],[0,0,0],[1,1,1,1,.7]);
const LEAVE={
  'player.jak-run-land':RUN_ON,'player.jak-run-land-weak':RUN_ON,
  'player.crouch':shape([15,19,13,12,11],[0,0,0],[.6,1,.5,.5,.62]),
  'player.crawl':shape([17,21,20,18,17],[0,0,1],[.8,1,.8,.7,1]),
  default:shape([38,42,32,29,26]),
};

export function createJakSlideClip(original:AnimationClip,rig:RigDefinition):AnimationClip {
  const end=RISE+JAK_SLIDE.lock+JAK_SLIDE.tail,id=original.id;
  return {...original,name:'D · Slide · low feet-first skid and an eased rise to the feet',duration:end,range:{start:0,end},
    playbackSpeed:1,loop:{...original.loop,mode:'once',seamless:false},
    tracks:bakeJakKeys(original,rig,'slide',SLIDE,end,'jak-slide'),proceduralDrivers:[],contacts:[],events:[],
    markers:[{id:`${id}:down`,time:.17,name:'Hip down'},{id:`${id}:hold`,time:HOLD,name:'Skid'},
      {id:`${id}:rise`,time:RISE,name:'Rock forward'},{id:`${id}:crouch`,time:r(JAK_SLIDE.crouch),name:'On his feet'},
      {id:`${id}:stand`,time:r(JAK_SLIDE.stand),name:'Up, a little past standing'}],
    metadata:{jakSlide:true,jakDirect:true,
      jakInertia:{segments:[ENTER,CROSS],out:LEAVE},
      jakSlideHold:HOLD,jakSlideRise:RISE,jakSlideLock:JAK_SLIDE.lock,jakSlideTail:JAK_SLIDE.tail,
      // Locomotion returns under the settle: the pelvis and legs first, the
      // arms and torso through the rest of the lock and the tail.
      recoveryStart:RISE,recoveryLegsBlend:[r(JAK_SLIDE.stand+.03),r(JAK_SLIDE.lock-.01)],
      recoveryBodyBlend:[r(JAK_SLIDE.lock-.10),end],
      // Where movement is not locked, a run starts straight out of the rise.
      recoveryMovingLegsBlend:[r(.02),r(.26)],
      elasticityProfile:'jak-slide',elasticityRevision:CHARACTER_ELASTICITY_REVISION,
      elasticityPrinciple:'independent, unmirrored limbs on single eased arcs with overlap and one settle'},
  };
}

export function createJakSlideJumpClip(original:AnimationClip,rig:RigDefinition):AnimationClip {
  const end=l(JAK_SLIDE_JUMP.settle),id=original.id;
  return {...original,name:'D · Slide jump · high knees-up jump out of the skid',duration:end,range:{start:0,end},
    playbackSpeed:1,loop:{...original.loop,mode:'once',seamless:false},
    tracks:bakeJakKeys(original,rig,'slide-jump',JUMP,end,'jak-slide-jump'),proceduralDrivers:[],contacts:[],events:[],
    markers:[{id:`${id}:push`,time:.06,name:'Push off'},{id:`${id}:tuck`,time:.20,name:'Knees up'},
      {id:`${id}:apex`,time:A,name:'Over the top'},{id:`${id}:reach`,time:a(.22),name:'Legs down'},
      {id:`${id}:land`,time:LAND,name:'Touchdown'},{id:`${id}:dip`,time:l(JAK_SLIDE_JUMP.dip),name:'Give at the knees'},
      {id:`${id}:up`,time:l(JAK_SLIDE_JUMP.stand),name:'Spring back up'}],
    metadata:{jakSlideJump:true,jakDirect:true,
      jakInertia:{segments:[LEAP,TOUCH],out:LEAVE},
      jakSlideJumpApex:A,jakSlideJumpFall:FALL,jakSlideJumpLand:LAND,
      // Control is back at the touchdown: a run takes the legs as the knees
      // give, a stand takes them as he comes back up.
      recoveryStart:LAND,recoveryLegsBlend:[l(.30),l(.46)],recoveryBodyBlend:[l(.38),end],
      recoveryMovingLegsBlend:[l(.05),l(.24)],
      elasticityProfile:'jak-slide-jump',elasticityRevision:CHARACTER_ELASTICITY_REVISION,
      poseIntent:'upright knees-up high jump; no somersault',
      elasticityPrinciple:'independent, unmirrored limbs on single eased arcs with overlap and one settle'},
  };
}
