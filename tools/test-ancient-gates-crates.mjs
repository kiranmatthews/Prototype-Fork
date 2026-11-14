import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
import {runThemedBonusWrongOrder} from './themed-bonus-pilot.mjs';
const out=process.env.ANCIENT_GATES_OUTPUT??'/tmp/ancient-gates';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE,source}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),report={bottomBoxes:0,footprintProbes:0,maxFloorError:0,enemies:l.enemies.length};
 assert.equal(l.crates.length,125);assert.equal(l.totalCrates,177);assert.equal(l.bonusCrateTotal,46);assert.equal(l.checkpoints.length,11);assert.equal(l.enemies.length,16);
 const groups=new Map();for(const b of l.crates){const nm=source.components[b.mesh.userData.editorIdx]?.nm;if(nm?.startsWith('Gates supplies /')){const prefix=nm.split(' / box ')[0];if(!groups.has(prefix))groups.set(prefix,[]);groups.get(prefix).push(b);}}
 assert.equal(groups.size,24);
 for(const [name,boxes]of groups){const base=Math.min(...boxes.map(b=>source.components[b.mesh.userData.editorIdx].p[1]));
  for(const b of boxes.filter(b=>source.components[b.mesh.userData.editorIdx].p[1]===base)){report.bottomBoxes++;
   for(const dx of [-.556,.556])for(const dz of [-.556,.556]){ray.set(b.mesh.position.clone().setY(base+3).add(new THREE.Vector3(dx,0,dz)),down);ray.far=6;const h=l.raycastGround(ray)[0];assert.ok(h,name+' has supported corners');const error=Math.abs(h.point.y-b.box.min.y);assert.ok(error<.04,`${name} footprint mismatch ${error}`);report.maxFloorError=Math.max(report.maxFloorError,error);report.footprintProbes++;}
  }
 }
 report.groups=groups.size;report.ordinaryCrates=[...groups.values()].reduce((n,v)=>n+v.length,0);assert.equal(report.ordinaryCrates,119);
 await writeFile(out+'/support.json',JSON.stringify(report,null,2));console.log('PASS all main crate footprints');
},{modulePath:'/src/levels/ancient-gates-route.ts',source:m=>m.JUNGLE_GATE_RUN_LEVEL,levelId:'jungle-gate-run'});
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,reports=[];const box=n=>l.crates.find(b=>r.source.components[b.mesh.userData.editorIdx]?.nm===n);
 const reset=q=>{p.respawn(l,true,false,q?{position:new THREE.Vector3(...q),heading:new THREE.Vector3(1,0,0)}:undefined);r.report={stage:'start',actions:[],evidence:[]};};
 const run=g=>{let n=g.next();while(!n.done){r.tick(n.value);n=g.next();}return n.value;};
 const c=puzzleControls(r);assert.equal(l.crates.length,53);assert.equal(l.totalCrates,46);
 reset([132,.12,0]);r.course={rooms:[{a:131,launchX:137,pattern:'finite',crates:[{role:'upper finite support',name:'Treasury upper finite chest'},{role:'lower finite support',name:'Treasury lower finite chest'},{role:'upper cap',name:'Treasury crown before supports'}]}]};
 let doubled=false;const tick=r.tick;r.tick=s=>{const q=tick(s);doubled ||=p.airJumpUsed&&p.doubleJumpAir;return q;};
 reports.push({...run(runThemedBonusWrongOrder(r)),actualDoubleJump:doubled});r.tick=tick;assert.ok(doubled);
 reset([8.5,.12,0]);run(c.stepFor(20));run(c.charge());r.tick({jumpReleased:true});run(c.until(()=>p.vVel<=7,{}, {limit:100}));r.tick({jumpHeld:true});r.tick({jumpReleased:true});
 run(c.until(()=>p.grounded,()=>({...c.steer([12,0,0]),jumpHeld:p.state==='hang',spinHeld:p.pos.y>3.8}),{label:'try unrevealed Jade gallery',limit:240}));
 assert.ok(p.pos.y<.1);assert.ok(!box('Jade gallery seal').bangUsed);assert.ok(l.crates.filter(b=>r.source.components[b.mesh.userData.editorIdx]?.nm?.startsWith('Hoard delivery / jade-gallery /')).every(b=>b.alive));reports.push({test:'unrevealed gallery cannot support clamber or award cargo',position:p.pos.toArray()});
 reset([50,.12,0]);run(c.stepFor(20));run(c.charge());r.tick({jumpReleased:true});run(c.until(()=>p.state==='dead',()=>c.steer([64,0,0]),{label:'skip causeway switch',limit:260,allowDeath:true}));assert.ok(!box('Three-stone causeway seal').bangUsed);reports.push({test:'unused causeway switch causes real gap death',state:p.state});
 reset([104,.12,0]);run(c.stepFor(20));run(c.charge());r.tick({jumpReleased:true});run(c.until(()=>p.state==='dead',()=>c.steer([112,0,0]),{label:'skip steel relay anchors',limit:260,allowDeath:true}));reports.push({test:'skipping relay footing causes real gap death',state:p.state});
 reset([147,.12,0]);run(c.stepFor(20));const donor=box('Hoard delivery / treasury-exit / box 1'),cap=box('Treasury crown before supports');
 r.charge(26);r.releaseJump();r.until(()=>!donor.alive&&p.vVel>0,()=>r.steerToward(donor.mesh.position,{pace:.65}),{maxFrames:180,label:'ordinary cargo rebound'});r.until(()=>p.vVel<.65,{}, {maxFrames:100,label:'cargo apex'});r.tick({jumpHeld:true});r.tick({jumpHeld:false});assert.ok(p.doubleJumpAir&&p.airJumpUsed);let maxHead=p.crateBodyBox.max.y;
 r.until(()=>p.grounded,()=>{maxHead=Math.max(maxHead,p.crateBodyBox.max.y);return r.steerToward([146,0,0],{pace:.35});},{maxFrames:200,label:'ordinary cargo height'});assert.ok(cap.alive&&maxHead<cap.box.min.y);reports.push({test:'ordinary cargo rebound and double stay below crown',maxHead,capBottom:cap.box.min.y});
 reset([126,2.5,0]);const relay=box('Relay cap 5'),relayCrown=box('Treasury crown before supports');
 r.stepFor(20);r.charge(26);r.releaseJump();
 r.until(()=>!relay.alive&&p.vVel>0,{}, {maxFrames:100,label:'actual final relay cap rebound'});
 r.until(()=>p.vVel<.65,()=>r.steerToward(relayCrown.mesh.position),{maxFrames:100,label:'relay rebound toward crown'});r.tick({jumpHeld:true});r.tick({jumpHeld:false});assert.ok(p.doubleJumpAir&&p.airJumpUsed);
 r.until(()=>p.grounded||p.state==='dead'||!relayCrown.alive,()=>({...r.steerToward(relayCrown.mesh.position),spinHeld:p.pos.y>6}),{maxFrames:200,allowDeath:true,label:'relay donor alternative'});
 assert.ok(relayCrown.alive,'relay cap must not replace the finite upper chest');reports.push({test:'final relay cap rebound and double cannot reach crown',capAlive:true,position:p.pos.toArray()});
 reset();assert.ok(l.crates.every(b=>b.alive));assert.equal(p.cratesBroken,0);reports.push({test:'complete retry',physical:53,counted:46,credit:0});
 await writeFile(out+'/bonus-negative.json',JSON.stringify(reports,null,2));console.log('PASS wrong-order bonus attempts and full retry');
},{modulePath:'/src/levels/ancient-gates-bonus.ts',source:m=>m.ANCIENT_GATES_BONUS,levelId:'bonus-jungle-gate',maxFrames:16000});
