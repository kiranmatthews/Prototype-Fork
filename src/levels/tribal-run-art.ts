import {BufferGeometry,CylinderGeometry,Matrix4,Quaternion,SphereGeometry,TorusGeometry,Vector3} from 'three';
import type {CustomComponent,CustomLevelData,DecorKind} from '../level';
import {tribalPoint as at,tribalYaw as yaw,tribalValue as value,tribalMix as mix,type TribalScalar,type TribalPoint as P} from './tribal-run-route';

type Road={a:number;b:number;top:TribalScalar;width:TribalScalar;offset:TribalScalar;name:string};
type Step={a:number;b:number;top:number;u:number;name:string};
type Course={roads:Road[];steps:Step[];checkpoints:{s:number;y:number;u:number;name:string}[]};
const JADE='#347e75',GOLD='#e4b95d',IVORY='#eee0ae';
const noise=(n:number)=>{const v=Math.sin(n*12.9898+4.719)*43758.5453;return v-Math.floor(v);};

/** All added pieces are scenery, outside the playing surface or below it.
 * Full Meshy geometry shares the existing instancing/streaming pipeline. */
function kit(data:CustomLevelData){
 const put=(c:CustomComponent)=>{data.components.push({...c,solid:false,scenerySolid:false,edgeGrinding:false,grp:c.grp??101});};
 // Keep every triangle and silhouette, while avoiding long floating-point
 // tails in editable JSON. One micrometre is below render/physics precision;
 // the original gameplay meshes are not rounded or changed here.
 const compact=(values:number[])=>values.map(v=>Math.round(v*1e6)/1e6);
 const mesh=(nm:string,p:P,vertices:number[],indices:number[],color:string,tex='solid',extra:Partial<CustomComponent>={})=>
  put({t:'mesh',p,vertices:compact(vertices),indices,color,tex,nm,...extra,
   ...(extra.normals?{normals:compact(extra.normals)}:{}),...(extra.uvs?{uvs:compact(extra.uvs)}:{})});
 const geom=(nm:string,p:P,g:BufferGeometry,color:string,tex='solid',extra:Partial<CustomComponent>={})=>{
  const a=g.attributes;mesh(nm,p,Array.from(a.position.array),g.index?Array.from(g.index.array):Array.from({length:a.position.count},(_,i)=>i),color,tex,
   {...(a.normal?{normals:Array.from(a.normal.array)}:{}),...(a.uv?{uvs:Array.from(a.uv.array)}:{}),...extra});g.dispose();
 };
 const prop=(kind:DecorKind,p:P,s:P,yaw=0,color='#ffffff',nm='Festival garden · existing Meshy asset',grp=102)=>
  put({t:'decor',dkind:kind,p,s,yaw,color,nm,grp});
 const beam=(nm:string,a:P,b:P,w=.2,color=IVORY)=>{
  const from=new Vector3(...a),to=new Vector3(...b),d=to.clone().sub(from),g=new CylinderGeometry(w/2,w/2,d.length(),10);
  g.applyMatrix4(new Matrix4().compose(from.add(to).multiplyScalar(.5),new Quaternion().setFromUnitVectors(new Vector3(0,1,0),d.normalize()),new Vector3(1,1,1)));
  geom(nm,[0,0,0],g,color,'wood');
 };
 const panel=(nm:string,p:P,w:number,h:number,angle:number,tex:string,color='#ffffff')=>
  mesh(nm,p,[-w/2,0,0,w/2,0,0,w/2,h,0,-w/2,h,0],[0,1,2,0,2,3],color,tex,
   {uvs:tex==='tribal-weave'?[0,0,w/3.2,0,w/3.2,h/3.2,0,h/3.2]:[0,0,1,0,1,1,0,1],yaw:angle,doubleSided:true,grp:104});
 const banner=(p:P,w:number,h:number,angle:number)=>{
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],nx=8,ny=10;
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
   const u=i/nx,v=j/ny;vertices.push((u-.5)*w,v*h-.3*(1-v)*Math.sin(Math.PI*u),.2*Math.sin(u*Math.PI)*Math.sin(v*Math.PI*1.7));uvs.push(u,v);
   if(i<nx&&j<ny){const a=j*(nx+1)+i,b=a+nx+1;indices.push(a,a+1,b+1,a,b+1,b);}
  }
  mesh('Handwoven festival banner',p,vertices,indices,'#ffffff','tribal-weave',{uvs,yaw:angle,doubleSided:true,grp:104});
 };
 const gong=(p:P,r:number,angle:number)=>{
  const q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),angle*Math.PI/180),local=(x:number,y:number,z:number)=>new Vector3(x,y,z).applyQuaternion(q).add(new Vector3(...p)).toArray() as P;
  geom('Great sun drum · bronze body',p,new CylinderGeometry(r,r,.55,72).rotateX(Math.PI/2),GOLD,'tribal-sunstone',{yaw:angle,grp:104});
  for(const [radius,tube,color,z]of [[r,.22,IVORY,.35],[r*.86,.12,JADE,.37],[r*.58,.09,IVORY,.39],[r*.35,.12,JADE,.42]] as [number,number,string,number][])
   geom('Great sun drum · raised concentric bead',local(0,0,z),new TorusGeometry(radius,tube,10,72),color,'solid',{yaw:angle,grp:104});
  geom('Great sun drum · central boss',local(0,0,.5),new SphereGeometry(r*.18,24,16).scale(1,1,.3),IVORY,'tribal-sunstone',{yaw:angle,grp:104});
  for(let i=0;i<16;i++){
   const a=i/16*Math.PI*2;
   geom('Great sun drum · hand-set rim stud',local(Math.cos(a)*r*.75,Math.sin(a)*r*.75,.37),new SphereGeometry(r*.026,10,8),IVORY,'solid',{grp:104});
  }
  for(const side of [-1,1]){
   const foot=local(side*(r+1.8),-p[1]-8,0);
   prop('stonebase',foot,[3.4,1.2,3.4],angle,'#d6c8a1','Sun-drum frame · Meshy carved foot',104);
   const height=p[1]+r+9.8;
   for(let y=1.2;y<height;y+=4.5)prop('stoneshaft',[foot[0],foot[1]+y,foot[2]],[1.6,Math.min(4.5,height-y),1.6],angle,'#b9c3a3','Sun-drum frame · carved shaft',104);
   beam('Sun-drum suspension',local(side*r*.65,r*.74,.1),local(side*r*.65,r+1.8,.1),.15);
  }
  beam('Sun-drum broad crossbeam',local(-r-2,r+1.8,0),local(r+2,r+1.8,0),.65,'#85613d');
 };
 return{put,mesh,geom,prop,beam,panel,banner,gong};
}

export function dressTribalRun(data:CustomLevelData,course:Course):void{
 const k=kit(data),base=[...data.components];
 data.jungleStyle='painterly';data.jungleDepthFade=false;
 data.atmosphere={fogEnabled:true,fogNear:90,fogFar:255,fogColor:'#b9d7c6',backdrop:'fog',
  ambientSky:'#d9ece0',ambientGround:'#80745b',ambientIntensity:1.25,
  sunColor:'#fff0d2',sunIntensity:1.85,sunDirection:[-.7,.8,.3],fillColor:'#98d4cf',fillIntensity:.46,drawDistance:340,shadowStrength:.72};
 data.groups??=[];for(const [id,nm]of [[101,'Drum-road rims and woven skirts'],[102,'Meshy lagoon gardens'],[103,'Lagoon and deep foundations'],[104,'Sun drums and festival cloth'],[105,'Woven bridge structure']] as [number,string][])
  data.groups.push({id,nm,editorOnly:true});
 for(const c of base){
  if(c.t==='pit')c.invisible=true;
  if(c.t==='mesh'){
   c.tex=c.nm?.startsWith('Canopy loom')?'treehouse-timber':'tribal-sunstone';c.color='#e8e6d4';
   if(c.normals){c.colors=[];for(let i=0;i<c.normals.length;i+=3){const top=c.normals[i+1]>.6;c.colors.push(...(top?[1,1,1]:[.61,.73,.66]));}}
  }
  if(c.t==='vertramp'){c.tex='tribal-sunstone';c.color='#d8f0df';}
  if(c.t==='crumble'){c.tex='treehouse-timber';c.color='#e4c58d';}
  if(c.t==='rail')c.color='#e7ba61';
 }
 // A quiet jade lagoon makes gaps legible while the original pit remains
 // the sole reset surface. The water adds no swim or collision volume.
 const pit=base.find(c=>c.t==='pit')!,width=pit.s![0]+160,depth=pit.s![2]+160;
 k.mesh('Deep jade beneath the translucent lagoon',[pit.p[0],-12.1,pit.p[2]],[-width/2,0,-depth/2,width/2,0,-depth/2,width/2,0,depth/2,-width/2,0,depth/2],
  [0,2,1,0,3,2],'#21685d','solid',{castShadow:false,grp:103});
 k.mesh('Jade lagoon beneath the drum road',[pit.p[0],-10.92,pit.p[2]],[-width/2,0,-depth/2,width/2,0,-depth/2,width/2,0,depth/2,-width/2,0,depth/2],
  [0,2,1,0,3,2],'#338d7b','custard-water',{materialStyle:'jungle-stream',opacity:.78,uvs:[0,0,40,0,40,80,0,80],doubleSided:true,castShadow:false,grp:103});

 // Apply a fitted skirt to the existing curved outline, including every
 // swollen drum shoulder. It never covers a takeoff or raises a ride face.
 for(const r of course.roads){
  const woven=r.name.startsWith('Canopy loom'),drum=course.steps.some(s=>s.a===r.a);
  const n=Math.ceil((r.b-r.a)/.3),origin=at(r.a,0),bandTop=woven?-.15:drum?-.5:-.32,bandBottom=woven?-.63:drum?-2.05:-.72;
  for(const side of [-1,1]){
   const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
   for(let i=0;i<=n;i++){
    const s=mix(r.a,r.b,i/n),y=value(r.top,s),u=value(r.offset,s)+side*(value(r.width,s)/2+.08);
    for(const dy of [bandTop,bandBottom]){const p=at(s,y+dy,u);vertices.push(p[0]-origin[0],p[1],p[2]-origin[2]);uvs.push((s-r.a)/(drum?3.2:8),(dy-bandBottom)/(drum?3.2:bandTop-bandBottom));}
    if(i<n){const a=i*2;indices.push(a,a+1,a+3,a,a+3,a+2);}
   }
   k.mesh(drum?'Woven skin around the drum crown':'Inlaid causeway edge',origin,vertices,indices,drum?'#ffffff':woven?IVORY:GOLD,drum?'tribal-weave':'solid',{uvs,doubleSided:true});
   if(drum)for(let s=r.a+.6;s<r.b;s+=2.7){
    const u=value(r.offset,s)+side*(value(r.width,s)/2+.06),next=Math.min(r.b-.15,s+1.3);
    k.beam('Drum skirt tension cord',at(s,value(r.top,s)-.2,u),at(next,value(r.top,next)-3.8,value(r.offset,next)+side*(value(r.width,next)/2+.06)),.075,IVORY);
   }
  }
  if(drum)for(const end of [r.a,r.b]){
   const outward=end===r.a?-.055:.055;
   k.panel('Woven wrap around the drum landing face',at(end+outward,value(r.top,end)+bandBottom,value(r.offset,end)),value(r.width,end),bandTop-bandBottom,yaw(end),'tribal-weave');
  }
  // Piers sit beneath solid road only; no foundation spans a deliberate gap.
  if(!woven&&r.name!=='Offbeat recovery court'&&r.b-r.a>24)for(let s=r.a+10;s<r.b-6;s+=34){
   const y=value(r.top,s),u=value(r.offset,s),w=Math.min(14,value(r.width,s)-.8);
   k.prop('coastv2ledge',at(s,-15,u),[w,Math.max(4,y+10.1),Math.min(20,r.b-r.a-1)],yaw(s),'#b1b89b','Meshy deep footing beneath the solid causeway',103);
  }
 }
 for(const s of course.steps){
  const station=(s.a+s.b)/2;
  k.prop('coastv2ledge',at(station,-13,s.u),[10.8,s.top+8.2,Math.max(8,s.b-s.a-1)],yaw(station),'#a3b79a','Rooted stone drum pedestal',103);
  for(const side of [-1,1])k.prop('stonefrieze',at(station,s.top-3.8,s.u+side*5.3),[3.1,1.6,.4],yaw(station)+side*90,'#d8c999','Carved relief on the drum body');
 }

 // Generous outer islands stay beyond jump range. Clear water separates
 // scenery from the playable edge; trees never become hidden obstacles.
 for(let s=10,i=0;s<2340;s+=42,i++)for(const side of [-1,1]){
  const across=side*(45+noise(i+side)*14),p=at(s,-14,across),height=16+noise(i+12)*9;
  k.prop(i%3?'coastv2buttress':'coastcliff',p,[24+noise(i)*7,height,25],yaw(s)+side*(60+noise(i+4)*30),'#b1bf9c','Meshy island above the lagoon',103);
  const foot=at(s,height-15.3,across);
  if(i%3===0)k.prop('trialsv2treeb',foot,[26,24,21],yaw(s)+i*31,'#b7d1a0','Full Meshy broad-canopy island tree');
  else k.prop('junglepalmtree',foot,[13,17+noise(i+8)*5,13],yaw(s)+i*29,'#d4dfab','Full Meshy lagoon palm');
  k.prop('junglefern',at(s+4,height-15,across-side*5),[6.2,3.2,5.5],yaw(s)+side*26,'#c2dda7','Lagoon fern crown');
  if(i%2===0)k.prop('coastfoliage',at(s-5,height-15,across+side*4),[5,2,5],yaw(s),'#e2bca5','Coral foliage among the jade leaves');
 }
 // Lower, smaller islets bring detail into the foreground without pretending
 // to be connected to the road or obscuring the next landing.
 for(let s=44,i=0;s<2300;s+=96,i++)for(const side of [-1,1]){
  const u=side*(23+noise(i)*4);
  k.prop('coastbeachrock',at(s,-10.9,u),[12,5.8,10],yaw(s)+i*17,'#c6c6a1','Low water-worn lagoon islet',103);
  k.prop('jungleleaf',at(s,-5.5,u),[7,4.4,6],yaw(s)+side*40,'#c5dfaa','Broadleaf islet planting');
 }

 // Each restart has a pair of small carved markers and cloth visible from
 // its approach. Their feet are outside the supported road, with clear air
 // above the existing surface-edge grind lines.
 for(const cp of course.checkpoints){
  const road=course.roads.filter(r=>cp.s>=r.a&&cp.s<=r.b).sort((a,b)=>value(b.top,cp.s)-value(a.top,cp.s))[0];
  const edge=road?value(road.width,cp.s)/2:9;
  for(const side of [-1,1]){
   const u=side*(edge+3.8),p=at(cp.s,cp.y-7.8,u);
   k.prop('coastpillar',p,[2.2,17,2.1],yaw(cp.s)+side*12,'#e8d6a5','Carved checkpoint drum marker',104);
   k.banner(at(cp.s,cp.y+1.8,u),2.5,5.6,yaw(cp.s));
  }
 }
 // Timber trestles beneath the woven deck retain the actual open underside.
 // The crossover itself is a clear span: no diagonal brace passes through
 // the lower route's walking volume or its camera sightline.
 for(const s of [1128,1150,1180,1275]){
  const r=course.roads.find(r=>r.name.includes('upper')&&s>=r.a&&s<=r.b);if(!r)continue;
  const top=value(r.top,s),u=value(r.offset,s);
  for(const side of [-1,1]){
   k.prop('stoneshaft',at(s,-10,u+side*4.2),[.9,Math.max(1,top+9),.9],yaw(s),'#c8b47a','Woven bridge trestle outside its edge',105);
   k.beam('Bridge cross brace',at(s,-8,u+side*4.2),at(s,top-.9,u-side*2.5),.22,'#a88b57');
  }
 }
 for(const [s,u]of [[1175,-29],[1238,30]])k.prop('trialsv2crownb',at(s,17,u),[42,13,32],yaw(s),'#b4cfa1','High canopy over the woven crossing');

 // Three destination compositions are deliberately larger than the repeated
 // verge pieces: entry procession, great court, and the final sun-drum stage.
 k.prop('coastarch',at(-14,-1),[27,17,9],yaw(0),'#ead4a2','Festival entrance · full Meshy gateway',104);
 k.gong(at(985,7.7,-25),7,yaw(985)+22);
 k.gong(at(2308,7.7,24),6.5,yaw(2308)-28);
 for(const [s,u]of [[88,-31],[963,31],[1618,-32],[2280,-31]]){
  k.prop('trialsv2porchhut',at(s,-.8,u),[12,8.2,10.5],yaw(s)+(u>0?-75:75),'#eddbb3','Meshy festival musicians pavilion',104);
  k.prop('coastv2buttress',at(s,-14,u),[17,13.4,15],yaw(s),'#b8bda1','Pavilion island foundation',103);
  k.banner(at(s+2,3.8,u),4.8,3.2,yaw(s));
 }
 // A fresco behind the bonus stone makes the optional detour visible from
 // both court routes, while preserving its jump-on entrance and return point.
 k.panel('Resonance Vault entrance fresco',at(986,2.1,14.8),6,4,yaw(986),'tribal-fresco');
 for(const u of [11.7,17.9])k.prop('stonecapital',at(986,6,u),[1.1,1,1.2],yaw(986),'#ddc792','Bonus fresco frame');
}

export function dressTribalBonus(data:CustomLevelData):void{
 const k=kit(data),base=[...data.components];
 data.jungleStyle='painterly';data.jungleDepthFade=false;
 data.atmosphere={backdrop:'fog',fogEnabled:true,fogNear:45,fogFar:135,fogColor:'#254c4d',ambientSky:'#b8ded5',ambientGround:'#6c614c',
  ambientIntensity:1.35,sunColor:'#ffe0a0',sunIntensity:1.7,sunDirection:[-.4,.8,.5],fillColor:'#9cd7d2',fillIntensity:.45,drawDistance:180,shadowStrength:.65};
 data.groups??=[];data.groups.push({id:101,nm:'Vault drum skins',editorOnly:true},{id:102,nm:'Meshy sanctuary architecture',editorOnly:true},
  {id:103,nm:'Quiet jade pool',editorOnly:true},{id:104,nm:'Generated resonance fresco and cloth',editorOnly:true});
 for(const c of base){
  if(c.t==='pit')c.invisible=true;
  if(c.t==='platform'){c.tex='tribal-sunstone';c.color=c.outline?'#d8e8ce':'#eee0bd';}
  if(c.t==='crumble'){c.tex='treehouse-timber';c.color='#e1bc7d';}
  if(c.t==='trampoline'){
   c.color='#d9b765';
   const [x,y,z]=c.p;
   k.mesh('Resonance drum · taut golden skin',[x,y+.012,z],[-3,0,-3.5,3,0,-3.5,3,0,3.5,-3,0,3.5],[0,2,1,0,3,2],IVORY,'tribal-sunstone',
    {uvs:[0,0,1.5,0,1.5,1.75,0,1.75]});
   for(const r of [1.3,2.35])k.geom('Resonance drum · inlaid bounce rings',[x,y+.025,z],new TorusGeometry(r,.035,8,48).rotateX(Math.PI/2),JADE);
   k.panel('Resonance drum · woven apron',[x,y-.7,z+3.51],6,.58,0,'tribal-weave');
  }
  if(c.t==='platform'&&c.s&&!c.outline){
   const top=c.p[1]+c.s[1]/2;
   k.panel('Woven drum body below the playable cap',[c.p[0],top-1.9,3.51],c.s[0],1.35,0,'tribal-weave');
   k.beam('Ivory drum rim',[c.p[0]-c.s[0]/2,top-.12,3.53],[c.p[0]+c.s[0]/2,top-.12,3.53],.18,IVORY);
  }
 }
 k.mesh('Still vault water',[50,-5.92,0],[-85,0,-30,85,0,-30,85,0,20,-85,0,20],[0,2,1,0,3,2],'#287e78','custard-water',
  {materialStyle:'jungle-stream',uvs:[0,0,25,0,25,8,0,8],doubleSided:true,castShadow:false,grp:103});
 for(let x=-13;x<=127;x+=28){
  k.panel('Painted resonance sanctuary wall',[x,0,-11],28,18.67,0,'tribal-fresco','#d4e0c7');
  for(const z of [-12.2,-8.8]){
   k.prop('stonebase',[x-14,-4.9,z],[3.6,1.3,3.6],0,'#b4bd9e','Meshy vault column foot');
   for(let y=-3.6;y<20;y+=4.5)k.prop('stoneshaft',[x-14,y,z],[1.65,4.5,1.65],0,'#b8c4a6','Meshy vault column shaft');
   k.prop('stonecapital',[x-14,20,z],[3.3,1.3,3.3],0,'#d7cca0','Meshy vault column crown');
  }
  k.prop('stonelintel',[x,21,-10.5],[28,1.4,3.4],0,'#bbc5a4','Meshy sanctuary roof lintel');
  k.banner([x-12,10,-8.1],2.5,7.7,0);
 }
 k.gong([35,13.2,-8],4.5,0);
 for(const x of [-12,17,42,92,115]){
  k.prop('junglefern',[x,-.5,-5.8],[5,3,4],x*11,'#a6c9a6','Ferns in the sanctuary alcove');
  k.prop('stonebase',[x,-1,-5.8],[5,1,4],0,'#9cae93','Meshy alcove planter');
 }
 for(let x=-6;x<120;x+=12){
  k.beam('Hanging lantern cord',[x,18,-5],[x,14.1,-5],.05,GOLD);
  k.geom('Warm sanctuary lantern',[x,13.6,-5],new SphereGeometry(.42,12,10).scale(1,1.4,1),GOLD,'solid',{emissive:'#69451d',grp:104});
  k.geom('Lantern ivory collar',[x,14.13,-5],new TorusGeometry(.23,.055,8,16).rotateX(Math.PI/2),IVORY,'solid',{grp:104});
 }
}
