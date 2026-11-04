import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';

const source=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
new Function(source.slice(source.indexOf('function installHeadlessDom()'),source.indexOf('\nfunction round('))+'\ninstallHeadlessDom();')();
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',optimizeDeps:{noDiscovery:true},server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
const reports=[];
try {
 const {Level}=await server.ssrLoadModule('/src/level.ts');
 const {SUNNY_BEACH_LEVEL}=await server.ssrLoadModule('/src/levels/sunny-beach.ts');
 const {JUNGLE_FRUIT_CLEARINGS}=await server.ssrLoadModule('/src/levels/fruit-clusters.ts');
 for(const entry of [{id:'jungle',name:'Jungle Ruins'},{id:'beachfront',name:SUNNY_BEACH_LEVEL.name,data:SUNNY_BEACH_LEVEL}]) {
  const level=new Level(new THREE.Scene(),entry);
  try {
   level.root.updateMatrixWorld(true);
   const authored=entry.data?.components.filter(c=>c.nm?.startsWith('Loose fruit /'));
   const cluster=entry.id==='jungle'?level.pickups.filter(p=>JUNGLE_FRUIT_CLEARINGS.some(z=>p.mesh.position.z<=z+.23&&p.mesh.position.z>=z-1.63)):
    level.pickups.filter(p=>authored.some(c=>p.mesh.position.distanceTo(new THREE.Vector3(...c.p))<1e-5));
   assert.equal(cluster.length,entry.id==='jungle'?24:30,'loose cluster members are missing');
   const clearance=[];
   for(const pickup of cluster) {
    const p=pickup.mesh.position;
    const hit=new THREE.Raycaster(new THREE.Vector3(p.x,p.y+.1,p.z),new THREE.Vector3(0,-1,0),0,3).intersectObjects(level.groundMeshes,false)[0];
    assert.ok(hit,`unsupported cluster fruit at ${p.toArray()}`);
    const lift=p.y-hit.point.y;clearance.push(lift);
    assert.ok(lift>.7&&lift<1.65,`unreachable or buried cluster at ${p.toArray()}: ${lift}`);
    assert.ok(!level.crates.some(c=>c.alive&&c.box.clone().expandByScalar(.35).containsPoint(p)),'fruit intersects crate');
    for(const peer of cluster)if(peer!==pickup)assert.ok(p.distanceTo(peer.mesh.position)>.65,'loose crowns overlap');
   }
   level.setTimeTrial(true);assert.ok(cluster.every(p=>!p.mesh.visible),'fruit remains in time trial');
   level.setTimeTrial(false);assert.ok(cluster.every(p=>p.mesh.visible),'fruit lost on trial exit');
   for(const p of cluster){p.alive=false;p.mesh.visible=false;}
   level.reset(false);assert.ok(cluster.every(p=>p.alive&&p.mesh.visible),'soft respawn lost fruit');
   const capture=level.captureData();assert.ok(cluster.every(p=>capture.components.some(c=>c.t==='wumpa'&&p.mesh.position.distanceTo(new THREE.Vector3(...c.p))<1e-5)),'editor capture dropped cluster');
   reports.push({level:entry.name,count:cluster.length,minClearance:Math.min(...clearance),maxClearance:Math.max(...clearance),trialAndRespawn:true,editorCapture:true});
  } finally {level.dispose();}
 }
 console.log(JSON.stringify(reports,null,2));
 console.log('PASS loose fruit clusters: supported reachable placement, crown spacing, crate clearance, trial lifecycle, soft respawn and editor capture.');
} finally {await server.close();}
