import type {CustomComponent,CustomGroup} from '../level';
import {buildCustardFinale,CUSTARD_FINALE_GROUP,CUSTARD_POOL_Y} from './custard-finale';
type P=[number,number,number];
interface Course {point(s:number,y?:number,u?:number):P;height(s:number):number;yaw(s:number):number}
export const CUSTARD_VALLEY_GROUPS:CustomGroup[]=[{id:93,nm:'Custard · dense layered willow forest'},{id:94,nm:'Custard · waterfall summit'},CUSTARD_FINALE_GROUP];
const rand=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};

/** Scenery remains below or outside the route, with explicit clearance from
 * every folded reach. New Meshy willows mix with the established forest kit. */
export function custardValley(course:Course):CustomComponent[]{
 const out:CustomComponent[]=[],spine=Array.from({length:615},(_,i)=>course.point(i*4,0));
 const clear=(p:P,radius:number)=>spine.every(q=>(p[0]-q[0])**2+(p[2]-q[2])**2>radius*radius);
 // A wide card can cut through a returning reach even when its centre is
 // clear. Test its entire horizontal span, allowing room for the pipe's
 // walls, air space and player camera on every part of the folded course.
 const clearMatte=(p:P,width:number,yaw:number)=>{
  const angle=yaw*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle);
  return spine.every(q=>{const dx=q[0]-p[0],dz=q[2]-p[2];
   return Math.hypot(Math.max(0,Math.abs(dx*cos-dz*sin)-width/2),dx*sin+dz*cos)>28;});
 };
 const prop=(dkind:CustomComponent['dkind'],s:number,u:number,y:number,size:P,yaw:number,nm:string,grp=93,color='#fff9e4')=>
  out.push({t:'decor',dkind,p:course.point(s,y,u),s:size,yaw,scenerySolid:false,solid:false,edgeGrinding:false,color,grp,nm});
 for(let s=12,i=0;s<2370;s+=100,i++)for(const side of [-1,1])for(let row=0;row<3;row++){
  const station=s+row*17+(rand(i+side)*6),u=side*(43+row*23+rand(i*7+row)*7),width=90+row*4+rand(i+row*19)*7;
  const p=course.point(station,course.height(station)-5,u),yaw=course.yaw(station)*Math.PI/180;
  const blocked=spine.some(q=>{const dx=q[0]-p[0],dz=q[2]-p[2];return Math.abs(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)<width*.5+8&&
    Math.abs(Math.cos(yaw)*dx-Math.sin(yaw)*dz)<width*.16+12;});
  if(blocked)continue;
  prop('custardgrove',station,u,p[1],[width,width*.209406,width*.299221],course.yaw(station)+90,
    `Custard dense ${side<0?'left':'right'} forest row ${row} grove ${i}`,93,'#fbf5db');
  if(row===0){
   prop('trialsv3thicket',station+5,u-side*5,p[1],[11,5.6,8],i*73,'Custard dense forest understory',93,'#eddfa1');
   if(i%3===0)prop('custardboulder',station-3,u-side*4,p[1]-5,[7,6.47,6.03],i*27,'Custard rooted forest boulder');
  }
 }
 for(let s=0;s<2330;s+=88)for(const side of [-1,1]){
  const p=course.point(s,0,side*102);if(!clear(p,25))continue;
  const yaw=course.yaw(s)+side*90;
  const offset=[102,94,86,78,70,62,54].find(u=>clearMatte(course.point(s,0,side*u),162,yaw));
  if(offset===undefined)continue;
  prop('custardforest',s,side*offset,course.height(s)-14,[162,45,.02],yaw,
   'Custard distant layered woodland',93,'#ffffff');
 }
 // Mossy rock masses at the summit tie the real shore to the 3D gorge.
 // The finish is a grounded promontory ending BEFORE the water's crest. Its
 // foundation stops behind the brink too; no floating path crosses the fall.
 prop('custardboulder',2409,0,-60,[58,53.614,49.983],course.yaw(2410),
   'Custard continuous bedrock under the finish bank',94);
 for(const [s,w] of [[2383,27],[2400,28],[2425,22]])
  prop('custardboulder',s,0,-7-w*.924385,[w,w*.924385,w*.861778],course.yaw(s),
   'Custard grounded summit rock shoulder',94);
 for(const side of [-1,1])for(const [s,u,w] of [[2378,19,9],[2400,22,12],[2424,22,13],[2445,19,10],[2455,31,18]]){
  const height=w*.924385;
  prop('custardboulder',s,side*u,course.height(s)-height-1,[w,height,w*.861778],course.yaw(s)+side*37,
    'Custard waterfall summit mossy outcrop',94);
  if(s<2450)prop('coastspire',s,side*(u+4),course.height(s)-31,[13,25,12],course.yaw(s)+side*20,
    'Custard waterfall deep rocky face',94,'#e2c199');
 }
 out.push(...buildCustardFinale(course));
 // The river physically turns over the brink; this visible mesh is neither a
 // supporting bridge nor a flat billboard standing in for the entire fall.
 const rows=[[2440,-12,34],[2445,-12,34],[2448,-13,31],[2452,-17,28],[2457,-24,26],[2461,CUSTARD_POOL_Y,25]];
 const origin=course.point(2445,0),vertices:number[]=[],uvs:number[]=[],indices:number[]=[];
 rows.forEach(([s,y,width],row)=>{for(let j=0;j<=16;j++){
  const u=-width+j*width*2/16,q=course.point(s,y+.18*Math.sin(j*1.8)*Math.min(1,row/3)*(1-row/(rows.length-1)),u);
  vertices.push(q[0]-origin[0],q[1],q[2]-origin[2]);uvs.push(j/2,(12+y)/-8);
  if(row&&j<16){const a=(row-1)*17+j,b=row*17+j;indices.push(a,a+1,b,a+1,b+1,b);}
 }});
 out.push({t:'mesh',p:origin,vertices,indices,uvs,tex:'custard-cascade',color:'#91c5b1',solid:false,doubleSided:true,
  castShadow:false,edgeGrinding:false,grp:94,nm:'Custard river folding over the waterfall brink'});
 return out;
}
