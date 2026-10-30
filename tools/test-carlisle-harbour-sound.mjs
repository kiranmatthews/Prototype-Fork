import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile('src/carlisleHarbourSound.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ES2020}}).outputText;
const {CarlisleHarbourSound}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const reports=[];
for(const fps of [30,60,144]){
 const channels=new Map(),events=[],audio={setLoop(id,name,active,gain,rate=1){events.push({id,name,active,gain,rate});if(active)channels.set(id,{name,gain,rate});else channels.delete(id);}};
 const mix=new CarlisleHarbourSound(audio),position={x:0,y:1,z:0},sea=-8,dt=1/fps;
 for(let i=0;i<fps*5;i++)mix.update(dt,position,sea);
 const dock={...mix.diagnostics};assert.ok(dock.waterGain>dock.windGain*3,'dock should feature water');
 let biggestGainStep=0,last={...dock};
 for(let i=0;i<fps*5;i++){
  const t=(i+1)/fps;position.y=1+90*Math.sin(t/5*Math.PI);position.z=-22*t;
  const previous={...position};mix.update(dt,position,sea);assert.deepEqual(position,previous,'audio changed player position');
  biggestGainStep=Math.max(biggestGainStep,Math.abs(mix.diagnostics.windGain-last.windGain));last={...mix.diagnostics};
  if(i===Math.round(fps*2.5)-1){const peak={...mix.diagnostics};assert.ok(peak.windGain>peak.waterGain*1.7,'high bounce should open into wind');reports.push({fps,dock,apex:peak});}
 }
 assert.ok(biggestGainStep<.02,'mix gain jumped during a normal bounce');
 const before=mix.diagnostics.windGain;position.x=800;position.y=1;
 mix.update(dt,position,sea);assert.equal(mix.diagnostics.verticalSpeed,0,'respawn became a speed burst');assert.equal(mix.diagnostics.teleports,1);
 assert.ok(Math.abs(mix.diagnostics.windGain-before)<.02);
 const count=events.length;for(const bad of [NaN,Infinity,-1,0])mix.update(bad,position,sea);
 mix.update(dt,{x:NaN,y:1,z:2},sea);assert.equal(events.length,count,'invalid updates must not touch audio');
 assert.equal(channels.size,2);assert.ok(events.every(e=>e.gain>=0&&e.gain<=.34&&e.rate===1),'unbounded gain or pitch change');
 mix.dispose();assert.equal(channels.size,0);const stopped=events.length;mix.dispose();mix.update(dt,position,sea);assert.equal(events.length,stopped);
 reports.at(-1).biggestGainStep=biggestGainStep;reports.at(-1).disposed=true;
}
for(const row of reports)assert.ok(Math.abs(row.apex.windGain-reports[1].apex.windGain)<.002,'frame-rate dependent mix');
await writeFile('art/carlisle-shipyard/harbour-sound/controller.json',JSON.stringify({passed:true,reports},null,2)+'\n');
console.log(JSON.stringify({passed:true,frameRates:reports.map(r=>r.fps),apexWind:reports.map(r=>r.apex.windGain),boundedGains:true,teleportAndCleanup:true}));
