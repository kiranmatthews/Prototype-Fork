import type { CustomComponent, CustomLevelData, DecorKind } from '../level';
import type { CustomAtmosphereData } from '../levelAtmosphere';
import { BEACHFRONT_RUN_LEVEL } from './beachfront-run';
import { ISLAND_HOPPER_LEVEL } from './island-hopper';
import { beachfrontPointAtDistance, beachfrontSandHeight, beachfrontYawAtDistance } from '../beachfrontCourse';
import { COASTAL_TOWN_ASSETS } from '../coastalTownAssets';

type P = [number,number,number];
export const SUNNY_ISLAND_OFFSET: P = [0,0,-780];
export const SUNNY_BEACH_OCEAN_LOOK={normalStrength:1.35,reflectionStrength:.38,causticsStrength:.4,
  shallow:{r:.07,g:.82,b:.75,a:.7},deep:{r:.015,g:.42,b:.56,a:1},depthDistance:2.5,foamStrength:.48,intersectionWidth:.85};
export const SUNNY_BEACH_ATMOSPHERE: CustomAtmosphereData = {
  fogEnabled:true,fogNear:160,fogFar:620,fogColor:'#b8e7ed',
  ambientSky:'#d5efff',ambientGround:'#ead2a0',ambientIntensity:1.4,
  sunColor:'#fff9ec',sunIntensity:2.15,sunDirection:[.36,.91,.22],
  fillColor:'#c7edff',fillIntensity:.42,shadowStrength:.62,drawDistance:720,backdrop:'painted sky',
  fallbackTop:'#229de6',fallbackBottom:'#d7f5f3',fallbackRidges:false,
  fallbackStars:false,fallbackSunColor:'#fffef5',fallbackSunU:.62,fallbackSunV:.12,
};
const r=(v:number)=>Math.round(v*1000)/1000;
const translate=(p:readonly number[]):P=>p.map((v,i)=>r(v+SUNNY_ISLAND_OFFSET[i])) as P;
const beachPoint=(d:number,lateral=0,y?:number):P=>{
  const p=beachfrontPointAtDistance(d,lateral,y);return [-r(p[0]),r(p[1]),r(p[2])];
};
export const sunnyIslandPoint=(d:number,lateral=0):P=>{
  const center=(s:number):P=>{const t=Math.max(0,Math.min(384,s))/384;
    return [46*Math.sin(Math.PI*t)**2*Math.sin(2*Math.PI*t),1.05,24-s];};
  const a=center(d-.1),b=center(d+.1),p=center(d),dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz);
  return translate([p[0]-dz/n*lateral,p[1],p[2]+dx/n*lateral]);
};

// Keep both source courses intact. The append is a translation, preserving
// the four authored water crossings and every actor's relationship to its deck.
const beach=structuredClone(BEACHFRONT_RUN_LEVEL.components).filter(c=>c.t!=='gate'&&c.t!=='crystal');
const islands=structuredClone(ISLAND_HOPPER_LEVEL.components).filter(c=>c.t!=='clock'&&c.t!=='decor').map(c=>{
  c.p=translate(c.p);c.grp=(c.grp??0)+40;
  c.nm=`Island Hopper / ${c.nm??c.t}`;
  if(c.supportBaseY!==undefined)c.supportBaseY+=SUNNY_ISLAND_OFFSET[1];
  // The lagoon's piles embed in its known seabed. Avoid asking every pile to
  // raycast the entire native beach again when this long course is exported.
  if(c.t==='woodpath')c.terrainSupports=false;
  if(c.t==='platform'&&c.shoreProfile){c.color='#cbbd9e';c.tex='sunny-sand';}
  return c;
});
const start=beachPoint(710,0,beachfrontSandHeight(710,0)+.17);
export const SUNNY_CONNECTOR_POINTS:P[]=[start,beachPoint(730,0,.85),[1,1.05,-738],[0,1.05,-752],sunnyIslandPoint(8)];
const connector:CustomComponent={t:'woodpath',p:start,pts:SUNNY_CONNECTOR_POINTS.map(p=>[r(p[0]-start[0]),r(p[2]-start[2]),0,r(p[1]-start[1])]),
  widths:[6.8,6.8,7.2,8,10],w:7,curve:'spline',structureStyle:'beach',plankPalette:'placeholder-board',polePalette:'placeholder-pole',
  scaffold:true,supports:true,rails:true,terrainSupports:false,supportBaseY:-3.6,supportDepth:4.65,spacing:.72,baySpacing:4.2,
  tex:'plank',color:'#c89758',seed:84199,nm:'Beach to Island Hopper / continuous departure pier',grp:30};
const components:CustomComponent[]=[...beach,connector,
  {t:'pit',p:[0,-2.9,-997],s:[260,1,550],invisible:true,nm:'Lagoon deep-water recovery',grp:30},
  {t:'checkpoint',p:[1,1.05,-738],nm:'Lagoon departure checkpoint',grp:30},
  ...[716,730].map(d=>({t:'camnode' as const,p:beachPoint(d,0,1.05),radius:10,grp:5})),
  {t:'camnode',p:[1,1.05,-740],radius:8,grp:5},...islands];
for(let z=-716;z>=-752;z-=7)components.push({t:'wumpa',p:[r((z+752)/36*1.8),2.02,z],grp:30});

// Fully editable scenery. A clear corridor surrounds every playable surface;
// the original cliff boundary remains the only cliff gameplay proxy.
function asset(dkind:DecorKind,p:P,s:P,yaw=0,nm=dkind as string){
  components.push({t:'decor',dkind,p:p.map(r) as P,s:s.map(r) as P,yaw:r(yaw),scenerySolid:false,solid:false,grp:80,nm});
}
function palm(p:P,k:number,yaw:number){
  asset('baytrunk',p,COASTAL_TOWN_ASSETS.baytrunk.size.map(v=>v*k) as P,yaw);
  const a=yaw*Math.PI/180;
  asset('baycrown',[p[0]+Math.cos(a)*.65*k,p[1]+7*k,p[2]-Math.sin(a)*.65*k],
    COASTAL_TOWN_ASSETS.baycrown.size.map(v=>v*k) as P,yaw);
}
function flowers(p:P,k:number,yaw:number){asset('sunnyhibiscus',p,[2.6*k,1.8*k,2.2*k],yaw);}
for(let i=0,d=3;d<739;d+=11,i++){
  const y=beachfrontSandHeight(d,9)-1.25;
  asset('sunnycliff',beachPoint(d,13.8,y),[14.8,19+(i%5)*1.4,8.4],90-beachfrontYawAtDistance(d)+(i%3-1)*4);
  if(i%3===0)palm(beachPoint(d+3,12.5,y+8),1.1+(i%4)*.12,45+i*39);
  if(i%2===0)palm(beachPoint(d,7.35,beachfrontSandHeight(d,7.35)-.15),.8+(i%3)*.12,190+i*31);
  flowers(beachPoint(d+2,6.65,beachfrontSandHeight(d+2,6.65)-.12),.9+(i%3)*.2,i*57);
  flowers(beachPoint(d+7,6.8,beachfrontSandHeight(d+7,6.8)-.12),1.1+(i%3)*.15,110+i*83);
  if(i%3===0)asset('bayvine',beachPoint(d+4,9.2,7+(i%4)*2),[3.4,5.8,1.8],90-beachfrontYawAtDistance(d));
  if(i%2===1){
    asset('sunnycliff',beachPoint(d,7.15,beachfrontSandHeight(d,7.15)-.4),[3.1,2.0,2.5],i*43);
    asset('jungleleaf',beachPoint(d+4,7,beachfrontSandHeight(d+4,7)),[3,1.8,2.7],i*83);
  }
}
const islandRuns=[[0,32,19],[86.9,126,20.5],[172,212,18.5],[257.93,294,20],[334,384,22]];
for(const [i,[a,b,w]] of islandRuns.entries()){
  for(const side of [-1,1]){
    const d=(a+b)/2+side*(b-a)*.22,edge=w/2+3.9;
    const p=sunnyIslandPoint(d,side*edge);p[1]=.4;
    palm(p,1.1+(i%3)*.12,side*34+i*63);
    flowers([p[0]-side*.8,.55,p[2]+2],1.15,i*75);
    const q=sunnyIslandPoint((a+b)/2-side*6,side*(edge+.2));q[1]=-.2;
    asset('sunnycliff',q,[4.7,2.9,3.85],i*47+side*35);
    flowers([q[0],.4,q[2]-2.4],1.05,80+i*31);
    const leaf=sunnyIslandPoint(d+5,side*(edge-1));leaf[1]=.5;
    asset('jungleleaf',leaf,[3.4,2.1,3],i*71);
  }
}
// Smaller offshore rock gardens supply layered silhouettes at the lagoon's
// open end, well outside every landing and rope envelope.
for(const [i,[x,z,k]] of [[68,-805,1.8],[-75,-895,2.1],[80,-980,2.4],[-68,-1100,1.8],[48,-1185,2.5]].entries()){
  asset('sunnycliff',[x,-2.5,z],[16*k,10*k,13*k],i*63);
  asset('sunnycliff',[x-6*k,-2.8,z+2*k],[10*k,7*k,10*k],30+i*43);
  asset('sunnycliff',[x+4*k,-2.5,z-3*k],[12*k,13*k,10*k],80+i*79);
  for(let j=0;j<3;j++){
    palm([x+(j-1)*5*k,(j===2?7:4.6)*k,z+(j%2?3:-2)*k],(.8+j*.12)*k,40+i*58+j*65);
    flowers([x+(j-1)*4*k,3.6*k,z+4*k],1.5*k,i*79+j*53);
  }
}

export const SUNNY_BEACH_LEVEL:CustomLevelData={
  v:1,name:'Beachside Run',spawn:[...BEACHFRONT_RUN_LEVEL.spawn],killY:-12,
  sky:'coast',jungleStyle:'painterly',jungleDepthFade:false,keepPlayFog:true,
  cameraRig:{camDist:9.4,camHeight:5.6,camPitch:18,camFov:59},cameraLookAhead:6,
  atmosphere:SUNNY_BEACH_ATMOSPHERE,
  shoreFoam:ISLAND_HOPPER_LEVEL.shoreFoam?.map(o=>({...o,center:translate(o.center)})),
  groups:[...(BEACHFRONT_RUN_LEVEL.groups??[]),{id:30,nm:'Beach to lagoon pier'},
    ...(ISLAND_HOPPER_LEVEL.groups??[]).map(g=>({...g,id:g.id+40,nm:`Island Hopper / ${g.nm}`})),
    {id:80,nm:'Sunny sandstone, palms and hibiscus',editorOnly:true}],
  components,
};
// The rustic Meshy boards keep their fitted geometry and atlas; only their
// colour range changes to sun-warmed oak under the brighter overhead light.
for(const c of components)if(c.t==='woodpath')c.plankPalette='sunny-oak';
