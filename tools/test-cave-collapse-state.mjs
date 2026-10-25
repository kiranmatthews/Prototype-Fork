import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({configFile:false,server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
 const {CaveCollapse,validCaveCollapse}=await server.ssrLoadModule('/src/caveCollapse.ts');
 const data={path:[[0,0,0],[0,0,120]],seed:73419,width:13,height:11,spacing:4.6,speed:7.8,trigger:3,headStart:16,warning:1.05};
 const a=new CaveCollapse(data),b=new CaveCollapse(data),initial=Array.from(a.rubble.instanceMatrix.array);
 assert.deepEqual(initial,Array.from(b.rubble.instanceMatrix.array),'identical seed gives identical arches');
 const p=new THREE.Vector3(0,0,28);let hit=false;
 for(let i=0;i<600;i++){a.update(1/60,p);if(a.hitsPlayer(p))hit=true;}
 assert.ok(hit,'stopping is fatal');assert.ok(a.collapsed>0);assert.equal(a.consumeWarning(),true);assert.equal(a.consumeWarning(),false);
 const old=a.front;a.update(1/60,new THREE.Vector3(0,0,0));assert.ok(a.front>old,'backtracking never resets or reverses the front');
 a.reset();assert.deepEqual(initial,Array.from(a.rubble.instanceMatrix.array));assert.ok(a.rocks.every(r=>r.box.isEmpty()));
 const simulate=dt=>{a.reset();for(let t=0;t<10-1e-6;t+=dt)a.update(dt,p);return a.front;};
 assert.ok(Math.abs(simulate(1/30)-simulate(1/120))<.5,'bounded equivalent front at 30/120 Hz');
 a.reset();for(let i=0;i<120;i++)a.update(1/60,new THREE.Vector3(-40,0,10));assert.equal(a.phase,'waiting','proximity outside the tunnel cannot trigger');
 a.reset(new THREE.Vector3(0,0,70));a.update(1/60,new THREE.Vector3(0,0,70));assert.equal(a.phase,'warning');assert.ok(a.front<70-16,'late debug spawn earns a head start');
 const curved={...data,path:[[0,0,0],[0,0,40],[30,0,70]]};assert.ok(validCaveCollapse(curved));const c=new CaveCollapse(curved);assert.ok(c.project(new THREE.Vector3(15,0,55)).s>40);assert.ok(c.sample(40,new THREE.Vector3()).distanceTo(new THREE.Vector3(0,0,40))<1e-8);
 for(const invalid of [{path:[[0,0,0],[0,0,1]]},{path:[[0,0,0],[0,999,120]]},{seed:Infinity},{spacing:0},{path:Array.from({length:130},(_,i)=>[0,0,i*5])}])assert.equal(validCaveCollapse({...data,...invalid}),false);
 const parent=new THREE.Group();parent.add(a.group);let disposed=0;a.rubble.geometry.addEventListener('dispose',()=>disposed++);a.dispose();assert.equal(parent.children.length,0);assert.equal(disposed,1);
 b.dispose();c.dispose();console.log('PASS: seeded geometry, warning, catch, monotonic pursuit, reset, timestep stability, path projection, bounded validation, disposal');
}finally{await server.close();}
