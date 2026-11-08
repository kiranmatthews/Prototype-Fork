import assert from 'node:assert/strict';

// Shared source/editor contract for the authored continuous Bahia shoreline.
// Detailed dry-sand, wave and access probes live in test-beach-bahia.mjs.
export function assertBeachStreetShore(data) {
  const ocean=data.ocean;
  assert.deepEqual(ocean.p,[0,-.85,0]);
  for(const [key,value] of Object.entries({geometryVersion:2,length:3220,seaward:1,width:80,overlap:0,
    longitudinalSegments:805,lateralSegments:128,sourceCoordinates:'unity',extendTails:false,
    horizonMode:'shoreline',shoreGeometry:'ground'})) assert.equal(ocean[key],value,`shoreline ${key}`);
  assert.equal(ocean.yaw??0,0);
  assert.equal(ocean.shore.length,823,'retain the grade breaks as well as the fine shoreline samples');
  for(const [x,z,sx,sz] of ocean.shore){
    assert.ok([x,z,sx,sz].every(Number.isFinite));
    assert.ok(x>35&&sx>.9&&Math.abs(Math.hypot(sx,sz)-1)<.00002,'shoreline stays seaward with unit directions');
  }
  assert.equal(data.unitySand,undefined,'the old sand rectangle must not return');
  const patches=data.components.filter(c=>c.nm?.startsWith('Bahia continuous Treehouse sand'));
  assert.equal(patches.length,18);
  assert.ok(patches.every(c=>c.t==='mesh'&&c.beachSand&&c.materialStyle==='unity-sand'&&c.smoothCollision));
  return patches;
}
