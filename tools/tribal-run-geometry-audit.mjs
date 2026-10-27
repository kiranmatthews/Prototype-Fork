// Kept browser-compatible so the same runtime probes can accompany a native
// harness or the loaded full-render game, without a second geometry model.
const assert={
 ok(value,message){if(!value)throw Error(message||'Expected a truthy value');},
 equal(actual,expected,message){if(actual!==expected)throw Error(message||`${actual} !== ${expected}`);},
 notEqual(actual,expected,message){if(actual===expected)throw Error(message||`${actual} === ${expected}`);},
};

/** Probe the runtime's real collision meshes, not a parallel approximation of
 * the level data. This complements input-only journeys with seam/edge coverage. */
export function auditTribalGeometry(r){
 const {THREE,l,source,sourceModule:m}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 l.root.updateMatrixWorld(true);
 const hits=(p,above=.18,depth=.4)=>{
  ray.set(new THREE.Vector3(p[0],p[1]+above,p[2]),down);ray.near=0;ray.far=depth;
  return l.raycastGround(ray).filter(h=>h.face?.normal.y>.1);
 };
 const val=(v,s)=>typeof v==='function'?v(s):v;
 let supportProbes=0,maxHeightError=0;
 for(const road of m.TRIBAL_RUN_ROADS){
  const stations=[];
  for(let s=road.a+.12;s<road.b-.1;s+=3)stations.push(s);
  // Chunk boundaries are part of the playable road and need their own probes.
  const chunks=Math.ceil((road.b-road.a)/56);
  for(let i=1;i<chunks;i++)for(const d of [-.025,0,.025])stations.push(road.a+(road.b-road.a)*i/chunks+d);
  for(const s of stations)for(const side of [-.42,0,.42]){
   const y=val(road.top,s),p=m.tribalPoint(s,y,val(road.offset,s)+side*val(road.width,s));
   const hit=hits(p).find(h=>Math.abs(h.point.y-y)<.075);
   assert.ok(hit,`${road.name}: missing real support at station ${s}, side ${side}`);
   maxHeightError=Math.max(maxHeightError,Math.abs(hit.point.y-y));supportProbes++;
  }
 }
 let openGaps=0;
 for(const gap of m.TRIBAL_RUN_GAPS){
  const p=m.tribalPoint((gap.a+gap.b)/2,gap.top,gap.u);
  assert.equal(hits(p).length,0,`${gap.name}: a hidden surface fills the deliberate gap`);openGaps++;
 }
 let headingProbes=0,minHeadingDot=1;
 for(let s=0;s<2320;s+=4){
  const p=m.tribalPoint(s,1),d=l.laneDirAt(...p),t=m.tribalTangent(s);
  assert.ok(d,'ordered lane camera missing');const dot=d.x*t[0]+d.z*t[2];
  assert.ok(dot>.98,`camera reverses or points across the course at ${s}: ${dot}`);
  minHeadingDot=Math.min(minHeadingDot,dot);headingProbes++;
 }
 const crateSeats=[];
 for(const c of source.components.filter(c=>c.t==='crate')){
  const runtime=l.crates.find(b=>b.name===c.nm&&Math.hypot(b.mesh.position.x-c.p[0],b.mesh.position.z-c.p[2])<.1)
   ??l.crates.find(b=>Math.hypot(b.mesh.position.x-c.p[0],b.mesh.position.z-c.p[2])<.1);
  assert.ok(runtime,`missing crate ${c.nm}`);
  const y=runtime.box.min.y,p=[c.p[0],y,c.p[2]],hit=hits(p,.08,.2).find(h=>Math.abs(h.point.y-y)<.09);
  assert.ok(hit,`unsupported crate ${c.nm} at ${c.p}`);
  assert.ok(Math.abs(y-c.p[1])<.12,`crate ${c.nm} needed a large automatic seating repair`);
  crateSeats.push({name:c.nm,p:c.p,runtimeY:y,supportY:hit.point.y});
 }
 assert.equal(source.components.filter(c=>c.t==='gate').length,1);
 assert.equal(l.checkpoints.length,9);assert.equal(l.cameraViews.length,0);
 assert.ok(!l.boulder&&!l.caveCollapse&&!l.skateRace,'Tribal Run must not become a chase or race');
 assert.ok(source.killY<-11);
 for(const c of source.components.filter(c=>c.t==='mesh'&&c.solid!==false))assert.notEqual(c.edgeGrinding,false,'ordinary road edges must remain grindable');
 return{supportProbes,maxHeightError,openGaps,headingProbes,minHeadingDot,crateSeats,checkpoints:l.checkpoints.length,authoredRails:l.rails.length,surfaceEdges:l.surfaceEdgeRails.length};
}
