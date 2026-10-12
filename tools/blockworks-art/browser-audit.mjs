import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BLOCKWORKS_URL||'http://127.0.0.1:5187';
const out='docs/blockworks-art/browser';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(base+'/?playtest&level=codex-lab');
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 const report=await page.evaluate(async()=>{
  const g=window.__game,l=g.getLevel(),p=g.player,m=await import('/src/levels/codex-lab.ts');
  await l.prepareJungleAssets();
  const frames=async(n)=>{for(let i=0;i<n;i++)await new Promise(requestAnimationFrame);};
  const timings=[];let last=performance.now();
  for(let i=0;i<150;i++){await new Promise(requestAnimationFrame);const t=performance.now();if(i>20)timings.push(t-last);last=t;}
  timings.sort((a,b)=>a-b);
  const result={method:'Independent browser smoke cases begin at named setup poses, then use only real normalized inputs; full continuous traversal is separately recorded by the journey pilot.',performance:{medianFrameMs:timings[Math.floor(timings.length*.5)],p95FrameMs:timings[Math.floor(timings.length*.95)],render:g.getRenderFrameStats()},assets:l.blockworksArtDiagnostics,cases:[]};
  const checkBindings=()=>{
    const owner=l.blockworksAssets,matrix=g.scene.matrixWorld.clone(),proxies=new Map(),errors=[];let rows=0;
    for(const batch of owner.boundBatches)for(const row of batch.rows){
      batch.mesh.getMatrixAt(row.index,matrix);const drawn=Math.abs(matrix.determinant())>1e-10,active=row.binding.active();rows++;
      if(drawn!==active)errors.push('instance state differs from native crate');
      let entry=proxies.get(row.binding.proxy);if(!entry){entry={active:false,kinds:new Set()};proxies.set(row.binding.proxy,entry);}
      entry.active||=active;if(drawn)entry.kinds.add(batch.mesh.name);
    }
    for(const[proxy,state]of proxies){
      if(state.kinds.size!==(state.active?1:0))errors.push('switch variants overlap or are missing');
      for(const mat of Array.isArray(proxy.material)?proxy.material:[proxy.material])if(mat.visible===state.active)errors.push('native material/ghost state mismatch');
    }
    return{proxies:proxies.size,rows,active:[...proxies.values()].filter(p=>p.active).length,errors};
  };
  let railSamples=0,maxRailSurfaceDistance=0,railModels=0;
  for(const rail of l.rails){rail.object.updateWorldMatrix(true,true);let found=false;
    rail.object.traverse(o=>{if(!o.isMesh||o.parent?.userData.blockworksModule?.kind!=='bw-grind-rail')return;found=true;
      const positions=o.geometry.attributes.position;
      for(let i=0;i<positions.count;i+=Math.max(1,Math.floor(positions.count/24))){const v=p.pos.clone().fromBufferAttribute(positions,i).applyMatrix4(o.matrixWorld);maxRailSurfaceDistance=Math.max(maxRailSurfaceDistance,rail.closest(v).distance);railSamples++;}
    });if(found)railModels++;
  }
  result.mechanical={railModels,railSamples,maxRailSurfaceDistance};
  const real=p.step.bind(p);let input={},previous={};let sampleFrame=0;
  p.step=(dt,event,level)=>{sampleFrame++;const sample=typeof input==='function'?input():input;Object.assign(event,{moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,restartPressed:false},sample);
   for(const button of ['jump','grind','spin','grab','transfer'])event[button+'Pressed']=!!event[button+'Held']&&!previous[button+'Held'];
   event.jumpReleased=!event.jumpHeld&&!!previous.jumpHeld;previous={...event};real(dt,event,level);};
  const simulate=async(n,buttons)=>{input=buttons;const until=sampleFrame+n;while(sampleFrame<until&&!g.gameFlow.blocksGameplay)await new Promise(requestAnimationFrame);input={};};
  const setup=async(position,heading)=>{g.gameFlow.hide();p.respawn(l,true,true,{position:p.pos.clone().set(...position),heading:p.pos.clone().set(...heading)});await frames(3);};
  await simulate(60,{moveY:1});result.cases.push({name:'spawn and forward traversal',grounded:p.grounded,position:p.pos.toArray(),deaths:p.totalDeaths});
  await setup(m.routePoint(158,-2.34,0),m.routeTangent(158));const before=p.totalDeaths;
  await simulate(240,{moveY:1,jumpHeld:true});const deathSeen=p.state==='dead'||p.totalDeaths>before;
  for(let i=0;i<600&&(p.state==='dead'||g.gameFlow.blocksGameplay);i++)await frames(1);
  await frames(8);result.cases.push({name:'pit fall',deathObserved:deathSeen,state:p.state,deaths:p.totalDeaths,
    respawned:p.grounded&&p.pos.distanceTo(l.currentSpawn)<2,position:p.pos.toArray()});
  const steer=target=>{const dx=target[0]-p.pos.x,dz=target[2]-p.pos.z,n=Math.hypot(dx,dz),f=l.laneDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1},fl=Math.hypot(f.x,f.z)||1;if(n<.1)return {spinHeld:true};return{moveX:(dx*-f.z+dz*f.x)/n/fl*.45,moveY:(dx*f.x+dz*f.z)/n/fl*.45,spinHeld:true};};
  const behind=(target,heading)=>[target[0]-heading[0]*2,target[1]+.04,target[2]-heading[2]*2];
  const cp=m.BLOCKWORKS_CHECKPOINTS[0];await setup(behind(cp.p,m.routeTangent(cp.s)),m.routeTangent(cp.s));
  await simulate(120,()=>steer(cp.p));result.cases.push({name:'checkpoint bank',active:l.checkpoints[0].active});
  const key=m.BLOCKWORKS_FOUNDRY.stairsKey;await setup([key[0],key[1]+.04,key[2]+1.25],m.routeTangent(1085));
  const owner=l.blockworksSurfaces;
  const checkVisuals=()=>{const rows=[...owner.proxies].filter(([group,proxy])=>proxy.userData.outlinedSurface&&Math.abs(proxy.position.x-p.pos.x)<20&&Math.abs(proxy.position.z-p.pos.z)<70);
    return rows.map(([group,proxy])=>({ghost:proxy.material.wireframe,visible:group.visible,proxyVisible:proxy.material.visible}));};
  await frames(5);const ghostBefore=checkVisuals();result.mechanical.before=checkBindings();
  for(let attempt=0;attempt<4&&!l.crates.some(c=>c.bang&&c.bangUsed);attempt++){await simulate(1,{spinHeld:true});await simulate(24,{});}await frames(5);
  result.cases.push({name:'switch-built Meshy route',before:ghostBefore,after:checkVisuals(),switchUsed:l.crates.some(c=>c.bang&&c.bangUsed)});
  result.mechanical.afterSwitch=checkBindings();
  l.reset(true);await frames(5);result.mechanical.afterReset=checkBindings();
  await setup(m.routePoint(2132,13.24),m.routeTangent(2132));
  await simulate(100,{moveY:1});result.cases.push({name:'finish gate',state:p.state,blockedByResults:g.gameFlow.blocksGameplay,position:p.pos.toArray()});
  return result;
 });
 await writeFile(out+'/smoke-and-performance.json',JSON.stringify({...report,errors},null,2));
 await page.screenshot({path:out+'/finish-smoke.png'});
 console.log(JSON.stringify({...report,errors}));
 assert.equal(errors.length,0);
 assert.equal(report.cases[0].grounded,true);
 assert.equal(report.cases[1].deathObserved,true);
 assert.equal(report.cases[1].respawned,true);
 assert.equal(report.cases[2].active,true);
 assert.equal(report.cases[3].switchUsed,true);
 assert.ok(report.cases[3].before.every(x=>!x.ghost||!x.visible),'inactive route must not look solid');
 assert.ok(report.cases[3].after.some(x=>!x.ghost&&x.visible),'activated route needs the actual Meshy modules');
 assert.equal(report.cases[4].state,'finished');
 assert.equal(report.mechanical.railModels,7);
 assert.ok(report.mechanical.railSamples>1000);
 assert.ok(report.mechanical.maxRailSurfaceDistance<.11,'Meshy rail skin must follow the original 9cm-radius grind line');
 for(const key of ['before','afterSwitch','afterReset'])assert.deepEqual(report.mechanical[key].errors,[],key+' bound visual state');
 assert.equal(report.mechanical.before.proxies,703);
 assert.equal(report.mechanical.before.active,3,'only the three unfired switches are solid before activation');
 assert.ok(report.mechanical.afterSwitch.active>report.mechanical.before.active,'actual spin must activate foundry instances');
 assert.equal(report.mechanical.afterReset.active,3,'hard reset restores three marked switches and ghosted steel');
}finally{await browser.close();}
