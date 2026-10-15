import * as THREE from 'three';
import type { CustomComponent } from '../level';
import { DROWNED_CROWN_MODELS } from '../drownedCrownAssets.generated';
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
const DROWNED_ART_MODELS={...DROWNED_CROWN_BOARD_MODELS,...DROWNED_CROWN_MODELS,...DROWNED_CROWN_SCULPTURES,...DROWNED_CROWN_SHIP_ASSETS,...DROWNED_CROWN_EXCELLENCE_MODELS};
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
 for(let c of source){
  if((c.grp??0)>=8){out.push(c);continue;}
  const name=c.nm??'';
  // The treasury's mounted lamp clusters replace the old floating mine lamps.
  if(c.grp===7&&c.t==='torch'&&name==='Smugglers lantern'&&c.p[2]<-286)continue;
  if(c.grp===1&&c.p[2]<60&&c.t==='decor'&&['Sculpted mine wall with original atlas','Sculpted mine ceiling with original atlas'].includes(name))continue;
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
   for(const [x,z] of DROWNED_SKYLIGHTS)backing=cutPirateRoofOpening(backing,x,z,40,38);
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
   if(/Turquoise crystal|Loose treasure gemstones/.test(name)){out.push({...c,emissive:/crystal/.test(name)?'#06191d':undefined});continue;}
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
 // Dress both faces of the stern while leaving the actual cabin open.
 art('crownsterngallery',[0,14,-91.6],1,0,6);
 art('crownsterngallery',[0,14,-94.8],.84,180,6);
 art('crowncharttable',[0,15.2,-99],.9,180,6);
 // Fitted panels follow the actual hull flare instead of floating beside it.
 art('crownfittedhull',[...DROWNED_HULL_POSITION],1,0,3);
 art('crownpaintedroyalhull',[...DROWNED_ROYAL_HULL_POSITION],1,0,3);
 for(const side of [-1,1])art('crownsterngallery',[side*8.9,16,-99],.4,side>0?90:-90,6);
 for(const side of [-1,1])art('crownsterngallery',[side*7.65,16.2,-99],.34,side>0?-90:90,6);
 for(const z of [-157,-176])art('crownshipribs',[-.5,-9,z],1,0,5,[31,21,2.4]);
 for(const p of [[11,8,-116],[-11,8,-127],[-10,8,-190],[11,8,-199]] as P[])art('crownnavalcannon',p,.85,p[0]>0?90:-90,4);
 for(const [x,y,z,scale,yaw] of [[25.5,12,-313.5,1.12,15],[27.9,12,-317.6,.68,-12],[-22,-4,-204,.65,-25],[4,14,-101,.5,20],[38.5,10,-300,.98,-18],[39.7,10,-305.5,.56,27]] as [number,number,number,number,number][])
  art('crowntreasurehoard',[x,z<-286?drownedVaultSurfaceHeight(x,z):y,z],scale,yaw,z>-120?6:z>-210?5:7);
 // Broad original-proportion shelves replace stretched vertical wall strips.
 for(const [x,y,z,yaw,w,h,d] of [[12,6,-307,90,50,25,20],[52,6,-307,-90,50,25,20],[11,-17,-307,90,52,25,24],[53,-17,-307,-90,52,25,24]])
  art('crowncrashcavernrock',[x,y,z],1,yaw,7,[w,h,d]);
 for(const [x,z] of [[30.4,-273],[31.6,-283]])art('crownmooringpiles',[x,-14,z],1,-6,7,[8.8,23.7,2.4]);
 // A broad existing rock mass roots the treasury shelf beside the bridge.
 art('crowncrashcavernrock',[24,-13,-293],1,-90,7,[39,23,25]);
 art('crownvaultfloor',[...DROWNED_VAULT_FLOOR_POSITION],1,0,7);
 art('crownroyalportal',[32,10,-326],1.12,0,7);
 // The crown frames an enclosed treasury alcove; the room has a real back wall.
 art('crowncrashcavernrock',[32,8,-342],1,0,7,[44,25,18]);
 out.push({t:'wall',p:[32,6,-349],s:[48,32,4],color:'#334052',tex:'solid',grp:7,nm:'Closed treasury rear wall'});
 for(const x of [19,45])out.push({t:'decor',dkind:'trialsv2cavewalla',p:[x,8,-334],s:[11,27,10],color:'#b9c4cf',scenerySolid:true,grp:7,nm:'Sculpted stone behind the royal portal'});
 // Reuse the textured hoard kit in overlapping edge clusters, clear of the finish lane.
 for(const [x,z,scale,yaw] of [[22,-311.8,1.1,32],[41,-318.2,1.08,-50],
  [25.6,-329.1,1.25,58],[38,-328.6,1.2,-48],[32,-329.4,1.4,0]])
  art('crowntreasurehoard',[x,drownedVaultSurfaceHeight(x,z),z],scale,yaw,7);
 // Dense banks reuse whole coin-spill meshes. Overlapping layers build
 // the hoard's volume; the original coin geometry, UVs and paint stay intact.
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
    // Omit complete clusters beyond the irregular stone shelf's footprint.
    let support:number;try{support=drownedVaultSurfaceHeight(px,pz);}catch{continue;}
    art('crowncoinspill',[px,support-.07+layer*.18,pz],scale,n*137.508,7);
    out[out.length-1].scenerySolid=false;
   }
  }
 };
 for(const [x,z,len,depth,layers,seed] of [[23.4,-298,7.8,5.2,6,11],[41.2,-303.5,8.5,5.8,7,27],
  [23.1,-308.5,9.6,6.1,8,43],[41.1,-314.5,9,6.2,8,61],
  [24.1,-319.7,7.2,5.6,7,83],[28.6,-329,6.5,6.3,10,97],[36.8,-328.8,6.8,6.4,9,131]])
  coinBank(x,z,len,depth,layers,seed);

 for(const [x,z] of [[21.5,-300],[43,-313],[24.1,-327.7],[38,-328.2],[32,-331]]){
  const floor=drownedVaultSurfaceHeight(x,z),y=floor+2.6;
  art('crownmeshybeamhewn',[x,floor-.1,z],1,0,7,[.26,3.9,.24]);
  art('crownbrasslantern',[x,y,z],.8,x<32?90:-90,7);
  out.push({t:'torch',p:[x,y,z],rise:.55,w:.28,grp:7,nm:'Treasury hoard lantern'});
 }
 out.push({t:'decor',dkind:'trialsv2caveroofa',p:[32,26.8,-337],s:[27,9,12],color:'#b9c4cf',scenerySolid:true,grp:7,nm:'Rock lintel behind the crown'});
 for(const x of [23.5,40.5]){
  art('crownbrasslantern',[x,14,-324.5],.9,x<32?35:-35,7);
  out.push({t:'torch',p:[x,14,-324.5],rise:.65,w:.3,grp:7,nm:'Royal portal lantern'});
 }

 // Cargo belongs to working bays beside the gangway and ship's frames.
 for(const [x,z,scale,yaw] of [[-10.6,-184,.6,12],[-9.5,-203,.84,-17],[9.6,-190.2,.9,-12],[9.9,-194.3,.52,23],[9.2,-181.8,.62,90],[-25,-205,.55,15]])
  art('crowncargostack',[x,-4,z],scale,yaw,5);
 out.push({t:'decor',dkind:'trialsv2awning',p:[9.5,.9,-191],s:[6.1,1.1,5.1],yaw:90,color:'#a84e51',scenerySolid:false,grp:5,nm:'Red sailcloth over the cargo bay'});
 for(const z of [-188.5,-193.5])out.push({t:'wall',p:[9.5,1.8,z],s:[.07,1,.07],color:'#a79d83',tex:'solid',grp:5,nm:'Cargo sailcloth suspension'});

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
 out.push({t:'wall',p:[0,-22,-380],s:[260,130,8],color:'#35486a',tex:'solid',grp:2,nm:'Deep cavern enclosing wall'});
 art('crowncrashcanopy',[...DROWNED_CANOPY_POSITION],1,0,2);
 for(const [x,z] of DROWNED_SKYLIGHTS)art('crowncrashskylight',[x,57,z],1,0,2,[76,8,74.5]);
 for(const [x,w] of [[-44,136],[103,126]])
  out.push({t:'decor',dkind:'trialsv2cavewalla',p:[x,-20,-350],s:[w,115,36],color:'#929bb9',scenerySolid:true,grp:2,nm:'Sculpted cavern end shoulder'});
 art('crowncargostack',[-44,-6,-71],.55,-18,2);
 art('crownnavalcannon',[-44.6,0,38.3],.78,-65,1);
 for(const [x,y,z,yaw] of [[-48,7.2,42,0],[-43.6,6.4,10,-26]])
  out.push({t:'decor',dkind:'trialsv2awning',p:[x,y,z],s:[8.5,1.1,5.2],yaw,color:'#b75b62',scenerySolid:false,grp:1,nm:'Faded sailcloth over a loading landing'});
 return out;
}
