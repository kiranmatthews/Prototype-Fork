import {Color} from 'three';
import type {CustomComponent,DecorKind} from '../level';
import {COASTAL_TOWN_ASSETS} from '../coastalTownAssets';
import {createLoopMeshData,sampleLoop} from '../loopRide';
import {warehouseBeam,warehouseRibbon,type WarehousePoint as P} from './warehouse-geometry';

export const MOTU_PALETTE={cream:'#f2e4c9',teal:'#25b8b2',navy:'#174d60',coral:'#ed7857',yellow:'#efbc52',mint:'#bce4cf'};
export const MOTU_LOOP={entry:[-59,0,-35] as P,radius:4.2,width:6.5,offset:9};
export const MOTU_SIGNS:Record<string,{title:string;subtitle:string;color:string}>={
  welcome:{title:'MOTU BEACH',subtitle:'INVITATIONAL  /  SKATE • SURF • SUN',color:MOTU_PALETTE.navy},
  lagoon:{title:'LAGOON BOWL',subtitle:'DEEP END  /  FIND YOUR FLOW',color:MOTU_PALETTE.teal},
  vert:{title:'TIDELINE VERT',subtitle:'42 METRES  /  GO BIG',color:MOTU_PALETTE.coral},
  loop:{title:'THE REEF LOOP',subtitle:'DROP IN  /  HOLD YOUR CHARGE',color:MOTU_PALETTE.navy},
  street:{title:'PALM STREET',subtitle:'LEDGES  /  RAILS  /  GOOD TIMES',color:MOTU_PALETTE.coral},
  surf:{title:'MOTU SURF CLUB',subtitle:'BOARDS • WAX • COLD DRINKS',color:MOTU_PALETTE.teal},
  judges:{title:'THE BREAK',subtitle:'JUDGES  /  CREW  /  BEACH RADIO',color:MOTU_PALETTE.navy},
  floor:{title:'MOTU',subtitle:'BEACH INVITATIONAL',color:MOTU_PALETTE.teal},
};
const out:CustomComponent[]=[];
const add=(c:CustomComponent)=>{out.push(c);return c;};
const batches=new Map<string,{vertices:number[];indices:number[];color:string;tex:string}>();
function quad(points:P[],color:string,tex='solid'){
  const key=color+tex;let b=batches.get(key);if(!b){b={vertices:[],indices:[],color,tex};batches.set(key,b);}
  const n=b.vertices.length/3;b.vertices.push(...points.flat());
  for(const [a,j,k]of [[0,1,2],[0,2,3]]){
    const u=points[j].map((v,i)=>v-points[a][i]),v=points[k].map((q,i)=>q-points[a][i]);
    if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-8)b.indices.push(n+a,n+j,n+k);
  }
}
function box(p:P,s:P,color:string,tex='solid'){
  const v:P[]=[];for(const y of [-1,1])for(const [x,z]of [[-1,-1],[1,-1],[1,1],[-1,1]])v.push([p[0]+x*s[0]/2,p[1]+y*s[1]/2,p[2]+z*s[2]/2]);
  for(const f of [[4,7,6,5],[0,1,2,3],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])quad(f.map(i=>v[i]),color,tex);
}
function beam(a:P,b:P,w:number,d:number,color:string){
  const c=warehouseBeam('Motu / festival structure',a,b,w,d,color),key=color+'solid';
  if(!batches.has(key))batches.set(key,{vertices:[],indices:[],color,tex:'solid'});
  const batch=batches.get(key)!,n=batch.vertices.length/3;batch.vertices.push(...c.vertices!);batch.indices.push(...c.indices!.map(i=>i+n));
}
function stripe(a:P,b:P,width:number,color:string){
  const l=Math.hypot(b[0]-a[0],b[2]-a[2]),x=-(b[2]-a[2])/l*width/2,z=(b[0]-a[0])/l*width/2;
  quad([[a[0]+x,a[1],a[2]+z],[b[0]+x,b[1],b[2]+z],[b[0]-x,b[1],b[2]-z],[a[0]-x,a[1],a[2]-z]],color);
}
function ring(x:number,z:number,rx:number,rz:number,width:number,color:string,start=0,end=Math.PI*2,y=.024){
  const n=Math.max(8,Math.ceil((end-start)*24));for(let i=0;i<n;i++){
    const a=start+(end-start)*i/n,b=start+(end-start)*(i+1)/n;
    quad([[x+Math.cos(a)*(rx-width/2),y,z+Math.sin(a)*(rz-width/2)],[x+Math.cos(b)*(rx-width/2),y,z+Math.sin(b)*(rz-width/2)],
      [x+Math.cos(b)*(rx+width/2),y,z+Math.sin(b)*(rz+width/2)],[x+Math.cos(a)*(rx+width/2),y,z+Math.sin(a)*(rz+width/2)]],color);
  }
}
function asset(dkind:DecorKind,p:P,scale=1,yaw=0){
  const spec=COASTAL_TOWN_ASSETS[dkind as keyof typeof COASTAL_TOWN_ASSETS];
  add({t:'decor',dkind,nm:`Motu / festival ${dkind}`,p,s:spec?spec.size.map(v=>v*scale) as P:[3.2*scale,1.8*scale,3.2*scale],yaw,solid:false,scenerySolid:false});
}
function palm(p:P,scale:number,yaw:number){
  asset('baytrunk',p,scale,yaw);const a=yaw*Math.PI/180;
  asset('baycrown',[p[0]+Math.cos(a)*.65*scale,p[1]+7*scale,p[2]-Math.sin(a)*.65*scale],scale,yaw);
}
function sign(key:string,p:P,w:number,h:number,yaw=0,floor=false){
  const a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a),v:number[]=[];
  for(const [x,y]of [[-w/2,-h/2],[w/2,-h/2],[-w/2,h/2],[w/2,h/2]])v.push(...(floor?[p[0]+x,p[1],p[2]-y]:[p[0]+x*c,p[1]+y,p[2]-x*s]));
  add({t:'mesh',nm:`Motu / graphic sign / ${key}`,p:[0,0,0],vertices:v,indices:[0,1,2,1,3,2],uvs:[0,0,1,0,0,1,1,1],tex:'solid',color:'#ffffff',solid:false,doubleSided:true,castShadow:false});
}

// Gravity-earned speed feeds a complete, rideable oververt loop. Its native
// centreline is also the render centreline, including the separated exit.
add({t:'mesh',nm:'Motu / reef loop riding surface',p:MOTU_LOOP.entry,...createLoopMeshData(MOTU_LOOP.radius,MOTU_LOOP.width,MOTU_LOOP.offset,192),
  loopRadius:MOTU_LOOP.radius,loopOffset:MOTU_LOOP.offset,loopRequired:false,w:MOTU_LOOP.width,
  tex:'pavement',color:MOTU_PALETTE.teal,doubleSided:true});
const drop=warehouseRibbon('Motu / reef loop gravity roll-in',[[-59,6.3,27],[-59,6.3,21],[-59,4.6,12],[-59,1,-3],[-59,0,-13],[-59,0,-23]],7,.45);
Object.assign(drop,{tex:'plank',color:'#e8bd83',gravityTrack:true});add(drop);
const walk=warehouseRibbon('Motu / elevated palm boardwalk',[[-59,6.3,27],[-49,6.3,27],[-43,4.7,19],[-42,1.3,4],[-42,0,-7]],5.4,.4);
Object.assign(walk,{tex:'plank',color:'#e8bd83',gravityTrack:true});add(walk);
// Visible timber piles and diagonal braces sit strictly beneath the decks.
for(const [x,z,y]of [[-59,24,6.3],[-59,12,4.6],[-49,27,6.3],[-43,19,4.7],[-42,8,2.4]])for(const side of [-1,1]){
  const xx=x+side*2.4;beam([xx,-.15,z],[xx,y-.3,z],.3,.3,'#875d3e');
  beam([xx,0,z-2.5],[xx,y-.35,z+2.5],.18,.2,'#b88a58');
}
// Thick coloured shell, polished rims and six complete structural ribs.
for(let i=0;i<192;i++)for(const side of [-1,1]){
  const a=sampleLoop(MOTU_LOOP,i/192*Math.PI*2,side*MOTU_LOOP.width/2),b=sampleLoop(MOTU_LOOP,(i+1)/192*Math.PI*2,side*MOTU_LOOP.width/2);
  const p=(q:typeof a,d:number):P=>q.point.map((v,k)=>v+MOTU_LOOP.entry[k]-q.normal[k]*d) as P;
  quad([p(a,.02),p(b,.02),p(b,.38),p(a,.38)],i%24<12?MOTU_PALETTE.cream:MOTU_PALETTE.coral);
  if(i%32===0)beam(p(a,.4),[p(a,.4)[0],0,p(a,.4)[2]],.13,.13,MOTU_PALETTE.navy);
}
sign('loop',[-52,10.3,-35],15,2.2);
for(const x of [-61,-44])beam([x,0,-35],[x,11.7,-35],.22,.22,MOTU_PALETTE.navy);

// A tall open horseshoe supplies a distinct vertical transfer landmark.
add({t:'vertramp',nm:'Motu / coral wave wall',p:[0,0,-149],pts:Array.from({length:73},(_,i)=>{
  const a=Math.PI-.4+i/72*(Math.PI+.8);return [Math.cos(a)*6.6,Math.sin(a)*7.3] as [number,number];}),
  vkind:'quarter',w:.2,rise:5.2,arc:83,arcSteps:48,deck:2,outerBank:5.2,tex:'pavement',color:MOTU_PALETTE.coral});

// Bold floor graphics are a non-solid paint skin: no new collision seam.
ring(0,14,12,12,.55,MOTU_PALETTE.teal);ring(0,14,13.2,13.2,.15,MOTU_PALETTE.coral);
ring(-42,-134,20,25,.6,MOTU_PALETTE.teal);ring(-42,-134,21.4,26.4,.18,MOTU_PALETTE.coral);
ring(32,24,9.5,9.5,.55,MOTU_PALETTE.coral);ring(32,24,10.5,10.5,.18,MOTU_PALETTE.teal);
for(const x of [22.6,63.3])stripe([x,.024,-151],[x,.024,-98],.35,MOTU_PALETTE.coral);
for(let i=0;i<14;i++)for(const side of [-1,1]){
  const z=36-i*14.1;stripe([side*65,.025,z],[side*65,.025,z-7],.26,MOTU_PALETTE.cream);
}
for(let i=0;i<12;i++){
  const z=7-i*10;stripe([-2,.025,z],[0,.025,z-2],.25,MOTU_PALETTE.coral);stripe([0,.025,z-2],[2,.025,z],.25,MOTU_PALETTE.coral);
}
sign('floor',[0,.028,13],17,7,0,true);
// Palm/hibiscus gardens interrupt the expanse without occupying a ride line.
for(const [index,[x,z,r]]of [[-50,-66,3.8],[-55,-86,3.4],[55,-76,3.3],[9,-122,3.4],[-5,34,3.2]].entries()){
  const vertices=[x,.72,z],indices:number[]=[],n=64;
  for(const y of [.72,0])for(let i=0;i<n;i++){const a=i/n*Math.PI*2;vertices.push(x+Math.cos(a)*r,y,z+Math.sin(a)*r);}
  for(let i=0;i<n;i++)indices.push(0,1+(i+1)%n,1+i);
  const grindTopTriangles=indices.length/3;
  for(let i=0;i<n;i++){const a=1+i,b=1+(i+1)%n;indices.push(a,b,b+n,a,b+n,a+n);}
  add({t:'mesh',nm:'Motu / planted circular skate ledge',p:[0,0,0],vertices,indices,grindTopTriangles,solidSides:true,tex:'pavement',color:MOTU_PALETTE.cream});
  ring(x,z,r-.4,r-.4,.42,MOTU_PALETTE.teal,0,Math.PI*2,.74);
  palm([x,.72,z],.95+index*.04,index*61);
  for(let k=0;k<5;k++){const a=k/5*Math.PI*2;asset('sunnyhibiscus',[x+Math.cos(a)*1.7,.72,z+Math.sin(a)*1.7],.75,k*71);}
}

// A true festival village: complete existing Meshy storefront pieces, shaded
// counters, stools and boards. Solid bodies match their visible footprints.
for(const [i,[x,z]]of [[40,62],[53,-91],[-13,-174]].entries()){
  const y=i===1?0:4.4,yaw=i===0?180:0,d=i===0?-1:1;
  const q=(dx:number,dy:number,dz:number):P=>[x+dx*d,y+dy,z+dz*d];
  if(i===0){
    add({t:'platform',nm:'Motu / seaside shop boardwalk',p:[x,y-.3,z],s:[12,.6,10],tex:'plank',color:'#e8bd83'});
    for(const dx of [-4,4])for(const dz of [-3,3])beam([x+dx,-3,z+dz],[x+dx,y-.3,z+dz],.35,.35,'#875d3e');
  }
  add({t:'decor',dkind:'baybody',nm:'Motu / surf club stucco kiosk',p:q(0,0,0),s:[7,3.5,5],yaw,solid:false,scenerySolid:false});
  add({t:'wall',nm:'Motu / kiosk body contact',p:q(0,0,0),s:[6.8,3.5,4.8],yaw,invisible:true});
  add({t:'decor',dkind:'bayroof',nm:'Motu / kiosk tiled roof',p:q(0,3.35,0),s:[8.5,2.2,6.7],yaw,solid:false,scenerySolid:false});
  add({t:'decor',dkind:'bayawning',nm:'Motu / striped shop canopy',p:q(0,2.7,2.5),s:[6.4,1.7,3.1],yaw,solid:false,scenerySolid:false});
  box(q(0,1.1,3.2),[6.1,.2,.85],MOTU_PALETTE.cream);box(q(0,.55,3.2),[5.8,1,.5],i%2?MOTU_PALETTE.coral:MOTU_PALETTE.teal);
  for(const side of [-1,1]){beam(q(side*3.1,0,4),q(side*3.1,3.7,4),.15,.15,MOTU_PALETTE.navy);asset('baypot',q(side*4.2,0,3),1,side*43);}
  sign(i===2?'judges':'surf',q(0,4.1,3.38),6,1.4,yaw);
}
// The front of the vert deck now has cladding, a fascia graphic and sheet joints.
sign('vert',[43,9.2,-103.93],28,2.3);
for(const x of [25.8,60.2]){
  beam([x,0,-102.8],[x,10.5,-102.8],.2,.2,MOTU_PALETTE.navy);
  for(let k=0;k<5;k++)box([x,1+k*.7,-103.8],[1.15,.42,.18],k%2?MOTU_PALETTE.coral:MOTU_PALETTE.cream);
}
sign('lagoon',[-42,7.1,-165],19,2.8);for(const x of [-50,-34])beam([x,0,-165],[x,8.6,-165],.22,.22,MOTU_PALETTE.navy);
sign('street',[-24,4.1,35.1],16,2.4);
for(const x of [-32.5,-15.5])beam([x,1.1,35.2],[x,5.5,35.2],.17,.17,MOTU_PALETTE.navy);
// Low-backed street benches are real grindable objects, clear of approaches.
for(const [x,z,yaw]of [[-35,3,0],[48,-56,0],[8,-105,90]]){
  add({t:'platform',nm:'Motu / timber skate bench',p:[x,.6,z],s:[1.8,.22,7],yaw,tex:'plank',color:'#e8bd83'});
  const a=yaw*Math.PI/180;
  for(const side of [-1,1])box([x+Math.sin(a)*side*2.4,.25,z+Math.cos(a)*side*2.4],yaw===90?[.35,.5,1.5]:[1.5,.5,.35],MOTU_PALETTE.navy);
}
// A full-width truss and hanging flags make the northern session a focal point.
sign('welcome',[0,14.8,-178],37,5.4);
for(const x of [-20,20])for(const dz of [-.8,.8])beam([x,0,-178+dz],[x,18,-178+dz],.25,.25,MOTU_PALETTE.navy);
for(const y of [11.8,17.8])beam([-20,y,-178],[20,y,-178],.25,.25,MOTU_PALETTE.navy);
for(let i=0;i<10;i++)beam([-20+i*4,11.8,-178],[-16+i*4,17.8,-178],.15,.15,MOTU_PALETTE.navy);

// Native cloth flags and seaside parasols retain their full geometry at range.
const cloth:number[]=[],clothIx:number[]=[],clothUvs:number[]=[],clothColors:number[]=[];
for(const [i,[x,z]]of [[-73,40],[72,38],[-74,-15],[75,-20],[-74,-100],[73,-95],[-54,-174],[53,-174]].entries()){
  beam([x,3.9,z],[x,15,z],.15,.15,MOTU_PALETTE.navy);
  const n=cloth.length/3,color=new Color(i%2?MOTU_PALETTE.coral:MOTU_PALETTE.teal);
  for(let j=0;j<=16;j++)for(const s of [0,1]){
    const t=j/16;cloth.push(x+s*(2.1-.6*t)*Math.sin(Math.PI*(.12+.78*t)),8+t*6.5,z+.18*s*Math.sin(t*Math.PI*2));
    clothUvs.push(s,t);clothColors.push(color.r,color.g,color.b);
    if(j&&s===0){const k=n+(j-1)*2;clothIx.push(k,k+1,k+3,k,k+3,k+2);}
  }
}
add({t:'mesh',nm:'Motu / coastal feather flags',p:[0,0,0],vertices:cloth,indices:clothIx,uvs:clothUvs,colors:clothColors,solid:false,doubleSided:true,tex:'rally-cloth'});
for(const [i,[x,z]]of [[97,27],[98,-3],[99,-33],[101,-63],[-91,43]].entries()){
  const y=-3.5;beam([x,y,z],[x,y+7,z],.18,.18,'#ac8156');
  for(let k=0;k<24;k++){
    const a=k/24*Math.PI*2,b=(k+1)/24*Math.PI*2,r=5;
    quad([[x,y+7.5,z],[x+Math.cos(a)*r,y+5.8,z+Math.sin(a)*r],[x+Math.cos(b)*r,y+5.8,z+Math.sin(b)*r],[x,y+7.5,z]],k%4<2?MOTU_PALETTE.cream:(i%2?MOTU_PALETTE.coral:MOTU_PALETTE.teal));
  }
  for(const side of [-1,1])box([x+side*2,y+.55,z],[1.3,.15,3.5],MOTU_PALETTE.cream);
}
// Additional complete plants soften the venue's edge at human scale.
for(let i=0;i<16;i++){
  const x=i%2?89:-94,z=46-Math.floor(i/2)*29;
  palm([x,-3,z],1.15+(i%3)*.12,i*41);asset('bayvine',[x,-1,z+3],1.25,i*29);
}
// Layered headlands break the old straight cliff-wall silhouette. All islands
// reuse complete Meshy meshes, with rooted palms at their exposed shoulders.
for(const [i,[x,z,k]]of [[-137,-18,3.2],[-143,-70,4.1],[-134,-128,3.5],[-42,-230,2.8],[17,-234,3.3],[164,-148,2.2],[180,-166,3.1],[191,-140,1.9]].entries()){
  add({t:'decor',dkind:'sunnycliff',nm:'Motu / layered island headland',p:[x,-5,z],s:[12*k,13.14197*k,5.63459*k],yaw:20+i*43,solid:false,scenerySolid:false});
  asset('bayrock',[x+5,-6,z+7],k*.8,i*37);
  palm([x-3,Math.max(5,k*6),z],1.25+i%3*.17,i*47);
}
// Quad boundaries keep every editable source chunk inside the mesh contract.
for(const [key,b]of batches)for(let start=0;start<b.vertices.length/3;start+=3000){
  const end=Math.min(start+3000,b.vertices.length/3);
  add({t:'mesh',nm:`Motu / festival detail batch ${key} ${start/3000}`,p:[0,0,0],
    vertices:b.vertices.slice(start*3,end*3),indices:b.indices.filter(i=>i>=start&&i<end).map(i=>i-start),
    color:b.color,tex:b.tex,solid:false,doubleSided:true,castShadow:false,flatShading:true});
}
export const MOTU_FESTIVAL=out;
