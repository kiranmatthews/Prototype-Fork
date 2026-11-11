import {Vector3} from 'three';
import type {ParticleMotion} from './particleMotion';
import type {ParticleLightingContext, ParticleLightingLibrary, ParticleLightingSelection, SunHours, SunOrbit, SunParticleLibrary} from './types';

const f=Math.fround, mul=(a:number,b:number)=>f(f(a)*f(b)),add=(a:number,b:number)=>f(f(a)+f(b));
const bits=(n:number)=>new Float32Array(new Uint32Array([n]).buffer)[0];
const SIN=[0x3f7fffde,0xbe2aa8f5,0x3c086bf6,0xb94d2072,0x361aa27f].map(bits);
const COS=[0xbefffd62,0x3d2a7a28,0xbab2bc31,0x37a933eb].map(bits);
function sinRad(x:number):number {
  const x2=mul(x,x),x3=mul(x,x2),x4=mul(x2,x2),x5=mul(x3,x2),x7=mul(x4,x3),x9=mul(x5,x4);
  return [x,x3,x5,x7,x9].reduce((sum,power,i)=>add(sum,mul(power,SIN[i])),0);
}
function cosRad(x:number):number {
  const x2=mul(x,x),x4=mul(x2,x2),x6=mul(x4,x2),x8=mul(x4,x4);
  return [x2,x4,x6,x8].reduce((sum,power,i)=>add(sum,mul(power,COS[i])),1);
}
export function sinRotation(angle:number):number {
  const x=mul(.000095873795,(Math.trunc(angle)<<16)>>16),square=mul(x,x);
  let power=x,result=mul(.999998,x);
  for(const coefficient of [-.16666014,.008326521,-.0001956241,.0000023042373]) {
    power=mul(power,square);result=add(result,mul(coefficient,power));
  }
  return result;
}
/** sky.gc:9 and trigonometry.gc. Preserve source angle truncation and polynomial
 * approximations; an ideal Math.sin orbit would subtly shift the original sun. */
export function sampleSunOrbit(orbit:SunOrbit,hour:number,out=new Vector3()):Vector3 {
  const angle=mul(2730.6667,f(f(hour)-f(orbit.highNoon))),sine=mul(sinRotation(angle),orbit.distance);
  const cosine=mul(sinRotation(add(16384,angle)),orbit.distance);
  const tilt=mul(.017453292,orbit.tilt),rise=mul(.017453292,orbit.rise);
  const y=mul(cosine,cosRad(tilt)),lateral=mul(cosine,sinRad(tilt));
  return out.set(f(mul(lateral,cosRad(rise))-mul(sine,sinRad(rise))),y,
    f(-add(mul(sine,cosRad(rise)),mul(lateral,sinRad(rise)))));
}
export function sunHourVisible(predicate:SunHours,hour:number):boolean {
  if('terms' in predicate)return predicate.op==='and'?predicate.terms.every(p=>sunHourVisible(p,hour)):
    predicate.terms.some(p=>sunHourVisible(p,hour));
  return predicate.op==='<'?hour<predicate.hour:predicate.op==='<='?hour<=predicate.hour:
    predicate.op==='>'?hour>predicate.hour:hour>=predicate.hour;
}
export interface SunPalettePreset {id:string;context:ParticleLightingContext;selection:ParticleLightingSelection}
/** update-mood-sky-texture uses sky-texture-interp, not particle palette-interp.
 * update-mood-quick uses its distinct sun snapshot (arg2, not arg3). */
export function sampleSunColor(library:ParticleLightingLibrary,preset:SunPalettePreset,hour:number):number[] {
  if(!Number.isFinite(hour))throw new Error('Sun hour must be finite');
  const {context,selection}=preset,table=library.sunTables!.find(t=>t.id===context.sun)!;
  let first=selection.snapshot??0,second=first,weight=0;
  if(selection.kind==='cycle') {
    const time=f(((hour%24)+24)%24),integer=Math.trunc(time),fraction=f(time-integer);
    const row=library.palettes.find(p=>p.id===context.skyPalette)!.hours[integer%24];
    first=row.snapshot1;second=row.snapshot2;
    weight=add(mul(row['morph-start'],f(1-fraction)),mul(row['morph-end'],fraction));
  }
  const a=table.snapshots[first].color,b=table.snapshots[second].color;
  return a.map((value,i)=>first===second?f(value):add(mul(value,f(1-weight)),mul(b[i],weight)));
}

export class SunParticles {
  readonly presets:SunPalettePreset[];
  readonly centre=new Vector3();
  readonly radius:number;
  readonly host:SunParticleLibrary['hosts'][number];
  selected:SunPalettePreset;
  fade=1;
  active=false;
  constructor(readonly motion:ParticleMotion,readonly sky:SunParticleLibrary,readonly lighting:ParticleLightingLibrary) {
    this.host=sky.hosts.find(host=>host.group===motion.group.name)!;
    if(!this.host)throw new Error(`No source sun host for ${motion.group.name}`);
    this.presets=lighting.contexts.flatMap(context=>(context.sunPresets??[]).map(selection=>({context,selection,
      id:`${context.id}:${selection.kind}${selection.snapshot===null?'':'-'+selection.snapshot}`})));
    this.selected=this.presets.find(p=>p.context.id==='beach')??this.presets[0];
    if(!this.selected)throw new Error('Source sun palettes unavailable');
    this.select(this.selected.id);
    motion.hour=sky.orbits.find(o=>o.slot===this.host.orbit)!.highNoon;
    motion.host.suns=sky.orbits.map(()=>new Vector3());
    // Fit the complete rotating quads, not the source 70 m culling sphere.
    this.radius=Math.max(...motion.group.items.map(item=>{
      const fields=motion.definitions.get(item.particle)!.fields;
      const x=fields.find(f=>f.field==='scale-x')?.base??0;
      const y=fields.find(f=>f.field==='scale-y');
      return .5*Math.hypot(x,y?.op==='copy'?x:y?.base??0)/4096;
    }));
    this.refresh();
    motion.sourceEmitter=()=>this.refresh();
  }
  select(id:string):void {
    const preset=this.presets.find(p=>p.id===id);if(!preset)throw new Error(`Unknown sun palette ${id}`);
    this.selected=preset;
    this.fade=preset.context.sunFades?.[0]?.fade??1;
  }
  refresh():void {
    const {motion}=this,hour=((motion.hour%24)+24)%24;
    for(const orbit of this.sky.orbits)sampleSunOrbit(orbit,hour,motion.host.suns[orbit.slot]);
    motion.host.sunColor.fromArray(sampleSunColor(this.lighting,this.selected,hour));
    motion.host.sunFade=this.fade;
    this.active=this.fade!==0&&sunHourVisible(this.host.hours,hour);
    motion.hostEmission=this.active?'once':'off';
    this.centre.copy(motion.host.suns[this.host.orbit]).addScaledVector(motion.host.camera,1/4096);
  }
}
