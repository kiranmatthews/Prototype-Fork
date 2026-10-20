import type { CustomComponent, CustomLevelData } from '../level';
import { DROWNED_CROWN_ASSETS } from '../drownedCrownAssets';

type Point=[number,number,number];
type Asset=keyof typeof DROWNED_CROWN_ASSETS;

/** The captain's ledger lives inside the same salvaged royal timber as the
 * main hold. This dresses the existing three puzzles without moving a collider,
 * reward, switch, reveal group, camera or gate. All models use native UVs and a
 * single uniform scale; every added surface is scenery only. */
export function dressDrownedCrownBonus(data:CustomLevelData,end:number):void {
 const scenery:CustomComponent[]=[];
 const model=(kind:Asset,p:Point,scale:number,name:string,yaw=0)=>scenery.push({
  t:'decor',dkind:kind,p,s:DROWNED_CROWN_ASSETS[kind].size.map(v=>v*scale) as Point,
  yaw,scenerySolid:false,grp:4,nm:`Captain's ledger · ${name}`,
 });
 for(const floor of data.components.filter(c=>c.t==='mesh'&&c.tex==='plank')){
  // The kit cube uses normalized vertices. Give the timber metre-based UVs
  // while preserving its exact vertices, winding, scale and reveal behaviour.
  floor.tex='crown-timber';floor.color='#e0cfb5';
  floor.uvs=[];
  for(let i=0;i<floor.vertices!.length;i+=3)
   floor.uvs.push(floor.vertices![i]*floor.s![0]/4,floor.vertices![i+2]*floor.s![2]/4);
  if(floor.outline||floor.p[1]>0)continue;
  const left=floor.p[0]-floor.s![0]/2,right=floor.p[0]+floor.s![0]/2;
  // Background floor stops at every real chasm. The switch bridge and upper
  // shelf retain their own ghost/reveal geometry, with no permanent overlay.
  scenery.push({t:'mesh',p:[0,-.012,0],vertices:[left,0,-3.2,right,0,-3.2,right,0,-16,left,0,-16],
   indices:[0,1,2,0,2,3],uvs:[left/4,-.8,right/4,-.8,right/4,-4,left/4,-4],
   tex:'crown-timber',color:'#a99982',solid:false,grp:4,nm:"Captain's ledger · recessed cabin floor"});
 }
 scenery.push({t:'mesh',p:[0,0,-16.6],vertices:[-22,-7,0,end+18,-7,0,end+18,24,0,-22,24,0],
  indices:[0,1,2,0,2,3],tex:'solid',color:'#302822',solid:false,grp:4,nm:"Captain's ledger · closed cabin backing"});
 for(let row=0;row<4;row++)
  for(let x=-14;x<end+18;x+=15)
   model('crownhullpanel',[x-(row%2)*7.5,-5+row*6.2,-15.1],1.3,'overlapping salvaged hull planking');
 for(const x of [13.5,43,87]){
  model('crowncrashsterngallery',[x,.15,-12.3],1,'red and gold captain’s gallery');
  model('crowncrashoakarch',[x,-.7,-10.4],1.45,'carved royal gallery frame');
 }
 for(const x of [-7,22,33,53,66,97,108])
  model('crownbrasslantern',[x,3.5,-7.1],.9,'warm brass reading lantern');
 for(const [x,yaw] of [[-3,12],[32,-10],[55,15],[101,-12]])
  model('crowncargostack',[x,-.03,-7.7],.68,'archived salvage behind the walking lane',yaw);
 data.components.push(...scenery);
 data.groups??=[];data.groups.push({id:4,nm:"Captain's cabin scenery",editorOnly:true});
 data.keepPlayFog=true;
 data.atmosphere={backdrop:'fog',fogEnabled:true,fogColor:'#253e48',fogNear:46,fogFar:145,drawDistance:170,
  ambientSky:'#c4d6df',ambientGround:'#77634f',ambientIntensity:1.12,
  sunColor:'#ffddb0',sunIntensity:1.55,sunDirection:[-.35,.65,.65],
  fillColor:'#86b9ce',fillIntensity:.5,shadowStrength:.52};
}
