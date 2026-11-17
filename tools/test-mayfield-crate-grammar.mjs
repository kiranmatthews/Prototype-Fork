import assert from 'node:assert/strict';import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.MAYFIELD_CRATE_OUTPUT??'/tmp/mayfield-crate-review';await mkdir(out,{recursive:true});const report={harvests:[],enemies:[],maxFloorError:0};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,source}=r,before=process.env.MAYFIELD_CRATE_BASELINE?JSON.parse(await readFile(process.env.MAYFIELD_CRATE_BASELINE,'utf8')):null;
 if(before){assert.ok(JSON.stringify(source.components.filter(c=>!['crate','enemy'].includes(c.t)))===JSON.stringify(before.components.filter(c=>!['crate','enemy'].includes(c.t))),'serialized non-crate geometry preserved');
 assert.deepEqual(Object.fromEntries(Object.entries(source).filter(([k])=>!['components','groups'].includes(k))),Object.fromEntries(Object.entries(before).filter(([k])=>!['components','groups'].includes(k))));
 }
 assert.equal(l.crates.length,110);assert.equal(l.totalCrates,138);assert.equal(l.bonusCrateTotal,18);assert.equal(l.enemies.length,3);
 await writeFile(out+'/after-source.json',JSON.stringify(source));
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),name=b=>source.components[b.mesh.userData.editorIdx].nm;
 for(let index=0;index<22;index++){
  p.respawn(l,true);r.stepFor(1);const prefix=`Section ${Math.floor(index/2)+1} · ${index%2?'receiving':'dispatch'} supplies`,boxes=l.crates.filter(b=>name(b).startsWith(prefix));assert.equal(boxes.length,5);
  const base=Math.min(...boxes.map(b=>b.box.min.y));
  for(const b of boxes.filter(b=>Math.abs(b.box.min.y-base)<.03))for(const x of [b.box.min.x+.02,b.box.max.x-.02])for(const z of [b.box.min.z+.02,b.box.max.z-.02]){ray.set(new THREE.Vector3(x,base+1,z),down);ray.far=3;const hit=l.raycastGround(ray)[0];assert.ok(hit,prefix+' floor');const error=Math.abs(hit.point.y-base);assert.ok(error<.13,prefix+' floor error '+error);report.maxFloorError=Math.max(report.maxFloorError,error);}
  const centre=boxes.reduce((v,b)=>v.add(b.mesh.position),new THREE.Vector3()).divideScalar(boxes.length);centre.y=base;
  // Start on the independently cleared main route, not beyond a possible
  // intervening source wall beside the delivery.
  const path=r.sourceModule.MAYFIELD_ROUTE;let q,best=Infinity;
  for(let i=1;i<path.length;i++){
   const a=new THREE.Vector3().fromArray(path[i-1]),delta=new THREE.Vector3().fromArray(path[i]).sub(a),t=Math.max(0,Math.min(1,centre.clone().sub(a).dot(delta)/delta.lengthSq())),candidate=a.addScaledVector(delta,t),distance=candidate.distanceTo(centre);
   if(distance<best){q=candidate;best=distance;}
  }
  const dir=l.cameraDirAt(q.x,q.y,q.z),heading=new THREE.Vector3(dir?.x??0,0,dir?.z??-1).normalize();
  ray.set(q.clone().add(new THREE.Vector3(0,3,0)),down);ray.far=6;const hit=l.raycastGround(ray)[0];assert.ok(hit,prefix+' approach');p.respawn(l,true,false,{position:hit.point.clone().add(new THREE.Vector3(0,.08,0)),heading});r.stepFor(15);const first=r.frame;
  let bestDistance=Infinity,lastAdvance=r.frame,lastJump=-1000,charge=0,double=false,releaseDouble=false,jumps=0;
  r.until(()=>boxes.every(b=>!b.alive),()=>{
   const target=boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y)[0].mesh.position,d=Math.hypot(target.x-p.pos.x,target.z-p.pos.z);
   if(d<bestDistance-.12){bestDistance=d;lastAdvance=r.frame;}
   if(p.grounded&&r.frame-lastAdvance>45&&r.frame-lastJump>150){charge=1;double=false;lastJump=r.frame;jumps++;}
   let jumpHeld=charge>0&&charge<=18;
   if(charge){charge++;if(charge>100)charge=0;}
   if(p.state==='air'&&charge>19&&p.vVel<.4&&!double){jumpHeld=true;double=true;releaseDouble=true;}
   else if(releaseDouble){jumpHeld=false;releaseDouble=false;}
   return {...r.steerToward(target,{pace:charge?1:.25}),jumpHeld,spinHeld:r.frame%24<12};
  },{maxFrames:1400,label:prefix});assert.equal(p.totalDeaths,0);report.harvests.push({name:prefix,count:5,frames:r.frame-first,deaths:p.totalDeaths,fromMainRoute:true,routeOffset:best,jumps});console.log('PASS access '+prefix+' jumps='+jumps);
 }
 for(let index=0;index<l.enemies.length;index++){
  p.respawn(l,true);const e=l.enemies[index],q=e.group.position.clone();q.z+=3;ray.set(q.clone().add(new THREE.Vector3(0,2,0)),down);ray.far=4;const h=l.raycastGround(ray)[0];assert.ok(h);p.respawn(l,true,false,{position:h.point.clone().add(new THREE.Vector3(0,.08,0)),heading:new THREE.Vector3(0,0,-1)});r.stepFor(15);
  let lastSpin=false;r.until(()=>!e.alive,()=>{const spinHeld=p.spinning||!lastSpin;lastSpin=spinHeld;return {...r.steerToward(e.group.position,{pace:p.spinning?.3:0}),spinHeld};},{maxFrames:600,label:'Stockroom guard '+index});assert.equal(p.totalDeaths,0);report.enemies.push({index,kind:e.kind,defeated:true,deaths:p.totalDeaths});
 }
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));assert.ok(l.enemies.every(e=>e.alive));report.retry={crates:110,enemies:3};if(before){report.nonCratesExact=true;report.settingsExact=true;}
},{modulePath:'/src/levels/mayfield-mall.ts',source:m=>m.MAYFIELD_MALL_LEVEL,levelId:'mayfield-mall',controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,maxFrames:40000});
await writeFile(out+'/grammar.json',JSON.stringify(report,null,2));console.log('PASS main-route approaches to all 110 crates in 22 supported groups, three normal-spin enemy counters and full reset');
