const fract=(value:number)=>value-Math.floor(value);
const noise=(value:number)=>fract(Math.sin(value*91.73+28.61)*14375.42);
export const STORM_PERIOD=43;

/** A distant, single cloud pulse. Events share the rain clock, never physics. */
export function sampleStormSquall(time:number,intensity:number){
 const cycle=Math.max(0,Math.floor(time/STORM_PERIOD));
 const start=cycle*STORM_PERIOD+12+noise(cycle+1)*7;
 const age=time-start,duration=1.35;
 const pulse=age>0&&age<duration?Math.sin(Math.PI*age/duration)**2:0;
 return {cycle,start,thunderAt:start+2.8+noise(cycle+5)*1.7,
  glow:pulse*Math.max(0,Math.min(1,intensity)),
  azimuth:Math.PI+(noise(cycle+9)-.5)*1.35,
  gain:.30+.08*noise(cycle+17),rate:.91+.13*noise(cycle+23)};
}

/** Own one cancellable thunder voice and skip cues crossed while inactive. */
export class StormSquall {
 private owner:object|null=null;
 private previousTime=0;
 private stopVoice:(()=>void)|undefined;
 private lastCue=-1;
 private cues=0;
 private glow=0;
 private azimuth=Math.PI;
 constructor(private readonly play:(gain:number,rate:number)=>(()=>void)|undefined){}
 update(owner:object,time:number,intensity:number){
  const enabled=Number.isFinite(time)&&time>=0&&Number.isFinite(intensity)&&intensity>0;
  time=Number.isFinite(time)&&time>=0?time:0;intensity=enabled?Math.min(1,intensity):0;
  if(owner!==this.owner||time<this.previousTime){this.stop();this.owner=owner;this.previousTime=time;this.lastCue=-1;}
  if(!enabled){this.stop();this.previousTime=time;return {glow:0,azimuth:this.azimuth};}
  const sample=sampleStormSquall(time,intensity),elapsed=time-this.previousTime;
  this.glow=sample.glow;this.azimuth=sample.azimuth;
  // No burst of old sounds after a pause, warm-up, inspection or seek.
  if(elapsed>=0&&elapsed<=.5&&this.previousTime<sample.thunderAt&&time>=sample.thunderAt&&sample.cycle!==this.lastCue){
   this.stopVoice?.();this.stopVoice=this.play(sample.gain*intensity,sample.rate);
   this.lastCue=sample.cycle;this.cues++;
  }
  this.previousTime=time;return {glow:this.glow,azimuth:this.azimuth};
 }
 stop(){this.stopVoice?.();this.stopVoice=undefined;this.glow=0;}
 get diagnostics(){return {time:this.previousTime,glow:this.glow,azimuth:this.azimuth,cues:this.cues,lastCue:this.lastCue};}
}
