import type {CustomComponent,CustomLevelData} from '../level';
import {roundCorners} from '../pathNodes';
import {spaghettiRail,rounded,type P,type SpaghettiIsland} from './spaghetti-infinite-course';

// Version 1 (c82ddfd3): six recovery tiers, the original weaving graph and
// full-height cell. Kept separate from the platformer's authored itinerary.
export const RACE_LOOP={minY:-144,height:288};
export const RACE_RECOVERY_HEIGHTS=[120,72,24,-24,-72,-120];
export interface RaceDeck extends SpaghettiIsland {
 baseDepth:number;stretch:number;grade:number;color:string;grp:number;spring?:CustomComponent;
}
export const raceDeckY=(s:RaceDeck,z:number)=>s.p[1]+s.grade*(s.spring?Math.sign(z-s.p[2])*Math.max(0,Math.abs(z-s.p[2])-10):z-s.p[2]);

export function spaghettiRaceWorld(finishZ:number){
 const components:CustomComponent[]=[],islands:RaceDeck[]=[],recovery:RaceDeck[][]=[];
 const finishY=-132,near=67,far=finishZ-72,gateZ=finishZ-60;
 const add=(c:CustomComponent)=>{components.push(c);return c;};
 const slab=(name:string,p:P,width:number,baseDepth:number,color='#8caeb6',grp=2,stretch=3,grade=.045):RaceDeck=>{
  const s={name,p:[...p] as P,w:width,d:baseDepth*stretch,baseDepth,stretch,grade,color,grp};islands.push(s);return s;
 };
 const rail=(name:string,nodes:P[],radius=4,grp=5)=>add(spaghettiRail({name,nodes,radius,stage:grp-10,choice:0,lanes:[0]}));
 const box=(p:P,kind:CustomComponent['kind']='mystery',name='Race item choice')=>add({t:'crate',p,kind,nm:name,grp:3});
 const rows=Math.ceil((40-(finishZ+32))/24),depth=(40-(finishZ+32))/rows,order=[0,3,1,4,2,5];
 for(let row=0;row<rows;row++){
  recovery[row]=[];
  for(let tier=0;tier<6;tier++){
   const col=(order[row%6]+tier)%6,stretch=[2,2.5,3,3.5,4][(row*3+tier*2)%5],grade=[.03,.045,.06,.075][(row+tier*3)%4];
   const z=40-(row+.5)*depth,boundedStretch=Math.min(stretch,2*(near-z)/(depth+.08));
   const s=slab(`Recovery ${row}.${tier}`,[-40+16*col,RACE_RECOVERY_HEIGHTS[tier],z],16.08,depth+.08,'#476271',5,boundedStretch,grade);
   s.row=row;s.tier=tier;recovery[row][tier]=s;
  }
 }
 const recoveryLanding=(z:number,tier:number)=>recovery[Math.max(0,Math.min(rows-1,Math.floor((40-z)/depth)))][tier];
 const recoveryPoint=(z:number,tier:number):P=>[...recoveryLanding(z,tier).p];
 const recoveryBelow=(p:P,advance=40):P=>{
  const candidates=RACE_RECOVERY_HEIGHTS.map((_,tier)=>recoveryLanding(p[2]-advance,tier)).filter(s=>s.p[1]<p[1]-3).sort((a,b)=>b.p[1]-a.p[1]);
  const s=candidates[0]??recoveryLanding(p[2]-advance,5);return [s.p[0],s.p[1]+.9,s.p[2]];
 };
 // Widening the catch decks must not put their undersides through a primary
 // run-in. Move the overlapping shelf to the nearest clear side of the run.
 const clearPrimaryDecks=()=>{
  for(const row of recovery)for(const s of row)for(const a of islands.filter(a=>a.tier===undefined)){
   if(Math.abs(s.p[0]-a.p[0])>=(s.w+a.w)/2+.3)continue;
   const lo=Math.max(s.p[2]-s.d/2,a.p[2]-a.d/2),hi=Math.min(s.p[2]+s.d/2,a.p[2]+a.d/2);if(lo>=hi)continue;
   const deltas=[lo,hi].map(z=>raceDeckY(s,z)-raceDeckY(a,z));
   const loY=Math.min(...deltas),hiY=Math.max(...deltas);
   if(loY<5.5&&hiY>-6)s.p[1]+=loY+hiY>=0?6-loY:-6-hiY;
  }
 };
 const connectRecovery=(entries:P[])=>{
  for(let tier=0;tier<6;tier++){
   for(let first=0;first<rows-1;first+=8){
    const last=Math.min(rows-1,first+8),nodes:P[]=[];
    for(let row=first;row<=last;row++){
     const s=recovery[row][tier],x=s.p[0]+(s.spring?(s.p[0]>0?-7.6:7.6):0),point=(z:number):P=>[x,raceDeckY(s,z)+.9,z];
     nodes.push(point(s.p[2]+(row===first?0:depth/2-3)));
     nodes.push(point(s.p[2]-(row===last?0:depth/2+1)));
    }
    rail(`Recovery weave / tier ${tier+1} / span ${first/8+1}`,nodes,3);
   }
   const end=recovery[rows-1][tier].p,x=end[0]*.4;
   // Stay above the extended final shelves until their forward edges, then
   // dive into the long shared finish deck with room to roll through the gate.
   rail(`Recovery collector / tier ${tier+1}`,[[end[0],end[1]+.9,end[2]],[end[0],end[1]+.9,finishZ-10],[x,finishY+.9,finishZ-40],[x,finishY+.9,finishZ-56]],2);
   const entry=entries[tier],target=recoveryPoint(entry[2]-108,tier);
   rail(`Tier exchange ${tier+1}`,[[entry[0],entry[1]+3.5,entry[2]-4],[entry[0],entry[1]+3.5,entry[2]-16],[target[0],target[1]+.9,target[2]]],5);
  }
 };
 const finish=()=>{
  const s=slab('Finish collector',[0,finishY,finishZ-2],96,72,'#96bbc0',2,2,.02);
  add({t:'gate',p:[0,raceDeckY(s,gateZ),gateZ],grp:2,nm:'Spaghetti / shared finish'});
 };
 const buildDecks=()=>{
  const batches:RaceDeck[][]=[];
  for(let first=0;first<rows;first+=4)batches.push(recovery.slice(first,first+4).flat());
  for(const s of islands.filter(s=>s.tier===undefined))batches.push([s]);
  for(const batch of batches){
   const vertices:number[]=[],uvs:number[]=[],tops:number[]=[],sides:number[]=[],origin:P=[0,0,batch[0].p[2]];
   const face=(points:P[],top=false)=>{const i=vertices.length/3;for(const p of points){vertices.push(p[0],p[1],p[2]-origin[2]);uvs.push(p[0]/8,p[2]/8);} (top?tops:sides).push(i,i+1,i+2,i,i+2,i+3);};
   const part=(s:RaceDeck,a:number,b:number,f:number,n:number,recess=false)=>{
    const splits=[f,...(s.spring?[s.p[2]-10,s.p[2]+10].filter(z=>z>f&&z<n):[]),n];
    for(let i=1;i<splits.length;i++){
     const f=splits[i-1],n=splits[i],yf=recess?s.p[1]-2.4:raceDeckY(s,f),yn=recess?s.p[1]-2.4:raceDeckY(s,n),lf=yf-1.4,ln=yn-1.4;
     face([[a,yn,n],[b,yn,n],[b,yf,f],[a,yf,f]],true);
     face([[a,lf,f],[b,lf,f],[b,ln,n],[a,ln,n]]);
     face([[a,ln,n],[b,ln,n],[b,yn,n],[a,yn,n]]);
     face([[b,lf,f],[a,lf,f],[a,yf,f],[b,yf,f]]);
     face([[a,lf,f],[a,ln,n],[a,yn,n],[a,yf,f]]);
     face([[b,ln,n],[b,lf,f],[b,yf,f],[b,yn,n]]);
    }
   };
   for(const s of batch){
    const [x,,z]=s.p,a=x-s.w/2,b=x+s.w/2,f=z-s.d/2,n=z+s.d/2;
    if(s.spring){const sx=s.spring.s![0]/2,sz=s.spring.s![2]/2;
     part(s,a,x-sx,f,n);part(s,x+sx,b,f,n);part(s,x-sx,x+sx,f,z-sz);part(s,x-sx,x+sx,z+sz,n);part(s,x-sx,x+sx,z-sz,z+sz,true);
    }else part(s,a,b,f,n);
   }
   const s=batch[0],nm=s.tier===undefined?s.name:`Recovery islands / rows ${s.row}–${batch[batch.length-1].row}`;
   add({t:'mesh',nm,p:origin,vertices,indices:[...tops,...sides],uvs,grindTopTriangles:tops.length/3,solidSides:true,gravityTrack:true,
    tex:'spaghetti-basalt',color:s.color,emissive:s.tier===undefined?'#24343c':'#142632',grp:s.grp});
  }
 };
 // Preserve the chosen version's rail graph. Where a longer deck reaches a
 // rail, blend its height over that deck instead of letting it pierce the slab.
 const fitRails=()=>{
  const bins=new Map<number,RaceDeck[]>();
  for(const s of islands)for(let k=Math.floor((s.p[2]-s.d/2-1)/64);k<=Math.floor((s.p[2]+s.d/2+1)/64);k++){
   if(!bins.has(k))bins.set(k,[]);bins.get(k)!.push(s);
  }
  for(const c of components.filter(c=>c.t==='rail')){
   const nodes=c.pts!,curve=roundCorners(nodes,false),heights=nodes.map(p=>c.p[1]+(p[3]??0));
   // Fillet heights are a linear blend of their neighbouring control nodes.
   // Solve clearances at one-metre intervals, retaining the exact original
   // X/Z curves and compact editable nodes instead of baking a dense polyline.
   const bases=nodes.map((_,k)=>roundCorners(nodes.map((p,j)=>[p[0],p[1],p[2]??0,k===j?1:0]),false));
   const probes:{weights:[number,number][];floors:number[]}[]=[];
   for(let i=1;i<curve.length;i++){
    const a=curve[i-1],b=curve[i],steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)));
    for(let j=0;j<=steps;j++){
     const t=j/steps,x=c.p[0]+a.x+(b.x-a.x)*t,z=c.p[2]+a.z+(b.z-a.z)*t;
     const floors=(bins.get(Math.floor(z/64))??[]).filter(s=>Math.abs(x-s.p[0])<=s.w/2+.5&&Math.abs(z-s.p[2])<=s.d/2+.5).map(s=>raceDeckY(s,z));
     if(!floors.length)continue;
     const weights=bases.map((v,k):[number,number]=>[k,v[i-1].y+(v[i].y-v[i-1].y)*t]).filter(([,v])=>v>1e-6);
     probes.push({weights,floors});
    }
   }
   for(let pass=0;pass<12;pass++){
    let changed=false;
    for(const {weights,floors} of probes){
     const y=weights.reduce((v,[k,w])=>v+heights[k]*w,0),floor=Math.max(...floors.filter(f=>f>y-.5&&f<y+4.4));
     if(!Number.isFinite(floor))continue;
     const norm=weights.reduce((v,[,w])=>v+w*w,0);
     for(const [k,w] of weights)heights[k]+=(floor+.9-y)*w/norm;
     changed=true;
    }
    if(!changed)break;
   }
   c.pts=nodes.map((p,i)=>[p[0],p[1],p[2]??0,rounded(heights[i]-c.p[1])]);
  }
 };
 const data=(spawn:P):CustomLevelData=>{
  buildDecks();
  add({t:'zone',p:[0,0,(near+far)/2],s:[104,1,near-far],dir:'S',grp:1,nm:'Steady forward corridor'});
  for(const side of [-1,1])add({t:'coastwall',p:[side*49,-144,near],pts:[[0,0],[0,far-near]],w:2,rise:288,grp:90,nm:'Periodic corridor side'});
  for(const z of [near,far])add({t:'coastwall',p:[-50,-144,z],pts:[[0,0],[100,0]],w:2,rise:288,grp:90,nm:'Periodic corridor end'});
  return {v:1,name:'Spaghetti Rails',spawn:[spawn[0],spawn[1]+.08,spawn[2]],startWarpPad:false,killY:-500,verticalLoop:{...RACE_LOOP},sky:'day',keepPlayFog:true,
   hugeDropBail:false,perfectGrindBoost:true,allBalanceCrates:false,medalTimes:{gold:135,silver:165,bronze:210},components,
   groups:[{id:1,nm:'Forward camera',editorOnly:true},{id:2,nm:'Downhill race decks',editorOnly:true},{id:3,nm:'Rewards and springs',editorOnly:true},
    {id:5,nm:'Six-height recovery weave',editorOnly:true},{id:90,nm:'Periodic architecture',editorOnly:true}]};
 };
 return {components,islands,recovery,add,slab,rail,box,recoveryPoint,recoveryBelow,recoveryLanding,connectRecovery,clearPrimaryDecks,fitRails,finish,data,near,far,finishZ,finishY,gateZ};
}
