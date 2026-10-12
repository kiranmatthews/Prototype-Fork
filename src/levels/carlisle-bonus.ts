import type {CustomComponent,CustomLevelData} from '../level';
import {CARLISLE_ASSETS} from '../carlisleAssets';
import {buildCarlisleRockTerrain} from './carlisle-rock-terrain';
import {carlisleSceneryFloor} from '../carlisleSceneryCollision';

type P=[number,number,number];
type Kind=keyof typeof CARLISLE_ASSETS;
/** The six player-camera storyboards live in docs/carlisle-bonus. The puzzle
 * remains course-owned: only its scenery and the shape below its floor change. */
export function rebuildCarlisleBonus(data:CustomLevelData):void {
 const gameplay=data.components.filter(c=>c.grp!==90);
 for(const c of gameplay)if(c.t==='pit')c.invisible=true;
 for(const c of gameplay)if(c.t==='camnode'&&c.cameraView){
  c.cameraPosition=[2,8.2,22];c.cameraTarget=[2,5.6,0];c.cameraFollowDistance=18;
  c.cameraFollowTargetHeight=5.3;c.cameraFov=56;c.cameraAspect=1.3;
  c.nm='Carlisle storyboard composition · complete court and high crate';
 }
 const protectedPoints=gameplay.filter(c=>['crate','gate'].includes(c.t)).map(c=>c.p);
 const art:CustomComponent[]=[];
 const prop=(kind:Kind,p:P,width:number,nm:string,yaw=0,solid=false,color='#ffffff')=>{
  const size=CARLISLE_ASSETS[kind].size,k=width/size[0];
  const c:CustomComponent={t:'decor',dkind:kind,p,s:size.map(v=>v*k) as P,yaw,nm,color,solid,edgeGrinding:false,grp:90};
  art.push(c);return c;
 };
 // Connected floors meet at their original x coordinates. The switch's
 // hidden bridge keeps exactly its source collider and activation group.
 let n=0;
 data.components=gameplay.map(c=>{
  if(c.t!=='mesh'||!c.s||c.solid===false)return c;
  if(c.outline)return {...c,tex:'coast-bedrock',color:'#d3be96'};
  const native:CustomComponent={...c,t:'platform',vertices:undefined,indices:undefined,tex:'coast-bedrock',edgeGrinding:c.edgeGrinding};
  const start=c.p[0]-c.s[0]/2,end=c.p[0]+c.s[0]/2;
  const result=buildCarlisleRockTerrain(native,49+(n++%6),protectedPoints,{near:end!==37&&end!==77,far:start!==-10&&start!==49});
  const surface=result.surfaces[0];
  // Quiet sandy foot-worn centre, living turf at the irregular exposed rim.
  for(let i=0;i<(surface.vertices?.length??0);i+=3){
   const x=surface.vertices![i]+surface.p[0],z=surface.vertices![i+2];
   if(surface.normals![i+1]>.8&&Math.abs(z)<.83+Math.sin(x*.57)*.23)
    surface.colors!.splice(i,3,.95,.89,.73);
  }
  return {...surface,nm:c.nm,tex:'coast-terrain',grp:c.grp};
 });
 // Exact natural proportions from Carlisle's existing high-resolution kit.
 // Rear shelves are detached from the play plane and cannot bypass a puzzle.
 for(const [i,x,y,z,w] of [[0,-11,-9,-10,15],[1,6,-10,-12,17],[2,25,-10,-13,18],[3,56,-10,-13,16],[4,73,-11,-12,19]] as const){
  const rock=prop('coastv2buttress',[x,y-1.8,z],w,`Quayside rear sandstone terrace ${i}`,i%2?7:-8,true,'#fff1d8');
  const floor=(dx:number,dz:number)=>(carlisleSceneryFloor(rock,x+dx,z+dz)??y)+.01;
  prop('coastpillar',[x+(i%2?3:-3),floor(i%2?3:-3,-1)-.15,z-1],2.3,`Quayside carved remnant ${i}`,i*7,true,'#ead5b2');
  prop('coastfern',[x+4,floor(4,4),z+4],2.2,`Quayside sheltered fern ${i}`,i*71);
  prop('coastfoliage',[x-3,floor(-3,4),z+4],2.4,`Quayside coral leaf garden ${i}`,i*35);
 }
 prop('coastarch',[70,-1.5,-16],15,'Return sanctuary broken gateway',0,true,'#ecdcc1');
 for(const x of [64.8,75.2])prop('coastv2ledge',[x,-1.5-6*1.0115,-16],6,'Return gateway rooted stone footing',180,true,'#e8d5b3');
 prop('coastspire',[-18,-18,-21],13,'Arrival canyon outer finger',12,true,'#e1d0b1');
 // Full 3D cap roots break up the broad authored terrain front, all buried
 // below the collision top. Their colliders never narrow the crossing.
 for(const [a,b] of [[-10,37],[49,77]])for(let x=a+3.8;x<b-2;x+=7.2){
  const w=Math.min(7.2,b-x+1.5);
  prop('coastv2ledge',[x,-w*1.0115-.18,0],w,`Quayside deep eroded root ${x}`,180,true,'#e8d5b3');
  prop('coastbonusmoss',[x,-2.05,2.12],4.6,`Quayside trailing moss ${x}`,0,false,'#c1c4a4');
  for(const dx of [-2,-.5,1.3]){
   prop('coastv2grass',[x+dx,0,-1.28],.85,`Quayside rear turf ${x} ${dx}`,x*19);
   prop('coastv2grassb',[x+dx,-.04,1.45],.72,`Quayside lip turf ${x} ${dx}`,x*13);
  }
 }
 prop('coastv2ledge',[33.4,-7.2*1.0115-.18,0],7.2,'Broken aqueduct rounded takeoff root',180,true,'#e8d5b3');
 // Both the distant and middle layers have real alpha and separate depths.
 prop('coastbonusfar',[28,-39,-107],238,'Canyon skyline beyond the cargo ravine');
 prop('coastbonusruins',[29,-19,-47],134,'Distant ruined quay and timber cargo hoists');
 prop('coastbonusfar',[119,-51,-139],250,'Hazy eastern canyon continuation',-9,false,'#e2dfd2');
 data.components.push(...art);
 data.sky='carlisle';data.jungleAtmosphere=true;data.jungleStyle='painterly';data.jungleDepthFade=false;data.keepPlayFog=true;
 data.atmosphere={fogEnabled:true,fogColor:'#d5ccb6',fogNear:48,fogFar:190,
  ambientSky:'#dce0ca',ambientGround:'#827052',ambientIntensity:1.5,
  sunColor:'#ffe0a8',sunIntensity:1.8,fillColor:'#c8d4c2',fillIntensity:.42,
  shadowStrength:.74,drawDistance:300,backdrop:'sky',fallbackTop:'#9aafa8',fallbackBottom:'#e9dec6'};
 data.groups??=[];data.groups.push({id:90,nm:'Carlisle storyboard scenery · stone, ruins, gardens and mist'});
}
