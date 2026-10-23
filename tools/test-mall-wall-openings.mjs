import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {p,l,THREE:T,sourceModule:m}=r,tuning=JSON.stringify(r.TUNING),fixtures=[];
 const occupied=(q)=>m.MALL_WALLS.some(w=>{
  const dx=w.b[0]-w.a[0],dz=w.b[2]-w.a[2],d=dx*dx+dz*dz,t=((q[0]-w.a[0])*dx+(q[2]-w.a[2])*dz)/d;
  if(t<0||t>1)return false;
  const y=w.a[1]+(w.b[1]-w.a[1])*t;
  return Math.abs((q[0]-w.a[0])*dz-(q[2]-w.a[2])*dx)/Math.sqrt(d)<.055&&q[1]>=y&&q[1]<=y+(w.heights?w.heights[0]+(w.heights[1]-w.heights[0])*t:w.height);
 });
 const survey=JSON.parse(await readFile(new URL('../docs/mall/source-survey.json',import.meta.url),'utf8'));
 const sourceFaces=new Map(survey.meshes.map(mesh=>[mesh.id,Array.from({length:mesh.indices.length/3},(_,i)=>({flag:mesh.flags[i],points:mesh.indices.slice(i*3,i*3+3).map(v=>m.mallPoint(...mesh.vertices.slice(v*3,v*3+3)))})).filter(f=>!(f.flag&16))]));
 let polygonSamples=0,profileWalls=0;
 for(const w of m.MALL_WALLS.filter(w=>w.heights)){
  profileWalls++;
  const dx=w.b[0]-w.a[0],dz=w.b[2]-w.a[2],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
  const project=p=>[(p[0]-w.a[0])*ux+(p[2]-w.a[2])*uz,p[1]];
  const triangles=sourceFaces.get(w.source).filter(f=>f.points.every(p=>Math.abs((p[0]-w.a[0])*uz-(p[2]-w.a[2])*ux)<.006)).map(f=>f.points.map(project));
  const inside=(p,f)=>{const[a,b,c]=f,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(den)<1e-9)return false;const u=((b[1]-c[1])*(p[0]-c[0])+(c[0]-b[0])*(p[1]-c[1]))/den,v=((c[1]-a[1])*(p[0]-c[0])+(a[0]-c[0])*(p[1]-c[1]))/den;return u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6;};
  for(const t of [.05,.25,.5,.75,.95])for(const v of [.05,.5,.95]){
   const y=w.a[1]+(w.b[1]-w.a[1])*t+v*(w.heights[0]+(w.heights[1]-w.heights[0])*t);
   assert.ok(triangles.some(f=>inside([t*length,y],f)),`Profile wall fills a source opening: ${w.source} ${t} ${v}`);polygonSamples++;
  }
 }
 const samples=[];
 for(const y of [610,650,700,750,800])for(const z of [345,370,405]){
  const point=[-8926.943359375,y,z],solid=occupied(m.mallPoint(...point));samples.push({point,solid});assert.equal(solid,false,'Source fountain opening must remain open');
 }
 for(const y of [550,565,580,840,860])assert.ok(occupied(m.mallPoint(-8926.943359375,y,370)),'Source sill/lintel must remain solid');
 for(const headingSign of [1,-1]){
  const q=m.mallPoint(-8650,591,370);q[1]=m.mallSupport(q[0],q[2],q[1]+.4)+.1;
  const heading=new T.Vector3(0,0,headingSign);p.respawn(l,true,false,{position:new T.Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
  const e={name:headingSign===1?'Fountain front exit':'Fountain rear exit',frames:0,bail:false,passageFrames:0,groundedAfterExit:0,trace:[]};
  for(let i=0;i<900;i++){
   r.tick({moveY:1,jumpHeld:true});const s=m.mallSourcePoint(...p.pos.toArray());e.frames++;e.bail||=p.isBailing;
   if(s[0]>-8920&&s[0]<-8360&&s[1]>580&&s[1]<620)e.passageFrames++;
   const beyond=headingSign===1?s[0]<-9140:s[0]>-8130;
   if(beyond&&p.grounded)e.groundedAfterExit++;
   if(i%6===0||e.bail)e.trace.push({frame:i,source:s,speed:p.speed,state:p.state,ground:p.groundHit?.name});
   if(e.bail||p.state==='dead'||e.groundedAfterExit>=15){e.end=s;e.state=p.state;break;}
  }
  e.reached=e.groundedAfterExit>=15;fixtures.push(e);console.log(JSON.stringify({...e,trace:undefined}));
 }
 const out={profileWalls,polygonSamples,openingPatches:m.MALL_WALL_OPENINGS,scale:m.MALL_SCALE,components:m.MALL_LEVEL.components.length,stats:m.MALL_SURVEY_STATS,samples,fixtures,tuningUnchanged:tuning===JSON.stringify(r.TUNING)};
 await writeFile('/private/tmp/mall-recreation/measured/wall-openings.json',JSON.stringify(out,null,2));
 assert.ok(out.tuningUnchanged);assert.ok(fixtures.every(f=>f.reached&&!f.bail&&f.passageFrames>50));
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:2400,controlFrame:r=>r.p.axisF});
