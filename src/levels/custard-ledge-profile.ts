import type {CreekBank} from './custard-terrain';

const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export const ledgeSmooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const hash=(x:number)=>{const h=Math.sin(x*127.1+311.7)*43758.5453;return h-Math.floor(h);};
export const ledgeNoise=(x:number,seed:number)=>{const i=Math.floor(x);return mix(hash(i+seed*13.71),hash(i+1+seed*13.71),ledgeSmooth(x-i));};
const value=(v:CreekBank['width'],s:number)=>typeof v==='function'?v(s):v;
const seedOf=(bank:CreekBank)=>{let n=bank.group*31;for(const c of bank.name)n=(n*33+c.charCodeAt(0))%100003;return n*.013;};

/** The same broad bays, smaller chips and protected core used by Carlisle,
 * expressed in metres along Custard's independently authored curved route. */
export function creekLedgeSection(bank:CreekBank,s:number){
 const width=value(bank.width,s),u=value(bank.offset,s),seed=seedOf(bank);
 const near=bank.joinNear?1-ledgeSmooth((s-bank.a)/6):0;
 const far=bank.joinFar?1-ledgeSmooth((bank.b-s)/6):0;
 const joined=Math.max(near,far),simple=bank.solid===false||bank.turf===false;
 const side=(sign:number)=>{
  if(simple)return {half:width/2,flat:width*.45,drop:.105};
  const bay=ledgeNoise(s/13.7,seed+sign*4),chip=ledgeNoise(s/2.7,seed+sign*19);
  let half=Math.max(bank.minHalf??Math.min(1.6,width*.30),width*.5*(.53+.25*bay)-.32*chip);
  let required=Math.min(1.45,width*.28);
  for(const p of bank.protected??[]){
   const weight=1-ledgeSmooth((Math.abs(p.s-s)-(p.along??2.8))/6);
   if(weight===0)continue;
   const across=sign*(p.u-u);
   required=Math.max(required,(across+p.radius)*weight);
  }
  const rim=Math.min(1.05,width*.19),maximum=width*.5+.28;
  half=Math.min(maximum,Math.max(half,required+rim*.7));
  half=mix(half,width/2,joined);
  const collar=Math.max(.18,Math.min(rim,half-required,half-1.1));
  const flat=Math.max(1.0,half-collar);
  return {half,flat,drop:(.21+.17*ledgeNoise(s/2.1,seed+sign*51))*(1-joined)};
 };
 const left=side(-1),right=side(1);
 return{u,width,seed,joined,left,right,
  columns:[-left.half,-mix(left.flat,left.half,.48),-left.flat,0,right.flat,mix(right.flat,right.half,.48),right.half]};
}

/** Round an exposed end around its practical takeoff/landing strip. Joined
 * ends retain their shared border. The map stays monotonic along the route. */
export function creekCapStation(bank:CreekBank,s:number,x:number,half:number){
 if(bank.solid===false||bank.turf===false)return s;
 const strip=Math.min(1.65,half*.69),corner=ledgeSmooth((Math.abs(x)-strip)/Math.max(.2,half-strip));
 const u=value(bank.offset,s);let protectedWeight=0;
 for(const p of bank.protected??[]){
  const along=1-ledgeSmooth((Math.abs(p.s-s)-1.8)/2.8);
  const across=1-ledgeSmooth((Math.abs(p.u-u-x)-p.radius-.25)/.65);
  protectedWeight=Math.max(protectedWeight,along*across);
 }
 const recess=(.8+ledgeNoise(x*1.1,seedOf(bank)+31)*1.25)*corner*(1-protectedWeight);
 let station=s;
 if(!bank.joinNear)station+=recess*(1-ledgeSmooth((s-bank.a)/5.5));
 if(!bank.joinFar)station-=recess*(1-ledgeSmooth((bank.b-s)/5.5));
 return station;
}

/** Top profile is quiet at actor footholds; only the collar rolls and chips. */
export function creekLedgeDrop(section:ReturnType<typeof creekLedgeSection>,x:number){
 const edge=x<0?section.left:section.right,t=(Math.abs(x)-edge.flat)/Math.max(.08,edge.half-edge.flat);
 return edge.drop*ledgeSmooth(t);
}
