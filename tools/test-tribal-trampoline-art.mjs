import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const data={v:1,name:'Tribal trampoline presentation test',spawn:[0,.12,0],killY:-30,hugeDropBail:false,components:[
 {t:'trampoline',p:[0,0,0],s:[20,.7,28],speed:70,amp:1.25,tex:'tribal-weave'},
 {t:'gate',p:[40,0,0]},
]};
await withSkateRuntime(async({player:p,level:l,THREE,CONST,server})=>{
 const owner=l.tribalTrampolines;assert.ok(owner);assert.equal(owner.diagnostics.nets,1);
 const mesh=l.groundMeshes.find(o=>o.userData.trampolineBounce),surface=(await server.ssrLoadModule('/src/trampolineSurface.ts')).trampolineSurfacePresentations.get(mesh);
 assert.ok(surface,'native support publishes Carlisle elastic presentation');
 p.respawn(l,true,false,{position:new THREE.Vector3(0,.1,0),heading:new THREE.Vector3(0,0,-1)});
 for(let i=0;i<60;i++){p.step(CONST.fixedStep,makeInput(),l);l.update(CONST.fixedStep);p.commitRenderStep(l);}
 assert.ok(p.grounded);assert.ok(surface.weightOffset(0,0)<-.5,'old rope visibly dents under supported feet');
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#c19f91',55,190);const camera=new THREE.PerspectiveCamera();
 camera.position.set(0,110,0);owner.view(camera,scene);assert.equal(scene.fog.near,120);assert.equal(scene.fog.far,225);
 camera.position.set(1000,0,0);owner.view(camera,scene);assert.equal(scene.fog.near,55);assert.equal(scene.fog.far,190);
 camera.position.set(0,110,0);owner.view(camera,scene);owner.dispose();assert.equal(scene.fog.near,55);assert.equal(scene.fog.far,190);
 assert.equal((await server.ssrLoadModule('/src/trampolineSurface.ts')).trampolineSurfacePresentations.has(mesh),false);
 console.log('PASS tribal net weight, scoped landing visibility, distant valley restoration and resource cleanup.');
},{levelEntry:{id:'__tribal-art',name:data.name,data}});
