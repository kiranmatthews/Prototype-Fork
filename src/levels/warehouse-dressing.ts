import type {CustomComponent,DecorKind} from '../level';
import {warehouseBeam} from './warehouse-geometry';
import {WAREHOUSE_BODY_KINDS} from '../warehouseContacts';

/** Art is source-owned level data. The compact room's riding lanes stay clear. */
export function warehouseDressing():CustomComponent[] {
 const out:CustomComponent[]=[];
 const add=(c:CustomComponent)=>{c.grp=208;out.push(c);return c;};
 const prop=(kind:DecorKind,p:[number,number,number],scale=1,yaw=0,vr=0)=>add({t:'decor',dkind:kind,nm:'Warehouse / '+kind,p,w:scale,yaw,vr,solid:WAREHOUSE_BODY_KINDS.includes(kind),scenerySolid:WAREHOUSE_BODY_KINDS.includes(kind)});
 const beam=(name:string,a:[number,number,number],b:[number,number,number],w=.45,d=.5)=>add(warehouseBeam(name,a,b,w,d));
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
 prop('warehousehoist',[24,31.8,-89],1.75,0);
 for(const x of[-50,50])for(const z of[-86,-92])beam('Crane bridge / end carriage',[x,39,z-3],[x,39,z+3],1.2,.9);
 // Regular fixtures establish scale; lower lamps mark the exploration routes.
 for(const x of[-36,0,36])for(const z of[-6,-42,-78,-114]){
  prop('warehouselight',[x,44,z],2,0);
  for(const dx of[-2,2])beam('Light suspension',[x+dx,47.7,z],[x+dx,45.2,z],.07,.07);
 }
 for(const[x,y,z]of[[-46.5,19,-44],[-10,19,-117],[29,19,-58],[24,24,-90],[-39,25,-79],[0,19,-48]]){
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
 for(const[x,y,z,w,d]of[[-53,0,-14,3,5],[-53,0,-74,3,6],[53,0,-41,3,6],[53,0,-111,3,7],[-53,0,-122,3,4]])
  add({t:'decor',dkind:'warehousepuddle',nm:'Roof leak / shallow standing water',p:[x,y,z],s:[w,.02,d],scenerySolid:false});
 for(const[x,y,z,w,d,yaw]of[[-53,0,-14,3,6,0],[-53,0,-73,3,7,0],[53,0,-40,3,6,0],[53,0,-110,3,7,0],[-53,0,-121,3,5,0]])
  add({t:'decor',dkind:'warehousestain',nm:'Localized leaked water / worn concrete',p:[x,y,z],s:[w,.01,d],yaw,scenerySolid:false});

 return out;
}
