import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {withBlockworksRuntime} from '../blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
  const {CountryClubCarts}=await r.server.ssrLoadModule('/src/golf-cart/course.ts');
  const traffic=new CountryClubCarts(r.scene);r.scene.updateMatrixWorld(true);
  const attached=performance.now();traffic.attach(r.l,'country-club');
  const report={attachMs:performance.now()-attached,runs:[]},roam=traffic.roaming,world=traffic.fleet.physics;
  console.log(JSON.stringify({attachMs:report.attachMs}));
  const rider={pos:r.p.pos,speed:0,state:'dead'};
  for(const seed of [0,1,71]){
    roam.reset(world,seed);
    const travel=Array(10).fill(0),maxHome=Array(10).fill(0),timings=[];let offroad=0,total=0;
    for(let frame=0;frame<60*220;frame++){
      const start=performance.now();traffic.step(1/60,rider);timings.push(performance.now()-start);
      world.carts.forEach((c,i)=>{travel[i]+=Math.abs(c.speed)/60;
        if(frame%60===0){const near=roam.course.project({x:c.x,y:c.y,z:c.z}),home=roam.patches[i].home;total++;if(near.distance>roam.course.width(near.s)/2+5)offroad++;maxHome[i]=Math.max(maxHome[i],Math.hypot(c.x-home.x,c.z-home.z));}
      });
    }
    timings.sort((a,b)=>a-b);
    const run={seed,offroadFraction:offroad/total,travel,respawns:world.carts.map(c=>c.respawns),maxHome,trips:roam.drivers.map(d=>d.trips),nodes:roam.patches.map(p=>p.nodes.length),medianMs:timings[Math.floor(timings.length*.5)],p95Ms:timings[Math.floor(timings.length*.95)]};report.runs.push(run);console.log(JSON.stringify(run));
    assert.ok(travel.every(d=>d>800),'all ten carts keep moving across the actual field');
    assert.ok(maxHome.every(d=>d<125),'actual terrain and trees do not scatter carts out of their territories');
    assert.ok(run.respawns.every(n=>n<=2),'ponds cannot trap a cart in repeated recoveries');
    assert.ok(run.offroadFraction>.65,'actual terrain routes mostly use the field');
  }
  await writeFile(process.env.CART_ROAM_REPORT??'/private/tmp/cart-roaming-terrain.json',JSON.stringify(report,null,2));
  traffic.attach({walls:[]},'flats');console.log('Three seeded full-terrain roaming runs passed.');
},{modulePath:'/src/levels/country-club.ts',source:m=>m.COUNTRY_CLUB_LEVEL,levelId:'country-club'});
