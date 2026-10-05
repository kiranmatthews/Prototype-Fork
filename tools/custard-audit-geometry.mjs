import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {THREE,l,source,sourceModule:m}=r,{normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(structuredClone(source)));
 for(const [type,array] of [['enemy',l.enemies],['stone',l.stones],['crusher',l.crushers],['pendulum',l.pendulums],['mover',l.movers],['crumble',l.crumbles]])
  assert.equal(array.length,source.components.filter(c=>c.t===type).length,type+' fixtures cover every authored runtime instance');
 assert.doesNotMatch(await readFile(new URL('../src/levels/custard-creek.ts',import.meta.url),'utf8'),/original-course|buildCarlisleBoxes|custardWarp/);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);l.root.updateMatrixWorld(true);
 const floor=(p,meshes=l.groundMeshes,above=6,far=12)=>{ray.set(new THREE.Vector3(p[0],p[1]+above,p[2]),down);ray.near=0;ray.far=far;return ray.intersectObjects(meshes,false).find(h=>h.face&&h.face.normal.clone().transformDirection(h.object.matrixWorld).y>.6);};
 const val=(v,s)=>typeof v==='function'?v(s):v,vec=p=>p.toArray().map(v=>Math.round(v*1e4)/1e4);
 const report={inventory:m.CUSTARD_CREEK_GAMEPLAY,route:{length:m.CUSTARD_CREEK_END,heightRange:[],headingReversals:0,maxYawRateAt23:0,minRadius:Infinity},roads:{expected:0,probes:0,failures:[]},pipe:{expected:0,probes:0,failures:[]},gaps:{expected:0,probes:0,failures:[]},enemies:[],stones:[],rails:[],camera:{expected:0,probes:0,maxError:0,failures:[]},contacts:{expectedTops:0,tops:0,expectedSides:0,sides:0,minSideMove:Infinity,minOutwardMove:Infinity,failures:[]},ferry:[]};
 const heights=[];let last=m.custardTangent(0),turned=0;
 for(let s=0;s<=m.CUSTARD_CREEK_END;s++){
  heights.push(m.custardHeight(s));const a=m.custardTangent(s-.5),b=m.custardTangent(s+.5),d=m.custardTangent(s),angle=Math.acos(Math.max(-1,Math.min(1,a[0]*b[0]+a[2]*b[2])));
  if(angle>1e-7){report.route.minRadius=Math.min(report.route.minRadius,1/angle);report.route.maxYawRateAt23=Math.max(report.route.maxYawRateAt23,angle*23*180/Math.PI);}
  turned+=Math.atan2(last[0]*d[2]-last[2]*d[0],last[0]*d[0]+last[2]*d[2]);if(Math.abs(turned)>=Math.PI*.9){report.route.headingReversals++;turned=0;}last=d;
 }
 report.route.heightRange=[Math.min(...heights),Math.max(...heights)];
 for(const road of m.CUSTARD_CREEK_ROADS){
  const meshes=l.groundMeshes.filter(o=>{const c=source.components[o.userData.editorIdx];return c?.t==='mesh'&&c.solid!==false&&c.nm===road.name;});
  for(let s=road.a+.05;s<=road.b-.05;s+=1)for(const side of [-.42,0,.42]){
   report.roads.expected++;const p=m.custardPoint(s,m.custardHeight(s),val(road.offset,s)+side*val(road.width,s)),hit=floor(p,meshes,.3,.8);report.roads.probes++;
   if(!hit||Math.abs(hit.point.y-p[1])>.035)report.roads.failures.push({name:road.name,s,side,p,y:hit?.point.y??null});
  }
 }
 const pipeMeshes=l.groundMeshes.filter(o=>source.components[o.userData.editorIdx]?.t==='vertramp');
 for(let s=850.1;s<=1159.9;s+=1)for(const u of [-3,0,3]){report.pipe.expected++;const p=m.custardPoint(s,m.custardHeight(s),u),hit=floor(p,pipeMeshes,.3,.8);report.pipe.probes++;if(!hit||Math.abs(hit.point.y-p[1])>.035)report.pipe.failures.push({s,u,p,y:hit?.point.y??null});}
 const statics=l.groundMeshes.filter(o=>{const c=source.components[o.userData.editorIdx];return c&&!['mover','crumble'].includes(c.t)&&c.solid!==false;});
 for(const gap of m.CUSTARD_CREEK_GAPS)for(let s=gap.a+.2;s<gap.b-.2;s+=.5)for(const u of [-2.4,0,2.4]){report.gaps.expected++;const p=m.custardPoint(s,m.custardHeight(s),gap.u+u),hit=floor(p,statics,.3,10);report.gaps.probes++;if(hit)report.gaps.failures.push({name:gap.name,s,u,p,y:hit.point.y,mesh:hit.object.name});}
 for(const rail of l.rails){const c=source.components[rail.object.userData.editorIdx];if(c?.t!=='rail')continue;const steps=Math.ceil(rail.totalLength/.5),q={name:c.nm,expected:steps+1,probes:0,minClearance:Infinity,failures:[]};for(let i=0;i<=steps;i++){const p=rail.pointAt(rail.totalLength*i/steps),hit=floor(p.toArray());q.probes++;if(hit){const clear=p.y-hit.point.y;q.minClearance=Math.min(q.minClearance,clear);if(clear<.25)q.failures.push({p:vec(p),clear});}}if(!Number.isFinite(q.minClearance))q.minClearance=null;report.rails.push(q);}
 for(const [i,e] of l.enemies.entries()){
  const q={i,kind:e.kind,range:e.x1-e.x0,speed:e.speed,expected:81,probes:0,maxHeightError:0,failures:[]};
  for(let j=0;j<81;j++){const t=e.x0+(e.x1-e.x0)*j/80,p=e.axis==='x'?[t,e.baseY,e.cross]:[e.cross,e.baseY,t],hit=floor(p);q.probes++;if(hit)q.maxHeightError=Math.max(q.maxHeightError,Math.abs(hit.point.y-e.baseY));if(!hit||Math.abs(hit.point.y-e.baseY)>.16)q.failures.push({p,y:hit?.point.y??null});}
  report.enemies.push(q);
 }
 for(const [i,st] of l.stones.entries()){
  const q={i,axis:st.axis,expected:81*9,probes:0,maxHeightError:0,failures:[]},a=st.axis==='x'?st.x1:st.z1,b=st.axis==='x'?st.x0:st.z0,y=st.mesh.position.y-st.r;
  for(let j=0;j<81;j++)for(const dx of [-st.r*.7,0,st.r*.7])for(const dz of [-st.r*.7,0,st.r*.7]){const t=a+(b-a)*j/80,p=[(st.axis==='x'?t:st.x)+dx,y,(st.axis==='z'?t:st.z)+dz],hit=floor(p);q.probes++;if(hit)q.maxHeightError=Math.max(q.maxHeightError,Math.abs(hit.point.y-y));if(!hit||Math.abs(hit.point.y-y)>.18)q.failures.push({p,y:hit?.point.y??null});}report.stones.push(q);
 }
 const cursor={s:-1};for(let s=0;s<=m.CUSTARD_CREEK_END;s+=2)for(const u of [-4,0,4]){
  report.camera.expected++;const p=m.custardPoint(s,m.custardHeight(s)+.8,u),d=l.laneDirAt(...p,cursor),want=m.custardTangent(s);report.camera.probes++;const err=d?Math.acos(Math.max(-1,Math.min(1,d.x*want[0]+d.z*want[2])))*180/Math.PI:180;report.camera.maxError=Math.max(report.camera.maxError,err);if(err>7)report.camera.failures.push({s,u,p,err});
 }
 for(const road of m.CUSTARD_CREEK_ROADS){
  const data=source.components.filter(c=>c.nm===road.name||c.nm?.startsWith(road.name+' ·'));
  const isolated=new r.Level(new THREE.Scene(),{id:'custard-own-road-probes',name:'Custard support probes',data:{...source,components:data}});isolated.root.updateMatrixWorld(true);
  for(const t of [.16,.5,.84])for(const side of [-1,1]){
   const s=road.a+(road.b-road.a)*t,u=val(road.offset,s)+side*val(road.width,s)/2,top=m.custardPoint(s,m.custardHeight(s)+.08,u-side*.12);
   report.contacts.expectedTops++;r.p.respawn(isolated,true,true,{position:new THREE.Vector3(...top)});r.p.pos.set(...top);r.p.prevPos.set(...top);r.p.state='ride';r.p.grounded=true;r.p.speed=0;r.p.rawInput.grindHeld=false;r.p.collide(isolated);report.contacts.tops++;if(r.p.pos.distanceTo(new THREE.Vector3(...top))>.005)report.contacts.failures.push({type:'own top',name:road.name,s,side,p:top,after:vec(r.p.pos)});
   const at=m.custardPoint(s,m.custardHeight(s)-.7,u-side*.015),before=m.custardPoint(s,m.custardHeight(s)-.7,u+side*1.2);
   report.contacts.expectedSides++;r.p.respawn(isolated,true,true,{position:new THREE.Vector3(...at)});r.p.pos.set(...at);r.p.prevPos.set(...before);r.p.state='air';r.p.grounded=false;r.p.vVel=0;r.p.speed=0;r.p.rawInput.grindHeld=true;r.p.collide(isolated);report.contacts.sides++;
   const shift=r.p.pos.clone().sub(new THREE.Vector3(...at)),d=m.custardTangent(s),outward=side*(-d[2]*shift.x+d[0]*shift.z);report.contacts.minSideMove=Math.min(report.contacts.minSideMove,shift.length());report.contacts.minOutwardMove=Math.min(report.contacts.minOutwardMove,outward);
   if(shift.length()<.05||outward<.025)report.contacts.failures.push({type:'side',name:road.name,s,side,p:at,after:vec(r.p.pos),outward});
  }isolated.dispose();
 }
 for(const mover of l.movers){const c=source.components[mover.mesh.userData.editorIdx];if(c?.nm!=='Reedbed ferry')continue;const positions=[-1,1].map(sign=>mover.base.clone().addScaledVector(mover.axisV,mover.amp*sign));report.ferry.push({axis:vec(mover.axisV),ends:[1622,1662].map(s=>{const p=m.custardPoint(s);return{s,minGap:Math.min(...positions.map(q=>Math.hypot(Math.max(0,Math.abs(p[0]-q.x)-5),Math.max(0,Math.abs(p[2]-q.z)-5))))};})});}
 await writeFile('/private/tmp/custard-audit-geometry.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({inventory:report.inventory,route:report.route,roads:{probes:report.roads.probes,failures:report.roads.failures.slice(0,8)},pipe:{probes:report.pipe.probes,failures:report.pipe.failures.slice(0,8)},gaps:{probes:report.gaps.probes,failures:report.gaps.failures.slice(0,8)},enemies:report.enemies.map(q=>({...q,failures:q.failures.slice(0,4)})),stones:report.stones.map(q=>({...q,failures:q.failures.slice(0,4)})),rails:report.rails,camera:{...report.camera,failures:report.camera.failures.slice(0,8)},contacts:{...report.contacts,failures:report.contacts.failures.slice(0,8)},ferry:report.ferry},null,2));
 assert.ok(report.route.headingReversals>=3);assert.ok(m.CUSTARD_CREEK_END>=2200&&m.CUSTARD_CREEK_END<=2700);assert.ok(report.route.heightRange[1]>=16&&report.route.heightRange[0]<=-8);
 for(const name of ['roads','pipe','gaps','camera']){assert.equal(report[name].probes,report[name].expected);assert.deepEqual(report[name].failures,[],name+' probes must all pass');}
 assert.ok(report.enemies.every(q=>q.probes===q.expected&&q.failures.length===0));assert.ok(report.enemies.filter(q=>q.kind==='charger').every(q=>q.speed>0&&q.range>0));assert.ok(report.stones.every(q=>q.probes===q.expected&&q.failures.length===0));
 assert.equal(report.rails.length,source.components.filter(c=>c.t==='rail').length);assert.ok(report.rails.every(q=>q.probes===q.expected&&q.failures.length===0));
 assert.equal(report.contacts.tops,report.contacts.expectedTops);assert.equal(report.contacts.sides,report.contacts.expectedSides);assert.deepEqual(report.contacts.failures,[]);
},{modulePath:'/src/levels/custard-creek.ts',levelId:'custard-creek',source:m=>m.CUSTARD_CREEK_LEVEL});
