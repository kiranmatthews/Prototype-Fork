import * as THREE from 'three';
import type { CustomComponent } from '../level';
import type { P } from './pirate-meshes';

/** Local harbour proof: reuse the paid kit, with a built quay and correctly
 * scaled materials. The rest of the course and its movement stay untouched. */
export function refineHarbourQuay(source:CustomComponent[]):CustomComponent[] {
 const out:CustomComponent[]=[];
 for(const c of source){
  if(c.t==='torch'&&(c.grp??0)>=8)continue;
  if(c.nm==='Harbour masonry sea wall'){
   out.push({...c,p:[-111.5,-4,155],s:[67,14.4,130],tex:'solid',color:'#776f5b'});continue;
  }
  if(c.dkind==='crownwarehouse')out.push({...c,p:[c.p[0]+3,3.2,c.p[2]]});
  else if(c.dkind==='crowntropicalpalm'&&c.grp===8)out.push({...c,p:[c.p[0]+3,3.2,c.p[2]]});
  // These stretched modules were an artificial curtain across the bay.
  else if(c.dkind==='crownlimestonewall'&&c.grp===10&&c.p[2]===45)continue;
  else out.push(c);
 }

 let vertices:number[]=[],uvs:number[]=[],colors:number[]=[];
 const flush=(name:string,tex:string)=>{
  if(!vertices.length)return;
  out.push({t:'mesh',p:[0,0,0],vertices,uvs,colors,tex,color:'#ffffff',solid:false,scenerySolid:false,grp:8,nm:name});
  vertices=[];uvs=[];colors=[];
 };
 const box=(p:P,size:P,tint:string,seed:number,tile=4.5)=>{
  const g=new THREE.BoxGeometry(...size).toNonIndexed(),v=g.getAttribute('position'),n=g.getAttribute('normal'),color=new THREE.Color(tint);
  for(let i=0;i<v.count;i++){
   const x=v.getX(i)+p[0],y=v.getY(i)+p[1],z=v.getZ(i)+p[2];
   // A small common offset keeps each stone's corners joined on every face.
   const chip=Math.sin(Math.sign(v.getX(i))*13+Math.sign(v.getY(i))*7+Math.sign(v.getZ(i))*19+seed)*.024;
   vertices.push(x+chip,y+chip*.5,z+chip);
   const ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i));
   uvs.push((ax>.5?z:x)/tile,(ay>.5?z:y)/tile);colors.push(color.r,color.g,color.b);
  }
  g.dispose();
 };
 // Staggered dressed blocks, with real recessed mortar and separate coping.
 // This abuts the deck's -78 m edge; the previous quay stopped 7 m short.
 for(let row=0;row<7;row++){
  for(let i=0;i<40;i++){
   const z=218-i*2+(row%2?1:0),shade=.88+Math.sin(i*7+row*11)*.075;
   box([-78.15,-1.25+row*.68,z],[.72,.64,1.95],new THREE.Color().setScalar(shade).getStyle(),row*100+i);
  }
  flush('Harbour proof · limestone quay blockwork','crown-limestone');
 }
 for(let i=0;i<42;i++)box([-78.35,3.28,219-i*2],[1.3,.23,1.94],'#e9e2cb',i+400);
 flush('Harbour proof · broad stone coping','crown-limestone');
 // Quayside paving is laid at a real metre scale rather than one UV square
 // stretched over a 130 m platform.
 for(let i=0;i<5;i++)box([-95,3.22,210-i*16],[32,.055,16],'#dad0b3',i+900,7);
 flush('Harbour proof · paved customs promenade','bay-paving');

 // Layer the existing rock models at moderate proportions instead of
 // elongating a single row into a 50 m vertical curtain.
 for(let row=0;row<4;row++){
  const y=-11+row*12.1,first=-103+row*6,last=42-row*9;
  for(let i=0,x=first;x<=last;i++,x+=19.5){
   if(row<2&&x>-67&&x<-26)continue;
   out.push({t:'decor',dkind:'crownlimestonewall',p:[x,y+Math.sin(i*3.9+row)*1.4,52+Math.sin(i*4.1+row)*3-row*1.6],
    s:[24,15+Math.sin(i*2.7+row)*2,16],yaw:Math.sin(i*7+row)*17,grp:10,nm:'Harbour proof · layered headland rock'});
  }
 }
 out.push({t:'decor',dkind:'crownlimestonewall',p:[-48,13.5,51],s:[23,17,15],yaw:-4,grp:10,nm:'Harbour proof · sea gate rock arch'});
 // Piles rise visibly through the quay. The water-facing edge stays open;
 // the waist-high rope is interrupted at the landing, not a hidden barrier.
 const addGeo=(name:string,g:THREE.BufferGeometry,p:P,tex:string,color:string,rotation?:THREE.Quaternion)=>{
  const geo=g.index?g.toNonIndexed():g;
  if(rotation)geo.applyQuaternion(rotation);geo.translate(...p);
  const v=geo.getAttribute('position'),n=geo.getAttribute('normal'),uv=[];
  for(let i=0;i<v.count;i++)uv.push((Math.abs(n.getX(i))>.7?v.getZ(i):v.getX(i))/3.8,v.getY(i)/3.8);
  out.push({t:'mesh',p:[0,0,0],vertices:Array.from(v.array),normals:Array.from(n.array),uvs:uv,tex,color,
   solid:false,scenerySolid:name==='Harbour proof · mooring post',grp:8,nm:name});geo.dispose();if(geo!==g)g.dispose();
 };
 for(const z of [211,198,184]){
  addGeo('Harbour proof · mooring post',new THREE.CylinderGeometry(.33,.42,13.65,10),[-65.85,-3.35,z],'crown-timber','#dec7a2');
  for(let ring=0;ring<4;ring++)addGeo('Harbour proof · rope lashing',new THREE.TorusGeometry(.37,.065,5,14),[-65.85,2.55+ring*.12,z],
    'solid','#b7a786',new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));
  out.push({t:'decor',dkind:'crownbrasslantern',p:[-65.85,3.48,z],s:[.69,.77,.37],yaw:-90,grp:8,nm:'Harbour proof · sheltered mooring lantern'});
 }
 for(const [x,z,yaw] of [[-83,204,90],[-84,184,20],[-86,176,-35]] as [number,number,number][])
  out.push({t:'decor',dkind:'crowncargostack',p:[x,3.28,z],s:[3.3,2.15,2.68],yaw,grp:8,nm:'Harbour proof · customs goods'});
 // The nearest lighter belongs to the arrival quay, close enough to read
 // its hull and rigging from the player's eye rather than as a tiny icon.
 for(const c of out)if(c.dkind==='crowncargolighter'&&c.p[2]===171){c.p=[-43,-10,184];c.s=[9.58,15.76,24];c.yaw=-12;}
 return out;
}
