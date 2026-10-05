import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

await withBlockworksRuntime(async r=>{
 const {THREE,l,source,sourceModule:m}=r;
 const {CARLISLE_COAST_LEVEL:coast}=await r.server.ssrLoadModule('/src/levels/carlisle-coast.ts');
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(structuredClone(source)),'the complete level remains within native geometry/collision budgets');
 const oracle=new r.Level(new THREE.Scene(),{id:'custard-audit-oracle',name:coast.name,data:coast});
 oracle.root.updateMatrixWorld(true);l.root.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const floor=(level,x,y,z,far=5)=>{ray.set(new THREE.Vector3(x,y+.15,z),down);ray.near=0;ray.far=far;return ray.intersectObjects(level.groundMeshes,false).find(h=>h.face&&h.face.normal.y>.6);};
 const xyz=p=>p.toArray().map(v=>Math.round(v*1e4)/1e4);
 const report={enemyPaths:[],stonePaths:[],railClearance:[],floorSides:[],actualSideContacts:[],supportedTopContacts:{probes:0,failures:[]},crumbleSeams:{},walls:[],camera:{}};
 const enemySources=source.components.filter(c=>c.t==='enemy');
 for(const [i,e] of l.enemies.entries()){
  const pts=[];let supported=0,worst=0;
  for(let j=0;j<=100;j++){
   const t=e.x0+(e.x1-e.x0)*j/100,x=e.axis==='x'?t:e.cross,z=e.axis==='z'?t:e.cross,hit=floor(l,x,e.baseY,z);
   const delta=hit?e.baseY-hit.point.y:null;
   if(hit&&Math.abs(delta)<.12)supported++;else if(pts.length<6)pts.push({x,z,baseY:e.baseY,floorY:hit?.point.y??null});
   if(hit)worst=Math.max(worst,Math.abs(delta));
  }
  report.enemyPaths.push({i,nm:enemySources[i]?.nm,kind:e.kind,axis:e.axis,range:[e.x0,e.x1],baseY:e.baseY,supported,total:101,worst,failures:pts});
 }
 assert.equal(report.enemyPaths.length,28);
 assert.ok(report.enemyPaths.every(q=>q.supported===q.total),'every retained enemy patrol remains on supported ground');
 const stoneSources=source.components.filter(c=>c.t==='stone');
 for(const [i,s] of l.stones.entries()){
  const pts=[];let supported=0,footSupported=0,worst=0;
  const a=s.axis==='x'?s.x1:s.z1,b=s.axis==='x'?s.x0:s.z0,y=s.mesh.position.y-s.r;
  for(let j=0;j<=100;j++){
   const t=a+(b-a)*j/100,x=s.axis==='x'?t:s.x,z=s.axis==='z'?t:s.z,hit=floor(l,x,y,z);
   if(hit&&Math.abs(y-hit.point.y)<.12)supported++;else if(pts.length<6)pts.push({x,z,y,floorY:hit?.point.y??null});
   if(hit)worst=Math.max(worst,Math.abs(y-hit.point.y));
   for(const dx of [-s.r*.7,0,s.r*.7])for(const dz of [-s.r*.7,0,s.r*.7]){const h=floor(l,x+dx,y,z+dz);if(h&&Math.abs(y-h.point.y)<.12)footSupported++;}
  }
  report.stonePaths.push({i,nm:stoneSources[i]?.nm,axis:s.axis,r:s.r,range:[a,b],y,supported,total:101,footSupported,footTotal:909,worst,failures:pts});
 }
 assert.equal(report.stonePaths.length,5);
 assert.ok(report.stonePaths.every(q=>q.supported===q.total),'every retained rolling stone path remains on supported ground');
 for(const [key,level,transform] of [['source',oracle,p=>p],['custard',l,m.custardWarp]]){
  const gaps=[];let open=null;
  for(let distance=2055;distance<=2145;distance+=.01){
   const q=transform([152,-26,-distance]),hit=floor(level,q[0],q[1],q[2],.4);
   const supported=hit&&Math.abs(hit.point.y+26)<.02;
   if(!supported&&open===null)open=distance;
   if(supported&&open!==null){gaps.push({from:open,to:distance,width:distance-open});open=null;}
  }
  if(open!==null)gaps.push({from:open,to:2145,width:2145-open});
  report.crumbleSeams[key]=gaps;
 }
 assert.ok(Math.max(...report.crumbleSeams.custard.map(q=>q.width))<=Math.max(...report.crumbleSeams.source.map(q=>q.width))+.021,
  'fitting rigid timed pads retains the original tiny dock seams within two sample steps');
 for(const rail of l.rails){
  const idx=rail.object.userData.editorIdx,c=source.components[idx];if(c?.t!=='rail')continue;
  let min=Infinity,buried=0;const failures=[];
  for(let s=0;s<=rail.totalLength;s+=.25){
   const p=rail.pointAt(s),hit=floor(l,p.x,p.y+12,p.z,20);if(!hit)continue;
   const clearance=p.y-hit.point.y;min=Math.min(min,clearance);
   if(clearance<.04){buried++;if(failures.length<3)failures.push({s,p:xyz(p),floorY:hit.point.y,clearance});}
  }
  const old=oracle.rails.find(q=>coast.components[q.object.userData.editorIdx]?.nm===c.nm.replace('Creek encounter','Test Course'));
  let oracleMin=Infinity,oracleBuried=0;
  if(old)for(let s=0;s<=old.totalLength;s+=.25){const p=old.pointAt(s),hit=floor(oracle,p.x,p.y+12,p.z,20);if(hit){const clearance=p.y-hit.point.y;oracleMin=Math.min(oracleMin,clearance);if(clearance<.04)oracleBuried++;}}
  report.railClearance.push({idx,nm:c.nm,length:rail.totalLength,minClearance:Number.isFinite(min)?min:null,buried,oracleMin:Number.isFinite(oracleMin)?oracleMin:null,oracleBuried,failures});
 }
 const sourceFloors=m.CUSTARD_CREEK_SOURCE_COMPONENTS.filter(c=>c.t==='platform');
 for(const c of sourceFloors){
  const x=c.p[0]+c.s[0]/2,y=c.p[1]+c.s[1]/2-.6,z=c.p[2],p=m.custardWarp([x,y,z]);
  const before=oracle.walls.some(b=>b.containsPoint(new THREE.Vector3(x,y,z)));
  const after=l.walls.some(b=>b.containsPoint(new THREE.Vector3(...p)));
  if(before&&!after)report.floorSides.push({nm:c.nm,original:[x,y,z],warped:p,sourceThickness:c.s[1]});
 }
 assert.deepEqual(report.floorSides,[],'the original platform side contacts survive the warp');
 for(const c of sourceFloors.filter(c=>['Test Course 0','Test Course 16','Test Course 17','Test Course 18','Test Course 19','Test Course 48','Test Course 53','Test Course 54'].includes(c.nm))){
  const x=c.p[0]+c.s[0]/2,y=c.p[1]+c.s[1]/2-.6,z=c.p[2],now=m.custardWarp([x-.015,y,z]),before=m.custardWarp([x+.8,y,z]);
  r.p.respawn(l,true,true,{position:new THREE.Vector3(...now)});r.p.pos.set(...now);r.p.prevPos.set(...before);
  r.p.rawInput.grindHeld=true;r.p.state='air';r.p.grounded=false;r.p.vVel=0;r.p.speed=0;r.p.invulnTimer=99;
  r.p.collide(l);
  const after=xyz(r.p.pos),motion=r.p.pos.distanceTo(new THREE.Vector3(...now));
  report.actualSideContacts.push({nm:c.nm,before:now,after,motion,state:r.p.state});
  assert.ok(motion>.2,`${c.nm} actual Player collide resolves the floor side`);
 }
 for(const c of m.CUSTARD_CREEK_SOURCE_COMPONENTS.filter(c=>c.t==='platform'||c.t==='ramp')){
  const name=c.nm.replace('Test Course','Creek encounter'),justFloors=source.components.filter(q=>q.nm===name||q.nm?.startsWith(name+' side collision'));
  const floorLevel=new r.Level(new THREE.Scene(),{id:'custard-audit-tops',name:'Custard floor audit',data:{...source,components:justFloors}});
  floorLevel.root.updateMatrixWorld(true);
  const w=c.t==='ramp'?c.w:c.s[0],d=c.t==='ramp'?c.len:c.s[2],a=(c.yaw??0)*Math.PI/180;
  for(const sx of [-.49,0,.49])for(const sz of [-.49,0,.49]){
   const x=sx*w,z=sz*d,y=c.t==='ramp'?c.rise*(.5-z/d):c.s[1]/2;
   const q=m.custardWarp([c.p[0]+x*Math.cos(a)+z*Math.sin(a),c.p[1]+y,c.p[2]-x*Math.sin(a)+z*Math.cos(a)]),hit=floor(floorLevel,q[0],q[1],q[2],.3);
   if(!hit||Math.abs(hit.point.y-q[1])>.04)continue;
   const now=new THREE.Vector3(q[0],hit.point.y+.08,q[2]);
   r.p.respawn(floorLevel,true,true,{position:now});r.p.pos.copy(now);r.p.prevPos.copy(now);r.p.state='ride';r.p.grounded=true;r.p.rawInput.grindHeld=false;r.p.speed=0;
   r.p.collide(floorLevel);report.supportedTopContacts.probes++;
   if(r.p.pos.distanceTo(now)>.005)report.supportedTopContacts.failures.push({nm:c.nm,sx,sz,p:xyz(now),after:xyz(r.p.pos)});
  }
  floorLevel.dispose();
 }
 assert.equal(report.supportedTopContacts.probes,513,'all 57 authored support surfaces retain nine usable top-contact probes');
 assert.deepEqual(report.supportedTopContacts.failures,[],'boundary side colliders never shove riders standing on the top');
 for(const c of source.components.filter(c=>c.t==='wallpath')){
  const idx=source.components.indexOf(c);
  const meshes=[];l.root.traverse(o=>{if(o.isMesh&&o.userData.editorIdx===idx)meshes.push(o);});
  report.walls.push({nm:c.nm,y:c.p[1],h:c.rise,w:c.w,meshBounds:meshes.map(o=>{const b=new THREE.Box3().setFromObject(o);return [xyz(b.min),xyz(b.max)];})});
 }
 const camera=m.CUSTARD_CREEK_CAMERA,segments=[];
 for(let i=1;i<camera.length;i++){
  const a=camera[i-1],b=camera[i],xz=Math.hypot(b[0]-a[0],b[2]-a[2]),dy=b[1]-a[1];
  if(Math.abs(dy)>3||xz<.001)segments.push({i,a,b,xz,dy});
 }
 report.camera={nodes:camera.length,heightJumps:segments,maxDy:Math.max(...camera.slice(1).map((b,i)=>Math.abs(b[1]-camera[i][1])))};
 await writeFile('/private/tmp/custard-audit-geometry.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({enemyFailures:report.enemyPaths.filter(q=>q.supported<q.total),stonePaths:report.stonePaths,buriedRails:report.railClearance.filter(q=>q.buried),floorSides:report.floorSides,actualSideContacts:report.actualSideContacts,supportedTopContacts:report.supportedTopContacts,camera:report.camera},null,2));
 oracle.dispose();
},{modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL});
