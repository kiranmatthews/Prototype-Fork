import {Color} from 'three';
import type {CustomComponent,DecorKind} from '../level';
import {COASTAL_TOWN_ASSETS} from '../coastalTownAssets';
import {createLoopMeshData,sampleLoop} from '../loopRide';
import {warehouseBeam,warehouseRibbon,type WarehousePoint as P} from './warehouse-geometry';
import {motuGroundedRibbon} from './motu-solid-structures';

export const MOTU_PALETTE={cream:'#f2e4c9',teal:'#25b8b2',navy:'#174d60',coral:'#ed7857',yellow:'#efbc52',mint:'#bce4cf'};
export const MOTU_LOOP={entry:[-59,0,-35] as P,radius:4.2,width:6.5,offset:9};
export const MOTU_SIGNS:Record<string,{title:string;subtitle:string;color:string}>={
  welcome:{title:'MOTU BEACH',subtitle:'INVITATIONAL  /  SKATE • SURF • SUN',color:MOTU_PALETTE.navy},
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
Object.assign(drop,{tex:'plank',color:'#e8bd83',gravityTrack:true});add(motuGroundedRibbon(drop));
const walk=warehouseRibbon('Motu / elevated palm boardwalk',[[-59,6.3,27],[-49,6.3,27],[-43,4.7,19],[-42,1.3,4],[-42,0,-7]],5.4,.4);
Object.assign(walk,{tex:'plank',color:'#e8bd83',gravityTrack:true});add(motuGroundedRibbon(walk));
// Continuous outer skin closes the loop's thickness; its central opening and
// native inner riding surface remain clear. Coloured rims meet both skins.
for(let i=0;i<192;i++){
  const p=(angle:number,side:number,depth:number):P=>{
    const q=sampleLoop(MOTU_LOOP,angle,side*MOTU_LOOP.width/2);
    return q.point.map((v,k)=>v+MOTU_LOOP.entry[k]-q.normal[k]*depth) as P;
  };
  const a=i/192*Math.PI*2,b=(i+1)/192*Math.PI*2;
  quad([p(a,-1,.38),p(a,1,.38),p(b,1,.38),p(b,-1,.38)],MOTU_PALETTE.teal,'pavement');
  if(i===0||i===191){const angle=i===0?a:b;quad([p(angle,-1,0),p(angle,1,0),p(angle,1,.38),p(angle,-1,.38)],MOTU_PALETTE.cream);}
}
for(let i=0;i<192;i++)for(const side of [-1,1]){
  const a=sampleLoop(MOTU_LOOP,i/192*Math.PI*2,side*MOTU_LOOP.width/2),b=sampleLoop(MOTU_LOOP,(i+1)/192*Math.PI*2,side*MOTU_LOOP.width/2);
  const p=(q:typeof a,d:number):P=>q.point.map((v,k)=>v+MOTU_LOOP.entry[k]-q.normal[k]*d) as P;
  quad([p(a,0),p(b,0),p(b,.38),p(a,.38)],i%24<12?MOTU_PALETTE.cream:MOTU_PALETTE.coral);
}
// Curved steel ribs carry the upper arc to four exterior buttresses. Nothing
// crosses the central opening: every support lies outside the riding radius.
for(const side of [-1,1]){
  const section=(angle:number):P[]=>{
    const q=sampleLoop(MOTU_LOOP,angle,side*(MOTU_LOOP.width/2+.015));
    return [[0,.36],[.24,.36],[.24,.66],[0,.66]].map(([x,depth])=>
      q.point.map((v,k)=>v+MOTU_LOOP.entry[k]-q.normal[k]*depth+(k===0?side*x:0)) as P);
  };
  for(let i=0;i<192;i++){
    const a=section(i/192*Math.PI*2),b=section((i+1)/192*Math.PI*2);
    for(let j=0;j<4;j++)quad([a[j],b[j],b[(j+1)%4],a[(j+1)%4]],MOTU_PALETTE.navy);
    if(i===0)quad(a,MOTU_PALETTE.navy);
    if(i===191)quad(b,MOTU_PALETTE.navy);
  }
  for(const angle of [Math.PI/2,Math.PI*1.5]){
    const q=sampleLoop(MOTU_LOOP,angle,side*(MOTU_LOOP.width/2+.135)),outward=-Math.sin(angle);
    const x=q.point[0]+MOTU_LOOP.entry[0],z=q.point[2]+MOTU_LOOP.entry[2]+outward*.54,y=MOTU_LOOP.radius;
    const heel=z+outward*1.8;
    // Closed native solids give the visible footings and uprights contact.
    for(const footZ of [z,heel]){
      add({t:'platform',nm:'Motu / loop buttress footing',p:[x,.08,footZ],s:[.86,.16,.9],color:MOTU_PALETTE.cream,tex:'pavement'});
      box([x,.185,footZ],[.58,.05,.62],MOTU_PALETTE.navy);
      for(const dx of [-.21,.21])for(const dz of [-.22,.22])box([x+dx,.23,footZ+dz],[.065,.04,.065],MOTU_PALETTE.cream);
    }
    add({t:'platform',nm:'Motu / loop exterior upright',p:[x,(y+.2)/2,z],s:[.26,y-.2,.3],color:MOTU_PALETTE.navy,tex:'solid'});
    const brace=warehouseBeam('Motu / loop exterior brace',[x,.22,heel],[x,y-.16,z],.18,.22,MOTU_PALETTE.navy);
    // Structural diagonals are blocking steel, not an additional grind line.
    Object.assign(brace,{solid:true,solidSides:true,vert:false});add(brace);
    box([x,y-.28,z],[.34,.4,.38],MOTU_PALETTE.navy);
  }
}

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
// Low fascia accents remain as construction details, without obstacle labels.
for(const x of [30.5,55.5]){
  for(let k=0;k<5;k++)box([x,1+k*.7,-103.955],[1.15,.42,.09],k%2?MOTU_PALETTE.coral:MOTU_PALETTE.cream);
}
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
// Dense perimeter groves frame every viewing direction. The deck palms sit
// in the clear gaps between spectator bays; beach roots remain on the sand.
for(const [i,[x,y,z,k]]of [
  [-76,4.4,37,1.3],[-77,4.4,-57,1.25],[-77,4.4,-115,1.3],[-68,4.4,-176,1.35],
  [76,4.4,20,1.3],[77,4.4,-72,1.25],[73,4.4,-158,1.3],[62,4.4,-177,1.35],
  [-71,-3,82,1.9],[-56,-3,88,2.1],[-42,-3,89,1.85],[-25,-3,92,2.2],[-8,-3,91,1.95],
  [9,-3,89,2.15],[26,-3,88,1.9],[44,-3,84,2.1],[62,-3,80,1.95],[82,-3,72,2.05],
  [108,-3,42,1.75],[112,-3,20,1.9],[112,-3,-5,1.8],[115,-3,-29,2],
  [114,-3,-53,1.8],[111,-3,-78,1.95],[108,-3,-103,1.85],[102,-3,-143,2.05],
  [-104,-3,23,1.75],[-107,-3,-5,1.9],[-108,-3,-38,1.8],[-106,-3,-71,2],
  [-107,-3,-101,1.8],[-105,-3,-139,1.95],[-91,-3,-183,1.85],[86,-3,-181,2.05],
].entries())palm([x,y,z],k,27+i*43);

// Additional continuous grind lines use the native rail path contract.
// Flat approaches and low rail heights leave the existing transition returns open.
add({t:'rail',nm:'Motu / west promenade rail',p:[-64,.72,-83],len:22,color:MOTU_PALETTE.navy});
add({t:'rail',nm:'Motu / east return rail',p:[61,.72,-74],len:20,color:MOTU_PALETTE.coral});
add({t:'rail',nm:'Motu / south festival flatbar',p:[12,.68,31],len:14,yaw:90,color:MOTU_PALETTE.teal});
add({t:'rail',nm:'Motu / palm crescent rail',p:[-46,.78,-103],pts:[[-10,6],[-7,1,2],[0,-2,2],[7,1,2],[10,6]],color:MOTU_PALETTE.teal});
add({t:'rail',nm:'Motu / east surf kink rail',p:[39,.78,-82],pts:[[-4,8],[0,0,2],[4,-8,2],[4,-13]],color:MOTU_PALETTE.coral});

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
