import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {mallSourceBoxFixtures,mallSourceBoxInput} from './mall-source-box-fixtures.mjs';
const out=process.env.MALL_BOX_REPORT||'/private/tmp/mall-recreation/measured/source-boxes.json';
const dir='/private/tmp/mall-recreation/box-oracle26';await mkdir(dir,{recursive:true});
const cppSource=await readFile('/private/tmp/mall-recreation/research/decomp/game_src_platform.cpp','utf8');
const vector=await readFile('/private/tmp/mall-recreation/research/decomp/game_src_vector.cpp','utf8');
const flight=cppSource.slice(cppSource.indexOf('\tNewVel = mVel;'),cppSource.indexOf('\n\tNewPos = mPos + NewVel;'));
const impulse=cppSource.match(/mVel.Set\(Direction.vx \+ \(Direction.vx >> 1\)[\s\S]*?\);/)[0];
const kill=vector.match(/void CVector::KillSmall\(\) \{[\s\S]*?\n\}/)[0];
assert.ok(flight.includes('0x8000')&&impulse.includes('-0x50000'));
const cpp=`#include <iostream>\nstruct CFriction{int vx,vy,vz;CFriction(int x=0,int y=0,int z=0):vx(x),vy(y),vz(z){}};
struct CVector{int vx=0,vy=0,vz=0;void Set(int x,int y,int z){vx=x;vy=y;vz=z;}void KillSmall();void operator%=(CFriction f){vx-=vx>>f.vx;vy-=vy>>f.vy;vz-=vz>>f.vz;}};${kill}
int main(){int mode,x,y,z;while(std::cin>>mode>>x>>y>>z){CVector mVel,NewVel,Direction;CFriction Fric;mVel.Set(x,y,z);Direction=mVel;if(mode){${impulse}NewVel=mVel;}else{${flight}}std::cout<<NewVel.vx<<' '<<NewVel.vy<<' '<<NewVel.vz<<'\\n';}}`;
await writeFile(`${dir}/oracle.cpp`,cpp);execFileSync('c++',['-std=c++17','-O2',`${dir}/oracle.cpp`,'-o',`${dir}/oracle`]);
await withBlockworksRuntime(async r=>{
 const {p,l,THREE:T,sourceModule:m}=r,owner=l.sourceProps,report={sourceRevision:'d9319c8d5b42c431de02bec0f02f0cf955f2fbae',sourceSHA256:createHash('sha256').update(cppSource).digest('hex'),fixtures:[]};
 const {sourceBoxImpulse,sourceBoxFlight,SourceBouncyProps}=await r.server.ssrLoadModule('/src/sourceBouncyProps.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(m.MALL_LEVEL),'source level must normalize');
 assert.equal(owner.objects.length,12);assert.ok(owner.objects.every(b=>b.members.length===6));
 const authored=JSON.stringify(l.captureData());
 for(const change of [c=>c.solid=true,c=>c.sourceBox.angles[0]=1,c=>c.sourceBox.bounds[0]=c.sourceBox.bounds[1],c=>c.yaw=0]){
  const data=structuredClone(m.MALL_LEVEL);change(data.components.find(c=>c.sourceBox));assert.equal(normalizeCustomLevelData(data),null);
 }
 const commands=[];let seed=1;
 for(let i=0;i<1000;i++){const v=Array.from({length:3},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed%1000001)-500000;});commands.push([i%2,...v]);}
 for(const v of [-2049,-2048,-1,0,1,2048,2049])commands.push([0,v,v-32768,v]);
 const expected=execFileSync(`${dir}/oracle`,[],{input:commands.map(c=>c.join(' ')).join('\n')+'\n',encoding:'utf8'}).trim().split('\n').map(s=>s.split(' ').map(Number));
 commands.forEach(([mode,...v],i)=>assert.deepEqual(mode?sourceBoxImpulse(v):sourceBoxFlight(v),expected[i]));report.compiledSourceCases=commands.length;
 // Standalone contact-boundary fixture: yaw must not expand the source AABB.
 const fixture=new SourceBouncyProps(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial()),data={id:1,bounds:[26,-24,49,-51,75,-75],angles:[0,512,0]},frame={origin:[0,0,0],axes:[1,-2,-3],unit:.01};
 fixture.add(mesh,data,frame);let hits=0;fixture.onHit=()=>hits++;
 fixture.touch(new T.Vector3(.461,0,0),new T.Vector3(.461,0,0),new T.Vector3(4,0,0));assert.equal(hits,0);
 fixture.touch(new T.Vector3(.46,0,0),new T.Vector3(.46,0,0),new T.Vector3(4,0,0));assert.equal(hits,1);
 fixture.touch(new T.Vector3(),new T.Vector3(),new T.Vector3());assert.equal(hits,1);fixture.reset(true);
 fixture.touch(new T.Vector3(-5,0,0),new T.Vector3(5,0,0),new T.Vector3(4,0,0));assert.equal(hits,2);
 const floor=new T.Mesh(new T.BoxGeometry(100,1,100),new T.MeshBasicMaterial());floor.position.y=-1.01;floor.updateMatrixWorld();
 for(let i=0;i<1200;i++)fixture.update(1/60,[floor],-40);
 const body=fixture.objects[0];assert.ok(body.hidden&&body.bounces>=19);assert.ok(body.current.toArray().every(Number.isFinite));
 report.contact={unrotatedBounds:true,inclusiveBoundary:true,sweptCrossing:true,firstHitOnly:true,bounces:body.bounces,retired:body.hidden};
 fixture.dispose();mesh.geometry.dispose();mesh.material.dispose();floor.geometry.dispose();floor.material.dispose();
 const touch=owner.touch.bind(owner),tuning=JSON.stringify(r.TUNING);
 for(const f of mallSourceBoxFixtures){
  const q=m.mallPoint(...f.start);q[1]=m.mallSupport(q[0],q[2],q[1]+5)+.1;assert.ok(Number.isFinite(q[1]),f.name);
  const heading=new T.Vector3(...f.heading),runs=[];let contacts=[];
  for(const enabled of [false,true]){
   owner.touch=enabled?touch:()=>{};p.respawn(l,true,false,{position:new T.Vector3(...q),heading});p.axisF.copy(heading);p.axisL.set(-heading.z,0,heading.x);
   const trace=[];let bail=false;const seen=new Set();
   for(let i=0;i<f.frames;i++){
    const speed=p.speed;r.tick(mallSourceBoxInput(p,m,f));bail||=p.isBailing;
    trace.push([p.pos.x,p.pos.y,p.pos.z,p.speed,p.state]);
    if(enabled)for(const box of owner.objects)if(box.hit&&!seen.has(box.data.id)){seen.add(box.data.id);contacts.push({id:box.data.id,frame:i,speedBefore:speed,speedAfter:p.speed,position:box.current.toArray()});}
   }
   assert.equal(bail,false,f.name);assert.ok(p.grounded&&p.state==='ride',f.name);runs.push(trace);
  }
  assert.equal(JSON.stringify(runs[0]),JSON.stringify(runs[1]),'Loose props must not alter any skater frame');
  assert.ok(contacts.length>=f.minimumHits);if(f.minimumHits)assert.deepEqual(contacts.map(c=>c.id),[520,514]);if(!f.minimumHits)assert.equal(contacts.length,0);
  const hitIds=owner.objects.filter(b=>b.hit).map(b=>b.data.id);
  assert.equal(JSON.stringify(l.captureData()),authored,'Playing must not rewrite authored box poses');
  for(let i=0;i<900;i++)l.update(1/60);
  assert.ok(owner.objects.every(b=>!b.hit||b.hidden),'Props must retire without an endless simulation');
  l.reset(false);assert.deepEqual(owner.objects.filter(b=>b.hit).map(b=>b.data.id),hitIds);
  l.reset(true);assert.ok(owner.objects.every(b=>!b.hit&&b.members.every(m=>m.mesh.visible)));
  report.fixtures.push({name:f.name,frames:f.frames,contacts,hitIds,movementIdentical:true,supportedRollout:true,finiteRetirement:true,trace: runs[1]});
 }
 owner.touch=touch;assert.equal(JSON.stringify(r.TUNING),tuning);report.tuningUnchanged=true;report.softResetKeepsProgress=true;report.hardResetRestoresAll=true;report.authoredDataPreserved=true;
 await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,fixtures:report.fixtures.map(({trace,...f})=>f)}));
},{modulePath:'/src/levels/mall-measured.ts',source:m=>m.MALL_LEVEL,levelId:'mall',endlessDeaths:true,maxFrames:1500,controlFrame:r=>r.p.axisF});
