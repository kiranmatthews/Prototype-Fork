import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { withBlockworksRuntime } from './blockworks-runner.mjs';

// Each run starts once on a real dry approach. All acceleration, ice travel,
// steering, takeoff and landing thereafter come from ordinary input samples.
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const authored=await server.ssrLoadModule('/src/levels/codex-lab.ts');
await server.close();
const evidence=[],failures=[];
for(const spec of [
  {name:'Frozen bends: three ice patches and launch',start:510,y:0,edge:724,end:750,patches:[[575,599],[635,660],[687,714]],overspeed:false},
  {name:'Roof relay: downhill overspeed through ice and gap',start:1560,y:13.2,edge:1687,end:1710,patches:[[1640,1664]],overspeed:true},
  {name:'Crown sweep: ice, jump and dry brake before tower',start:1910,y:6,edge:2018,patches:[[1985,2008]],overspeed:false,brake:true},
]) {
  const contacts=[];
  try {
    await withBlockworksRuntime(ctx=>{
      const {p,sourceModule:m,until,releaseJump,steerToward,trace,TUNING}=ctx;
      const original=JSON.stringify(TUNING),station=()=>20-p.pos.z;
      const steer=()=>steerToward(m.routePoint(station()+14,0));
      const alive=()=>assert.ok(!p.isBailing && !['dead','gameover','hang'].includes(p.state),JSON.stringify(ctx.snapshot()));
      until(()=>station()>=spec.edge-.8,()=>({...steer(),jumpHeld:true}),{maxFrames:1800,label:spec.name+' approach'});
      const launch=ctx.snapshot();
      assert.ok(p.grounded && p.freeSkate,'approach must arrive on the board without a reset');
      assert.ok(p.speed>21.5,'real approach must earn gap speed');
      releaseJump(steer());assert.equal(p.state,'air','charged release must launch');
      until(()=>p.grounded,()=>({...steer(),jumpHeld:false}),{maxFrames:120,label:spec.name+' landing'});
      const receivingEdge=m.BLOCKWORKS_GAPS.find(gap=>gap.a===spec.edge).b;
      assert.ok(station()>=receivingEdge && p.state==='ride','jump must land beyond the authored gap');
      const landing=ctx.snapshot();
      if(spec.brake) {
        until(()=>p.speed<.08,()=>({...steer(),grabHeld:true}),{maxFrames:300,label:'dry brake before crown climb'});
        const crown=m.BLOCKWORKS_CLIMBS.find(climb=>climb.name==='Crown roof bays');
        const firstRoof=crown?.steps[0];
        const firstWedge=m.BLOCKWORKS_SKATE_RAMPS.find(wedge=>wedge.name==='Crown roof bays · skate tier 1');
        assert.ok(firstRoof && firstWedge,'authored Crown roof and wedge metadata missing');
        const [fx,,fz]=m.routeTangent(firstRoof.s);
        const towardRoof=(p.pos.x-firstRoof.point[0])*fx+(p.pos.z-firstRoof.point[2])*fz;
        assert.ok(p.grounded && !p.groundHit?.slippy && Math.abs(p.speed)<.08,
          'the receiving road/wedge must provide a supported dry stop');
        assert.ok(station()>=receivingEdge && towardRoof < -firstRoof.depth/2 && p.pos.y<firstRoof.top,
          'dry braking must stop before the first roof face, including its rideable approach wedge');
        const firstWedgeComponent=ctx.source.components.find(c=>c.nm===firstWedge.name);
        assert.ok(firstWedgeComponent && firstWedgeComponent.slip!==true,'Crown approach wedge must remain dry');
      }else until(()=>station()>=spec.end,()=>({...steer(),jumpHeld:true}),{maxFrames:180,label:spec.name+' exit'});
      alive();
      const patchEvidence=spec.patches.map(([a,b])=>{
        const samples=contacts.filter(t=>20-t.position[2]>=a+.5 && 20-t.position[2]<=b-.5);
        assert.ok(samples.length>30,'ice crossing needs sustained contact');
        assert.ok(samples.every(t=>t.grounded),'a patch was skipped by jumping/falling');
        assert.ok(samples.every(t=>t.slippy && t.grip===.08),'the path must actually contact the authored deep ice');
        const entered=samples[0].speed,minimum=Math.min(...samples.map(t=>t.speed));
        assert.ok(entered>21.5 && minimum>20,'ice must carry the actual approach momentum');
        const lateral=Math.max(...samples.map(t=>Math.abs(t.position[0]-m.routeX(20-t.position[2]))));
        assert.ok(lateral<4.5,'ice line exceeded the physical ribbon width');
        return {a,b,frames:samples.length,entrySpeed:+entered.toFixed(2),minimumSpeed:+minimum.toFixed(2),maxWorldXOffset:+lateral.toFixed(2)};
      });
      if(spec.overspeed)assert.ok(patchEvidence[0].entrySpeed>24,'downhill stress must genuinely exceed ordinary top speed');
      // Camera-lane forward already bends with this course. A fixed screen-X
      // amplitude misses real steering on the gentler Crown sweep; require
      // correction input and an actual change of world travel heading instead.
      const moving=trace.filter(t=>t.grounded && t.speed>20);
      const firstHeading=moving[0]?.heading;
      const turn=firstHeading ? Math.max(...moving.map(t=>Math.acos(Math.max(-1,Math.min(1,
        t.heading[0]*firstHeading[0]+t.heading[2]*firstHeading[2]))))) : 0;
      const correction=Math.max(...trace.map(t=>Math.abs(t.input.moveX)));
      assert.ok(correction>.01 && turn>.05,`curve steering was not exercised: correction ${correction}, turn ${turn}`);
      assert.equal(p.totalDeaths,0);assert.equal(JSON.stringify(TUNING),original);
      evidence.push({name:spec.name,seconds:+(ctx.frame*ctx.dt).toFixed(2),patches:patchEvidence,
        takeoffSpeed:+launch.speed.toFixed(2),landingStation:+(20-landing.position[2]).toFixed(2),exit:ctx.snapshot().position});
    },{start:authored.routePoint(spec.start,spec.y+.02),onTick:(sample,ctx)=>contacts.push({...sample,slippy:ctx.p.groundHit?.slippy,grip:ctx.p.groundHit?.iceGrip})});
  }catch(error){failures.push({name:spec.name,error:error.message});}
}
console.log(JSON.stringify({evidence,failures},null,2));
assert.equal(failures.length,0,failures.map(f=>`${f.name}: ${f.error}`).join('\n'));
console.log('PASS continuous physically curved ice approaches, earned speed, steering, charged gaps and receiving bends');
