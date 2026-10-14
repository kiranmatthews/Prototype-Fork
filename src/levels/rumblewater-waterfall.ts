import type {CustomComponent,CustomGroup} from '../level';
import {CUSTARD_ASSETS} from '../custardAssets';
import {CARLISLE_ASSETS} from '../carlisleAssets';
import {RUMBLEWATER_WATERFALL_PLANTS} from './rumblewater-waterfall-plants';
import type {CreekSampler} from './custard-terrain';

type P=[number,number,number];
const assets={...CARLISLE_ASSETS,...CUSTARD_ASSETS};
type Kind=keyof typeof assets;
export const RUMBLEWATER_WATERFALL_GROUP:CustomGroup={id:94,nm:'Headwaters · waterfall and willow cliffs',editorOnly:true};

/** The source of the creek sits behind the first cradle. All water and stone
 * use the existing animated cascade and Meshy kit; the chase stays untouched. */
export function buildRumblewaterWaterfall({point}:CreekSampler,yaw:(s:number)=>number):CustomComponent[]{
 const C:CustomComponent[]=[],grp=RUMBLEWATER_WATERFALL_GROUP.id;
 const prop=(kind:Kind,s:number,u:number,w:number,y:number,turn=0,name='Headwaters layered sandstone',color='#fff5df')=>{
  const size=assets[kind].size,k=w/size[0];
  C.push({t:'decor',dkind:kind,p:point(s,y,u),s:size.map(v=>v*k) as P,yaw:yaw(s)+turn,
   solid:false,scenerySolid:false,castShadow:false,color,grp,nm:name});
 };
 // Overlapping masses reach below the plunge pool. The higher left crown and
 // lower right shoulder give the skyline an asymmetric, continuous silhouette.
 for(const [s,u,w,y,turn]of [
  [-143,0,104,-21,0],[-141,0,104,27,0],
  [-129,-62,88,-12,19],[-132,-58,82,31,13],
  [-124,60,82,-14,-18],[-136,56,76,30,-12],
  [-97,-47,64,2,31],[-101,46,60,0,-29],
  [-76,-44,54,-11,64],[-79,45,52,-13,-61],
 ] )prop('custardgorgecliff',s,u,w,y,turn);
 prop('custarderodedcliff',-105,-41,47,28,40,'Headwaters worn left cascade shoulder');
 prop('custarderodedcliff',-110,39,44,31,-35,'Headwaters worn right cascade shoulder');
 for(const [s,u,w,y,turn]of [[-113,-23,17,49,23],[-113,24,15,46,-25],[-96,-27,19,14,42],[-99,28,18,16,-34]])
  prop('custardboulder',s,u,w,y,turn,'Headwaters mossy waterfall outcrop');

 const origin=point(-100,0),local=(s:number,y:number,u:number)=>{
  const p=point(s,y,u);return[p[0]-origin[0],y,p[2]-origin[2]] as P;
 };
 const mesh=(name:string,vertices:number[],indices:number[],uvs:number[],extra:Partial<CustomComponent>)=>
  C.push({t:'mesh',p:origin,vertices,indices,uvs,solid:false,scenerySolid:false,doubleSided:true,
   edgeGrinding:false,castShadow:false,grp,nm:name,...extra});
 // Three overlapping curtains turn over a real crest and flare into the pool.
 // Their uneven edges, curved faces and differing lips avoid a flat rectangle.
 const profile=[[-126,78,1],[-119,78,1],[-114,77.7,1],[-111,76,1],[-109,72,1.01],[-107.5,65,1.03],
  [-106,56,1.05],[-104.5,45,1.08],[-102.5,34,1.1],[-100,24,1.15],[-97,17,1.23],[-92,15.2,1.35],[-81,15.1,1.4]];
 for(const [sheet,centre,width,drop]of [[0,-13,15,2],[1,0,15,0],[2,13.5,13.5,5]]){
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];let flow=0;
  profile.forEach(([s,y,spread],row)=>{
   if(row)flow+=Math.hypot(s-profile[row-1][0],y-profile[row-1][1]);
   for(let j=0;j<=20;j++){
    const t=j/20,x=(t-.5)*width*spread,edge=Math.sin(t*Math.PI),fall=Math.sin(row/(profile.length-1)*Math.PI);
    const u=centre+x+.32*Math.sin(row*1.7+sheet*2)*(1-edge);
    const height=y-drop*Math.max(0,(y-16)/62)+.18*Math.sin(j*1.8+sheet)*fall;
    vertices.push(...local(s+sheet*.3+.65*edge*fall,height,u));uvs.push((u+23)/9+.025*Math.sin(y*.58+u*.7)+.012*Math.sin(y*1.3-u*1.4),flow/13+.5);
    if(row&&j<20){const a=(row-1)*21+j,b=row*21+j;indices.push(a,a+1,b,a+1,b+1,b);}
   }
  });
  mesh('Headwaters falling water curtain '+(sheet+1),vertices,indices,uvs,{tex:'custard-cascade',color:sheet===1?'#8fcbd1':'#a2d3d7'});
 }
 // A broad submerged bowl joins the existing flowing creek at station -62.
 const water:number[]=[],bed:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let row=0;row<=12;row++){
  const s=-109+row*47/12,half=39+7*Math.sin(row/12*Math.PI);
  for(let j=0;j<=8;j++){
   const t=j/8,u=(t*2-1)*half;
   water.push(...local(s,15.04,u));bed.push(...local(s,10.8+2.6*Math.pow(Math.abs(t*2-1),3),u));uvs.push(u/7,s/7);
   if(row&&j<8){const a=(row-1)*9+j,b=row*9+j;indices.push(a,b,a+1,a+1,b,b+1);}
  }
 }
 mesh('Headwaters submerged plunge basin',bed,indices,uvs,{tex:'coast-bedrock',color:'#687f70'});
 mesh('Headwaters pool feeding the creek',water,indices,uvs,{tex:'custard-water',materialStyle:'jungle-stream',color:'#63aaa1',opacity:.9,lethal:true});
 // Low broken rings of moving foam mark the impacts without covering the
 // foreground with a spray card. They sit immediately above the water plane.
 for(const [s,u,rx,rz]of [[-91,-11,12,5],[-90,6,13,6],[-86,0,24,10]]){
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  for(let i=0;i<=64;i++)for(let j=0;j<3;j++){
   const a=i/64*Math.PI*2,r=1+j*.10+.035*Math.sin(a*7);
   vertices.push(...local(s+Math.sin(a)*rz*r,15.1,u+Math.cos(a)*rx*r));uvs.push(i/64,j/2);
   if(i&&j<2){const k=(i-1)*3+j,b=i*3+j;indices.push(k,k+1,b,k+1,b+1,b);}
  }
  mesh('Headwaters waterfall impact foam',vertices,indices,uvs,{tex:'custard-foam',color:'#e4f5e4',opacity:.72});
 }
 for(const [s,u,w,turn]of [[-73,-29,14,30],[-87,-31,12,69],[-71,30,13,-40],[-87,32,11,-62],[-101,-24,12,10],[-98,23,9,-40]])
  prop('custardshoreboulder',s,u,w,13.4,turn,'Headwaters wet shoreline stone');
 // Anchored plant roots are measured against these exact cliff triangles.
 for(const [kind,s,u,w,y,turn,name]of RUMBLEWATER_WATERFALL_PLANTS)prop(kind,s,u,w,y,turn,name,'#eaf2c9');
 return C;
}
