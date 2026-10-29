import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {grindPilot,observeGrindPlayer} from './carlisle-grind-pilot.mjs';
const compiled=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const data=api.CARLISLE_TIDAL_RELAY_LEVEL,beats=api.CARLISLE_RELAY_GRINDS,point=api.carlislePoint,rows=[];
await withSkateRuntime(async({level,player:p,CONST,TUNING,THREE,server})=>{
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');assert.ok(normalizeCustomLevelData(data));
 p.competitionMode=false;p.endlessDeaths=true;const tuning=JSON.stringify(TUNING);
 for(const phase of (process.env.PHASES??'0,7,53').split(',').map(Number))for(const beat of beats){
  level.time=phase;level.update(0);p.totalDeaths=0;
  p.respawn(level,true,false,{position:new THREE.Vector3(...point(beat.start[0],beat.start[1]+.12,beat.start[2]??0)),heading:new THREE.Vector3(...point(beat.start[0]+3,0)).sub(new THREE.Vector3(...point(beat.start[0],0)))});
  const pilot=grindPilot(beat,api.CARLISLE_RELAY_JUMPS,point),samples=[];let completed=false,frame=0;
  for(;frame<60*60;frame++){
   const before=observeGrindPlayer(p,level),control=pilot.sample(before);
   if(control.done){completed=true;break;}
   const input=makeInput(control.input);p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();
   if(frame%12===0)samples.push({...observeGrindPlayer(p,level),input:control.input});
   if(p.isBailing||['dead','gameover'].includes(p.state)||p.totalDeaths)break;
  }
  const row={name:beat.name,phase,completed,seconds:frame/60,catches:pilot.catches,launches:pilot.launches,pops:pilot.pops,end:observeGrindPlayer(p,level),samples};rows.push(row);
  console.log(JSON.stringify({...row,samples:undefined}));
 }
 assert.equal(JSON.stringify(TUNING),tuning);
 await mkdir('docs/carlisle-relay/grinds',{recursive:true});await writeFile('docs/carlisle-relay/grinds/traversal.json',JSON.stringify({rows},null,2)+'\n');
 assert.ok(rows.every(r=>r.completed&&!r.end.bail&&!r.end.deaths),'a required rail/bounce route is not traversable');
 for(const row of rows){const beat=beats.find(b=>b.name===row.name);assert.deepEqual(row.catches,beat.rails.map(r=>r.name));assert.deepEqual(row.launches,beat.launches);assert.deepEqual(row.pops,beat.rails.filter(r=>r.popTo).map(r=>r.name));}
 console.log('PASS continuous spring-to-grind routes, charged rail exits, moving rebound and descending finish at all phases.');
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
