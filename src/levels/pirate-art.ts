import * as THREE from 'three';
import type { CustomComponent } from '../level';
import { DROWNED_CROWN_MODELS } from '../drownedCrownAssets.generated';
import { DROWNED_CROWN_GALLERY_MODELS } from '../drownedCrownGallery.generated';
import { DROWNED_CROWN_BOARD_MODELS } from '../drownedCrownBoards.generated';
import { DROWNED_CROWN_SCULPTURES } from '../drownedCrownSculpture';
import { DROWNED_CROWN_EXCELLENCE_MODELS } from '../drownedCrownExcellence.generated';
import { DROWNED_ROYAL_HULL_POSITION } from '../drownedCrownRoyalHull.generated';
import { DROWNED_GROTTO_FLOOR_POSITION } from '../drownedCrownGrotto.generated';
import { DROWNED_MINE_POSITION } from '../drownedCrownMine.generated';
import { DROWNED_CANOPY_POSITION, DROWNED_SKYLIGHTS } from '../drownedCrownCanopy.generated';
import { cutPirateRoofOpening } from './pirate-clearance';
import { DROWNED_VAULT_FLOOR_POSITION, drownedVaultSurfaceHeight } from '../drownedCrownVault.generated';
import { DROWNED_CROWN_SHIP_ASSETS, DROWNED_HULL_POSITION } from '../drownedCrownShip.generated';
const DROWNED_ART_MODELS={...DROWNED_CROWN_GALLERY_MODELS,...DROWNED_CROWN_BOARD_MODELS,...DROWNED_CROWN_MODELS,...DROWNED_CROWN_SCULPTURES,...DROWNED_CROWN_SHIP_ASSETS,...DROWNED_CROWN_EXCELLENCE_MODELS};
import type { P } from './pirate-meshes';

type Kind=keyof typeof DROWNED_ART_MODELS;
const round=(n:number)=>Math.round(n*10000)/10000;
function bounds(c:CustomComponent):{p:P;size:P} {
 const b=new THREE.Box3(),s=c.s??[1,1,1],yaw=(c.yaw??0)*Math.PI/180;
 for(let i=0;i<(c.vertices?.length??0);i+=3){
  const x=c.vertices![i]*s[0],z=c.vertices![i+2]*s[2];
  b.expandByPoint(new THREE.Vector3(c.p[0]+x*Math.cos(yaw)+z*Math.sin(yaw),c.p[1]+c.vertices![i+1]*s[1],c.p[2]-x*Math.sin(yaw)+z*Math.cos(yaw)));
 }
 const center=b.getCenter(new THREE.Vector3()),size=b.getSize(new THREE.Vector3());
 return {p:[center.x,b.min.y,center.z],size:size.toArray() as P};
}

/** Planar metric UVs are generated per triangle so walls and roofs keep the
 * same texel scale. Collision positions/indices and platform tops are retained. */
function painted(c:CustomComponent,tex:string,tint='#e1d5c4'):CustomComponent {
 if(c.t!=='mesh'||!c.vertices)return {...c,tex,color:tint};
 const vertices:number[]=[],uvs:number[]=[],indices:number[]=[],lookup=new Map<string,number>(),ids=c.indices??Array.from({length:c.vertices.length/3},(_,i)=>i);
 const v=c.vertices,a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3();
 const fit=tex==='crown-canvas',box=fit?bounds(c):null,longGrain=c.nm?.endsWith('longitudinal grain')===true;
 const tile=tex==='crown-coins'?.85:tex==='crown-limestone'?5:4;
 for(let i=0;i<ids.length;i+=3){
  a.fromArray(v,ids[i]*3);b.fromArray(v,ids[i+1]*3).sub(a);d.fromArray(v,ids[i+2]*3).sub(a);b.cross(d);
  const nx=Math.abs(b.x),ny=Math.abs(b.y),nz=Math.abs(b.z);
  for(let j=0;j<3;j++){
   const k=ids[i+j]*3,x=v[k],y=v[k+1],z=v[k+2];
   const u=fit&&box?round((x-box.p[0])/Math.max(.01,box.size[0])+.5):round((ny>nx&&ny>nz?(longGrain?z:x):nx>nz?z:x)/tile);
   const w=fit&&box?round((y-box.p[1])/Math.max(.01,box.size[1])):round((ny>nx&&ny>nz?(longGrain?x:z):y)/tile);
   const key=`${k}:${u}:${w}`;let index=lookup.get(key);
   if(index===undefined){index=vertices.length/3;lookup.set(key,index);vertices.push(x,y,z);uvs.push(u,w);}
   indices.push(index);
  }
 }
 return {...c,vertices,indices,normals:undefined,uvs,tex,color:tint};
}

export function dressDrownedCrown(source:CustomComponent[]):CustomComponent[] {
 const out:CustomComponent[]=[],barrels:P[]=[];
 const art=(kind:Kind,p:P,scale=1,yaw=0,grp=2,size?:P)=>out.push({t:'decor',dkind:kind,p:p.map(round) as P,
  s:size??DROWNED_ART_MODELS[kind].size.map(v=>round(v*scale)) as P,yaw,grp,nm:DROWNED_ART_MODELS[kind].label});
 const setProp=(kind:Kind,p:P,scale=1,yaw=0,grp=5,size?:P)=>{
  art(kind,p,scale,yaw,grp,size);out[out.length-1].scenerySolid=false;
 };
 // Transform complete support timbers; their meshes, UVs and paint stay intact.
 const timber=(a:P,b:P,width=.42,depth=.3,grp=5)=>{
  const native=DROWNED_CROWN_BOARD_MODELS.crownmeshybeamhewn.size;
  const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],h=Math.hypot(dx,dz),length=Math.hypot(h,dy);
  if(length<.001)return;
  const crossScale=Math.min(width/native[0],depth/native[2]);
  const count=Math.max(1,Math.ceil(length/(native[1]*crossScale))),scale=length/count/native[1];
  for(let i=0;i<count;i++){
   const t=i/count,base:P=[a[0]+dx*t,a[1]+dy*t,a[2]+dz*t];
   setProp('crownmeshybeamhewn',base,scale,Math.atan2(-dz,dx)*180/Math.PI,grp);
   out[out.length-1].amp=-Math.atan2(h,dy)*180/Math.PI;
  }
 };
 // Fit whole Meshy beams to the existing straight authoring guides. This
 // reads their principal axis only; none of the old vertices/UVs are rendered.
 const replaceTimber=(c:CustomComponent)=>{
  const vertices=c.vertices??[],points:THREE.Vector3[]=[],centre=new THREE.Vector3();
  for(let i=0;i<vertices.length;i+=3){const p=new THREE.Vector3(vertices[i],vertices[i+1],vertices[i+2]).add(new THREE.Vector3(...c.p));points.push(p);centre.add(p);}
  if(points.length<3)return;
  centre.multiplyScalar(1/points.length);
  const box=new THREE.Box3().setFromPoints(points),extent=box.getSize(new THREE.Vector3());
  let axis=extent.x>=extent.y&&extent.x>=extent.z?new THREE.Vector3(1,0,0):extent.y>=extent.z?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
  for(let n=0;n<10;n++){
   const next=new THREE.Vector3();for(const p of points){const d=p.clone().sub(centre);next.addScaledVector(d,d.dot(axis));}axis=next.normalize();
  }
  let lo=Infinity,hi=-Infinity,radius=0;
  for(const p of points){const d=p.clone().sub(centre),t=d.dot(axis);lo=Math.min(lo,t);hi=Math.max(hi,t);radius=Math.max(radius,d.addScaledVector(axis,-t).length());}
  const first=out.length;
  timber(centre.clone().addScaledVector(axis,lo).toArray() as P,centre.clone().addScaledVector(axis,hi).toArray() as P,radius*1.7,radius*1.55,c.grp);
  for(let i=first;i<out.length;i++)out[i].nm='Original Meshy timber · '+c.nm;
 };
 const mountedLamp=(x:number,y:number,z:number,side:number,grp=5)=>{
  setProp('crownbrasslantern',[x,y,z],.78,side<0?180:0,grp);
  out.push({t:'torch',p:[x,y+.3,z],rise:.5,w:.24,grp,nm:'Mounted working-bay lantern'});
 };
 for(let c of source){
  if((c.grp??0)>=8){out.push(c);continue;}
  const name=c.nm??'';
  if(c.t==='mesh'&&['Towering galleon mast','Massive horizontal yard','Long broken bowsprit','Fallen mast splinter','Broken bulwark post','Bulwark rail','Nest railing','Cabin curved eave frame','Quarterdeck bearing strut','Gallery carved corbel','Quarterdeck stair coaming post','Quarterdeck stair handrail','Keel crossing bearing timber'].includes(name)){
   replaceTimber(c);if(c.solid||c.scenerySolid)out.push({...c,artProxy:true});continue;
  }
  // The paid inner hull already contains the curved bracing. These extra
  // strips duplicated it and produced detached splinters over the decks.
  if(['Hull oak frame','Exposed ship rib','Curved cabin side planking','Curved captain transom backing','Curved weathered cabin roof','Crows nest basket','Carved golden sea serpent figurehead'].includes(name)){
   if(c.solid||c.scenerySolid)out.push({...c,artProxy:true});continue;
  }
  // Replace only decorative furniture and braces with original Meshy timber.
  if(['Cargo hold deck beam','Cargo hold rib','Captains chart table','Chart table carved leg','Chart table lower stretcher'].includes(name))continue;
  if(c.t==='torch'&&name==='Smugglers lantern'&&(c.grp===6||(c.grp===5&&c.p[0]>-20)))continue;
  // The treasury's mounted lamp clusters replace the old floating mine lamps.
  if(c.grp===7&&c.t==='torch'&&name==='Smugglers lantern'&&c.p[2]<-286)continue;
  // The fitted mine and native sea-gate shoulders own this whole lining.
  if(c.grp===1&&c.t==='decor'&&['Sculpted mine wall with original atlas','Sculpted mine ceiling with original atlas'].includes(name))continue;
  if(c.grp===7&&c.t==='decor'&&name==='Sculpted mine wall with original atlas'&&c.p[2]<-280)continue;
  if(c.grp===5&&['Oak barrel staves','Barrel iron hoop','Barrel lid','Cargo chest'].includes(name))continue;
  if(c.artProxy){out.push(c);continue;}
  if(name==='Moonpool stepping rubble'){
   const b=bounds(c);out.push({t:'decor',dkind:'trialsv2riverstonea',p:b.p,s:b.size,yaw:Math.sin(b.p[2])>0?180:0,color:'#a2b7bd',grp:c.grp,scenerySolid:c.scenerySolid,nm:'Original-UV moonpool stones'});continue;
  }

  if(c.grp===7&&c.p[2]<=-286&&(c.t==='torch'||c.t==='wumpa'||c.t==='crate')){
   const offset=c.t==='wumpa'?.9:c.t==='torch'?1:0;
   c={...c,p:[c.p[0],drownedVaultSurfaceHeight(c.t==='torch'?32:c.p[0],c.p[2])+offset,c.p[2]]};
  }
  if(c.grp===1&&(name==='Faceted underground tunnel shell'||name.startsWith('Crystal grotto · closed')))continue;
  if(c.grp===1&&c.t==='mesh'&&/Excavated smugglers trail|Fissure (near|far) bank|Grotto branch|Hidden crystal alcove|Tunnel edge rubble/.test(name)){out.push({...c,tex:'solid',color:'#798286'});continue;}
  if(['Vaulted cavern ceiling','Massive cavern cliff','Black square gunport','Limestone headland with open portal'].includes(name))continue;
  if(['Hand-shaped broken galleon hull planking','Blackened hull wale'].includes(name))continue;
  if(name==='Escape bridge anchored limestone')continue;
  if(name==='Continuous limestone cavern enclosure'&&c.vertices&&c.indices){
   const v=c.vertices,indices=c.indices.flatMap((_,i,ids)=>i%3===0&&Math.max(v[ids[i]*3+2],v[ids[i+1]*3+2],v[ids[i+2]*3+2])<=-72?[ids[i],ids[i+1],ids[i+2]]:[]);
   let backing:CustomComponent={...c,indices,tex:'solid',color:'#35486a',vertices:v.map((n,i)=>i%3===1?Math.min(n,70):n),doubleSided:true};
   for(const [x,z] of DROWNED_SKYLIGHTS)backing=cutPirateRoofOpening(backing,x,z,22,21);
   out.push(backing);continue;
  }
  if(name==='Limestone headland with open portal'&&bounds(c).p[2]>0)continue;
  if(c.grp===7&&/^(Old mine brace|Mine lintel)$/.test(name)&&bounds(c).p[2]<-286)continue;
  if(/^(Piles of ancient gold|Loose treasure gemstones)$/.test(name))continue;
  if(c.t==='torch'&&c.grp===4&&c.p[0]===4)c={...c,p:[7,8,c.p[2]]};
  if(c.t==='woodpath'){out.push(c);continue;}
  if(c.t==='decor'&&c.dkind==='junglepalmtree'&&c.grp===8){art('crowntropicalpalm',c.p,.92,c.yaw??0,8);continue;}
  if(/^Harbour · (limewashed warehouse|tiled pitched roof|dark shutter window|ochre window sill|arcaded gallery|gallery column|fort curtain wall|fort corner bastion|parapet merlon|moored lighter hull|lighter mast)/.test(name))continue;
  if(/^Meshy /.test(name)||/Golden stern window|Stern window mullion|Ships wheel pedestal|Helm wheel spoke|Unrolled parchment|Skull portal stone pillar|Skull arch pillar/.test(name))continue;
  if(/Brass lantern frame|Amber lantern glass|Barrel iron hoop|Barrel lid/.test(name))continue;
  if(name==='Oak barrel staves'){
   const b=bounds(c);if(!barrels.some(p=>Math.hypot(p[0]-b.p[0],p[2]-b.p[2])<2.9&&Math.abs(p[1]-b.p[1])<1)){
    barrels.push(b.p);art('crowncargostack',b.p,.6,Math.sin(b.p[2]) * 12,c.grp);
   }continue;
  }
  if(c.t==='torch'&&name==='Smugglers lantern'&&c.grp===4){
   art('crownmeshybeamhewn',[c.p[0]+.37,c.p[1]-.08,c.p[2]-.04],1,0,4,[.24,2.6,.22]);
   art('crownbrasslantern',[c.p[0],c.p[1]+1.2,c.p[2]],.63,0,4);
   out.push({...c,p:[c.p[0],c.p[1]+1.2,c.p[2]],rise:.55,w:.25});continue;
  }
  if(c.t==='torch'&&name==='Smugglers lantern'){
   if(c.grp===5&&c.p[0]<-20)art('crownmeshybeamhewn',[c.p[0]-.37,-4.08,c.p[2]+.04],1,0,5,[.24,2.9,.22]);
   art('crownbrasslantern',[c.p[0],c.p[1]+.05,c.p[2]],.63,c.grp===7?(c.p[0]>32?-90:90):c.grp===5&&c.p[0]<0?180:0,c.grp);
   out.push({...c,rise:.55,w:.25});continue;
  }
  if(c.t==='mesh'&&name==='Cavern hanging stalactite')continue;
  if(c.t==='mesh'&&/Massive cavern cliff|Harbour · headland limestone|Vaulted cavern ceiling|Moonpool stepping rubble|Escape bridge anchored limestone/.test(name)){
   const raised=name==='Vaulted cavern ceiling'?{...c,p:[c.p[0],c.p[1]+18,c.p[2]] as P}:c;
   out.push({...raised,tex:'solid',color:'#607184'});continue;
  }
  if(c.t==='mesh'&&!c.materialStyle&&c.opacity===undefined){
   if(name.startsWith('Fitted weathered deck boards · underboard support')){out.push({...c,tex:'solid',color:'#48362a'});continue;}
   if(name==='Hand-shaped broken galleon hull planking'){out.push(painted(c,'crown-timber',c.color==='#69422f'?'#bdad98':'#d9c4a7'));continue;}
   if(name==='Blackened hull wale'){out.push(painted(c,'crown-timber','#716e5b'));continue;}
   if(name.startsWith('Treasure dais')){out.push({...c,tex:'solid',color:'#88908d'});continue;}
   if(name==='Curved weathered cabin roof'){out.push(painted(c,'crown-timber','#81755e'));continue;}
   if(name==='Black square gunport'){out.push(c);continue;}
   if(name==='Turquoise crystal cluster'){out.push({...c,materialStyle:'crown-quartz',emissive:'#06191d'});continue;}
   if(/Loose treasure gemstones/.test(name)){out.push({...c,emissive:undefined});continue;}
   if(/Piles of ancient gold|Carved golden sea serpent/.test(name)){out.push(painted(c,'crown-coins','#fff0c3'));continue;}
   if(/sail|parchment/i.test(name)){out.push(painted(c,'crown-canvas','#f0e6d0'));continue;}
   if(/cavern|tunnel shell|rubble|Grotto branch|Hidden crystal alcove|Excavated smugglers trail|Fissure (near|far) bank|Royal treasure chamber|Treasure grotto path|Moonpool rim|Curving moonpool|lookout ledge|Limestone headland|Harbour · sea gate (shoulder|lintel)/.test(name)){
    out.push({...c,tex:'solid',color:'#75818b'});continue;
   }
   out.push(painted(c,'crown-timber',/dark|frame|rib|beam/i.test(name)?'#b4a494':'#e3cbb0'));continue;
  }
  if(c.t==='platform'&&name==='Harbour masonry sea wall')out.push({...c,tex:'solid',color:'#cac7b8'});
  else if(c.t==='wall'&&name.startsWith('Crystal grotto'))out.push({...c,tex:'solid',color:'#b4c0ba'});
  else out.push(c);
 }
 for(const t of [.18,.5,.83]){
  const x=-20+20*t,z=-75-31*t,y=-6+14*t;
  art('crownmooringpiles',[x,-10.5,z],1,32,2,[7.6,y+10.2,1.7]);
  for(const side of [-1,1]){
   const p:P=[x+side*3.8,y,z];
   out.push({t:'wall',p,s:[.2,1.8,.2],tex:'crown-timber',color:'#b29a7d',grp:2,nm:'Gangway lantern post'});
   art('crownbrasslantern',[p[0],y+1,p[2]],.65,0,2);
   out.push({t:'torch',p:[p[0],y+1.2,p[2]],rise:.5,w:.25,grp:2,nm:'Gangway lantern candle'});
  }
 }
 // Complete original Meshy hull panels enclose the chart cabin; no painted
 // primitive siding. The rounded roof is assembled from existing plank assets.
 for(const side of [-1,1])setProp('crownhullpanel',[side*9.2,14,-98.5],1,side>0?-90:90,6,[11.3,7.4,1.15]);
 for(let row=0;row<23;row++)for(let col=0;col<6;col++){
  const xa=-10.2+col*3.4,xb=xa+3.4,ya=21.1+1.75*Math.cos(xa/10.2*Math.PI/2),yb=21.1+1.75*Math.cos(xb/10.2*Math.PI/2);
  setProp((row+col)%3?'crownmeshyplankchipped':'crownmeshyplankchipped',[(xa+xb)*.5,(ya+yb)*.5,-107.9+row*.75],1,0,6,[Math.hypot(xb-xa,yb-ya)+.4,.28,1.02]);
  out[out.length-1].amp=Math.atan2(yb-ya,xb-xa)*180/Math.PI;
  out[out.length-1].nm='Original Meshy plank · rounded captain cabin roof';
 }
 // Whole original timbers close the eave silhouette below the roof boards.
 for(const z of [-108.25,-91.05])for(let col=0;col<6;col++){
  const xa=-10.2+col*3.4,xb=xa+3.4,ya=21.1+1.75*Math.cos(xa/10.2*Math.PI/2),yb=21.1+1.75*Math.cos(xb/10.2*Math.PI/2);
  timber([xa,ya,z],[xb,yb,z],.4,.36,6);
 }
 for(const side of [-1,1])timber([side*10.2,21.1,-108.25],[side*10.2,21.1,-91.05],.4,.36,6);
 // Dress both faces of the stern while leaving the actual cabin open.
 art('crowncrashsterngallery',[0,14,-91.6],1,0,6,[19,9.8476,5.504]);
 art('crowncrashsterngallery',[0,14,-94.8],1,180,6,[15.96,8.272,4.6234]);
 // A substantial chart desk uses the existing complete plank/beam assets.
 for(const x of [-2.18,2.18])for(const z of [-100.05,-97.95])timber([x,14,z],[x,15.16,z],.34,.3,6);
 for(const z of [-100.05,-97.95])timber([-2.25,14.4,z],[2.25,14.4,z],.22,.22,6);
 for(const z of [-100,-99.22,-98.44])setProp('crownmeshyplankchipped',[0,15.05,z],1,0,6,[5.3,.18,.82]);
 art('crowncharttable',[0,15.23,-99.2],.96,180,6);
 for(const x of [-6.65,6.65]){
  timber([x,14,-98.1],[x,19.8,-98.1],.48,.36,6);
  mountedLamp(x,16.2,-98.35,x<0?-1:1,6);
 }
 // Folded red sailcloth serves as salvaged window curtains.
 for(const x of [-6.2,6.2])out.push({t:'decor',dkind:'trialsv2awning',p:[x,18.3,-97.3],s:[4.6,.65,1.55],yaw:-90,amp:90,color:'#9e393e',scenerySolid:false,grp:6,nm:'Salvaged crimson cabin curtain'});
 // Fitted panels follow the actual hull flare instead of floating beside it.
 art('crownfittedhull',[...DROWNED_HULL_POSITION],1,0,3);
 art('crownpaintedroyalhull',[...DROWNED_ROYAL_HULL_POSITION],1,0,3);
 for(const side of [-1,1])art('crowncrashsterngallery',[side*8.9,16,-99],1,side>0?90:-90,6,[7.6,3.939,2.2016]);
 for(const side of [-1,1])art('crowncrashsterngallery',[side*7.65,16.2,-99],1,side>0?-90:90,6,[6.46,3.3482,1.8714]);
 // The complete hull already supplies its ribs; keep the hatch sightline open.
 for(const p of [[11,8,-116],[-11,8,-127],[-10,8,-190],[11,8,-199]] as P[])art('crownnavalcannon',p,.85,p[0]>0?90:-90,4);
 for(const [x,y,z,scale,yaw] of [[25.5,12,-313.5,1.12,15],[27.9,12,-317.6,.68,-12],[-22,-4,-204,.65,-25],[4,14,-101,.5,20],[38.5,10,-300,.98,-18],[39.7,10,-305.5,.56,27]] as [number,number,number,number,number][])
  art('crowntreasurehoard',[x,z<-286?drownedVaultSurfaceHeight(x,z):y,z],scale,yaw,z>-120?6:z>-210?5:7);
 // Broad original-proportion shelves replace stretched vertical wall strips.
 for(const [x,y,z,yaw,w,h,d] of [[12,6,-307,90,50,25,20],[52,6,-307,-90,50,25,20],[11,-17,-307,90,52,25,24],[53,-17,-307,-90,52,25,24]])
  art('crowncrashcavernrock',[x,y,z],1,yaw,7,[w,h,d]);
 // Intact native-proportion pile clusters stack down from the original
 // landing height; the lower modules continue beneath the waterline.
 const pileNative=DROWNED_CROWN_MODELS.crownmooringpiles.size,pileScale=8.8/pileNative[0];
 const pileHeight=pileNative[1]*pileScale,pileCount=Math.ceil(23.7/pileHeight),pileTop=-14+23.7;
 for(const [x,z] of [[30.4,-273],[31.6,-283]])for(let i=0;i<pileCount;i++)
  art('crownmooringpiles',[x,pileTop-(i+1)*pileHeight,z],pileScale,-6,7);
 // A broad existing rock mass roots the treasury shelf beside the bridge.
 art('crowncrashcavernrock',[24,-13,-293],1,-90,7,[39,23,25]);
 art('crownvaultfloor',[...DROWNED_VAULT_FLOOR_POSITION],1,0,7);
 art('crownroyalportal',[32,10,-326],1.12,0,7);
 // The crown frames an enclosed treasury alcove; the room has a real back wall.
 // The near rear face, a deeper mass and a side buttress overlap behind
 // the crown. All three are complete native-proportion rocks; the untextured
 // closure sits behind them, clear of their sculpted surfaces.
 setProp('crowncrashcavernrock',[32,8,-342],1.2,0,7);
 setProp('crowncrashcavernrock',[32,8,-372],2.2,0,7);
 setProp('crowncrashcavernrock',[78,8,-349],1.8,-90,7);
 out.push({t:'wall',p:[32,0,-405],s:[160,80,4],color:'#334052',tex:'solid',grp:7,nm:'Closed treasury rear wall'});
 for(const x of [19,45])out.push({t:'decor',dkind:'trialsv2cavewalla',p:[x,8,-334],s:[11,27,10],color:'#b9c4cf',scenerySolid:true,grp:7,nm:'Sculpted stone behind the royal portal'});
 // Reuse the textured hoard kit in overlapping edge clusters, clear of the finish lane.
 for(const [x,z,scale,yaw] of [[22,-311.8,1.1,32],[41,-318.2,1.08,-50],
  [25.6,-329.1,1.25,58],[38,-328.6,1.2,-48]])
  art('crowntreasurehoard',[x,drownedVaultSurfaceHeight(x,z),z],scale,yaw,7);
 // Dense banks retain whole original coin-spill meshes on their outer skin.
 // Omit a cluster only when its complete rotated footprint fits inside the
 // next layer: hidden cores add vertex/shadow cost without defining the pile.
 const coinBank=(x:number,z:number,length:number,depth:number,layers:number,seed:number)=>{
  for(let layer=0;layer<layers;layer++){
   const shrink=1-layer/(layers+1),halfX=depth*.5*shrink,halfZ=length*.5*shrink;
   const nx=Math.max(2,Math.ceil(halfX*2/1.1)),nz=Math.max(2,Math.ceil(halfZ*2/1.3));
   for(let row=0;row<nz;row++)for(let col=0;col<nx;col++){
    const u=((col+.5)/nx*2-1),v=((row+.5)/nz*2-1);
    if(u*u+v*v>1.18)continue;
    const n=seed+row*17+col*11+layer*7;
    const px=x+u*halfX+Math.sin(n*2.31)*.18,pz=z+v*halfZ+Math.cos(n*1.73)*.2;
    const scale=.43+(.5+.5*Math.sin(n*4.13))*.11;
    const angle=n*137.508*Math.PI/180,native=DROWNED_CROWN_SCULPTURES.crowncoinspill.size;
    const rx=(native[0]*Math.abs(Math.cos(angle))+native[2]*Math.abs(Math.sin(angle)))*scale*.5+.1;
    const rz=(native[0]*Math.abs(Math.sin(angle))+native[2]*Math.abs(Math.cos(angle)))*scale*.5+.1;
    const nextShrink=1-(layer+1)/(layers+1);
    if(layer<layers-2&&Math.pow((Math.abs(px-x)+rx)/(depth*.5*nextShrink),2)+
      Math.pow((Math.abs(pz-z)+rz)/(length*.5*nextShrink),2)<1.18)continue;
    // Omit complete clusters beyond the irregular stone shelf's footprint.
    let support:number;try{support=drownedVaultSurfaceHeight(px,pz);}catch{continue;}
    art('crowncoinspill',[px,support-.07+layer*.24,pz],scale,n*137.508,7);
    out[out.length-1].scenerySolid=false;
   }
  }
 };
 for(const [x,z,len,depth,layers,seed] of [[23.4,-298,7.8,5.2,6,11],[41.2,-303.5,8.5,5.8,7,27],
  [23.1,-308.5,9.6,6.1,13,43],[41.1,-314.5,9,6.2,18,61],
  [24.1,-319.7,7.2,5.6,18,83],[32,-330,9.5,10,24,97]])
  coinBank(x,z,len,depth,layers,seed);
 // An intact jewelled chest crowns the rear bank, framed by the skull arch.
 // Its foot sinks into the retained top layer and stays beyond the finish lane.
 setProp('crowntreasurehoard',[32,drownedVaultSurfaceHeight(32,-330)+5.35,-330],1.12,6,7);
 out[out.length-1].nm='Treasury · the crowned hoard';

 // Short whole timbers support lanterns beside the clear walking lane. The
 // candle flame sits at the front of each housing, clear of its solid post
 // and cage. Enclosed lamps do not need the native large-torch smoke plume.
 for(const [x,z] of [[24,-299.5],[39.5,-301],[39.5,-313],[27,-320.5]]){
  const floor=drownedVaultSurfaceHeight(x,z),side=x<32?1:-1;
  art('crownmeshybeamhewn',[x,floor-.1,z],1.05,0,7);
  art('crownbrasslantern',[x+side*.5,floor+1.95,z],.8,0,7);
  out.push({t:'torch',p:[x+side*.5,floor+2.38,z+.36],rise:0,w:.28,grp:7,nm:'Treasury hoard lantern'});
 }
 out.push({t:'decor',dkind:'trialsv2caveroofa',p:[32,26.8,-337],s:[27,9,12],color:'#b9c4cf',scenerySolid:true,grp:7,nm:'Rock lintel behind the crown'});
 for(const x of [23.5,40.5]){
  const y=drownedVaultSurfaceHeight(x,-322.1)+2.1;
  art('crownbrasslantern',[x,y,-322.1],.9,0,7);
  out.push({t:'torch',p:[x,y+.5,-321.69],rise:0,w:.29,grp:7,nm:'Royal portal lantern'});
 }

 // Three broad framed bays give the hold a readable rhythm. The centre and
 // port powder-room crosswalk remain clear; dressing is visual-only.
 for(const z of [-183,-195,-207]){
  for(const side of [-1,1])timber([side*12.6,-4,z],[side*13.1,6.4,z],.66,.55);
  timber([-13.1,6.4,z],[13.1,6.4,z],.66,.6);
 }
 // One tall starboard working bay, a low port cache and a little salvage at
 // the entrance replace the repeated isolated piles.
 for(const [x,z,scale,yaw] of [[9.9,-188.6,1.14,-8],[9.7,-193.4,.8,27],
  [-9.8,-203.7,1.08,14],[-10.9,-180.8,.65,-22],[-25,-205,.6,15]])
  setProp('crowncargostack',[x,-4,z],scale,yaw,5);
 for(const z of [-185.5,-195.7])timber([11.6,-4,z],[11.6,3.5,z],.4,.32);
 timber([11.6,3.5,-185.5],[11.6,3.5,-195.7],.38,.3);
 out.push({t:'decor',dkind:'trialsv2awning',p:[9.8,2.5,-190.5],s:[4.6,1.1,10.3],yaw:0,color:'#b6423f',scenerySolid:false,grp:5,nm:'Crimson sailcloth over the starboard working bay'});
 for(const [x,y,z,side] of [[11.1,.5,-185.5,1],[11.1,.5,-195.7,1],[-12.2,.1,-202.7,-1],[-12.2,.1,-183.5,-1]])mountedLamp(x,y,z,side);
 // The optional powder room reads as an intentional stocked alcove.
 for(const z of [-191.6,-205.5])timber([-26.4,-4,z],[-26.4,2.6,z],.4,.34);
 timber([-26.4,2.6,-191.6],[-26.4,2.6,-205.5],.4,.32);
 setProp('crowncargostack',[-24.7,-4,-191.8],.54,22,5);
 // A broad blue stone soffit gives the treasury one clear ceiling shape.
 // Keep a single recessed stalactite accent; the crown and gold stay dominant.
 setProp('crowncrashcavernrock',[32,32.5,-325],.93,8,7);
 setProp('crownstalactitevault',[15,29,-320],.62,20,7);

 out.push({t:'wall',p:[35,10,-279.3],s:[.25,1.9,.25],color:'#715338',tex:'solid',grp:7,nm:'Landing lantern mounting post'});
 for(const x of [22.5,41.5])out.push({t:'wall',p:[x,10,-326],s:[3.2,17,3],invisible:true,nm:'Royal portal masonry collision',grp:7});
 art('crowncrashmineshell',[...DROWNED_MINE_POSITION],1,0,1);
 // Close rockwork follows the mine and vault while leaving the native
 // walking surfaces and the optional grotto entrance clear.
 art('crowncrashcavernrock',[-58,-6,-54.8],1,0,1,[22,15,6]);
 art('crowngrottofloor',[...DROWNED_GROTTO_FLOOR_POSITION],1,0,1);
 art('crowntreasurehoard',[-59.8,-4,-52.1],.6,20,1);
 art('crowncargostack',[-62.2,-4,-51.5],.42,-15,1);
 art('crowncrashcavernrock',[-24,-13,-198],1,0,5,[15,8,25]);
 for(const [x,y,z,yaw] of [[-43.9,0,41.8,18],[-41.53,-.6,16.23,-22],[-31.15,-4.87,-26.96,10],[-35.12,-6,-44.51,43]] as [number,number,number,number][])
  art('crowncargostack',[x,y,z],.7,yaw,1);
 // Root each large wall mass below the water; overlapping upright shapes
 // avoid exposed horizontal cut bases from stacking separate storeys.
 for(const [i,z] of [-120,-225,-325].entries())for(const side of [-1,1]){
  const x=side<0?[-96,-85,-86][i]:[80,78,82][i];
  art('crowncrashcavernrock',[x,-24,z],1,side<0?90:-90,2,[150,88,56]);
 }
 // Original-proportion rock spurs break up the distant blue wall and give
 // the ship reveal a near shoreline, middle distance and deep cliff terraces.
 // Every added mass sits outside the ship and powder-cache corridor.
 for(const [x,y,z,scale,yaw] of [[-62,-21,-154,1.6,78],[51,-21,-168,1.4,-85],
  [-66,-24,-312,2,-12],[-70,8,-332,2,15]])
  setProp('crowncrashcavernrock',[x,y,z],scale,yaw,2);
 // These shoulders meet the canopy at its outer seams. Both authored
 // skylights remain open: their centres are (-30,-190) and (40,-136).
 for(const [x,y,z,scale,yaw] of [[-86,50,-248,1.1,12],[91,49,-216,1.05,-18]])
  setProp('crowncrashcavernrock',[x,y,z],scale,yaw,2);
 out.push({t:'wall',p:[0,-22,-380],s:[260,130,8],color:'#35486a',tex:'solid',grp:2,nm:'Deep cavern enclosing wall'});
 art('crowncrashcanopy',[...DROWNED_CANOPY_POSITION],1,0,2);
 for(const [x,z] of DROWNED_SKYLIGHTS){
  art('crowncrashskylight',[x,57,z],1,0,2,[76,8,74.5]);
  // Existing Meshy foliage catches daylight at the skylight rims.
  for(const [dx,dy,dz,yaw] of [[-13,57,12,-30],[16,58,-2,80]])
   out.push({t:'decor',dkind:'trialsv3bough',p:[x+dx,dy,z+dz],s:[18,6,9],yaw,scenerySolid:false,grp:2,nm:'Overhanging jungle at the cavern skylight'});
 }
 for(const [x,w] of [[-44,136],[103,126]])
  out.push({t:'decor',dkind:'trialsv2cavewalla',p:[x,-20,-350],s:[w,115,36],color:'#929bb9',scenerySolid:true,grp:2,nm:'Sculpted cavern end shoulder'});
 art('crowncargostack',[-44,-6,-71],.55,-18,2);
 art('crownnavalcannon',[-44.6,0,38.3],.78,-65,1);
 for(const [x,y,z,yaw] of [[-48,7.2,42,0],[-43.6,6.4,10,-26]])
  out.push({t:'decor',dkind:'trialsv2awning',p:[x,y,z],s:[8.5,1.1,5.2],yaw,color:'#b75b62',scenerySolid:false,grp:1,nm:'Faded sailcloth over a loading landing'});
 return out;
}
