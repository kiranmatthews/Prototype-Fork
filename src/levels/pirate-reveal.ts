import type { CustomComponent } from '../level';
import { DROWNED_CROWN_EXTERIOR_MODELS } from '../drownedCrownExterior.generated';
import { DROWNED_CROWN_EXCELLENCE_MODELS } from '../drownedCrownExcellence.generated';
import { DROWNED_INTERIOR_OFFSET_X as OFFSET, DROWNED_TREASURY_OFFSET } from './pirate-sets';
import { PIRATE_INTERIOR_COMPONENTS } from './pirate-interior';
import { PIRATE_INTERIOR_SCENERY } from './pirate-interior-scenery';
import type { P } from './pirate-meshes';

/** Complete scenic vessel and a separately staged, full-size playable wreck. */
export function stageDrownedReveal(source:CustomComponent[]):CustomComponent[]{
 const shifted=(c:CustomComponent):CustomComponent=>({...c,p:[c.p[0]+OFFSET,c.p[1],c.p[2]],
  ...(c.cameraPosition?{cameraPosition:[c.cameraPosition[0]+OFFSET,c.cameraPosition[1],c.cameraPosition[2]] as P}:{}),
  ...(c.cameraTarget?{cameraTarget:[c.cameraTarget[0]+OFFSET,c.cameraTarget[1],c.cameraTarget[2]] as P}:{}),
  ...(c.to?{to:[c.to[0]+OFFSET,c.to[1],c.to[2]] as P}:{})});
 const vault=(c:CustomComponent):CustomComponent=>{
  const delta=DROWNED_TREASURY_OFFSET;
  const move=(p:P):P=>[p[0]+OFFSET+delta[0],p[1]+delta[1],p[2]+delta[2]];
  return {...c,p:move(c.p),...(c.to?{to:move(c.to)}:{}),...(c.cameraPosition?{cameraPosition:move(c.cameraPosition)}:{}),...(c.cameraTarget?{cameraTarget:move(c.cameraTarget)}:{})};
 };
 const out:CustomComponent[]=[];
 for(const c of source){
  const name=c.nm??'';
  if(name==='Original-UV moonpool stones')continue;
  // Retire the obsolete exposed ramp and its support props; boarding now
  // passes through the covered hull passage at the end of the existing pier.
  if(c.grp===2&&(/Salvaged boarding gangway|Gangway lantern|Gangway hand rope|Gangway support trestle/.test(name)||c.dkind==='crownmooringpiles'&&c.p[2]>-110))continue;
  // The previous narrow deck/hatch/hold/cabin set is replaced completely.
  if(c.grp!==undefined&&c.grp>=3&&c.grp<=6)continue;
  if(c.grp===7){
   // Older assembly appended a few hold braces to the treasure group. Only
   // retain the actual escape bridge and vault, not those obsolete fragments.
   let depth=c.p[2];
   if(c.vertices?.length){const zs=c.vertices.filter((_,i)=>i%3===2);depth+=(Math.min(...zs)+Math.max(...zs))*.5*(c.s?.[2]??1);}
   if(depth<=-236)out.push(vault(c));
   continue;
  }
  if(c.t==='camnode'&&c.p[2]<-95){
   if(c.cameraView&&name.startsWith('Royal vault'))out.push(vault(c));
   continue;
  }
  // The compact scenic vessel needs a lower cave than the playable wreck.
  // Keep its roof behind the coastal skyline while the interior retains its
  // full mast clearance. Reuse the same models and aligned skylight openings.
  const cave=c.grp===2&&(c.dkind&&['crowncrashcavernrock','crowncrashcanopy','crowncrashskylight','trialsv3bough','trialsv2cavewalla','treehousetrialssunshaft'].includes(c.dkind)||
   ['Continuous limestone cavern enclosure','Deep cavern enclosing wall','Cold bottomless moonpool'].includes(name));
  if(cave){
   let exterior=c;
   if(['crowncrashcanopy','crowncrashskylight','trialsv3bough'].includes(c.dkind??''))exterior={...c,p:[c.p[0],c.p[1]-20,c.p[2]]};
   else if(c.dkind==='treehousetrialssunshaft'&&c.s)exterior={...c,s:[c.s[0],c.s[1]-20,c.s[2]]};
   else if(c.dkind==='crowncrashcavernrock'&&c.p[1]>40)exterior={...c,p:[c.p[0],c.p[1]-20,c.p[2]]};
   else if(name==='Continuous limestone cavern enclosure'&&c.vertices)exterior={...c,normals:undefined,vertices:c.vertices.map((n,i)=>i%3===1?Math.min(n,50):n)};
   else if((name==='Deep cavern enclosing wall'||c.dkind==='trialsv2cavewalla')&&c.s)exterior={...c,s:[c.s[0],Math.min(c.s[1],50-c.p[1]),c.s[2]]};
   out.push(exterior);
  }else out.push(c);
 }
 for(const c of [...PIRATE_INTERIOR_COMPONENTS,...PIRATE_INTERIOR_SCENERY])out.push(shifted(c));
 for(const p of [[0,16,-376],[30,18,-387],[32,18,-406],[32,20,-438]] as P[])
  out.push({t:'camnode',p:[p[0]+OFFSET,p[1],p[2]],radius:5,grp:11,nm:'New ship interior · treasury approach spine'});
 const prop=(dkind:NonNullable<CustomComponent['dkind']>,p:P,s:P,yaw=0,nm='Boarding passage')=>out.push({t:'decor',dkind,p,s,yaw,scenerySolid:false,grp:2,nm});
 // The boarding camera looks across the north end of the cave shell.
 // Close its exposed water horizon with one uniformly scaled native rock.
 const shoulder=DROWNED_CROWN_EXCELLENCE_MODELS.crowncrashcavernrock;
 prop('crowncrashcavernrock',[80,-22,-38],shoulder.size.map(v=>v*3) as P,-90,'Moonpool · east entrance shoulder');
 for(const [x,y,z,w,h,d] of [[-53,-13,-91,9,5,7],[-47,-12,-102,6,3,8],[-7,-14,-89,8,4,6]])
  prop('crowncrashcavernrock',[x,y,z],[w,h,d],0,'Low sea-cavern reef beside the scenic ship');
 const ship=DROWNED_CROWN_EXTERIOR_MODELS.crowncrashexteriorship;
 prop('crowncrashexteriorship',[-20,-13.8,-119],ship.size.map(v=>v*1.4) as P,0,'The Drowned Crown · complete scenic Meshy exterior');
 // Every visible wall, plank and fitting uses an existing Meshy asset.
 for(const z of [-79.9,-72.1])prop('crownhullpanel',[-28,-6.4,z],[12,4.5,1.5],z<-76?0:180,'Salvaged hull wall around the boarding passage');
 for(let i=0;i<11;i++)for(let j=0;j<3;j++)prop('crownmeshyplankchipped',[-32+j*4,-1.8,-80+i*.8],[4.1,.22,.88],0,'Existing Meshy planks over the boarding passage');
 for(const x of [-34,-26]){
  prop('crownmeshybeamhewn',[x,-6,-72.5],[.45,4.5,.38]);prop('crownmeshybeamhewn',[x,-6,-79.5],[.45,4.5,.38]);
  prop('crownbrasslantern',[x-.4,-3.8,-72.9],[.8,1,.5],90,'Boarding passage lantern');
  out.push({t:'torch',p:[x-.4,-3.5,-72.9],rise:.4,w:.2,grp:2,nm:'Boarding passage lantern glow'});
 }
 out.push({t:'returnportal',p:[-25,-6.6,-76],s:[7.2,6,1.4],yaw:90,to:[OFFSET+4,8.08,-112],exitYaw:0,artProxy:true,grp:2,nm:'Covered boarding passage · enter the full wreck'});
 out.push({t:'camnode',p:[-29,-3,-76],s:[11,12,8],cameraView:true,cameraPresentationOnly:true,grp:12,
  cameraPosition:[-38,-1,-76],cameraTarget:[-27,-3,-76],cameraFollowDistance:7,cameraFollowTargetHeight:2.5,cameraFov:58,radius:1.5,nm:'Boarding passage · follow the covered walk'});
 return out;
}
