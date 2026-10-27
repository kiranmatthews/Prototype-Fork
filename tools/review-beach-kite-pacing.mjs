// Light authoring review: complements the connected collision/browser evidence.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
const load=async file=>{
 const js=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
};
const {KITE_TOW}=await load('../src/kiteTow.ts');
const {BEACH_KITE_BEATS:beats}=await load('../src/levels/beach-street-gameplay.ts');
const out=new URL('../docs/beach-street/kite-controls/',import.meta.url);
const native=JSON.parse(await readFile(new URL('native.json',out),'utf8'));
const speed=23; // Full normal charge; the connected run exercises this pace.
const shifts=[];
for(let i=1;i<beats.length;i++){
 const a=beats[i-1],b=beats[i],distance=b.lane-a.lane;if(Math.abs(distance)<.01)continue;
 // Start after the preceding beat clears; canal alignment is due before its ramp.
 const start=a.z+(a.kind==='gap'?25:7),end=b.z-(b.kind==='gap'?14:3);
 const available=(end-start)/speed;
 // Worst-case reversal: full opposite steering plus adverse wind, followed
 // by sustained maximum headwind. Runtime wind is smoother and less severe.
 let velocity=-KITE_TOW.steeringSpeed-KITE_TOW.windDrift,x=0,time=0;
 while(x<Math.abs(distance)&&time<5){velocity+=(KITE_TOW.steeringSpeed-KITE_TOW.windDrift-velocity)*(1-Math.exp(-KITE_TOW.steeringResponse/60));x+=velocity/60;time+=1/60;}
 shifts.push({from:a.name,to:b.name,metres:Math.abs(distance),availableSeconds:available,
  worstReversalSeconds:time,spareSeconds:available-time});
}
const landings=native.jumps.map(j=>{
 const jumpZ=-j.takeoff.p[2],beat=beats.find(b=>b.name===j.name);
 const next=beats.find(b=>b.z>beat.z&&['weave','hop','freight','patrol','gap'].includes(b.kind));
 if(!next)return null;
 // Full charged speed bounds the unbraked route's flight travel.
 const landBy=jumpZ+speed*j.flight.seconds;
 return {jump:j.name,next:next.name,landingBy:landBy,
  secondsUntilNextApproach:(next.z-17-landBy)/speed};
}).filter(Boolean);
const report={method:'Authored timing review alongside native collision tests. Steering assumes full opposite velocity and maximum sustained adverse wind; landing uses measured native airtime at full charged speed (23 m/s).',
 shifts,landings,minimumSteeringSpare:Math.min(...shifts.map(s=>s.spareSeconds)),
 minimumLandingBreath:Math.min(...landings.map(l=>l.secondsUntilNextApproach))};
console.log(JSON.stringify({tightestShifts:shifts.toSorted((a,b)=>a.spareSeconds-b.spareSeconds).slice(0,3),tightestLandings:landings.toSorted((a,b)=>a.secondsUntilNextApproach-b.secondsUntilNextApproach).slice(0,3)}));
assert.ok(report.minimumSteeringSpare>.3,'Each lane change has response margin beyond a full reversal');
assert.ok(report.minimumLandingBreath>.5,'Every jump settles before the next obstacle approach');
report.pass=true;
await writeFile(new URL('pacing-review.json',out),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,shifts:shifts.length,landings:landings.length,
 minimumSteeringSpare:report.minimumSteeringSpare,minimumLandingBreath:report.minimumLandingBreath}));
