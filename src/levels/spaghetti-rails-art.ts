import type {CustomComponent,CustomLevelData,DecorKind} from '../level';

type P=[number,number,number];
const ART=90;
const hash=(n:number)=>{const h=Math.sin(n*127.1+311.7)*43758.5453;return h-Math.floor(h);};
const V={solid:false,scenerySolid:false,castShadow:false,grp:ART} as const;
const THREADS=['#ddb76c','#b79ad4','#85c9bd','#e0b89a','#abb9ca','#d99c9c','#a9b77b','#89accb'];

/** The rail knots, platforms, retry points and timings are the greybox data.
 * This layer changes materials and adds scenery; it never creates a second
 * rail or collision path. Meshy objects retain their complete source meshes. */
export function withSpaghettiCavern(source:CustomLevelData):CustomLevelData {
 const data=structuredClone(source),art:CustomComponent[]=[];
 const put=(c:CustomComponent)=>art.push({...V,...c});
 const decor=(dkind:DecorKind,p:P,s:P,yaw=0,nm=String(dkind))=>put({t:'decor',dkind,p,s,yaw,nm});
 const mesh=(nm:string,p:P,vertices:number[],indices:number[],extra:Partial<CustomComponent>={})=>put({t:'mesh',nm,p,vertices,indices,tex:'solid',doubleSided:true,...extra});

 // Existing upright-beam skin rebuilds directly from the native rail nodes.
 // Its running crest stays at the normal board contact height; the deeper
 // iron web makes distant crossings readable without a duplicate grind path.
 for(const c of data.components)if(c.t==='rail')c.dkind='citydeck';

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

 // The eight choices have a consistent colour/material language at every
 // common junction. The arrow is on supported stone beneath the real rail.
 for(const c of data.components){
  if(c.t!=='rail'||!c.pts||!c.nm?.endsWith('thread 1'))continue;
  const choice=Number(c.nm.split('.')[1]?.split(' ')[0])-1;
  if(choice<0||choice>7)continue;
  const first=c.pts[0],next=c.pts[1],yaw=Math.atan2(-(next[0]-first[0]),-(next[1]-first[1]))*180/Math.PI;
  const vertices=[-2.4,0,3.5,0,0,-2.8,2.4,0,3.5,1.2,0,3.5,0,0,.5,-1.2,0,3.5];
  mesh(`Choose thread ${choice+1} / ${c.nm}`,[c.p[0],c.p[1]-.88,c.p[2]],vertices,[0,1,5,1,4,5,1,2,3,1,3,4],{yaw,color:THREADS[choice],emissive:THREADS[choice]});
 }

 // A real enclosing wall sits well outside the complete tangled network.
 // The generated matte supplies distant fractures, with full Meshy basalt
 // and arches in front for parallax and silhouetted depth.
 const center:P=[0,0,-1120],radiusX=660,radiusZ=1700,bottom=-150,top=780,vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
 for(let i=0;i<=192;i++){
  const a=i/192*Math.PI*2,u=(i/192*4)%2;
  for(const [y,v]of [[bottom,0],[top,1]]){vertices.push(Math.sin(a)*radiusX,y,-Math.cos(a)*radiusZ);uvs.push(u<=1?u:2-u,v);}
  if(i<192){const k=i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
 }
 mesh('Quagmire / cathedral cavern walls',center,vertices,indices,{uvs,tex:'spaghetti-cavern',color:'#ffffff',emissive:'#263047',fog:false});
 const platforms=data.components.filter(c=>c.t==='platform'&&c.s&&c.s[0]>100);
 for(const [i,c]of platforms.entries()){
  const top=c.p[1]+c.s![1]/2;
  decor('nightbasalt',[c.p[0],top-150,c.p[2]],[154,143,100],i*37,'Full Meshy basalt / massive island roots');
  for(const side of [-1,1]){
   decor('nightbasalt',[side*(420+hash(i)*55),top-200,c.p[2]-75],[170,420,170],i*61+side*15,'Full Meshy basalt / cavern pillars');
   if(i%2===0)decor('nightdistantarch',[side*390,top-70,c.p[2]-140],[110,170,42],-side*90,'Full Meshy arch / abandoned side vault');
  }
  // The chandelier identifies the calm planning island. Its lowest point is
  // well above the rider and the entire native camera envelope.
  decor('ghostchandelier',[c.p[0],top+44,c.p[2]+20],[22,22,22],i*24,'Meshy iron chandelier / decision island');
 }
 // Fixed full-detail teeth frame each chasm without occupying a rail line.
 for(let tooth=0;tooth<36;tooth++){
  const stage=Math.floor(tooth/6),side=tooth%2?1:-1,top=420-stage*70;
  const p:P=[side*(230+hash(tooth+32)*130),top+70+hash(tooth+77)*50,30-stage*400-hash(tooth+53)*290];
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],size=14+hash(tooth+2)*22,height=85+hash(tooth+17)*130;
  for(let ring=0;ring<4;ring++)for(let side=0;side<7;side++){
   const angle=side/6*Math.PI*2,scale=[.08,.48,.76,1][ring];
   vertices.push(Math.cos(angle)*size*scale,height*ring/3,Math.sin(angle)*size*scale);uvs.push(side/6*4,ring*height/30);
   if(ring<3&&side<6){const k=ring*7+side;indices.push(k,k+1,k+7,k+1,k+8,k+7);}
  }
  mesh('Hanging fractured basalt / upper vault',p,vertices,indices,{uvs,tex:'spaghetti-basalt',color:'#8b97af'});
 }
 decor('ghostmonsterportal',[0,-2,-2405],[55,55,42],0,'Meshy watching portal / beyond finish');
 for(let i=0;i<6;i++)decor('ghosttrestle',[(i%2?1:-1)*310,310-i*70,-150-i*400],[42,32,130],i%2?30:-30,'Meshy wreck / broken chasm trestle');
 const floorVertices=[0,0,0],floorIndices:number[]=[],floorUvs=[0,0];
 for(let i=0;i<96;i++){
  const a=i/96*Math.PI*2,x=Math.sin(a)*radiusX,z=Math.cos(a)*radiusZ;
  floorVertices.push(x,0,z);floorUvs.push(x/95,z/95);floorIndices.push(0,i+1,(i+1)%96+1);
 }
 mesh('Quagmire / drowned basalt far below',[0,-90,-1120],floorVertices,floorIndices,{uvs:floorUvs,tex:'spaghetti-basalt',color:'#161e20',emissive:'#07100d'});
 data.components.push(...art);
 data.groups=[...(data.groups??[]),{id:ART,nm:'Quagmire Caverns / ironwork and basalt',editorOnly:true}];
 data.atmosphere={backdrop:'fog',fogEnabled:true,fogNear:160,fogFar:700,fogColor:'#242e40',drawDistance:1900,
  ambientSky:'#b9c7e6',ambientGround:'#40514a',ambientIntensity:1.15,
  sunColor:'#b9caff',sunIntensity:1.5,sunDirection:[.5,.8,.24],fillColor:'#c5a374',fillIntensity:.55,shadowStrength:.65,
  heightFog:{height:-5,density:.012,falloff:.025}};
 return data;
}
