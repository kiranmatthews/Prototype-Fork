// Light authoring review: complements the connected collision/browser evidence.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
const load=async file=>{
 const js=ts.transpileModule(await readFile(new URL(file,import.meta.url),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
};
const {KiteTowMotion,KITE_TOW,kiteCruiseSpeed}=await load('../src/kiteTow.ts');
const {BEACH_KITE_BEATS:beats}=await load('../src/levels/beach-street-gameplay.ts');
const native=JSON.parse(await readFile(new URL('../docs/beach-street/kite/native.json',import.meta.url),'utf8'));
const shifts=[];
for(let i=1;i<beats.length;i++){
 const a=beats[i-1],b=beats[i],distance=b.lane-a.lane;if(Math.abs(distance)<.01)continue;
 // Start after the preceding beat clears; canal alignment is due before its ramp.
 const start=a.z+(a.kind==='gap'?25:7),end=b.z-(b.kind==='gap'?14:3);
 const available=(end-start)/kiteCruiseSpeed(b.z);
 // Worst-case reversal: start with full velocity in the opposite direction.
 const m=new KiteTowMotion(),sign=Math.sign(distance);m.age=10;m.lateral=-sign*KITE_TOW.steeringSpeed;
 let x=0,time=0;
 while(sign*x<Math.abs(distance)&&time<5){x+=m.step(1/60,b.z,true,{moveX:sign,jumpHeld:false,jumpPressed:false}).dx;time+=1/60;}
 shifts.push({from:a.name,to:b.name,metres:Math.abs(distance),availableSeconds:available,
  worstReversalSeconds:time,spareSeconds:available-time});
}
const landings=native.jumps.map(j=>{
 const jumpZ=-j.takeoff.p[2],beat=beats.find(b=>b.name===j.name);
 const next=beats.find(b=>b.z>beat.z&&['weave','hop','freight','patrol','gap'].includes(b.kind));
 if(!next)return null;
 // Use the later district's speed as a conservative upper bound on flight travel.
 const speed=kiteCruiseSpeed(next.z),landBy=jumpZ+speed*j.flight.seconds;
 return {jump:j.name,next:next.name,landingBy:landBy,
  secondsUntilNextApproach:(next.z-17-landBy)/speed};
}).filter(Boolean);
const report={method:'Authored timing review, not a substitute for native collision tests. Steering assumes a full opposite-velocity reversal; landing uses measured native airtime and the later district speed.',
 shifts,landings,minimumSteeringSpare:Math.min(...shifts.map(s=>s.spareSeconds)),
 minimumLandingBreath:Math.min(...landings.map(l=>l.secondsUntilNextApproach))};
assert.ok(report.minimumSteeringSpare>.3,'Each lane change has response margin beyond a full reversal');
assert.ok(report.minimumLandingBreath>.5,'Every jump settles before the next obstacle approach');
report.pass=true;
await writeFile(new URL('../docs/beach-street/kite/pacing-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pass:true,shifts:shifts.length,landings:landings.length,
 minimumSteeringSpare:report.minimumSteeringSpare,minimumLandingBreath:report.minimumLandingBreath}));
