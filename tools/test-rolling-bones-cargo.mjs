import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.ROLLING_BONES_OUTPUT??'/tmp/rolling-bones-evidence';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,sourceModule:m,source}=r,{ROLLING_BONES_CARGO}=await r.server.ssrLoadModule('/src/levels/rolling-bones-crates.ts');
 const report={groups:[],footprintProbes:0,maxFloorError:0,retainedSlopeContacts:[]},ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 if(process.env.ROLLING_BONES_BASELINE){const before=JSON.parse(await readFile(process.env.ROLLING_BONES_BASELINE,'utf8'));assert.deepEqual(JSON.parse(JSON.stringify({...source,components:source.components.filter(c=>c.t!=='crate')})),{...before,components:before.components.filter(c=>c.t!=='crate')});report.nonCratesAndSettingsExact=true;}
 assert.equal(l.crates.length,118);assert.equal(l.totalCrates,105);assert.equal(l.bonusCrateTotal,22);assert.equal(l.checkpoints.length,6);assert.equal(l.enemies.length,0);
 const counts=new Map();
 for(const [section,s,u,count]of ROLLING_BONES_CARGO){const cache=(counts.get(section)??0)+1;counts.set(section,cache);const prefix=`Bones shelter / section ${section} / cache ${cache} /`,boxes=l.crates.filter(b=>source.components[b.mesh.userData.editorIdx]?.nm?.startsWith(prefix));assert.equal(boxes.length,count);
  const base=Math.min(...boxes.map(b=>source.components[b.mesh.userData.editorIdx].p[1]));
  for(const b of boxes.filter(b=>source.components[b.mesh.userData.editorIdx].p[1]===base))for(const dx of [-.556,.556])for(const dz of [-.556,.556]){ray.set(b.mesh.position.clone().setY(base+3).add(new THREE.Vector3(dx,0,dz)),down);ray.far=6;const h=l.raycastGround(ray)[0];assert.ok(h,prefix+' corner');const error=Math.abs(h.point.y-b.box.min.y);report.maxFloorError=Math.max(report.maxFloorError,error);report.footprintProbes++;assert.ok(error<.06,prefix+' flat support '+error);}
  const start=m.rumblePoint(s-2.5,m.rumbleHeight(s)+.12,0);p.respawn(l,true,false,{position:new THREE.Vector3(...start),heading:new THREE.Vector3(...m.rumbleTangent(s))});l.boulder.course.reset(p.pos);r.stepFor(25);assert.ok(p.grounded);assert.ok(!l.boulder.course.active,'supply harvesting starts outside the active chase');
  let lastSpin=false;const first=r.frame;r.until(()=>boxes.every(b=>!b.alive),()=>{const target=boxes.filter(b=>b.alive).sort((a,b)=>a.box.min.y-b.box.min.y||p.pos.distanceTo(a.mesh.position)-p.pos.distanceTo(b.mesh.position))[0].mesh.position;const spinHeld=p.spinning||!lastSpin;lastSpin=spinHeld;return{...r.steerToward(target,{pace:p.spinning?.38:0}),spinHeld};},{maxFrames:1600,label:prefix});assert.equal(p.totalDeaths,0);assert.ok(!l.boulder.course.active);report.groups.push({name:prefix,count,frames:r.frame-first,deaths:0});
 }
 p.respawn(l,true);assert.ok(l.crates.every(b=>b.alive));
 // The old audit's seven overhang flags are on sloping terrain/pipe walls.
 // Probe from above their actual surfaces instead of below an uphill corner.
 if(process.env.ROLLING_BONES_AUDIT){const audit=JSON.parse(await readFile(process.env.ROLLING_BONES_AUDIT,'utf8')).levels[0],before=JSON.parse(await readFile(process.env.ROLLING_BONES_BASELINE,'utf8'));
  for(const flagged of audit.crates.filter(c=>'corners'in c)){const original=before.components[flagged.cid],b=l.crates.find(b=>{const c=source.components[b.mesh.userData.editorIdx];return c.kind===original.kind&&c.p.every((n,i)=>n===original.p[i]);});assert.ok(b,'retained obstacle');let min=Infinity,max=-Infinity;for(const dx of [-.476,.476])for(const dz of [-.476,.476]){ray.set(b.mesh.position.clone().setY(b.box.min.y+3).add(new THREE.Vector3(dx,0,dz)),down);ray.far=6;const h=l.raycastGround(ray)[0];assert.ok(h,'retained sloped obstacle has ground at every corner');min=Math.min(min,h.point.y-b.box.min.y);max=Math.max(max,h.point.y-b.box.min.y);}report.retainedSlopeContacts.push({kind:flagged.kind,originalComponent:flagged.cid,minFloorDelta:min,maxFloorDelta:max});}
 }
 assert.equal(report.groups.reduce((n,g)=>n+g.count,0),44);await writeFile(out+'/cargo.json',JSON.stringify(report,null,2));console.log('PASS all 44 grouped shelter supplies, supported footprints, inactive pursuers and full reset');
},{modulePath:'/tools/rolling-bones-source.ts',source:m=>m.ROLLING_BONES_LEVEL,levelId:'rolling-bones',maxFrames:18000,controlFrame:r=>r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1},allowCheckpointTrips:true});
