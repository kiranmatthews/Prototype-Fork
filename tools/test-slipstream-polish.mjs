import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {physicalFingerprint} from './waterslide-island/polish-invariants.mjs';
const expected=JSON.parse(await readFile('docs/slipstream-polish/corrective/ride-physics-baseline.json','utf8'));
await withBlockworksRuntime(async r=>{
 const {normalizeCustomLevelData}=await r.server.ssrLoadModule('/src/level.ts');
 const {WATERSLIDE_ASSETS}=await r.server.ssrLoadModule('/src/waterslideAssets.ts');
 assert.deepEqual(physicalFingerprint({...r.source,components:r.source.components.filter(c=>c.grp!==434)}),expected,'the requested roof openings may change group 434; every original ride/return surface and race rule must remain exact');
 assert.ok(normalizeCustomLevelData(r.source),'the entire level must remain inside the portable editor budget');
 const gardens=r.source.components.filter(c=>c.grp===436);
 assert.ok(gardens.length>100);assert.ok(gardens.every(c=>c.scenerySolid===false));
 const {JUNGLE_ASSETS}=await r.server.ssrLoadModule('/src/jungleAssets.ts');
 assert.equal(r.source.components.filter(c=>JUNGLE_ASSETS[c.dkind]?.matte).length,0,'No scenery painting may cross this winding, vertically stacked race');
 assert.equal(r.source.sky,'waterslide-island');
 assert.ok(r.source.components.filter(c=>c.grp===437).length>150,'The major sections have actual midground rock masses');
 for(const spec of Object.values(WATERSLIDE_ASSETS).filter(s=>s.matte)){
  assert.equal(spec.featherAllEdges,true);assert.ok(spec.edgeFade>=.04&&spec.fog,'all four painting borders blend in the real level atmosphere');
 }
 // Ruin surfaces must survive editor capture with the selected palette.
 const before=r.source.components.filter(c=>c.dkind==='ruinblock').map(c=>[c.p,c.s,c.color,c.tex]);
 const captured=r.l.captureData().components.filter(c=>c.dkind==='ruinblock').map(c=>[c.p,c.s,c.color,c.tex]);
 assert.deepEqual(captured,before);
 // An existing coplanar strip at the ticket forecourt produced a dotted
 // depth fight. Bias only the visual deck; its original contacts stay put.
 const forecourt=r.source.components.find(c=>c.nm==='Closed ticket forecourt');
 const grid=r.source.components.find(c=>c.nm==='Race starting grid');
 assert.equal(forecourt.p[1]+forecourt.s[1]/2,grid.p[1]+grid.s[1]/2);
 assert.equal(forecourt.depthBias,2);
 const deckIndex=r.source.components.indexOf(forecourt);
 const deckMesh=r.l.groundMeshes.find(m=>m.userData.editorIdx===deckIndex);
 assert.ok(deckMesh.material.polygonOffset);
 assert.equal(deckMesh.material.polygonOffsetFactor,2);
 console.log(JSON.stringify({physics:expected,gardenProps:gardens.length,meshTriangles:r.source.components.reduce((n,c)=>n+(c.indices?.length??0)/3,0)}));
 console.log('PASS Slipstream original physics, race, editor budget, matte borders and portable ruin materials.');
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
