import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
const js=ts.transpileModule(await readFile(new URL('../src/kiteTow.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {KiteTowMotion,KITE_TOW}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const tuning={cruiseSpeed:12,maxSpeed:23,chargeBoost:9,chargeDecay:10,jumpChargeTime:.4};
const idle={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false};
const m=new KiteTowMotion(1),step=(input=idle,grounded=true)=>m.step(1/60,300,grounded,input,tuning);
for(let i=0;i<600;i++)assert.equal(step().dz,0);
assert.equal(m.started,false);assert.ok(Math.abs(m.wind)>.01,'Waiting kite still reacts to wind');
step({...idle,jumpPressed:true,jumpHeld:true});assert.equal(m.started,true);
for(let i=0;i<45;i++)assert.equal(step({...idle,jumpHeld:true}).jumpCharge,null,'Holding never jumps');
assert.equal(m.charge,.4);assert.equal(step({...idle,jumpReleased:true}).jumpCharge,.4);
for(let i=0;i<30;i++)assert.equal(step(idle,false).jumpCharge,null);
m.reset(7);m.started=true;m.speed=12;
for(let i=0;i<20;i++)step({...idle,jumpHeld:true});
assert.ok(Math.abs(m.speed-15)<1e-8,'Charge adds the live normal acceleration exactly');
assert.ok(Math.abs(m.charge-20/60)<1e-8);
// Braking stores removed kinetic energy, not an endlessly farmed timer bonus.
m.speed=23;m.reserve=0;m.charging=false;m.charge=0;
for(let i=0;i<240;i++)step({...idle,moveY:-1});
assert.equal(m.speed,KITE_TOW.brakeFloor);
const stored=m.reserve;assert.ok(Math.abs(stored-(23**2-4.5**2)/2)<1e-7);
for(let i=0;i<240;i++)step({...idle,moveY:-1});assert.equal(m.reserve,stored);
let maxDelta=0,previous=m.speed;
for(let i=0;i<120;i++){step();maxDelta=Math.max(maxDelta,m.speed-previous);previous=m.speed;}
assert.equal(m.reserve,0);assert.ok(m.speed>22);assert.ok(maxDelta<.61,'Stored speed returns smoothly');
// Repeated pulls restore what was removed; they cannot manufacture overdrive.
m.speed=23;
for(let cycle=0;cycle<8;cycle++){
 for(let i=0;i<65;i++)step({...idle,moveY:-1,jumpHeld:true});
 for(let i=0;i<65;i++)step({...idle,jumpHeld:true});
 assert.ok(m.speed<=23+1e-7);assert.equal(m.reserve,0);
}
m.reset(7);step({...idle,spinPressed:true,moveY:-1});
for(let i=0;i<60;i++)step({...idle,moveY:-1});
assert.equal(m.speed,KITE_TOW.brakeFloor,'Starting with brake held still receives forward pull');
assert.equal(m.reserve,0,'Starting slowly does not manufacture stored energy');
const wind=seed=>{const w=new KiteTowMotion(seed);let prev=0,maxDelta=0,lo=1,hi=-1,x=0;const samples=[];
 for(let i=0;i<3600;i++){const r=w.step(1/60,500,true,{...idle,spinPressed:i===0},tuning);x+=r.dx;lo=Math.min(lo,w.wind);hi=Math.max(hi,w.wind);maxDelta=Math.max(maxDelta,Math.abs(w.wind-prev));prev=w.wind;if(i%60===0)samples.push(w.wind);}
 return {seed,lo,hi,maxDelta,x,samples};};
const winds=[wind(1),wind(92)];assert.notDeepEqual(winds[0].samples,winds[1].samples);
for(const w of winds){assert.ok(w.lo<-.2&&w.hi>.2);assert.ok(w.maxDelta<.05);assert.ok(Math.abs(w.x)>1);}
m.reset();for(let i=0;i<180;i++)assert.equal(step({...idle,jumpHeld:true}).dz,0,'Held input from death cannot restart');
// Review boundary inputs separately from the connected route: a late release
// may use coyote time or a landing buffer, but cancellation/reset must erase it.
const edges=[];
const prepare=()=>{m.reset(53);step({...idle,jumpPressed:true,jumpHeld:true});for(let i=0;i<30;i++)step({...idle,jumpHeld:true});};
prepare();for(let i=0;i<4;i++)step({...idle,jumpHeld:true},false);
assert.equal(step({...idle,jumpReleased:true},false).jumpCharge,.4);edges.push('release within coyote window');
assert.equal(step(idle,false).jumpCharge,null,'A release is consumed once');edges.push('release consumed once');
prepare();for(let i=0;i<12;i++)step({...idle,jumpHeld:true},false);
assert.equal(step({...idle,jumpReleased:true},false).jumpCharge,null);
for(let i=0;i<4;i++)step(idle,false);
assert.equal(step().jumpCharge,.4);edges.push('air release buffers through a near landing');
prepare();for(let i=0;i<12;i++)step({...idle,jumpHeld:true},false);
step({...idle,jumpReleased:true},false);for(let i=0;i<12;i++)step(idle,false);
assert.equal(step().jumpCharge,null);edges.push('expired buffer cannot jump on landing');
prepare();assert.equal(step({...idle,jumpCancelled:true,jumpReleased:true}).jumpCharge,null);
assert.equal(m.charge,0);assert.equal(m.charging,false);edges.push('cancel overrides simultaneous release');
prepare();for(let i=0;i<12;i++)step({...idle,jumpHeld:true},false);
step({...idle,jumpReleased:true},false);m.reset(53);
assert.equal(step({...idle,jumpReleased:true}).jumpCharge,null);assert.equal(m.started,false);
assert.equal(step({...idle,spinPressed:true}).jumpCharge,null);edges.push('reset discards pending charge and buffer');
for(const button of ['jumpPressed','spinPressed','grindPressed','grabPressed']){
 m.reset(53);assert.equal(step().dz,0);assert.ok(step({...idle,[button]:true}).dz<0);
}edges.push('each fresh face-button edge starts the tow');
const report={pass:true,chargeSeconds:tuning.jumpChargeTime,chargeAcceleration:tuning.chargeBoost,storedBrakeEnergy:stored,maxReturnSpeedDelta:maxDelta,winds,edgeReview:edges};
await mkdir('docs/beach-street/kite-controls',{recursive:true});await writeFile('docs/beach-street/kite-controls/motion.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS wait/start, release charge, normal acceleration, stored braking, seeded wind and seven input-edge cases');
