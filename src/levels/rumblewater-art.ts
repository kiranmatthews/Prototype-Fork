import type {CustomComponent,CustomGroup} from '../level';
import {CARLISLE_ASSETS} from '../carlisleAssets';
import {CUSTARD_ASSETS} from '../custardAssets';
import {buildRumblewaterWaterfall,RUMBLEWATER_WATERFALL_GROUP} from './rumblewater-waterfall';
import {buildCreekBank,type CreekBank,type CreekSampler} from './custard-terrain';

type P=[number,number,number];
const assets={...CARLISLE_ASSETS,...CUSTARD_ASSETS};
type Kind=keyof typeof assets;
const noise=(n:number)=>{const a=Math.sin(n*127.1+46.7)*43758.5453;return a-Math.floor(a);};
export const RUMBLEWATER_ART_GROUPS:CustomGroup[]=[
 {id:90,nm:'Gorge · sculpted sandstone and roots',editorOnly:true},
 {id:91,nm:'Willows · rooted creek vegetation',editorOnly:true},
 {id:92,nm:'Ruins · mill and aqueduct remnants',editorOnly:true},
 {id:93,nm:'Water · shaded creek and lethal depths',editorOnly:true},
 RUMBLEWATER_WATERFALL_GROUP,
];

/** Existing licensed/commissioned Custard and Carlisle GLBs retain their
 * real proportions. Placements form an independent gorge around the new run. */
export function rumblewaterArt(sampler:CreekSampler,banks:readonly CreekBank[],yaw:(s:number)=>number,end:number,checkpoints:readonly number[]):CustomComponent[]{
 const C:CustomComponent[]=buildRumblewaterWaterfall(sampler,yaw),{point,height}=sampler;
 function prop(kind:Kind,s:number,u:number,width:number,base:number,turn=0,group=90,name='Rumblewater eroded stone',solid=false,color='#fff4db'){
  const size=assets[kind].size,k=width/size[0];
  C.push({t:'decor',dkind:kind,p:point(s,base,u),s:size.map(v=>v*k) as P,yaw:yaw(s)+turn,
   scenerySolid:solid,solid:false,castShadow:group!==90||width<34,color,grp:group,nm:name});
 }
 // Overlapping near walls and lower roots produce real geological depth.
 // The central 32m remain clear even at the wider two-route forks.
 for(let s=-55,i=0;s<end+39;s+=28,i++)for(const side of [-1,1]){
  const act=s<892?0:s<1784?1:2,w=31+noise(i+side*71)*7,kind:Kind=act===2?(i%3===0?'coastcliff':'coastv2cavewall'):i%4===0?'custardgorgecliff':i%3===0?'coastv2cavewall':'coastv2buttress';
  const depth=assets[kind].size[2]*w/assets[kind].size[0];
  prop(kind,s+side*3,side*(20+depth/2),w,height(s)-12-noise(i)*3,side<0?87:-87,90,'Layered sandstone gorge',false,act===2?'#c6c2a9':act===1?'#ddc8a3':'#e5d6b8');
  if(i%2===0)prop('coastv2buttress',s+6,side*29,29,height(s)-33,side*90,90,'Deep connected gorge foundation',false,'#aaae96');
  prop('coastbeachrock',s+8,side*(18+noise(i+4)*3),8+noise(i)*4,height(s+8)-10,side*65,90,'Grounded stream margin',true,'#dfd1b8');
  if(i%3===1){
   prop('coastv2ledge',s-5,side*17,8,height(s-5)-10,side*90,90,'Deep root beneath the planting shelf');
   prop('coastv2earthbank',s-5,side*16,8,height(s-5)-2.1,side*90,90,'Rooted earth on the gorge edge');
  }
  if(i%3===1){
   prop('coastfern',s-5,side*16,2.0,height(s-5)-.65,noise(i)*360,91,'Creek fern in the rock seam',false,'#d4d7b6');
   prop('coastfoliage',s-4,side*16.7,2.4,height(s-5)-.65,noise(i+5)*360,91,'Coral fern accent',false,'#e4d1b7');
  }
  if(i%4===2&&s<1800){
   prop('custardwillow',s-3,side*30,16,height(s)+.7,noise(i)*90,91,'Willow over the outer bank',false,'#dfe6ba');
   prop('custardclifffoliage',s+8,side*24,10,height(s)+3,side*70,91,'Trailing willow over stone',false,'#dbe1b6');
  }
 }
 // A few landmarks carry the geography; the gameplay foreground stays clear.
 prop('custardmill',592,30,15,height(592)+3,-65,92,'Watermill above the high-wire branch',false);
 prop('coastv2buttress',592,31,23,height(592)-17,0,90,'Watermill foundation');
 prop('coastarch',end-5,0,28,height(end-5)-.2,0,92,'Sanctuary gateway',false);
 for(const [s,u,w,turn]of [[968,-28,12,70],[1480,27,17,-75]]){
  prop('custardmill',s,u,w,height(s)+1,turn,92,'Working mill district landmark');
  prop('coastv2buttress',s,u,22,height(s)-18,turn,90,'Deep mill foundation');
 }
 for(const s of [1190,1435,1772,2010,2245,2480])for(const side of [-1,1])
  prop('coastspire',s,side*(22+(s%3)),10,height(s)-2,side*21,92,'Downstream carved gorge landmark',false,s>1784?'#c6c7aa':'#e4d2ac');
 prop('coastarch',1775,0,28,height(1775)-1,0,92,'Flooded district threshold');
 for(const s of [1775,end-5])for(const side of [-1,1])prop('coastv2buttress',s,side*12.5,12,height(s)-11,side*90,90,'Grounded gateway footing');
 for(const s of [1249,1279,1322,1356,2068,2120,2165,2204,2592])
  prop('coastpillar',s,6,2,height(s)-10.5,0,92,'Submerged downstream aqueduct remnant');
 for(let s=1840;s<2600;s+=83)for(const side of [-1,1])
  prop('coastv2ledge',s,side*20,12,height(s)-11,side*92,90,'Late gorge fractured root');
 for(const s of checkpoints)for(const side of [-1,1]){
  prop('coastpillar',s,side*12.5,2.25,height(s)-.5,side*12,92,'Checkpoint carved stone sentinels',true);
  prop('coastpillar',s,side*12.5,3.5,height(s)-11.25,side*12,92,'Checkpoint sentinel connected foundation');
  prop('coastbeachrock',s,side*12.5,5.5,height(s)-12.4,side*30,90,'Checkpoint sentinel creek footing');
 }
 // Broken masonry hangs below the exposed aqueduct without supplying a floor.
 for(const s of [183,213,244,271]){
  const lift=.76+2*Math.sin(Math.PI*(s-159)/135);
  prop('coastpillar',s,7,4.5,height(s)+lift-15.566,0,92,'Grounded aqueduct pier',true);
  prop('coastshelf',s,7,5,height(s)+lift-1.6,90,92,'Aqueduct bearing collar');
 }
 for(let a=-62;a<end+36;a+=96)for(const side of [-1,1])C.push(...buildCreekBank(sampler,{a,b:Math.min(end+36,a+96),width:32,offset:side*35,top:s=>height(s)-9,solid:false,turf:false,spacing:14,name:'Deep joined gorge shoulders',group:90}));
 for(const bank of banks){
  if(bank.b-bank.a<18||bank.group>=110&&bank.group<=115)continue;
  for(let s=bank.a+5;s<bank.b-4;s+=5.5)for(const side of [-1,1]){
   const w=typeof bank.width==='function'?bank.width(s):bank.width,u=typeof bank.offset==='function'?bank.offset(s):bank.offset;
   const h=bank.top===undefined?height(s):typeof bank.top==='function'?bank.top(s):bank.top;
   prop(noise(s+side)>.5?'coastv2grass':'coastv2grassb',s,u+side*(w/2-.65),1.0+noise(s)*.4,h-.035,noise(s)*360,91,'Fine grass rooted at the worn rim',false,'#dbe2b5');
  }
 }
 // One visible, flowing water surface under every open gap. It has no hidden
 // support. Bounded adjacent death volumes meet that surface along the grade.
 for(let a=-62;a<end+36;a+=28){
  const b=Math.min(end+36,a+28),p=point(a,0),vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
  for(let i=0;i<=7;i++)for(const side of [-1,1]){
   const s=a+(b-a)*i/7,q=point(s,height(s)-7,side*39);vertices.push(q[0]-p[0],q[1],q[2]-p[2]);uvs.push(side<0?0:12,s/8);
  }
  for(let i=0;i<7;i++){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
  C.push({t:'mesh',p:[p[0],-3.5,p[2]],vertices,indices,uvs,tex:'coast-bedrock',color:'#526c61',doubleSided:true,solid:false,castShadow:false,edgeGrinding:false,grp:93,nm:'Submerged riverbed'});
  C.push({t:'mesh',p,vertices,indices,uvs,tex:'custard-water',materialStyle:'jungle-stream',color:'#689c94',opacity:.86,
   solid:false,lethal:true,doubleSided:true,castShadow:false,edgeGrinding:false,grp:93,nm:'Rumblewater flowing creek'});
  C.push({t:'pit',p:point((a+b)/2,Math.min(height(a),height(b))-7.15),s:[78,1,b-a+2],yaw:yaw((a+b)/2),invisible:true,grp:93,nm:'Creek water contact'});
 }
 return C;
}
