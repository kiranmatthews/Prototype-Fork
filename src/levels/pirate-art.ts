import * as THREE from 'three';
import type { CustomComponent } from '../level';
import { DROWNED_CROWN_MODELS } from '../drownedCrownAssets.generated';
import type { P } from './pirate-meshes';
import { refineHarbourQuay } from './pirate-harbour-proof';

type Kind=keyof typeof DROWNED_CROWN_MODELS;
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
 const fit=tex==='crown-canvas',box=fit?bounds(c):null;
 const tile=tex==='crown-coins'?.85:tex==='crown-limestone'?5:4;
 for(let i=0;i<ids.length;i+=3){
  a.fromArray(v,ids[i]*3);b.fromArray(v,ids[i+1]*3).sub(a);d.fromArray(v,ids[i+2]*3).sub(a);b.cross(d);
  const nx=Math.abs(b.x),ny=Math.abs(b.y),nz=Math.abs(b.z);
  for(let j=0;j<3;j++){
   const k=ids[i+j]*3,x=v[k],y=v[k+1],z=v[k+2];
   const u=fit&&box?round((x-box.p[0])/Math.max(.01,box.size[0])+.5):round((ny>nx&&ny>nz?x:nx>nz?z:x)/tile);
   const w=fit&&box?round((y-box.p[1])/Math.max(.01,box.size[1])):round((ny>nx&&ny>nz?z:y)/tile);
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
  s:size??DROWNED_CROWN_MODELS[kind].size.map(v=>round(v*scale)) as P,yaw,grp,nm:DROWNED_CROWN_MODELS[kind].label});
 for(let c of source){
  const name=c.nm??'';
  if(c.grp===7&&/^(Old mine brace|Mine lintel)$/.test(name)&&bounds(c).p[2]<-286)continue;
  if(c.t==='torch'&&c.grp===4&&c.p[0]===4)c={...c,p:[7,8,c.p[2]]};
  if(c.t==='woodpath'){out.push({...c,plankPalette:(c.grp??0)>=8?'crown-quay':'crown-timber',polePalette:(c.grp??0)>=8?'rustic-timber-rope':'crown-timber',tex:'crown-timber',color:'#d1b991'});continue;}
  if(c.t==='decor'&&c.dkind==='junglepalmtree'&&c.grp===8){art('crowntropicalpalm',c.p,.92,c.yaw??0,8);continue;}
  if(/^Harbour · (limewashed warehouse|tiled pitched roof|dark shutter window|ochre window sill|arcaded gallery|gallery column|fort curtain wall|fort corner bastion|parapet merlon|moored lighter hull|lighter mast)/.test(name))continue;
  if(/^Meshy /.test(name)||/Golden stern window|Stern window mullion|Ships wheel pedestal|Helm wheel spoke|Unrolled parchment|Skull portal stone pillar|Skull arch pillar/.test(name))continue;
  if(/Brass lantern frame|Amber lantern glass|Barrel iron hoop|Barrel lid/.test(name))continue;
  if(name==='Oak barrel staves'){
   const b=bounds(c);if(!barrels.some(p=>Math.hypot(p[0]-b.p[0],p[2]-b.p[2])<2.9&&Math.abs(p[1]-b.p[1])<1)){
    barrels.push(b.p);art('crowncargostack',b.p,.6,Math.sin(b.p[2]) * 12,c.grp);
   }continue;
  }
  if(c.t==='torch'&&name==='Smugglers lantern'){
   art('crownbrasslantern',[c.p[0],c.p[1]+.05,c.p[2]],.63,0,c.grp);
   out.push({...c,rise:.7,w:.25});continue;
  }
  if(c.t==='mesh'&&name==='Cavern hanging stalactite')continue;
  if(c.t==='mesh'&&/Massive cavern cliff|Harbour · headland limestone|Vaulted cavern ceiling|Moonpool stepping rubble|Escape bridge anchored limestone/.test(name)){
   const raised=name==='Vaulted cavern ceiling'?{...c,p:[c.p[0],c.p[1]+18,c.p[2]] as P}:c;
   out.push(painted(raised,'crown-limestone','#b0bab9'));continue;
  }
  if(c.t==='mesh'&&!c.materialStyle&&c.opacity===undefined){
   if(name==='Black square gunport'){out.push(c);continue;}
   if(/Turquoise crystal|Loose treasure gemstones/.test(name)){out.push({...c,emissive:/crystal/.test(name)?'#123f45':undefined});continue;}
   if(/Piles of ancient gold|Carved golden sea serpent/.test(name)){out.push(painted(c,'crown-coins','#fff0c3'));continue;}
   if(/sail|parchment/i.test(name)){out.push(painted(c,'crown-canvas','#f0e6d0'));continue;}
   if(/cavern|tunnel shell|rubble|Grotto branch|Hidden crystal alcove|Excavated smugglers trail|Fissure (near|far) bank|Royal treasure chamber|Treasure grotto path|lookout ledge|Limestone headland|Harbour · sea gate (shoulder|lintel)/.test(name)){
    out.push(painted(c,'crown-limestone','#bdc7c5'));continue;
   }
   out.push(painted(c,'crown-timber',/dark|frame|rib|beam/i.test(name)?'#b4a494':'#e3cbb0'));continue;
  }
  if(c.t==='platform'&&name==='Harbour masonry sea wall')out.push({...c,tex:'crown-limestone',color:'#cac7b8'});
  else if(c.t==='wall'&&name.startsWith('Crystal grotto'))out.push({...c,tex:'crown-limestone',color:'#b4c0ba'});
  else out.push(c);
 }
 // The town fronts the water. Buildings use uniform source proportions.
 for(const [x,z,scale] of [[-96,211,1],[-112,190,1.15],[-97,175,.95],[-112,151,1.1],[-96,137,1]] as [number,number,number][])art('crownwarehouse',[x,2,z],scale,90,8);
 art('crownfortbastion',[-71,15,58],1.35,10,10);
 art('crownfortbastion',[-91,17,51],.8,20,10);
 for(const x of [-98,-80,-61,-36,-14,9,28,43]){
  const top=-11+53*Math.sqrt(Math.max(0,1-(x/(x>0?45:108))**2));
  art('crownlimestonewall',[x,-12,45],1,Math.sin(x)*10,10,[25,top+13,17]);
 }
 art('crowncargolighter',[-28,-10,171],1,15,9);
 art('crowncargolighter',[-18,-10,125],.78,-12,9);
 // Piles have a visible base at the waterline and carry each broken bank.
 for(const [x,z,y] of [[-72,198,2],[-72,183,2],[-57,153,2],[-57,150.5,2],[-57,134,2],[-57,131,2],[-43,103,1],[-43,100,1],[-48,72,0]] as [number,number,number][])
  art('crownmooringpiles',[x,-10.4,z],1,0,9,[8.1,y+10.2,1.7]);
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
 // Repeated hull modules add real rim/gunport relief outside the authored skin.
 for(const [z,width] of [[-117,18],[-137,19.5],[-192,17],[-212,15],[-230,10.5]] as [number,number][])
  for(const side of [-1,1])art('crownhullpanel',[side*(width+.15),-.5,z],1,side>0?90:-90,3,[18,9,2.1]);
 for(const z of [-157,-176])art('crownshipribs',[-.5,-9,z],1,0,5,[31,21,2.4]);
 for(const p of [[11,8,-116],[-11,8,-127],[-10,8,-190],[11,8,-199]] as P[])art('crownnavalcannon',p,.85,p[0]>0?90:-90,4);
 for(const [x,y,z,scale,yaw] of [[26.5,12,-311,.9,25],[39,10,-294,.75,-20],[-22,-4,-204,.65,-25],[4,14,-101,.5,20],[23,10,-302,.8,30],[40,10,-309,.85,-25]] as [number,number,number,number,number][])
  art('crowntreasurehoard',[x,y,z],scale,yaw,z>-120?6:z>-210?5:7);
 art('crownroyalportal',[32,10,-326],1.12,0,7);
 for(const x of [22.5,41.5])out.push({t:'wall',p:[x,10,-326],s:[3.2,17,3],invisible:true,nm:'Royal portal masonry collision',grp:7});
 // The alcove wall and mine-mouth edges use full 3D rock close to the player.
 art('crownlimestonewall',[-58,-4,-56],1,0,1,[16,11,3]);
 for(const [x,z,yaw] of [[-56,49,65],[-40,49,-65]] as [number,number,number][])art('crownlimestonewall',[x,-5,z],1,yaw,10,[12,19,6]);
 for(const z of [36,13,-12,-36])for(const side of [-1,1]){
  const x=z>20?-48:z>-10?-39:-36,y=z>20?0:z>-10?-2:-5;
  art('crownlimestonewall',[x+side*7,y-.8,z],1,side>0?-90:90,1,[13,9,3.5]);
 }
 // Keep natural module proportions: wall bands and a high canopy replace
 // the earlier stretched cliff skins while the continuous enclosure stays.
 for(let z=16;z>=-330;z-=25)for(const side of [-1,1])for(const y of [-10,5,20,35]){
  if(side>0&&z>-80)continue;
  art('crownlimestonewall',[side*78,y,z],1.8,side<0?90:-90,2);
 }
 for(const z of [-72,-110,-150,-190,-230,-270,-310])for(const x of [-39,-11,19,47])
  art('crownstalactitevault',[x,57+Math.sin(z+x)*3,z],1.25,0,2);
 // Painting only occupies the distant world; every playable surface is 3D.
 out.push({t:'decor',dkind:'crownharbourmatte',p:[-119,-16,224],s:[240,80,.02],yaw:105,grp:8,nm:'Port Royal distant waterfront'});
 out.push({t:'decor',dkind:'crownharbourmatte',p:[37,-17,270],s:[280,93.33,.02],yaw:180,grp:8,nm:'Harbour far shore'});
 for(const [x,z,yaw] of [[-95,-122,90],[95,-138,-90],[-95,-274,90],[95,-284,-90]] as [number,number,number][])
  out.push({t:'decor',dkind:'crowncavernmatte',p:[x,-22,z],s:[180,90,.02],yaw,grp:2,nm:'Cavern depth beyond the physical limestone'});
 out.push({t:'decor',dkind:'crownexitbay',p:[32,7,-350],s:[42,23.625,.02],grp:7,nm:'Daylight beyond the royal vault'});
 return refineHarbourQuay(out);
}
