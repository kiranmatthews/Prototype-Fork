import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=text=>createHash('sha256').update(text).digest('hex');
const baseline=JSON.parse(await readFile(new URL('./fixtures/slipstream-2-original-gaps.json',import.meta.url),'utf8'));
const near=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1e-8,label+': '+actual+' != '+expected);
const range=values=>[Math.min(...values),Math.max(...values)];
export async function verifySlipstream2GapReduction(m){
 assert.equal(m.SLIPSTREAM_2_GAP_SCALE,.9);assert.equal(m.SLIPSTREAM_2_GAPS.length,baseline.gaps.length);
 const temple={destinations:m.SLIPSTREAM_2_TEMPLE,spawn:m.SLIPSTREAM_2_LEVEL.spawn,killY:m.SLIPSTREAM_2_LEVEL.killY,
  components:m.SLIPSTREAM_2_LEVEL.components.filter(c=>c.grp===1||c.cameraView)};
 assert.equal(hash(JSON.stringify(temple)),baseline.templeSha256,'Temple and spawn must stay unchanged');
 for(const [path,key]of [['../src/player.ts','playerSha256'],['../src/tuning.ts','tuningSha256']])
  assert.equal(hash(await readFile(new URL(path,import.meta.url))),baseline[key],'Runtime/tuning must stay unchanged');
 const gradual=m.slipstream2Height(0)-m.slipstream2Height(1);near(gradual,baseline.gradualDescent,'Gradual vertical descent');
 const ratios=[];
 for(let i=0;i<baseline.gaps.length;i++){
  const old=baseline.gaps[i],g=m.SLIPSTREAM_2_GAPS[i];assert.equal(g.name,old.name);
  near(g.a,old.a,g.name+' takeoff station');near(g.width,old.width*.9,g.name+' 10% smaller width');
  near(g.b-g.a,g.width,g.name+' gap extent');
  const takeoff=m.slipstream2Point(g.a),landing=m.slipstream2Point(g.b);
  for(let k=0;k<3;k++)near(takeoff[k],old.takeoff[k],g.name+' takeoff coordinate '+k);
  const physical=Math.hypot(landing[0]-takeoff[0],landing[2]-takeoff[2]);
  near(physical,old.physicalWidth*.9,g.name+' physical width');ratios.push(physical/old.physicalWidth);
  for(const p of old.approach)near(m.slipstream2Height(p.s),p.height,g.name+' approach height');
  const drop=m.slipstream2Height(g.a)-m.slipstream2Height(g.b)-gradual*g.width-baseline.kickerRise;
  near(drop,old.flightDrop,g.name+' authored landing drop');
 }
 return{baselineRevision:baseline.revision,runtimeBaselineRevision:baseline.runtimeBaselineRevision,widthScale:.9,oldWidthMetres:range(baseline.gaps.map(g=>g.physicalWidth)),
  newWidthMetres:range(m.SLIPSTREAM_2_GAPS.map(g=>g.width)),physicalWidthRatios:range(ratios),
  unchangedTemple:true,unchangedTakeoffs:true,unchangedVerticalDrops:true,unchangedRuntimeAndTuning:true};
}
