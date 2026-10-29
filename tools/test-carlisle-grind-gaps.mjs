import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
import {grindPilot,observeGrindPlayer} from './carlisle-grind-pilot.mjs';
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const data=api.CARLISLE_TIDAL_RELAY_LEVEL,point=api.carlislePoint,rows=[];
await withSkateRuntime(async({level,player:p,CONST,TUNING,THREE})=>{
 p.competitionMode=false;p.endlessDeaths=true;const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let emptySpans=0;
 for(const beat of api.CARLISLE_RELAY_GRINDS){
  for(const line of beat.rails){const rail=level.rails.find(r=>r.object.userData.sourceName===line.name);assert.ok(rail);
   for(const t of [.2,.5,.8]){const at=rail.pointAt(rail.totalLength*t);ray.set(at.clone().add(new THREE.Vector3(0,2,0)),down);ray.far=at.y+20;
    assert.equal(ray.intersectObjects(level.groundMeshes,false).filter(h=>h.face?.normal.y>.2).length,0,'walkable bypass under '+line.name);emptySpans++;}}
  for(const variant of ['feet without Grind','full-speed board without Grind',...(beat.rails.some(r=>r.popTo)?['grind without exit jump']:[])]){
   const bypass=!variant.startsWith('grind'),mounted=variant.startsWith('full-speed'),first=api.CARLISLE_RELAY_JUMPS.find(j=>j.name===beat.launches[0]);
   const start=bypass?first.from:beat.start,station=start[0]+(mounted?5.8:0),at=point(station,start[1]+.12,start[2]??0);
   level.time=0;level.update(0);p.totalDeaths=0;p.respawn(level,true,false,{position:new THREE.Vector3(...at),heading:new THREE.Vector3(...point(station+3,0)).sub(new THREE.Vector3(...point(station,0)))});
   if(mounted){p.freeSkate=true;p.speed=TUNING.downhillMax;p.lastPlanar=p.speed;}
   p.masks=0;const pilot=grindPilot(beat,api.CARLISLE_RELAY_JUMPS,point,{bypass,noPop:!bypass});let completed=false,frame=0;
   for(;frame<3600;frame++){
    const control=pilot.sample(observeGrindPlayer(p,level));if(control.done){completed=true;break;}
    const input=makeInput(control.input);p.rawInput=input;p.step(CONST.fixedStep,input,level);level.update(CONST.fixedStep);input.consumeEdges();if(p.isBailing||p.totalDeaths||p.state==='dead')break;
   }
   const row={name:beat.name,variant,completed,seconds:frame/60,catches:pilot.catches,launches:pilot.launches,end:observeGrindPlayer(p,level)};rows.push(row);console.log(JSON.stringify(row));
  }
 }
 await mkdir('docs/carlisle-relay/grinds',{recursive:true});await writeFile('docs/carlisle-relay/grinds/gaps.json',JSON.stringify({emptySpans,rows},null,2)+'\n');
 assert.ok(rows.every(r=>!r.completed),'a simple no-grind or no-jump bypass clears a required crossing');
 console.log('PASS open-water rail spans and rejected direct no-grind / no-pop attempts.');
},{levelEntry:{id:'carlisle-coast',name:data.name,data}});
