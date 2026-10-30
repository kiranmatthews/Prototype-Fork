import * as THREE from 'three';
import { createAnimationClip } from './document';
import type { AnimationClip, QuaternionTuple, Vec3Tuple } from './types';

/** Presentation tuning only. Launch impulse, gravity and steering stay in Player. */
export const LAUNCH_JUMP = {
  pushSeconds: .19,
  riseLoopAt: .88,
  gatherSeconds: .38,
  loopSeconds: 1.36,
  minimumStrength: .12,
  waistPivot: .78,
  pedalHipSwing: .48,
  pedalKneeSwing: .62,
  pedalKneeLag: .13,
  pedalRiseCycles: 1,
  pedalRiseBlend: .18,
  somersaultSpeedRatio: .8,
  somersaultStart: .22,
  somersaultLatestStart: .55,
} as const;
export const LAUNCH_CLIPS = {
  rise: 'player.launch-rise', float: 'player.launch-float', gather: 'player.launch-gather',
  boardRise: 'player.launch-board-rise', boardFloat: 'player.launch-board-float', boardGather: 'player.launch-board-gather',
} as const;
export type LaunchClipId = typeof LAUNCH_CLIPS[keyof typeof LAUNCH_CLIPS];
export interface LaunchPresentation {
  id: number;
  strength: number;
  elapsed: number;
  rise: number;
  gather: number;
  verticalSpeed: number;
  board: boolean;
}
export function launchRiseProgress(elapsed: number, speed: number, initialSpeed: number): number {
  if (elapsed < LAUNCH_JUMP.pushSeconds) return .22 * Math.max(0, elapsed / LAUNCH_JUMP.pushSeconds);
  const ascent = Math.max(0, 1 - speed / Math.max(1, initialSpeed));
  const pushFraction = ascent * LAUNCH_JUMP.pushSeconds / Math.max(LAUNCH_JUMP.pushSeconds, elapsed);
  return Math.min(1, .22 + .78 * Math.max(0, ascent - pushFraction) / Math.max(.01, LAUNCH_JUMP.riseLoopAt - pushFraction));
}
export function launchClip(p: LaunchPresentation): LaunchClipId {
  if (p.gather > 0) return p.board ? LAUNCH_CLIPS.boardGather : LAUNCH_CLIPS.gather;
  if (p.rise < 1) return p.board ? LAUNCH_CLIPS.boardRise : LAUNCH_CLIPS.rise;
  return p.board ? LAUNCH_CLIPS.boardFloat : LAUNCH_CLIPS.float;
}
export const isLaunchClip = (id: string | null): boolean => !!id?.startsWith('player.launch-');

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t*t*(3-2*t); };
const PHASE = [0, .065, .22, .46, .72, 1];
/** Monotone Hermite: rounded arcs without stops at every key or angular overshoot. */
function curve(values: number[], p: number): number {
  let i=0; while(i<PHASE.length-2 && p>PHASE[i+1])i++;
  const span=PHASE[i+1]-PHASE[i],t=Math.max(0,Math.min(1,(p-PHASE[i])/span));
  const slope=(n:number)=>{
    if(n===0||n===PHASE.length-1)return 0;
    const a=(values[n]-values[n-1])/(PHASE[n]-PHASE[n-1]), b=(values[n+1]-values[n])/(PHASE[n+1]-PHASE[n]);
    return a*b<=0?0:2*a*b/(a+b);
  };
  return (2*t*t*t-3*t*t+1)*values[i]+(t*t*t-2*t*t+t)*span*slope(i)+
    (-2*t*t*t+3*t*t)*values[i+1]+(t*t*t-t*t)*span*slope(i+1);
}

/** Authored reconstruction from the boss footage, not copied asset curves.
 * Each board variant deliberately contains no root/hips/leg keys: deck IK owns them. */
function build(rigId: string, phase: 'rise' | 'float' | 'gather', board: boolean, includeTorsoRoot: boolean): AnimationClip {
  const id = phase==='rise' ? (board?LAUNCH_CLIPS.boardRise:LAUNCH_CLIPS.rise) : phase==='float'
    ? (board?LAUNCH_CLIPS.boardFloat:LAUNCH_CLIPS.float) : (board?LAUNCH_CLIPS.boardGather:LAUNCH_CLIPS.gather);
  const clip=createAnimationClip({id, rigId, name:`Launch · ${board?'Board ':''}${phase==='rise'?'Load / Extend / Open':phase==='float'?'Airborne Float':'Landing Gather'}`,
    duration:phase==='float'?LAUNCH_JUMP.loopSeconds:1});
  clip.loop.mode=phase==='float'?'loop':'once';
  const samples=Array.from({length:65},(_,i)=>i/64);
  const rotation=(joint:string,fn:(p:number)=>Vec3Tuple)=>{
    const trackId=`${id}:${joint}:rotation`;
    clip.tracks.push({id:trackId,kind:'quaternion',target:joint,keys:samples.map((p,i)=>({
      id:`${trackId}:${i}`,time:p*clip.duration,interpolation:'linear',
      value:new THREE.Quaternion().setFromEuler(new THREE.Euler(...fn(p),'XYZ')).toArray() as QuaternionTuple,
    }))});
  };
  const position=(joint:string,fn:(p:number)=>Vec3Tuple)=>{
    const trackId=`${id}:${joint}:position`;
    clip.tracks.push({id:trackId,kind:'position',target:joint,keys:samples.map((p,i)=>({
      id:`${trackId}:${i}`,time:p*clip.duration,interpolation:'linear',value:fn(p),
    }))});
  };
  const wave=(p:number,lag=0)=>Math.sin(2*Math.PI*(p-lag));
  const beat=(p:number,keys:number[],idle:number,amp=0,lag=0,catchValue=idle)=>phase==='rise'
    ?curve(keys,p):phase==='float'?idle+amp*wave(p,lag):THREE.MathUtils.lerp(idle,catchValue,smooth(p));
  const pedal=(p:number,keys:number[],idle:number,amp:number,lag:number,catchValue:number)=>{
    if(phase!=='rise')return beat(p,keys,idle,amp,lag,catchValue);
    // Keep the initial load/extension, then pedal during the same rising arc
    // as the slow turn. One whole cycle meets the float's opening leg pose.
    const cycle=Math.max(0,(p-LAUNCH_JUMP.somersaultStart)/(1-LAUNCH_JUMP.somersaultStart));
    return THREE.MathUtils.lerp(curve(keys,p),idle+amp*wave(cycle*LAUNCH_JUMP.pedalRiseCycles,lag),
      smooth(cycle/LAUNCH_JUMP.pedalRiseBlend));
  };
  const pitch=(p:number)=>beat(p,[.04,.15,-.18,-.64,.08,.64],.64,.065,0,.02);
  if(!board){
    rotation('root',p=>[pitch(p),0,phase==='float'?.055*wave(p,.18):0]);
    position('root',p=>{
      const a=pitch(p),load=phase==='rise'?curve([0,-.22,.05,.02,0,0],p):phase==='gather'?-.06*smooth(p):0;
      return [0,LAUNCH_JUMP.waistPivot*(1-Math.cos(a))+load,-LAUNCH_JUMP.waistPivot*Math.sin(a)];
    });
    rotation('hips',p=>[beat(p,[0,-.12,.02,.06,-.02,-.06],-.06,.04,.18,0),0,phase==='float'?.045*wave(p,.3):0]);
  }
  if(includeTorsoRoot)rotation('torsoRoot',()=>[0,0,0]);
  rotation('spine',p=>[beat(p,[.05,.24,-.16,-.25,-.10,.10],.10,.07,.07,.18)*(board?.65:1),
    phase==='float'?.08*wave(p,.2):0,phase==='float'?.06*wave(p,.1):0]);
  rotation('chest',p=>[beat(p,[.02,.12,-.08,-.16,.02,.06],.06,.045,.14,.05),
    phase==='float'?-.06*wave(p,.27):0,0]);
  rotation('neck',p=>[beat(p,[-.04,.10,-.08,-.16,-.12,-.18],-.18,.035,.18,-.08),0,0]);
  rotation('head',p=>[beat(p,[0,.12,-.18,-.30,-.18,-.26],-.26,.055,.23,-.12),
    phase==='float'?.10*wave(p,.34):0,phase==='float'?-.045*wave(p,.12):0]);
  for(const [side,sign,lag] of [['Left',1,0],['Right',-1,.28]] as const){
    rotation(`clavicle${side}`,p=>[0,0,sign*beat(p,[0,-.04,.04,.15,.12,.10],.10,.045,lag)]);
    rotation(`shoulder${side}`,p=>[
      beat(p,[-.20,-.70,.35,-.35,-1.2+(sign>0?.3:0),-.55],-.55,.30,lag,.10),
      sign*beat(p,[.05,.05,.08,.15,.10,.12],.12,.08,lag+.15,.05),
      sign*beat(p,[.20,.30,.22,1.30,1.15,1.08],1.08,.22,lag+.08,.45),
    ]);
    rotation(`elbow${side}`,p=>[beat(p,[-.55,-1.30,-.18,-.70,-1.35,-1.04],-1.04,.30,lag+.10,-.62),0,sign*.12]);
    rotation(`wrist${side}`,p=>[beat(p,[.10,.24,-.22,-.05,.32,.20],.20,.20,lag+.19,.04),
      sign*.12,sign*beat(p,[0,.08,-.12,-.22,.12,.05],.05,.12,lag+.23,0)]);
    for(const [finger,delay] of [['Index',0],['Middle',.035],['Outer',.07]] as const)
      for(const [segment,scale] of [['Proximal',1],['Middle',1.2],['Distal',.9]] as const)
        rotation(`finger${finger}${segment}${side}`,p=>[
          scale*beat(p,[.18,.45,.08,.18,.32,.24],.24,.10,lag+.23+delay,.20),0,0]);
    if(!board){
      // Half a cycle between legs; the delayed knee fold makes each shoe
      // sweep an oval through push, recovery and lift instead of kicking.
      const pedalLag=side==='Left'?0:.5;
      rotation(`hip${side}`,p=>[pedal(p,[-.18,-1.05,.04,.20,-.35,-.27],-.38,LAUNCH_JUMP.pedalHipSwing,pedalLag,-.43),
        sign*.06,sign*beat(p,[.05,.08,.03,.12,.18,.18],.18,.055,lag,.08)]);
      rotation(`knee${side}`,p=>[pedal(p,[.35,1.75,.10,.48,1.30,1.12],1.06,LAUNCH_JUMP.pedalKneeSwing,pedalLag+LAUNCH_JUMP.pedalKneeLag,.85),0,0]);
      rotation(`ankle${side}`,p=>[pedal(p,[-.17,-.48,.28,.18,-.12,-.20],-.20,.20,pedalLag+.24,-.37),0,sign*.04]);
      rotation(`toe${side}`,p=>[pedal(p,[0,.10,-.15,-.08,0,.02],.02,.09,pedalLag+.30,0),0,0]);
    }
  }
  clip.tags=['player','launch','trampoline','squash-stretch',phase];
  clip.metadata={progressSource:phase==='float'?'elapsed-time':'gameplay-actionProgress',
    rootMotion:'presentation waist pivot only; world translation belongs to gameplay',
    motionDesign:'footage reconstruction: load, extend, backward opening, asymmetric float, landing gather',
    ...(board?{launchUpperBodyOnly:true}:{}),
    ...(!board&&phase!=='gather'?{launchPedalRevision:1}:{}),
  };
  if(phase==='rise')clip.markers=[['compression',.065],['push',.22],['open',.46],['float',1]].map(([name,p])=>({id:`${id}:${name}`,name:String(name),time:Number(p)}));
  return clip;
}
export function buildLaunchClips(rigId:string,includeTorsoRoot=true):AnimationClip[]{
  return [false,true].flatMap(board=>(['rise','float','gather'] as const).map(phase=>build(rigId,phase,board,includeTorsoRoot)));
}
