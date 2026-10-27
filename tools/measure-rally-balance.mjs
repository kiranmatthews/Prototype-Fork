import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const seeds=(process.env.RALLY_BALANCE_SEEDS??'11,741,2026').split(',').map(Number),out=process.env.RALLY_BALANCE_REPORT??'/private/tmp/rally-balance.json';
await withBlockworksRuntime(async e=>{
 const {SkateRace}=await e.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(e.scene,e.p,false,()=>true);race.attach(e.l,'coconut-cart-rally');const runs=[];
 console.log('RACE MODULES READY');
 for(const seed of seeds){
  race.start('race',seed);race.phase='running';const samples=[],draws=[],footSeconds=Array(8).fill(0),start=performance.now();let earlyLeader=null,leaderChanges=0,lastLeader=0;
  const crateBroken=race.crateBroken.bind(race);race.crateBroken=(box,id)=>{const before=race.riders[id]?.item,rank=race.rank(id),gap=race.order()[0].progress-race.riders[id].progress;crateBroken(box,id);const item=race.riders[id].item;if(!before&&item)draws.push({id,rank,gap,item,time:race.elapsed});};
  for(let f=0;f<14400&&!race.riders.every(r=>r.finish!==null);f++){
   race.step(e.dt,race.drive(0));const leader=race.order()[0].id;if(f>1200&&leader!==lastLeader)leaderChanges++;lastLeader=leader;
   if(earlyLeader===null&&race.elapsed>=20)earlyLeader=leader;
   for(const r of race.riders)if(r.finish===null&&!race.carts.isDriving(r.id))footSeconds[r.id]+=e.dt;
   if(f%1200===0){const order=race.order();samples.push({time:race.elapsed,order:order.map(r=>r.id),gap:order[0].progress-order[1].progress,positions:race.riders.map(r=>r.progress),health:race.riders.map(r=>race.carts.fleet.physics.carts[race.carts.cartForRacer[r.id]]?.health??0)});}
  }
  race.crateBroken=crateBroken;
  const order=race.order(),times=order.map(r=>r.finish),run={seed,earlyLeader,winner:order[0].id,earlyLeaderWon:earlyLeader===order[0].id,leaderChanges,allFinished:times.every(t=>t!==null),winningMargin:times[1]===null?null:times[1]-times[0],fieldSpread:times.at(-1)===null?null:times.at(-1)-times[0],medianGap:times[4]===null?null:times[4]-times[0],finishes:race.riders.map(r=>({id:r.id,finish:r.finish,falls:r.falls,progress:r.progress,footSeconds:footSeconds[r.id]})),stats:{...race.carts.stats},samples,draws,wallSeconds:(performance.now()-start)/1000};runs.push(run);console.log(JSON.stringify({...run,samples:undefined,draws:undefined}));await writeFile(out,JSON.stringify({runs},null,2)+'\n');
 }
 race.attach({skateRace:null},'flats');
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
