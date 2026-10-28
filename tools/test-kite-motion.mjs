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
const speedCases=[];
for(const distance of [0,1000,2100]){
 const c=new KiteTowMotion(3);c.started=true;c.wind=c.windTarget=0;c.windTime=1000;
 for(let i=0;i<600;i++)c.step(1/60,distance,true,idle,tuning);
 const old=12+(distance<920?0:distance<1830?1.5:3);
 assert.ok(c.speed>old*1.3);speedCases.push({distance,oldCruise:old,cruise:c.speed});
}
m.reset(7);m.started=true;m.speed=12;
for(let i=0;i<20;i++)step({...idle,jumpHeld:true});
assert.ok(Math.abs(m.speed-16.2)<1e-8,'Every charge accelerates faster than the previous motor');
for(let i=0;i<240;i++)step({...idle,jumpHeld:true});
assert.ok(Math.abs(m.speed-31.05)<1e-7);speedCases.push({oldFullCharge:23,fullCharge:m.speed});
for(let i=0;i<48;i++)step({...idle,moveY:-1});
assert.equal(m.speed,KITE_TOW.brakeFloor);assert.ok(m.speed>4.5);
const stored=m.reserve,loaded=m.brakeSeconds;
for(let i=0;i<12;i++)step();
const partial={before:loaded,after:m.brakeSeconds,speed:m.speed,reserve:m.reserve};
assert.ok(partial.after>0&&partial.after<loaded);assert.ok(partial.speed>KITE_TOW.brakeFloor);assert.ok(partial.reserve<stored);
for(let i=0;i<12;i++)step({...idle,moveY:-1});
assert.ok(Math.abs(m.brakeSeconds-(partial.after+.2))<1e-7,'A second pull resumes the remaining counter');
let frames=0;while(m.autoReleases===0&&frames<180){step({...idle,moveY:-1});frames++;}
assert.equal(m.autoReleases,1);assert.equal(m.braking,false);assert.equal(m.bursting,true);
const burstStart=m.speed;
for(let i=0;i<10;i++)step({...idle,moveY:-1});
const burst={framesToLimit:frames,startSpeed:burstStart,speed:m.speed,counter:m.brakeSeconds,reserve:m.reserve};
assert.equal(m.brakeSeconds,0);assert.equal(m.reserve,0);assert.ok(m.speed>31);
for(let i=0;i<180;i++)step({...idle,moveY:-1});
assert.equal(m.autoReleases,1,'Continuing to hold Down cannot instantly reload after the forced ping');assert.equal(m.braking,false);
step();step({...idle,moveY:-1});assert.equal(m.braking,true);assert.ok(m.brakeSeconds>0);
// Removed kinetic energy plus bounded wind work cannot grow without a limit.
for(let cycle=0;cycle<8;cycle++){
 for(let i=0;i<90;i++)step({...idle,moveY:-1,jumpHeld:true});
 for(let i=0;i<90;i++)step({...idle,jumpHeld:true});
 assert.ok(m.speed<=31.05*KITE_TOW.burstSpeedScale+1e-7);
}
m.reset(7);step({...idle,spinPressed:true,moveY:-1});
for(let i=0;i<36;i++)step({...idle,moveY:-1});
assert.equal(m.speed,KITE_TOW.brakeFloor,'Starting with brake held still receives the faster crawl');
assert.ok(m.reserve>0,'Wind keeps loading the spring at the crawl floor');
const wind=seed=>{const w=new KiteTowMotion(seed);let prev=0,previousTarget=0,changes=0,reversals=0,maxDelta=0,lo=1,hi=-1,x=0,magnitude=0;const samples=[];
 for(let i=0;i<3600;i++){const r=w.step(1/60,500,true,{...idle,spinPressed:i===0},tuning);x+=r.dx;magnitude+=Math.abs(w.wind);lo=Math.min(lo,w.wind);hi=Math.max(hi,w.wind);maxDelta=Math.max(maxDelta,Math.abs(w.wind-prev));prev=w.wind;if(w.windTarget!==previousTarget){changes++;if(w.windTarget*previousTarget<0)reversals++;previousTarget=w.windTarget;}if(i%60===0)samples.push(w.wind);}
 return {seed,lo,hi,maxDelta,x,changes,reversals,meanAbsoluteDrift:magnitude/3600*KITE_TOW.windDrift,samples};};
const winds=[wind(1),wind(92)];assert.notDeepEqual(winds[0].samples,winds[1].samples);
for(const w of winds){assert.ok(w.lo<-.75&&w.hi>.75);assert.ok(w.maxDelta<.06);assert.ok(w.meanAbsoluteDrift>2.6);assert.ok(w.changes>=9&&w.changes<=18&&w.reversals>=5);}
assert.equal(KITE_TOW.steeringSpeed,9,'Only forward speed increases');assert.equal(KITE_TOW.steeringResponse,16);
const airSteering=[];
for(const moveX of [-1,0,1])for(const wind of [-1,0,1]){
 const ground=new KiteTowMotion(41),air=new KiteTowMotion(41);
 for(const c of [ground,air]){c.started=true;c.speed=31.05;c.wind=c.windTarget=wind;c.windTime=1000;}
 const input={...idle,moveX,jumpHeld:true};
 for(let i=0;i<90;i++)for(const c of [ground,air])c.step(1/60,500,true,input,tuning);
 let groundTravel=0,airTravel=0;
 for(let i=0;i<90;i++){
  const g=ground.step(1/60,500,true,input,tuning),a=air.step(1/60,500,false,input,tuning);
  assert.ok(Math.abs(a.dx-g.dx*.5)<1e-9,'Air travel is exactly half, including carried speed and wind');
  assert.equal(a.dz,g.dz,'Air steering does not reduce forward travel');groundTravel+=g.dx;airTravel+=a.dx;
 }
 const landing=air.step(1/60,500,true,input,tuning),reference=ground.step(1/60,500,true,input,tuning);
 assert.ok(Math.abs(landing.dx-reference.dx)<1e-9,'Landing restores the original ground steering');
 air.charge=.4;air.charging=true;
 const takeoff=air.step(1/60,500,true,{...input,jumpHeld:false,jumpReleased:true},tuning);
 const grounded=ground.step(1/60,500,true,input,tuning);
 assert.equal(takeoff.jumpCharge,.4);assert.ok(Math.abs(takeoff.dx-grounded.dx*.5)<1e-9,'The jump-release frame already uses half lateral speed');
 airSteering.push({moveX,wind,groundTravel,airTravel});
}
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
const report={pass:true,chargeSeconds:tuning.jumpChargeTime,chargeAcceleration:tuning.chargeBoost*KITE_TOW.accelerationScale,speedCases,partialRelease:partial,forcedBurst:burst,winds,airSteering,edgeReview:edges};
const out=process.env.BEACH_OUTPUT??'docs/beach-street/kite-spring';
await mkdir(out,{recursive:true});await writeFile(`${out}/motion.json`,JSON.stringify(report,null,2)+'\n');
console.log('PASS faster forward speed, original steering, partial brake memory, one-second forced burst, capped energy, slower strong gusts and seven input-edge cases');
