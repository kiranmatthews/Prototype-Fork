import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const options={modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1}};
const report={inventory:null,support:0,voids:0};
await withBlockworksRuntime(async r=>{
 const m=r.sourceModule,{normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(structuredClone(r.source)),'course fits the editable component contract');
 const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
 assert.deepEqual(pack.levels.find(l=>l.id==='custard-creek').data,JSON.parse(JSON.stringify(r.source)));
 const authoring=await readFile(new URL('../src/levels/custard-creek.ts',import.meta.url),'utf8');
 assert.ok(!/import.*(?:carlisle|original-course)/i.test(authoring),'the independent course has no Carlisle geometry dependency');
 assert.ok(!r.source.components.some(c=>/Creek encounter \d|Test Course|Carlisle/.test(c.nm??'')),'no inherited encounter identities');
 assert.equal(m.CUSTARD_CREEK_SECTIONS.length,8);
 assert.deepEqual(m.CUSTARD_CREEK_SECTIONS.map(s=>s.mechanic),['crusher timing','two banks and broken spans','ascending rail bridge','downhill halfpipe','offset jumps and crumbling arc','moving ferry and island routes','downhill carving and rolling hazards','pendulum approach and final rail bridge']);
 const bounds=m.CUSTARD_CREEK_CAMERA.map(p=>[p[0],p[2]]),xs=bounds.map(p=>p[0]),zs=bounds.map(p=>p[1]);
 assert.ok(Math.max(...xs)-Math.min(...xs)>650,'folded course has a broad horizontal footprint');
 assert.ok(Math.max(...zs)-Math.min(...zs)<850,'course is not Carlisle\'s long northward corridor');
 let reversals=0,last=0;for(let s=0;s<m.CUSTARD_CREEK_END;s+=8){const z=m.custardTangent(s)[2];if(Math.abs(z)<.35)continue;const sign=Math.sign(z);if(last&&sign!==last)reversals++;last=sign;}assert.ok(reversals>=3,'travel turns back along the creek at least three times');
 assert.ok(m.custardHeight(850)>17&&m.custardHeight(2100)<-9,'early ascent hands into a long descent');
 report.inventory=m.CUSTARD_CREEK_GAMEPLAY;assert.equal(report.inventory.gate,1);assert.ok(report.inventory.enemy>=10&&report.inventory.crusher===2&&report.inventory.mover===2&&report.inventory.stone===3);
 assert.ok(r.l.laneActive);r.stepFor(20);assert.ok(r.p.grounded,'supported spawn');
 const ray=new r.THREE.Raycaster(),down=new r.THREE.Vector3(0,-1,0);
 const floor=(p,far=3,meshes=r.l.groundMeshes)=>{ray.set(new r.THREE.Vector3(p[0],p[1]+.18,p[2]),down);ray.far=far;return ray.intersectObjects(meshes,false)[0];};
 const fail=[];
 for(const c of r.source.components.filter(c=>c.t==='crate'||c.t==='checkpoint')) {
  const hit=floor(c.p),stacked=r.source.components.some(b=>b!==c&&b.t==='crate'&&Math.abs(b.p[0]-c.p[0])<.01&&Math.abs(b.p[2]-c.p[2])<.01&&Math.abs(c.p[1]-b.p[1]-.96)<.015);
  if(!stacked&&(!hit||Math.abs(hit.point.y-c.p[1])>.19))fail.push({name:c.nm,p:c.p,hit:hit?.point.y});report.support++;
 }
 assert.deepEqual(fail,[],'authored boxes and restarts meet actual supporting geometry');
 const staticFloors=r.l.groundMeshes.filter(o=>!['mover','crumble'].includes(r.source.components[o.userData.editorIdx]?.t));
 for(const name of ['Broken crown aqueduct','First sluice jump','Second sluice jump','Moving ferry channel','Final backwater rail crescent']){
  const g=m.CUSTARD_CREEK_GAPS.find(g=>g.name===name),p=m.custardPoint((g.a+g.b)/2,m.custardHeight((g.a+g.b)/2),g.u);assert.equal(floor(p,2,staticFloors),undefined,`${name} stays a real void`);report.voids++;
 }
 let challenged=false;
 for(let i=0;i<1200;i++){r.tick({moveY:1,jumpHeld:true});if(r.p.isBailing||['dead','gameover','grind'].includes(r.p.state)||!r.p.grounded&&r.p.vVel< -4){challenged=true;break;}}
 assert.ok(challenged,'a single held skating input meets real gameplay');
 report.reversals=reversals;report.bounds={width:Math.max(...xs)-Math.min(...xs),depth:Math.max(...zs)-Math.min(...zs)};
 await writeFile('/private/tmp/custard-gameplay-structure.json',JSON.stringify(report,null,2));
},options);
console.log(JSON.stringify(report,null,2));
