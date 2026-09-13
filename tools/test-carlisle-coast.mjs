import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
globalThis.self=globalThis;globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.fetch=async input=>{const path=new URL(typeof input==='string'?input:input.url,'http://headless.invalid').pathname;try{return new Response(await readFile(new URL('../public'+path,import.meta.url)));}catch{return new Response('',{status:404});}};
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
 const {Level,normalizeCustomLevelData,normalizeUserLevelEntries,setUserLevels,findLevel}=await server.ssrLoadModule('/src/level.ts');
 const {CARLISLE_COAST_LEVEL:data,CARLISLE_EXCAVATIONS:pits}=await server.ssrLoadModule('/src/levels/carlisle-coast.ts');
 assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(data))),'city passes the actual runtime contract');
 const pack=JSON.parse(await readFile(new URL('../public/levels.json',import.meta.url),'utf8'));
 assert.ok(normalizeUserLevelEntries(pack.levels),'published pack is importable');
 assert.deepEqual(pack.levels.find(e=>e.id==='test').data,JSON.parse(JSON.stringify(data)),'published/source versions agree');
 const scene=new THREE.Scene();
 const level=new Level(scene,{id:'test',name:data.name,data});await level.prepareJungleAssets();level.root.updateMatrixWorld(true);
 assert.deepEqual(level.cityAssetDiagnostics.errors,[]);assert.equal(level.cityAssetDiagnostics.ready,level.cityAssetDiagnostics.placements);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),failures=[];let probes=0;
 function floor(x,z,y=4){ray.set(new THREE.Vector3(x,y,z),down);ray.near=0;ray.far=40;return ray.intersectObjects(level.groundMeshes,false)[0];}
 function supported(x,z,label){const hit=floor(x,z);probes++;if(!hit||Math.abs(hit.point.y)>.1||!hit.object.userData.cityAsset)failures.push({label,x,z,y:hit?.point.y});}
 for(let z=10;z>=-1718;z-=.5)if(!pits.some(h=>Math.abs(z-h.z)<h.d/2+.01&&Math.abs(h.x)<.01))for(const x of [-4.5,0,4.5])supported(x,z,'main carriageway');
 for(let z=-1738;z>=-2300;z-=.5)if(!pits.some(h=>Math.abs(z-h.z)<h.d/2+.01&&h.x===156))for(const x of [151.5,156,160.5])supported(x,z,'harbour carriageway');
 for(let x=10;x<146;x+=.5)if(!pits.some(h=>h.axis==='x'&&Math.abs(x-h.x)<h.w/2+.01))supported(x,-1728,'east carriageway');
 for(let i=0;i<=90;i++){const angle=i*Math.PI/180;supported(9-9*Math.cos(angle),-1719-9*Math.sin(angle),'first curved junction');supported(147+9*Math.sin(angle),-1737+9*Math.cos(angle),'second curved junction');}
 for(const h of pits){const hit=floor(h.x,h.z);assert.ok(!hit,`${h.id}: pit has no survivable floor below its kill volume`);}
 for(const c of data.components.filter(c=>c.t==='platform'&&c.dkind==='citydeck')){const hit=floor(c.p[0],c.p[2],c.p[1]+c.s[1]/2+.05);assert.ok(hit&&Math.abs(hit.point.y-(c.p[1]+c.s[1]/2))<.03,'deck top matches collision '+JSON.stringify(c.p)+' hit '+hit?.point.y);}
 const blocked=[];
 for(let z=10;z>=-1718;z-=1)for(const x of [-4.5,0,4.5])if(level.walls.some(w=>w.containsPoint(new THREE.Vector3(x,.6,z))))blocked.push([x,z]);
 assert.deepEqual(blocked,[],'buildings and perimeter walls keep the main lanes open');
 assert.deepEqual(failures,[],'all street seams support the intended lanes');
 const original=JSON.parse(await readFile(new URL('carlisle-coast/original-course.json',import.meta.url),'utf8'));
 assert.ok(setUserLevels([original]));assert.equal(findLevel('test').name,'Carlisle Coast','unchanged installed demo follows the new release');
 const edited=JSON.parse(JSON.stringify(original));edited.data.components[0].p[0]+=.01;
 assert.ok(setUserLevels([edited]));assert.equal(findLevel('test').name,'Test Course','even a one-centimetre local edit is retained');
 const captured=level.captureData();assert.equal(captured.name,data.name);assert.ok(normalizeCustomLevelData(captured),'editor can retain the complete city');
 const {Player}=await server.ssrLoadModule('/src/player.ts');const player=new Player(scene);player.rawInput={grindHeld:false};
 player.respawn(level,true);assert.ok(player.grounded&&Math.abs(player.pos.y-data.spawn[1])<.01,'supported spawn');
 let ledges=0;
 for(const c of data.components.filter(c=>c.t==='platform'&&c.dkind==='citydeck').slice(0,24)){
  const top=c.p[1]+c.s[1]/2,z=c.p[2]+c.s[2]/2+.35;
  player.pos.set(c.p[0],top-1.05,z);player.prevPos.copy(player.pos);player.state='air';player.grounded=false;player.vVel=-1;player.speed=0;player.freeSkate=false;player.lastVelX=0;player.lastVelZ=-4;player.axisF.set(0,0,-1);player.axisL.set(-1,0,0);player.ledgeCoolT=0;player.comboRun=false;
  if(player.tryLedgeGrabMesh(level)){assert.ok(Math.abs(player.ledgeLip-top)<.05);assert.ok(floor(player.ledgeLanding.x,player.ledgeLanding.z,top+.1));ledges++;}
 }
 assert.ok(ledges>=20,'deck lips and corners support ledge recovery');
 for(const cr of level.crates.filter(c=>!c.pending)){
  const x=(cr.box.min.x+cr.box.max.x)/2,z=(cr.box.min.z+cr.box.max.z)/2,y=cr.box.min.y;
  const hit=floor(x,z,y+.02),stack=level.crates.some(other=>other!==cr&&Math.abs(other.box.max.y-y)<.15&&Math.abs(other.box.min.x-cr.box.min.x)<.1&&Math.abs(other.box.min.z-cr.box.min.z)<.1);
  assert.ok(stack||(hit&&Math.abs(hit.point.y-y)<.16),'crate support '+[x,y,z]);
 }
 // Spawn invulnerability must never let a missed pit trigger leave a player
 // standing on an invisible floor at the bottom of an excavation.
 const input={moveX:0,moveY:0,consumeEdges(){}};
 for(const key of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferPressed'])input[key]=false;
 player.respawn(level,true);player.pos.set(0,-6,-381);player.prevPos.copy(player.pos);player.state='air';player.grounded=false;player.invulnTimer=3;player.vVel=-5;player.lives=30;
 let pitDeath=false;for(let i=0;i<180;i++){player.step(1/60,input,level);level.update(1/60);pitDeath ||= player.state==='dead';}
 assert.ok(pitDeath,'missed jumps respawn even through temporary invulnerability');
 const mainDir=level.cameraDirAt(0,0,-1600),eastDir=level.cameraDirAt(78,0,-1728),endDir=level.cameraDirAt(156,0,-1820);
 assert.ok(mainDir.z<-.99&&eastDir.x>.99&&endDir.z<-.99,'camera faces the three course directions');
 console.log(JSON.stringify({probes,ledges,pits:pits.length,groundMeshes:level.groundMeshes.length,walls:level.walls.length,assets:level.cityAssetDiagnostics,rails:level.rails.length,crates:level.crates.length}));
 level.dispose();
}finally{await server.close();}
