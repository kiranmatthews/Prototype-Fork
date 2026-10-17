import type {CustomComponent,DecorKind} from '../level';
import {warehouseBeam,type WarehousePoint} from './warehouse-geometry';
import {WAREHOUSE_BODY_KINDS} from '../warehouseContacts';

/** Art is source-owned level data. The compact room's riding lanes stay clear. */
export function warehouseDressing(course:readonly CustomComponent[]=[]):CustomComponent[] {
 const out:CustomComponent[]=[];
 const add=(c:CustomComponent)=>{c.grp=208;out.push(c);return c;};
 const prop=(kind:DecorKind,p:[number,number,number],scale=1,yaw=0,vr=0)=>add({t:'decor',dkind:kind,nm:'Warehouse / '+kind,p,w:scale,yaw,vr,solid:WAREHOUSE_BODY_KINDS.includes(kind),scenerySolid:WAREHOUSE_BODY_KINDS.includes(kind)});
 const beam=(name:string,a:[number,number,number],b:[number,number,number],w=.45,d=.5)=>add(warehouseBeam(name,a,b,w,d,/Crane bridge/.test(name)?'#dcc18a':'#c4cecc'));
 const edge=(name:string,a:WarehousePoint,b:WarehousePoint,color='#c8bfa9',w=.06,d=.12)=>add(warehouseBeam(name,a,b,w,d,color));
 const panel=(name:string,vertices:number[],indices:number[],color='#c3d5cd')=>add({t:'mesh',nm:name,p:[0,0,0],vertices,indices,color,tex:'solid',solid:false,doubleSided:true,castShadow:false,edgeGrinding:false});
 const mural=(p:WarehousePoint,w:number,h:number,yaw:number,vr:number)=>add({t:'decor',dkind:'warehousegraffiti',nm:'Warehouse / original localized skate mural',p,s:[w,h,.01],yaw,vr,solid:false,scenerySolid:false});
 // Construction follows the authored riding envelopes. These thin render
 // details cannot change a collider, turn a seam into a rail, or block a gap.
 for(const c of course){
  const name=c.nm??'';
  if(c.t==='mesh'&&c.grindTopTriangles&&c.vertices){
   const n=(c.vertices.length/3-1)/3;
   if(Number.isInteger(n)&&n===48){
    for(let i=0;i<n;i++){
     const point=(j:number):WarehousePoint=>[c.p[0]+c.vertices![(j+1)*3],c.p[1]+c.vertices![(j+1)*3+1]+.014,c.p[2]+c.vertices![(j+1)*3+2]];
     edge('Island cap edging / '+name,point(i),point((i+1)%n),'#c0b49e',.035,.10);
    }
   }
  }
  if(c.t==='ramp'){
   const yaw=(c.yaw??0)*Math.PI/180;
   const p=(x:number,y:number,z:number):WarehousePoint=>[c.p[0]+x*Math.cos(yaw)+z*Math.sin(yaw),c.p[1]+y,c.p[2]-x*Math.sin(yaw)+z*Math.cos(yaw)];
   for(const side of[-1,1])edge('Ramp polished coping / '+name,p(side*(c.w??8)/2,.018,(c.len??10)/2),p(side*(c.w??8)/2,(c.rise??3)+.018,-(c.len??10)/2),'#c3bcb0',.04,.12);
  }
  if(c.t==='platform'&&!/Continuous concrete floor|Warehouse roof/.test(name)){
   const [w,h,d]=c.s!,y=c.p[1]+h/2-.13;
   const corners:WarehousePoint[]=[[-w/2,y,-d/2],[w/2,y,-d/2],[w/2,y,d/2],[-w/2,y,d/2]].map(p=>[p[0]+c.p[0],p[1],p[2]+c.p[2]]);
   for(let i=0;i<4;i++)edge('Deck steel fascia / '+name,corners[i],corners[(i+1)%4],'#c0c7bd',.24,.12);
  }
  if(c.t==='vertramp'&&c.vkind==='half'){
   const r=c.rise??3.6,f=c.w??4,lip=c.lipRise??0,deck=c.deck??0,bank=c.outerBank??0,len=c.len??30;
   const half:[number,number][]=[];
   for(let i=0;i<=24;i++){const a=i/24*Math.PI/2;half.push([f+r*Math.sin(a),r*(1-Math.cos(a))]);}
   half.push([f+r,r+lip],[f+r+deck,r+lip],[f+r+deck+bank,0]);
   const profile=[...half.map(([x,y])=>[-x,y] as [number,number]).reverse(),...half];
   // Actual seams between plywood sheets, following the existing curved deck.
   for(let z=-len/2+4.8;z<len/2-.1;z+=4.8){
    const v:number[]=[],idx:number[]=[];
    profile.forEach(([x,y],i)=>{const before=profile[Math.max(0,i-1)],after=profile[Math.min(profile.length-1,i+1)],dx=after[0]-before[0],dy=after[1]-before[1],m=Math.hypot(dx,dy)||1;
     for(const offset of[-.014,.014])v.push(c.p[0]+x-dy/m*.012,c.p[1]+y+dx/m*.012,c.p[2]+z+offset);
     if(i)idx.push(i*2-2,i*2,i*2+1,i*2-2,i*2+1,i*2-1);
    });panel('Plywood panel seam / cross sheet',v,idx,'#80705a');
   }
   for(const side of[-1,1])for(const [x,y]of[[f,0],[f+r*Math.SQRT1_2,r*(1-Math.SQRT1_2)],[f+r+deck/2,r+lip]])
    edge('Plywood panel seam / longitudinal',[c.p[0]+side*x,c.p[1]+y+.012,c.p[2]-len/2],[c.p[0]+side*x,c.p[1]+y+.012,c.p[2]+len/2],'#80705a',.014,.026);
   for(const end of[-1,1])for(const side of[-1,1]){
    const v:number[]=[],idx:number[]=[],z=c.p[2]+end*(len/2+.018);
    for(const [x,y]of half)v.push(c.p[0]+side*x,c.p[1]+y,z);
    for(let i=1;i<half.length-1;i++)idx.push(0,i,i+1);
    panel('Halfpipe steel fascia / exposed end',v,idx);
   }
  }
 }
 // A few deliberate building joints establish the floor's scale. They are
 // real geometry and stop at the halfpipe, whose bottom shares floor height.
 for(const x of[-48,-40,-16,0,16,40,48]){
  const spans=x===-40?[[-132,-61],[-29,16]]:[[-132,16]];
  for(const[a,b]of spans)edge('Construction joint / concrete slabs',[x,.006,a],[x,.006,b],'#77756e',.008,.025);
 }
 for(const z of[8,-8,-24,-40,-56,-72,-88,-104,-120]){
  const spans=z>=-60&&z<=-30?[[-54,-44.2],[-17.8,54]]:[[-54,54]];
  for(const[a,b]of spans)edge('Construction joint / concrete slabs',[a,.006,z],[b,.006,z],'#77756e',.008,.025);
 }
 // Paint belongs to selected vertical faces, never an all-over tile.
 for(const x of[21.985,38.015])panel('Workshop steel fascia / side',[
  x,.12,-52,x,4.55,-52,x,4.55,-63,x,.12,-63],[0,1,2,0,2,3]);
 panel('Workshop steel fascia / transfer receiver',[22,.12,-51.98,38,.12,-51.98,38,4.55,-51.98,22,4.55,-51.98],[0,1,2,0,2,3]);
 mural([30,.85,-51.95],11,2.7,0,0);
 mural([21.99,.8,-57.5],8,2.8,-90,1);
 mural([-39,.75,-29.96],3.5,1.7,0,3);
 mural([-4,.55,-109.97],10,2.1,0,2);
 // Reuse complete source models as shallow workshop fittings. Their backs
 // sit inside the existing solid roof block; the transfer face stays clear.
 add({t:'decor',dkind:'warehouseshutter',nm:'Workshop / original shutter in side wall',p:[38.08,0,-57.5],s:[6.5,4.3,.22],yaw:90,solid:true,scenerySolid:true});
 add({t:'decor',dkind:'warehousecabinet',nm:'Workshop / recessed electrical station',p:[21.96,0,-61.2],s:[1.4,2.5,.25],yaw:-90,solid:true,scenerySolid:true});
 add({t:'decor',dkind:'warehousepipes',nm:'Workshop / wall-mounted service pipes',p:[21.96,.1,-54],s:[1.8,3.7,.18],yaw:-90,solid:true,scenerySolid:true});
 const facade=(axis:'x'|'z',fixed:number,low:number,high:number,bays:number,yaw:number)=>{
  const vertices:number[]=[],indices:number[]=[];
  const quad=(a:number,b:number,bottom:number,top:number,vr=0)=>{if(b-a<.001||top-bottom<.001)return;const k=vertices.length/3;
   const backing=fixed+Math.sign(fixed)*.55;
   for(const[q,y]of [[a,bottom],[b,bottom],[b,top],[a,top]])vertices.push(...(axis==='x'?[backing,y,q]:[q,y,backing]));indices.push(k,k+1,k+2,k,k+2,k+3);
   const q=(a+b)/2,depth=.5,back=fixed+Math.sign(fixed)*depth/2;
   add({t:'decor',dkind:bottom<.01?'warehousewalllower':'warehousewallupper',nm:'Warehouse / complete textured wall bay',
    p:axis==='x'?[back,bottom-.02,q]:[q,bottom-.02,back],s:[b-a+.04,top-bottom+.04,depth],yaw,vr,solid:false,scenerySolid:false});
  };
  for(let i=0;i<bays;i++){
   const a=low+(high-low)*i/bays,b=low+(high-low)*(i+1)/bays,centre=(a+b)/2,half=7.706;
   const variants=[0,4,4,0,4,0,0,4,0],variation=variants[(i+(fixed<0?2:0)+(axis==='x'?0:3))%variants.length];
   if(i%3===0){quad(a,centre-4.000008,0,14,variation+1);quad(centre+4.000008,b,0,14,variation+2);quad(centre-4.000008,centre+4.000008,8,14,variation);}else quad(a,b,0,14,variation);
   quad(a,b,32,48,variants[(i+5)%variants.length]);quad(a,centre-half,14,32,variation+1);quad(centre+half,b,14,32,variation+2);
   const recessed=fixed+Math.sign(fixed)*1.116549;
   const p:[number,number,number]=axis==='x'?[recessed,14,centre]:[centre,14,recessed];prop('warehousewindow',p,3,yaw,i%3===1?1:0);
   const inner=fixed-Math.sign(fixed)*(axis==='x'?.4:.15);
   if(i%2===0){const fan:[number,number,number]=axis==='x'?[inner,36,centre]:[centre,36,inner];prop('warehousefan',fan,1.7,yaw);}
   const shutter=fixed+Math.sign(fixed)*1.31922;
   const ground:[number,number,number]=axis==='x'?[shutter,0,centre]:[centre,0,shutter];
   if(i%3===0)prop('warehouseshutter',ground,1.6,yaw);
   if(axis==='x'){
    // The west-north quarter has an air envelope as well as a floor approach.
    if(!(fixed<0&&a+3>-114&&a+3<-92))prop('warehousepipes',[fixed-Math.sign(fixed)*.85,4.5,a+3],2,yaw);
    beam('Warehouse wall cable tray',[fixed-Math.sign(fixed)*.55,11.4,a],[fixed-Math.sign(fixed)*.55,11.4,b],.4,.4);
   }
  }
  add({t:'mesh',nm:'Warehouse masonry / pierced factory backing',p:[0,0,0],vertices,indices,solid:false,doubleSided:true,castShadow:true,tex:'solid',color:'#a19b8b',edgeGrinding:false});
 };
 // The original Meshy wall atlases are still clipped by the shared wall kit.
 // Only bay positions/counts change; no tile generation or UV repetition.
 facade('x',-55.5,-126,10,6,90);facade('x',55.5,-126,10,6,-90);
 facade('z',17.5,-48,48,4,180);facade('z',-133.5,-48,48,4,0);
 // Close the rounded corners with the same 8 m radius as native containment.
 for(const [cx,cz,start]of[[-48,10,0],[-48,-126,1],[48,-126,2],[48,10,3]]){
  const v:number[]=[],idx:number[]=[];
  for(let i=0;i<=12;i++){const a=(start*.5+.5+i/24)*Math.PI;v.push(cx+Math.cos(a)*8.2,0,cz+Math.sin(a)*8.2,cx+Math.cos(a)*8.2,48,cz+Math.sin(a)*8.2);if(i<12){const k=i*2;idx.push(k,k+1,k+3,k,k+3,k+2);}}
  add({t:'mesh',nm:'Warehouse masonry / rounded corner backing',p:[0,0,0],vertices:v,indices:idx,solid:false,doubleSided:true,tex:'solid',color:'#a19b8b',castShadow:true,edgeGrinding:false});
  for(let side=0;side<4;side++)for(const [bottom,top]of [[0,14],[14,32],[32,48]]){
   const a=(start*.5+.5+(side+.5)/8)*Math.PI,depth=.5,r=7.5+depth/2;
   add({t:'decor',dkind:bottom===0?'warehousewalllower':'warehousewallupper',nm:'Warehouse / original textured corner section',
    p:[cx+Math.cos(a)*r,bottom-.02,cz+Math.sin(a)*r],s:[15*Math.tan(Math.PI/16)+.04,top-bottom+.04,depth],
    yaw:Math.atan2(-Math.cos(a),-Math.sin(a))*180/Math.PI,vr:(side+start)%3===0?4:0,solid:false,scenerySolid:false});
  }
 }
 // Overhead machinery identifies the crane district without occupying its lines.
 for(const z of[-86,-92]){
  beam('Crane bridge / chipped yellow web',[-51,40.2,z],[51,40.2,z],1.2,.3);
  for(const y of[39.55,40.85])beam('Crane bridge / flange',[-51,y,z],[51,y,z],.18,1.5);
 }
 for(const side of[-1,1]){
  beam('Crane runway / steel rail',[side*51,40.8,10],[side*51,40.8,-126],1.1,1.1);
  for(let z=8;z>=-112;z-=24)beam('Crane runway / column bracket',[side*54,39,z],[side*51,40.8,z],.5,.5);
 }
 prop('warehousehoist',[35,19,-94],1.3,0);
 for(const x of[32.6,37.4])beam('Crane hoist suspension',[x,40.2,-94],[x,25.1,-94],.11,.11);
 for(const x of[-50,50])for(const z of[-86,-92])beam('Crane bridge / end carriage',[x,39,z-3],[x,39,z+3],1.2,.9);
 // Regular fixtures establish scale; lower lamps mark the exploration routes.
 for(const x of[-36,0,36])for(const z of[-6,-42,-78,-114]){
  prop('warehouselight',[x,44,z],2,0);
  for(const dx of[-2,2])beam('Light suspension',[x+dx,47.7,z],[x+dx,45.2,z],.07,.07);
 }
 for(const[x,y,z]of[[-43,13,-44],[-10,13,-117],[29,14,-58],[34,19,-94],[-35,19,-83],[0,12,-48],[0,12,3]]){
  prop('warehousependant',[x,y,z],1.2,0);
  beam('Pendant suspension',[x,47.7,z],[x,y+2.35,z],.07,.07);
 }
 // Small reachable props hug the straight walls. Keep the west-north quarter,
 // front turnaround and back-center transition free, including their run-outs.
 for(const [side,stations]of[[-1,[-12,-72,-122]],[1,[-12,-40,-108]]] as const)for(const [i,z]of stations.entries()){
  const yaw=side<0?90:-90;
  prop(i===1?'warehousedumpster':'warehousecabinet',[side*54.7,0,z],i===1?.7:.75,yaw);
  prop('warehousejunk',[side*54.65,0,z+3.7],.4,yaw);
  prop('warehousecrate',[side*54.9,0,z-2.8],.75,yaw);
 }
 prop('warehouseboiler',[-54.7,0,-24],.8,90);
 prop('warehouseboiler',[54.7,0,-74],.8,-90);
 for(const [x,y,z,scale,yaw]of[[-54.8,23,-2,2.5,90],[-54.8,23,-58,2.5,90],[-54.8,24,-118,2.2,90],[54.8,25,-80,2.3,-90]])prop('warehouseivy',[x,y,z],scale,yaw);
 // Localized leaks remain on supported floor at the wall; the Meshy wall
 // sections already carry their graffiti, so obsolete floating fascia is gone.
 for(const[x,y,z,w,d]of[[-53,0,-14,3,5],[-53,0,-74,3,6],[53,0,-41,3,6],[53,0,-111,3,7],[-53,0,-122,3,4],
  [-6.6,3.2,10.7,4.6,6],[-14,0,-16,7,10],[20,0,-32,3.8,9],[45,0,-101,7,9],[-12,0,-63,4,6]])
  add({t:'decor',dkind:'warehousepuddle',nm:'Roof leak / shallow standing water',p:[x,y,z],s:[w,.02,d],scenerySolid:false});
 for(const[x,y,z,w,d,yaw]of[[-53,0,-14,3,6,0],[-53,0,-73,3,7,0],[53,0,-40,3,6,0],[53,0,-110,3,7,0],[-53,0,-121,3,5,0],
  [-6,3.2,10.5,6,7,8],[6.3,3.2,9.5,5,7,-13],[-14,0,-16,12,15,20],[21,0,-34,8,16,-8],[-12,0,-63,7,12,18],
  [45,0,-101,12,16,13],[-26,0,-99,12,6,-20],[17,0,-86,12,11,-12],[2,0,-100,15,9,15],[-48,0,-6,9,15,8]])
  add({t:'decor',dkind:'warehousestain',nm:'Localized leaked water / worn concrete',p:[x,y,z],s:[w,.01,d],yaw,scenerySolid:false});
 for(const [x,z,dx,dz]of[[21,-20,0,-4],[21,-20,4,0],[39,-20,0,-4],[39,-20,-4,0],[-27,-108,5,0],[-27,-108,0,3],[5,-108,-5,0],[5,-108,0,3]])
  edge('Warehouse painted marking / old loading boundary',[x,.012,z],[x+dx,.012,z+dz],'#9c865d',.016,.18);

 return out;
}
