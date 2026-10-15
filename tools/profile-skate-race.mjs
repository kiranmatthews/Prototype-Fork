import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(async r=>{
 const {SkateRace}=await r.server.ssrLoadModule('/src/race/runtime.ts');const race=new SkateRace(r.scene,r.p);race.attach(r.l,'slipstream-race');race.start();race.phase='running';
 const stats={},stack=[];const wrap=(prototype,name)=>{const fn=prototype[name];if(typeof fn!=='function')return;prototype[name]=function(...args){const start=performance.now(),frame={children:0};stack.push(frame);try{return fn.apply(this,args);}finally{const ms=performance.now()-start;stack.pop();if(stack.length)stack[stack.length-1].children+=ms;const s=stats[name]??={ms:0,self:0,calls:0};s.ms+=ms;s.self+=ms-frame.children;s.calls++;}};};
 for(const prototype of [r.Player.prototype,r.Level.prototype])for(const name of Object.getOwnPropertyNames(prototype))if(name!=='constructor'&&typeof Object.getOwnPropertyDescriptor(prototype,name)?.value==='function')wrap(prototype,name);
 const start=performance.now();for(let i=0;i<150;i++){race.step(r.dt,race.drive(0));r.p.commitRenderStep(r.l);race.commitRenderStep();}
 console.log(JSON.stringify({total:performance.now()-start,stats:Object.fromEntries(Object.entries(stats).sort((a,b)=>b[1].self-a[1].self).slice(0,30))},null,2));
},{modulePath:'/src/levels/slipstream.ts',source:m=>m.SLIPSTREAM_LEVEL,levelId:'slipstream-race'});
