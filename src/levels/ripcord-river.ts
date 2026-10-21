import {BufferGeometry,Float32BufferAttribute} from 'three';
import type {CustomComponent,CustomLevelData} from '../level';
import {RUMBLEWATER_RUN_LEVEL,RUMBLEWATER_END,RUMBLEWATER_BANKS,RUMBLEWATER_PIPES,
  RUMBLEWATER_GAPS,RUMBLEWATER_REFUGES,rumblePoint,rumbleHeight,rumbleProgress,rumbleTangent,rumbleYaw} from './rumblewater-run';
import {buildCreekBank,buildCreekCollision,type CreekBank} from './custard-terrain';

type Point=[number,number,number];
export const RIPCORD_WIDTH_SCALE=1.3;
export const RIPCORD_SPEED_SCALE=.85;
const KEEP_THROUGH=1798;
const round=(n:number)=>Math.round(n*10000)/10000;
const value=(n:number|((s:number)=>number),s:number)=>typeof n==='function'?n(s):n;
const sampler={point:rumblePoint,height:rumbleHeight};

// Measure the actual winding centreline. Removing its last 30% preserves
// grades, approach lengths and the original choreography of the retained acts.
export function riverLength(end:number):number {
  let total=0,previous=rumblePoint(0);
  for(let s=.25;s<end+.25;s+=.25){const p=rumblePoint(Math.min(s,end));
    total+=Math.hypot(p[0]-previous[0],p[2]-previous[2]);previous=p;}
  return total;
}
export const ROLLING_BONES_LENGTH=riverLength(RUMBLEWATER_END);
const wanted=ROLLING_BONES_LENGTH*.7;
let low=0,high=RUMBLEWATER_END;
for(let i=0;i<32;i++){const middle=(low+high)/2;if(riverLength(middle)<wanted)low=middle;else high=middle;}
export const RIPCORD_END=(low+high)/2;
export const RIPCORD_LENGTH=riverLength(RIPCORD_END);
export const RIPCORD_BOULDER_END=RIPCORD_END-28;
export const RIPCORD_REFUGES=RUMBLEWATER_REFUGES.filter(r=>r.exit<KEEP_THROUGH);

/** Stretch across the river's local frame, including mesh collision vertices.
 * The centreline, grades, forward distances and character physics stay intact. */
export function ripcordPoint(s:number,y=rumbleHeight(s),u=0):Point {
  return rumblePoint(s,y,u*RIPCORD_WIDTH_SCALE);
}
function widenPoint(p:Point):Point {
  const s=rumbleProgress(p),c=rumblePoint(s,p[1]),d=rumbleTangent(s);
  const u=(p[0]-c[0])*-d[2]+(p[2]-c[2])*d[0];
  return [p[0]-d[2]*u*.3,p[1],p[2]+d[0]*u*.3].map(round) as Point;
}
function widenComponent(source:CustomComponent):CustomComponent {
  const c=structuredClone(source),p=widenPoint(c.p),yaw=(c.yaw??0)*Math.PI/180,cos=Math.cos(yaw),sin=Math.sin(yaw);
  const world=(x:number,y:number,z:number):Point=>[c.p[0]+x*cos+z*sin,c.p[1]+y,c.p[2]-x*sin+z*cos];
  const local=(q:Point):Point=>{const x=q[0]-p[0],z=q[2]-p[2];return [round(x*cos-z*sin),round(q[1]-p[1]),round(x*sin+z*cos)];};
  if(c.vertices){
    const scale=c.s??[1,1,1],vertices:number[]=[];
    for(let i=0;i<c.vertices.length;i+=3)vertices.push(...local(widenPoint(world(c.vertices[i]*scale[0],c.vertices[i+1]*scale[1],c.vertices[i+2]*scale[2]))));
    c.vertices=vertices;delete c.s;
    const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(vertices,3));if(c.indices)g.setIndex(c.indices);
    g.computeVertexNormals();c.normals=Array.from(g.getAttribute('normal').array).map(round);g.dispose();
  } else if(c.s){
    const delta=yaw-rumbleYaw(rumbleProgress(c.p))*Math.PI/180;
    const xScale=Math.hypot(1.3*Math.cos(delta),Math.sin(delta));
    const zScale=Math.hypot(1.3*Math.sin(delta),Math.cos(delta));
    c.s=[round(c.s[0]*xScale),c.s[1],round(c.s[2]*zScale)];
  }
  if(c.pts)c.pts=c.pts.map(q=>{const v=local(widenPoint(world(q[0],q[3]??0,q[1])));
    const next=[...q];next[0]=v[0];next[1]=v[2];if(q.length>=4)next[3]=v[1];return next as typeof q;});
  if(c.t==='vertramp'||c.dkind==='bw-aqueduct-v3'){
    // Retain the native curved wall radius. Add the extra width to the flat
    // bed and deck; total lip-to-lip width is exactly 130% of the original.
    const edge=(c.rise??0)*Math.sin((c.arc??90)*Math.PI/180);
    c.w=round((c.w??0)*1.3+edge*.3);if(c.deck!==undefined)c.deck=round(c.deck*1.3);
  }
  if(c.to)c.to=widenPoint(c.to);
  c.p=p;return c;
}

const C:CustomComponent[]=RUMBLEWATER_RUN_LEVEL.components.filter(c=>{
  if(['gate','crystal','camnode'].includes(c.t)||c.nm==='Gorge water reset')return false;
  // These are complete authored sections, including their final receiving bank.
  if(c.grp!==undefined&&c.grp>=10&&c.grp<=23)return c.grp<=18;
  if(c.grp!==undefined&&c.grp>=110&&c.grp<=115)return c.grp<=113;
  return rumbleProgress(c.p)<KEEP_THROUGH;
}).map(widenComponent);

function addBank(a:number,b:number,width:number,offset:CreekBank['offset'],name:string,top:CreekBank['top']=rumbleHeight){
  const spec:CreekBank={a,b,width,offset,name,top,group:140,minHalf:width/2-.15};
  C.push(...[...buildCreekBank(sampler,spec),...buildCreekCollision(sampler,spec)].map(widenComponent));
}
export const RIPCORD_GAPS:{a:number;b:number;u:number;name:string;original:number}[]=[];
for(const gap of RUMBLEWATER_GAPS.filter(g=>g.b<KEEP_THROUGH&&g.b-g.a<=20)){
  const target=Math.min(6,(gap.b-gap.a)*.6),extension=(gap.b-gap.a-target)/2;
  for(const side of [-1,1]){
    const edge=side<0?gap.a:gap.b,station=edge+side*.1;
    const banks=RUMBLEWATER_BANKS.filter(b=>station>=b.a&&station<=b.b)
      .sort((a,b)=>Math.abs(value(a.offset,station)-gap.u)-Math.abs(value(b.offset,station)-gap.u));
    const bank=banks[0],pipe=RUMBLEWATER_PIPES.find(p=>station>=p.a&&station<=p.b);
    const offset=bank?value(bank.offset,edge):pipe?value(pipe.offset,edge):gap.u;
    const width=bank?value(bank.width,edge):pipe?pipe.width:10;
    addBank(side<0?edge-2:edge-extension,side<0?edge+extension:edge+2,width,offset,
      gap.name+' · forgiving '+(side<0?'takeoff':'receiver'),bank?.top??rumbleHeight);
  }
  RIPCORD_GAPS.push({a:gap.a+extension,b:gap.b-extension,u:gap.u,name:gap.name,original:gap.b-gap.a});
}
// The new ending replaces the advanced quarry/aqueduct/final-exam sequence.
// It retains a real boulder drop and a broad, supported crystal/finish island.
addBank(KEEP_THROUGH-1,RIPCORD_BOULDER_END,18,0,'Ripcord final escape bank');
addBank(RIPCORD_BOULDER_END+6,RIPCORD_END+20,24,0,'Ripcord sanctuary island');
RIPCORD_GAPS.push({a:RIPCORD_BOULDER_END,b:RIPCORD_BOULDER_END+6,u:0,name:'Ripcord final boulder-drop leap',original:12});
for(let s=KEEP_THROUGH;s<RIPCORD_END-4;s+=6)if(s<RIPCORD_BOULDER_END-1||s>RIPCORD_BOULDER_END+7)
  C.push({t:'wumpa',p:ripcordPoint(s,rumbleHeight(s)+1),grp:140,nm:'Ripcord sanctuary trail'});
C.push({t:'crystal',p:ripcordPoint(RIPCORD_END-10,rumbleHeight(RIPCORD_END-10)+1.2),grp:140,nm:'Ripcord sanctuary crystal'},
  {t:'crate',kind:'nitrobang',p:ripcordPoint(RIPCORD_END-6,rumbleHeight(RIPCORD_END-6),7),grp:140,nm:'Ripcord nitro clear'},
  {t:'gate',p:ripcordPoint(RIPCORD_END),yaw:rumbleYaw(RIPCORD_END),grp:140,nm:'Ripcord sanctuary'});
for(const side of [-1,1])C.push({t:'decor',dkind:'coastpillar',p:ripcordPoint(RIPCORD_BOULDER_END-4,rumbleHeight(RIPCORD_BOULDER_END-4)-.2,side*7),
  s:[.8,2,.7],yaw:rumbleYaw(RIPCORD_BOULDER_END),scenerySolid:false,grp:140,nm:'Ripcord final jump markers'});
// Re-seat the original sanctuary's carved gateway and footings at the new end.
for(const source of RUMBLEWATER_RUN_LEVEL.components.filter(c=>
  c.nm==='Sanctuary gateway'||c.nm==='Grounded gateway footing'&&rumbleProgress(c.p)>2600)){
  const station=rumbleProgress(source.p),centre=rumblePoint(station),d=rumbleTangent(station);
  const lateral=(source.p[0]-centre[0])*-d[2]+(source.p[2]-centre[2])*d[0],at=RIPCORD_END+(station-RUMBLEWATER_END);
  C.push(widenComponent({...source,p:rumblePoint(at,rumbleHeight(at)+source.p[1]-rumbleHeight(station),lateral),
    yaw:(source.yaw??0)-rumbleYaw(station)+rumbleYaw(at),grp:140}));
}
for(let s=RIPCORD_END+44;s>=-64;s-=8)C.push({t:'camnode',p:rumblePoint(s),grp:1,nm:'Camera-facing escape frame'});
// Continue the visible river and its lethal contact below the new ending.
for(let a=KEEP_THROUGH-1;a<RIPCORD_END+32;a+=24){const b=Math.min(a+24,RIPCORD_END+32),p=rumblePoint(a,0),vertices:number[]=[],indices:number[]=[];
  for(let i=0;i<=6;i++)for(const side of [-1,1]){const s=a+(b-a)*i/6,q=ripcordPoint(s,rumbleHeight(s)-7,side*39);vertices.push(q[0]-p[0],q[1],q[2]-p[2]);}
  for(let i=0;i<6;i++){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
  C.push({t:'mesh',p,vertices,indices,tex:'custard-water',materialStyle:'jungle-stream',color:'#689c94',opacity:.86,solid:false,lethal:true,doubleSided:true,edgeGrinding:false,grp:93,nm:'Ripcord sanctuary creek'},
    {t:'pit',p:rumblePoint((a+b)/2,Math.min(rumbleHeight(a),rumbleHeight(b))-7.15),s:[101.4,1,b-a+2],yaw:rumbleYaw((a+b)/2),invisible:true,grp:93,nm:'Ripcord sanctuary water contact'});
}
C.push({t:'pit',p:[0,-82,-RIPCORD_END/2],s:[468,1,RIPCORD_END+180],invisible:true,nm:'Gorge water reset'});
const oldChase=RUMBLEWATER_RUN_LEVEL.boulderChase!;
export const RIPCORD_RIVER_LEVEL:CustomLevelData={...structuredClone(RUMBLEWATER_RUN_LEVEL),name:'Ripcord River',components:C,
  groups:[...(RUMBLEWATER_RUN_LEVEL.groups??[]),{id:140,nm:'Ripcord · gentler gaps and sanctuary',editorOnly:true}],
  medalTimes:{gold:90,silver:112,bronze:140},
  boulderChase:{...structuredClone(oldChase),speed:oldChase.speed*RIPCORD_SPEED_SCALE,
    paces:oldChase.paces!.slice(0,RIPCORD_REFUGES.length+1).map(n=>n*RIPCORD_SPEED_SCALE),
    path:Array.from({length:481},(_,i)=>rumblePoint(-58+(RIPCORD_BOULDER_END+58)*i/480)),
    forks:oldChase.forks!.filter(f=>rumbleProgress(f.paths[0][f.paths[0].length-1])<KEEP_THROUGH).map(f=>({paths:f.paths.map(path=>path.map(widenPoint))})),
    shelters:oldChase.shelters!.slice(0,RIPCORD_REFUGES.length)},
};

// Preserve the entire previous course and its timing under a separate identity.
// Atmosphere overrides are explicit because the original warm lighting would
// otherwise override the night preset even with a night sky selected.
export const ROLLING_BONES_LEVEL:CustomLevelData={...structuredClone(RUMBLEWATER_RUN_LEVEL),name:'Rolling Bones',sky:'night',
  atmosphere:{...RUMBLEWATER_RUN_LEVEL.atmosphere,fogColor:'#172640',fogNear:65,fogFar:190,
    ambientSky:'#819dc7',ambientGround:'#28344b',ambientIntensity:1.05,
    sunColor:'#adcaff',sunIntensity:1.15,fillColor:'#557db6',fillIntensity:.42,drawDistance:250,shadowStrength:.6},
};
