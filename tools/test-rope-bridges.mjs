import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const options={modulePath:'/src/levels/sky-bridge.ts',levelId:'bridge-test',endlessDeaths:true,controlFrame:()=>({x:0,z:-1})};
await withBlockworksRuntime(async r=>{
 const {p,l,THREE}=r,bridge=l.ropeBridges;
 assert.equal(bridge.diagnostics.decks,1);assert.ok(bridge.diagnostics.boards>5);
 const span=bridge.spans[0],ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 let landed=false,maxError=0,minimum=0;
 for(let i=0;i<240;i++){
  r.tick({});
  if(p.grounded){landed=true;assert.ok(p.groundHit.mesh.userData.bridgeBoard);ray.set(p.pos.clone().addScaledVector(down,-.3),down);ray.far=.6;
   const hit=ray.intersectObjects(l.groundMeshes,false)[0];assert.ok(hit);maxError=Math.max(maxError,Math.abs(p.pos.y-hit.point.y));minimum=Math.min(minimum,p.pos.y);}
 }
 assert.ok(landed&&minimum<-.1);assert.ok(maxError<.035,`rider separated from moving board: ${maxError}`);assert.equal(p.totalDeaths,0);
 assert.ok(bridge.diagnostics.landings>0&&bridge.diagnostics.carried>100);assert.ok(bridge.edges.every(e=>e.rail.grindable));
 const edge=bridge.edges[0],rest=edge.points.map(v=>v.clone());assert.ok(edge.rail.points.some((p,i)=>Math.abs(p.y-rest[i].y-.05)>.02));
 // Crumble reset must not be necessary to restore ordinary bridge rest geometry.
 l.reset();assert.equal(span.physics.sample(span.physics.length/2).height,0);
 ray.set(new THREE.Vector3(0,2,-15),down);ray.far=4;assert.ok(Math.abs(ray.intersectObjects(l.groundMeshes,false)[0].point.y)<.001);
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const data=l.captureData();assert.ok(normalizeCustomLevelData(data));
 for(const anchors of [[[0,0,0],[0,1,0]],[[0,0,0],[0,0,5000]],[[0,0,0],[0,0,NaN]]]){
  const bad=structuredClone(data);bad.components[0].bridgeSpan=anchors;assert.equal(normalizeCustomLevelData(bad),null);
 }
 console.log(JSON.stringify({name:'rider-contact',pass:true,boards:bridge.diagnostics.boards,maxError,minimum,landings:bridge.diagnostics.landings}));
},{...options,source:m=>({v:1,name:'Suspension contact',spawn:[0,3,-15],killY:-24,sky:'clouds',components:[...m.SKY_BRIDGE_LEVEL.components.filter(c=>c.p[2]===-15&&c.tex==='bridge-timber'),{t:'gate',p:[0,0,8]}]})});
await withBlockworksRuntime(async r=>{
 const {p,l}=r;for(let i=0;i<150;i++)r.tick({});
 assert.notEqual(l.crumbles[0].state,'idle');assert.ok(l.ropeBridges.diagnostics.landings>0);
 assert.equal(l.groundMeshes.filter(m=>m.userData.bridgeBoard).length,0);assert.ok(l.ropeBridges.edges.every(e=>!e.rail.grindable));
 l.reset();assert.equal(l.crumbles[0].state,'idle');assert.equal(l.groundMeshes.filter(m=>m.userData.bridgeBoard).length,l.ropeBridges.diagnostics.boards);
 assert.ok(l.ropeBridges.edges.every(e=>e.rail.grindable));assert.ok(!p.isBailing);
 console.log(JSON.stringify({name:'falling-deck-reset',pass:true}));
},{...options,source:m=>({v:1,name:'Suspension crumble',spawn:[0,2,-49.5],killY:-100,sky:'clouds',components:[...m.SKY_BRIDGE_LEVEL.components.filter(c=>c.t==='crumble'&&c.p[2]===-49.5),{t:'gate',p:[0,0,8]}]})});
await withBlockworksRuntime(async r=>{
 const {l,THREE,source}=r,span=l.ropeBridges.spans[0];assert.ok(span.start.x>1000,'treasury offset lost');assert.equal(l.ropeBridges.diagnostics.decks,2);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),gap=span.start.clone().lerp(span.end,.474);
 ray.set(gap.clone().setY(30),down);ray.far=50;assert.equal(ray.intersectObjects(l.groundMeshes,false).length,0,'authored escape gap filled');
 const fullGeometry=source.components.filter(c=>c.dkind?.startsWith('crownmeshyplank')).length;
 assert.ok(fullGeometry>30);assert.equal(l.root.children.filter(o=>!o.userData.assetBatchRoot&&source.components[o.userData.editorIdx]?.dkind?.startsWith('crownmeshyplank')).length,fullGeometry,'moving boards lost to static batching');
 const first=span.start.clone().lerp(span.end,.24),actor={};
 span.physics.impact(span.distance(first),12);span.press(actor,first);l.update(1/60);assert.ok(span.physics.sample(span.distance(first)).height<0);
 ray.set(gap.clone().setY(30),down);assert.equal(ray.intersectObjects(l.groundMeshes,false).length,0);
 console.log(JSON.stringify({name:'sloping-escape-bridge',pass:true,fullGeometry,anchors:[span.start.toArray(),span.end.toArray()],boards:l.ropeBridges.diagnostics.boards}));
},{...options,modulePath:'/src/levels/pirate-wreck.ts',source:m=>({v:1,name:'Escape bridge',spawn:[1154,20,-626],killY:-50,sky:'clouds',components:[...m.PIRATE_WRECK_LEVEL.components.filter(c=>c.bridgeSpan),{t:'gate',p:[1200,18,-650]}]})});
