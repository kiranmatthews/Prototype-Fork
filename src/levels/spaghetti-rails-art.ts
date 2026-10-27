import type {CustomComponent,CustomLevelData,DecorKind} from '../level';

type P=[number,number,number];
const ART=90;
const hash=(n:number)=>{const h=Math.sin(n*127.1+311.7)*43758.5453;return h-Math.floor(h);};
const round=(n:number)=>Math.round(n*1000)/1000;
const V={solid:false,scenerySolid:false,castShadow:false,grp:ART} as const;
const THREADS=['#d6a765','#89d3cc','#d38781'];

/** The rail knots, platforms, retry points and timings are the greybox data.
 * This layer changes materials and adds scenery; it never creates a second
 * rail or collision path. Meshy objects retain their complete source meshes. */
export function withSpaghettiCavern(source:CustomLevelData):CustomLevelData {
 const data=structuredClone(source),art:CustomComponent[]=[];
 const put=(c:CustomComponent)=>art.push({...V,...c});
 const decor=(dkind:DecorKind,p:P,s:P,yaw=0,nm=String(dkind))=>put({t:'decor',dkind,p,s,yaw,nm});
 const mesh=(nm:string,p:P,vertices:number[],indices:number[],extra:Partial<CustomComponent>={})=>put({t:'mesh',nm,p,vertices,indices,tex:'solid',doubleSided:true,...extra});

 // Narrow iron bands sit on the existing vertical faces. They do not hide
 // the top edge, shrink a landing or introduce a non-grindable rail proxy.
 for(const c of data.components){
  if(c.t!=='platform'||!c.s)continue;
  c.tex='spaghetti-basalt';c.color='#c6ccdb';c.emissive='#080a10';
  const [w,h,d]=c.s,vertices:number[]=[],indices:number[]=[];
  const quad=(points:P[])=>{const start=vertices.length/3;for(const p of points)vertices.push(...p);indices.push(start,start+1,start+2,start,start+2,start+3);};
  for(const side of [-1,1]){
   const x=side*(w/2+.012),z=side*(d/2+.012),top=h/2-.18,bottom=top-.24;
   quad([[x,top,-d/2],[x,top,d/2],[x,bottom,d/2],[x,bottom,-d/2]]);
   quad([[-w/2,top,z],[w/2,top,z],[w/2,bottom,z],[-w/2,bottom,z]]);
   // Fasteners and buttress ends remain wholly inside the original slab.
   for(let j=0;j<Math.max(2,Math.floor(d/4));j++){
    const zz=-d/2+2+j*(d-4)/Math.max(1,Math.floor(d/4)-1);
    quad([[x,top-.38,zz-.11],[x,top-.38,zz+.11],[x,top-.60,zz+.11],[x,top-.60,zz-.11]]);
   }
  }
  mesh(`Riveted iron rim / ${c.nm}`,c.p,vertices,indices,{yaw:c.yaw,color:'#b1a38a',emissive:'#11120f'});
 }

 // The three choices have a consistent colour/material language at every
 // common junction. The arrow is on supported stone beneath the real rail.
 for(const c of data.components){
  if(c.t!=='rail'||!c.pts||!c.nm?.endsWith('thread 1'))continue;
  const choice=Number(c.nm.split('.')[1]?.split(' ')[0])-1;
  if(choice<0||choice>2)continue;
  const first=c.pts[0],next=c.pts[1],yaw=Math.atan2(-(next[0]-first[0]),-(next[1]-first[1]))*180/Math.PI;
  const vertices=[-2.4,0,3.5,0,0,-2.8,2.4,0,3.5,1.2,0,3.5,0,0,.5,-1.2,0,3.5];
  mesh(`Choose thread ${choice+1} / ${c.nm}`,[c.p[0],c.p[1]-.88,c.p[2]],vertices,[0,1,5,1,4,5,1,2,3,1,3,4],{yaw,color:THREADS[choice],emissive:THREADS[choice]});
 }

 // A real enclosing wall sits well outside the complete tangled network.
 // The generated matte supplies distant fractures, with full Meshy basalt
 // and arches in front for parallax and silhouetted depth.
 const center:P=[-55,0,-130],radius=850,bottom=-100,top=480,vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
 for(let i=0;i<=160;i++){
  const a=i/160*Math.PI*2,u=(i/160*2)%2;
  for(const [y,v]of [[bottom,0],[top,1]]){vertices.push(Math.sin(a)*radius,y,-Math.cos(a)*radius);uvs.push(u<=1?u:2-u,v);}
  if(i<160){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
 }
 mesh('Quagmire / cathedral cavern walls',center,vertices,indices,{uvs,tex:'spaghetti-cavern',color:'#ffffff',emissive:'#263047',fog:false});
 for(let i=0;i<14;i++){
  const a=i/14*Math.PI*2,r=665+hash(i+8)*28;
  decor('nightbasalt',[round(center[0]+Math.sin(a)*r),-85,round(center[2]-Math.cos(a)*r)],
   [150+hash(i)*60,300+hash(i+20)*95,125+hash(i+40)*50],a*180/Math.PI+22,'Full Meshy basalt / cavern perimeter');
 }
 for(let i=0;i<6;i++){
  const a=(i+.35)/6*Math.PI*2;
  decor('nightdistantarch',[round(center[0]+Math.sin(a)*560),-30,round(center[2]-Math.cos(a)*560)],
   [105,145+hash(i+71)*30,42],a*180/Math.PI,'Full Meshy arch / ancient ironwork vault');
 }

 // Broken hexagonal basalt teeth hang above every playable rail and camera.
 // These are authored geometry, never distance-dependent substitutes.
 for(let tooth=0;tooth<22;tooth++){
  const a=tooth*2.39996,r=150+hash(tooth+32)*440,p:P=[round(center[0]+Math.sin(a)*r),240+hash(tooth+77)*45,round(center[2]+Math.cos(a)*r)];
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],size=13+hash(tooth+2)*19,height=95+hash(tooth+17)*85;
  for(let ring=0;ring<4;ring++)for(let side=0;side<7;side++){
   const angle=side/6*Math.PI*2,scale=[.08,.48,.76,1][ring],x=Math.cos(angle)*size*scale,z=Math.sin(angle)*size*scale;
   vertices.push(x,height*ring/3,z);uvs.push(side/6*4,ring*height/30);
   if(ring<3&&side<6){const k=ring*7+side;indices.push(k,k+1,k+7,k+1,k+8,k+7);}
  }
  mesh('Hanging fractured basalt / upper vault',p,vertices,indices,{uvs,tex:'spaghetti-basalt',color:'#8b97af'});
 }

 // A few original Meshy landmarks punctuate the course without filling the
 // open space needed to read crossings and jump destinations.
 decor('ghostchandelier',[0,195,80],[17,17,17],12,'Meshy iron chandelier / starting vault');
 decor('ghostmonsterportal',[15,18,-474],[38,38,38],0,'Meshy watching portal / beyond finish');
 decor('ghosttrestle',[-440,-10,-300],[28,20,100],-22,'Meshy wreck / abandoned lower trestle');
 decor('ghosttrestle',[350,-10,-120],[25,18,90],36,'Meshy wreck / distant broken trestle');

 const floorVertices=[0,0,0],floorIndices:number[]=[],floorUvs=[0,0];
 for(let i=0;i<80;i++){
  const a=i/80*Math.PI*2,x=Math.sin(a)*820,z=Math.cos(a)*820;
  floorVertices.push(x,0,z);floorUvs.push(x/95,z/95);floorIndices.push(0,i+1,(i+1)%80+1);
 }
 mesh('Quagmire / drowned basalt far below',[-55,-49,-130],floorVertices,floorIndices,{uvs:floorUvs,tex:'spaghetti-basalt',color:'#161e20',emissive:'#07100d'});
 data.components.push(...art);
 data.groups=[...(data.groups??[]),{id:ART,nm:'Quagmire Caverns / ironwork and basalt',editorOnly:true}];
 data.atmosphere={backdrop:'fog',fogEnabled:true,fogNear:180,fogFar:780,fogColor:'#242e40',drawDistance:1700,
  ambientSky:'#b9c7e6',ambientGround:'#40514a',ambientIntensity:1.15,
  sunColor:'#b9caff',sunIntensity:1.5,sunDirection:[.5,.8,.24],fillColor:'#c5a374',fillIntensity:.55,shadowStrength:.65,
  heightFog:{height:-5,density:.012,falloff:.025}};
 return data;
}
