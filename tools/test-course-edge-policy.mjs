import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createServer } from 'vite';
import * as THREE from 'three';
import { makeInput } from './jungle-cup-harness.mjs';

const fixture=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
new Function('noop',fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nconst held'))+'\ninstallHeadlessDom();')(()=>{});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const warn=console.warn,error=console.error;
console.warn=(...a)=>{if(!/failed|GLB|procedural skateboard/i.test(String(a[0])))warn(...a);};
console.error=(...a)=>{if(!/failed|GLB/i.test(String(a[0])))error(...a);};
const reports=[],failures=[];
const requested=process.argv.slice(2).filter(a=>!a.startsWith('--'));
const ordinary=new Set(['platform','ramp','mesh','woodpath','mover','crumble','phasepad','spinbridge','trampoline','speedpad']);
// Concrete exceptions in the current authored courses, not blanket helper
// permissions. New disabled ordinary floors must fail this audit.
function reason(c,id){
  if(c.solid===false)return 'visual-only';
  if(c.loopRadius!==undefined)return 'vertical loop owns its track';
  if(c.outOfBounds||c.lethal)return 'hazard / out-of-bounds surface';
  if(c.shoreProfile)return 'continuous beach/seabed shelf';
  if(c.t==='vertramp')return 'transition owns its explicit coping policy';
  if(c.t==='wall'||c.t==='wallpath')return 'architectural enclosure / containment';
  if(c.t==='rock')return 'scenic natural boulder';
  if(c.nm==='Showcase1ContinuousSandSeabed'||c.nm==='Jungle cove beach and seabed')return 'continuous beach/seabed';
  if(id==='descent'&&c.nm==='oil slick')return 'traction/paint overlay on the road, not a separate lip';
  if(id==='codex-lab'&&c.nm==='Continuous ground stratum')return 'under the ground-floor reset volume';
  if(id==='flats'&&['0,89.5,-75','0,89.5,-340'].includes(c.p.join(',')))return 'two explicitly authored legacy practice slabs';
  if(id==='slip'&&(c.nm==='finish run'||c.p.join(',')==='0,-0.3,-842'))return 'apron under the landing ribbon';
  if(id==='crab-chief'&&c.nm==='Island Hopper coastal shelf · reused sand/shore geometry')return 'continuous beach/seabed shelf';
  if(id==='treehouse-trail'){
    if(['Opening safety foundation','Treehouse cabin floor support'].includes(c.nm))return 'buried/interior safety support';
    if(c.nm==='Treehouse stair flight support')return 'smooth collision proxy beneath stepped timber; visible handrails own the edge';
    if(/^(Seamless small beach|Continuous painted opening ground|Continuous sculpted planted|Visible shallow solid dirt bed|Opening ocean ·|Supported left forest shoulder|Supported distant forest bank|Sunlit forest earth beyond the finish|Climb summit · continuous buried stone berm)/.test(c.nm??''))
      return 'continuous natural ground, seabed or buried seam fill';
  }
  return null;
}
try{
  const {Level,BUILTIN_LEVELS}=await server.ssrLoadModule('/src/level.ts');
  const {Player}=await server.ssrLoadModule('/src/player.ts');
  const {CONST}=await server.ssrLoadModule('/src/tuning.ts');
  const {surfaceBoundaryEdges}=await server.ssrLoadModule('/src/surfaceEdges.ts');
  const player=new Player(new THREE.Scene());
  for(const entry of BUILTIN_LEVELS.filter(e=>e.id!=='warproom'&&(!requested.length||requested.includes(e.id)))){
    const start=performance.now(),level=new Level(new THREE.Scene(),entry);level.update(0);
    const data=level.builtFromData??level.captureData();
    const report={id:entry.id,components:data.components.length,disabled:[],meshes:0,boundaries:0,activeRails:0,catches:0,uncaught:[],buildMs:Math.round(performance.now()-start)};
    try{
      for(const [index,c]of data.components.entries())if(c.edgeGrinding===false){
        const why=reason(c,entry.id);
        if(!why&&ordinary.has(c.t))failures.push({id:entry.id,index,name:c.nm,error:'unexplained disabled ordinary surface'});
        report.disabled.push({index,t:c.t,name:c.nm,reason:why??'non-floor scenery'});
      }
      const meshes=new Set([...level.groundMeshes,...level.obstacleEdgeMeshes,...level.dynamicSurfaceEdges.map(b=>b.mesh)]);
      const live=level.grindRails.filter(r=>r.grindable);
      for(const mesh of meshes){
        const c=level.builtFromData?.components[mesh.userData.editorIdx];
        if(c&&(!ordinary.has(c.t)||c.solid===false||c.edgeGrinding===false||c.loopRadius!==undefined||c.invisible&&c.edgeGrinding!==true))continue;
        if(mesh.userData.edgeGrinding===false||mesh.userData.finishPad||mesh.userData.startWarpPad)continue;
        // Native analytic transitions have their own authored copings.
        if(mesh.userData.vert===true)continue;
        const edges=surfaceBoundaryEdges(mesh),owned=level.surfaceEdgeRails.filter(r=>level.surfaceEdgeOwners.get(r)===mesh);
        const dynamic=level.dynamicSurfaceEdges.find(b=>b.mesh===mesh);
        if(dynamic&&!dynamic.active()){
          if(!owned.length||owned.some(r=>r.grindable))failures.push({id:entry.id,name:c?.nm,error:'inactive platform rim missing or still catchable'});
          continue;
        }
        report.meshes++;
        for(const [a,b]of edges){
          const point=a.clone().lerp(b,.5);point.y+=.05;report.boundaries++;
          if(!live.some(r=>r.closest(point).distance<.211))failures.push({id:entry.id,name:c?.nm??mesh.name,error:'missing grind boundary',point:point.toArray()});
        }
        const rails=owned.filter(r=>r.grindable&&r.totalLength>3).sort((a,b)=>b.totalLength-a.totalLength);
        if(!rails.length)continue;
        let caught=false;
        attempts:for(const rail of rails.slice(0,3))for(const fraction of [.4,.2,.8])for(const side of [0,.35,-.35]){
          const t=rail.totalLength*fraction,position=rail.pointAt(t),heading=rail.tangentAt(t);
          position.y+=.15;const planar=Math.hypot(heading.x,heading.z);
          if(planar){position.x+=heading.z/planar*side;position.z-=heading.x/planar*side;}
          if(level.finishGlow.containsPoint(position))continue;
          player.pos.copy(position);player.settle(level,heading);player.pos.copy(position);player.prevPos.copy(position);
          player.camDir.copy(heading);player.state='air';player.grounded=false;
          player.freeSkate=player.airFromSkate=true;player.speed=8;player.vVel=0;
          player.step(CONST.fixedStep,makeInput({grindHeld:true,grindPressed:true}),level);
          if(player.state==='grind'){caught=true;report.catches++;break attempts;}
        }
        const lethal=player.state==='dead'&&(player.pos.y<level.killY||level.killBoxes.some(box=>box.intersectsBox(player.playerBox)));
        if(!caught&&!lethal)report.uncaught.push({name:c?.nm??mesh.name,index:mesh.userData.editorIdx,railLengths:rails.slice(0,3).map(r=>r.totalLength),state:player.state});
      }
      report.activeRails=live.length;reports.push(report);
      console.log(`${entry.id}: ${report.meshes} surfaces / ${report.boundaries} boundaries / ${report.catches} catches / ${report.uncaught.length} needs review (${report.buildMs}ms)`);
    }finally{level.dispose();}
  }
  const output=process.env.COURSE_EDGE_REPORT||join(tmpdir(),'course-edge-policy.json');
  await mkdir(dirname(output),{recursive:true});
  await writeFile(output,JSON.stringify({reports,failures},null,2));
  assert.deepEqual(failures,[],'ordinary surface policy/coverage failures');
  if(!process.argv.includes('--inspect'))assert.equal(reports.reduce((n,r)=>n+r.uncaught.length,0),0,'review uncaught physical edges');
  console.log(`PASS ${reports.length} course inventories; ${reports.reduce((n,r)=>n+r.boundaries,0)} boundary checks; ${reports.reduce((n,r)=>n+r.catches,0)} real catches.`);
}finally{await server.close();console.warn=warn;console.error=error;}
