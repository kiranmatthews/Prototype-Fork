import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const summarize=s=>{const v=[...s].sort((a,b)=>a-b);return {meanMs:s.reduce((a,b)=>a+b,0)/s.length,p50Ms:v[Math.floor(v.length*.5)],p95Ms:v[Math.floor(v.length*.95)],samples:s.length};};
await withBlockworksRuntime(async env=>{
 const {SkateRace}=await env.server.ssrLoadModule('/src/race/runtime.ts');
 const race=new SkateRace(env.scene,env.p,false,()=>true);race.attach(env.l,'coconut-cart-rally');race.start('race',0);race.phase='running';
 const carts=race.carts,report={};let collecting=false;const measures={};
 for(const [object,method,label] of [[carts,'step','cartStep'],[carts,'nearest','targetSearch'],[carts.fleet,'present','fleetPresentation'],[carts.effects,'update','effectsUpdate'],[carts.effects,'present','effectsPresentation']]){
  if(!object[method])continue;const fn=object[method];measures[label]=[];object[method]=function(...args){const start=performance.now(),out=fn.apply(this,args);if(collecting)measures[label].push(performance.now()-start);return out;};
 }
 const run=(name,steps)=>{const timings=[];collecting=false;for(let i=0;i<60;i++){race.step(env.dt,race.drive(0));race.applyRenderInterpolation(.5);}
  for(const values of Object.values(measures))values.length=0;collecting=true;
  for(let i=0;i<steps;i++){const start=performance.now();race.step(env.dt,race.drive(0));race.applyRenderInterpolation(.5);race.hud();timings.push(performance.now()-start);}
  collecting=false;report[name]={total:summarize(timings),...Object.fromEntries(Object.entries(measures).filter(([,s])=>s.length).map(([k,s])=>[k,summarize(s)])),flameInstances:carts.effects.flames.count,flameVisible:carts.effects.flames.visible};};
 run('racing',900);
 for(let i=0;i<race.count;i++)carts.hit(i,undefined,1);
 run('allDriversEjected',600);
 report.fleet=carts.fleet.stats;report.owners=[...carts.cartForRacer];
 race.attach({skateRace:null},'flats');await writeFile(process.env.CART_POLISH_REPORT??'/private/tmp/cart-polish-benchmark.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
},{modulePath:'/src/levels/coconut-cart-rally.ts',source:m=>m.COCONUT_CART_RALLY_LEVEL,levelId:'coconut-cart-rally'});
