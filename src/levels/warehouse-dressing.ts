import type {CustomComponent,DecorKind} from '../level';
import {warehouseBeam} from './warehouse-geometry';
import {WAREHOUSE_BODY_KINDS} from '../warehouseContacts';

/** Art is source-owned level data. The existing riding surfaces are untouched. */
export function warehouseDressing():CustomComponent[] {
 const out:CustomComponent[]=[];
 const add=(c:CustomComponent)=>{c.grp=208;out.push(c);return c;};
 const prop=(kind:DecorKind,p:[number,number,number],scale=1,yaw=0,vr=0)=>add({t:'decor',dkind:kind,nm:'Warehouse / '+kind,p,w:scale,yaw,vr,solid:WAREHOUSE_BODY_KINDS.includes(kind),scenerySolid:WAREHOUSE_BODY_KINDS.includes(kind)});
 const mural=(p:[number,number,number],yaw:number,vr:number,w=10,h=5)=>add({t:'decor',dkind:'warehousegraffiti',nm:'Original warehouse graffiti',p,s:[w,h,.01],yaw,vr,scenerySolid:false});
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
    prop('warehousepipes',[fixed-Math.sign(fixed)*.85,4.5,a+3],2,yaw);
    beam('Warehouse wall cable tray',[fixed-Math.sign(fixed)*.55,11.4,a],[fixed-Math.sign(fixed)*.55,11.4,b],.4,.4);
   }
  }
  add({t:'mesh',nm:'Warehouse masonry / pierced factory backing',p:[0,0,0],vertices,indices,solid:false,doubleSided:true,castShadow:true,tex:'solid',color:'#a19b8b',edgeGrinding:false});
 };
 facade('x',-85.5,-202,30,9,90);facade('x',85.5,-202,30,9,-90);
 facade('z',37.5,-78,78,6,180);facade('z',-209.5,-78,78,6,0);
 // Close the rounded corners with the same 8 m radius as native containment.
 for(const [cx,cz,start]of[[-78,30,0],[-78,-202,1],[78,-202,2],[78,30,3]]){
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
 // The old crane explains the high service network and gives the room a focal point.
 for(const z of[-103,-109]){
  beam('Crane bridge / chipped yellow web',[-80,40.2,z],[80,40.2,z],1.2,.3);
  for(const y of[39.55,40.85])beam('Crane bridge / flange',[-80,y,z],[80,y,z],.18,1.5);
 }
 for(const side of[-1,1]){
  beam('Crane runway / steel rail',[side*80,40.8,28],[side*80,40.8,-200],1.1,1.1);
  for(let z=28;z>=-188;z-=24)beam('Crane runway / column bracket',[side*83,39,z],[side*80,40.8,z],.5,.5);
 }
 prop('warehousehoist',[8,31.8,-106],1.75,0);
 for(const x of[-79,79])for(const z of[-103,-109])beam('Crane bridge / end carriage',[x,39,z-3],[x,39,z+3],1.2,.9);
 // Regular fixtures establish scale; lower lamps mark the exploration routes.
 for(const x of[-51,0,51])for(const z of[3,-43,-89,-135,-181]){
  prop('warehouselight',[x,44,z],2,0);
  for(const dx of[-2,2])beam('Light suspension',[x+dx,47.7,z],[x+dx,45.2,z],.07,.07);
 }
 prop('warehouselight',[-40,6.3,25],1.3,0);
 for(const[x,y,z]of[[-64,20,-91],[24,37,-165],[-8,40,-124],[-48,44,-91],[43,37,-163],[-45,17,-171]]){
  prop('warehousependant',[x,y,z],1.2,0);
  if(y<44)beam('Pendant suspension',[x,47.7,z],[x,y+2.35,z],.07,.07);
 }
 for(const [x,z]of [[-22,-51],[36,-98],[-15,-160]]){
  prop('warehousependant',[x,10,z],1.1,0);
  beam('Work light cable',[x,47.7,z],[x,12.2,z],.06,.06);
 }
 // Perimeter dressing uses the actual model surfaces for reachable contacts.

 for(const side of[-1,1])for(const [i,z]of[-12,-61,-130,-179].entries()){
  const yaw=side<0?90:-90,p:[number,number,number]=[side*81.4,0,z];
  if(i%2===0){prop('warehousecabinet',p,1.35,yaw);}
  else{prop('warehousedumpster',p,1.3,yaw);}
  prop('warehousejunk',[side*79.4,0,z+5.4],.65,yaw);
  prop('warehousecrate',[side*80.1,0,z-5],1,yaw+12);
 }
 prop('warehouseboiler',[-80,0,-96],2,90);
 prop('warehouseboiler',[80,0,-151],1.6,-90);
 prop('warehousecrate',[-59,8,29],1.2,0);
 prop('warehousecrate',[-59,9.44,29],.9,15);
 prop('warehousejunk',[-57,8,30.8],.65,45);
 // Abandoned service clusters sit between the proven circulation lanes.
 prop('warehousecabinet',[34,0,-113],1.2,-15);
 prop('warehouseboiler',[30,0,-119],1.2,25);
 prop('warehousejunk',[35.5,0,-118],.65,60);
 prop('warehousecrate',[38,0,-118],1.1,-10);
 prop('warehousedumpster',[-58,0,-154],1.2,0);
 prop('warehousejunk',[-58.5,0,-150],.8,35);
 prop('warehousecabinet',[-50,0,23],1.4,0);
 prop('warehousecrate',[-46,0,27],1.3,15);
 for(const [x,y,z,scale,yaw]of[[-84.8,23,14,3,90],[-84.8,23,-63,3,90],[-84.8,24,-151,2.65,90],[84.8,25,-89,2.3,-90]])prop('warehouseivy',[x,y,z],scale,yaw);
 // Decals live on walls and fascia, never obscure a takeoff or landing edge.
 add({t:'wall',nm:'Warehouse fascia / arrival metal sign',p:[-42,3.6,33.96],s:[14,3.8,.12],tex:'solid',color:'#50686b'});
 add({t:'wall',nm:'Warehouse fascia / loft cladding',p:[24,14.1,-160.04],s:[8,3.8,.12],tex:'solid',color:'#50686b'});
 add({t:'wall',nm:'Warehouse fascia / crane cladding',p:[8,24.1,-120.04],s:[11,3.2,.12],tex:'solid',color:'#50686b'});
 mural([-42,3.7,33.88],180,0,13,3);
 mural([-45,1,-164.98],0,1,10,3.5);
 mural([24,14.2,-159.96],0,2,7,2.7);
 mural([8,24.1,-119.94],0,3,9,2.2);
 for(const[x,y,z,w,d]of[[-65,0,-25,14,7],[-21,0,-53,9,5],[47,0,-110,15,5],[-17,0,-165,13,5],
  [0,0,-186,12,6],[27,0,-85,10,6],[-45,8,28,8,3],[-51,8,20,5,14],[-32,8,18,7,9],[22,18,-165,5,4],[-49,32,-92,3,2]])
  add({t:'decor',dkind:'warehousepuddle',nm:'Roof leak / shallow standing water',p:[x,y,z],s:[w,.02,d],scenerySolid:false});
 for(const[x,y,z,w,d,yaw]of[[-56,8,27,9,7,12],[-29,8,17,7,8,25],[-65,0,-22,13,8,32],[-14,0,-48,11,6,80],
  [39,0,-83,17,9,12],[-25,0,-144,14,6,43],[43,0,-162,9,9,18],[-45,5.4,-171,12,6,10],
  [-64,8.4,-91,5,7,22],[25,18,-165,7,7,43],[10,28,-124,12,5,17],[-49,32,-92,6,5,25]])
  add({t:'decor',dkind:'warehousestain',nm:'Localized leaked water / worn concrete',p:[x,y,z],s:[w,.01,d],yaw,scenerySolid:false});

 return out;
}
