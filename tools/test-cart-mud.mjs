import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true}});
try{
 const {CartMud}=await server.ssrLoadModule('/src/golf-cart/cartMud.ts');
 const {createCartState}=await server.ssrLoadModule('/src/golf-cart/physics.ts');
 const {cartRallyPoint,cartRallyFrame}=await server.ssrLoadModule('/src/levels/cart-stadium-layout.ts');
 const p=cartRallyPoint(25),f=cartRallyFrame(25),make=()=>createCartState({x:p[0],z:p[2],yaw:Math.atan2(-f.dx,1)},()=>({height:p[1],grip:1,drag:0,safe:true}));
 const cart=make(),listener=new THREE.Vector3(cart.x,cart.y,cart.z),mud=new CartMud();
 const tick=(seconds,owners=[0],human=0)=>{for(let i=0;i<seconds*60;i++)mud.update(1/60,[cart],owners,human,listener);};
 tick(20);assert.equal(mud.diagnostics.bursts,0);assert.equal(mud.diagnostics.emitted,0,'Idle engines must not make mud');
 cart.speed=21;cart.vx=-Math.sin(cart.yaw)*21;cart.vz=-Math.cos(cart.yaw)*21;
 const before=structuredClone(cart);tick(30);assert.deepEqual(cart,before,'Presentation changed vehicle physics');
 assert.ok(mud.diagnostics.emitted>200);assert.ok(mud.diagnostics.bursts>0);assert.ok(mud.diagnostics.clods<=192);assert.ok(mud.diagnostics.splats<=12);
 // Grounding after a real downward flight produces a bounded landing hit.
 const landing=new CartMud();cart.grounded=false;cart.vy=-12;landing.update(1/60,[cart],[0],0,listener);
 cart.grounded=true;cart.vy=0;landing.update(1/60,[cart],[0],0,listener);
 assert.equal(landing.diagnostics.bursts,1);assert.equal(landing.diagnostics.splats,3);
 cart.speed=0;for(let i=0;i<9*60;i++)landing.update(1/60,[cart],[0],0,listener);
 assert.equal(landing.diagnostics.splats,0);assert.equal(landing.diagnostics.clods,0,'Spray settles and releases its live slots');
 cart.speed=22;const near=new CartMud(),far=new CartMud(),sn=Math.sin(cart.yaw),cs=Math.cos(cart.yaw);
 const behind=new THREE.Vector3(cart.x+sn*8,cart.y,cart.z+cs*8),remote=new THREE.Vector3(cart.x+sn*80,cart.y,cart.z+cs*80);
 for(let i=0;i<20*60;i++){near.update(1/60,[cart],[1],-1,behind);far.update(1/60,[cart],[1],-1,remote);}
 assert.ok(near.diagnostics.bursts>0,'Following a close rival should put spray on the lens');assert.equal(far.diagnostics.bursts,0,'Distant rivals cannot dirty the camera');
 const abandoned=new CartMud();for(let i=0;i<120;i++)abandoned.update(1/60,[cart],[-1],-1,behind);assert.equal(abandoned.diagnostics.emitted,0);
 let disposed=0;mud.root.children[0].geometry.addEventListener('dispose',()=>disposed++);mud.dispose();assert.equal(disposed,1);
 for(const owner of [landing,near,far,abandoned])owner.dispose();
 console.log('PASS cart mud: idle, wheel spray, landing, nearby rival, distance, finite fade, pool bounds, unchanged physics, disposal');
}finally{await server.close();}
