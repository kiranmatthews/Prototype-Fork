import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5421/';
const output=process.env.CAVE_REVIEW_OUTPUT||'/private/tmp/cave-collapse-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={runs:[],errors:[]};
try{
 for(const mode of (process.env.CAVE_REVIEW_MODES||'lite,full').split(',')){
  const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('solProtoDebugChrome','visible'));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push({mode,error:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({mode,error:m.text()});});
  await page.goto(base+'?playtest&level=sky'+(mode==='lite'?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  const menu=page.locator('[data-debug-tab="menu"]');if(await menu.getAttribute('aria-expanded')!=='true')await menu.click();
  await page.getByTitle('Crumblewake Cave',{exact:true}).filter({hasText:'Crumblewake Cave'}).click();
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='cave-collapse'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  if(await menu.getAttribute('aria-expanded')==='true')await menu.click();
  await page.waitForTimeout(1200);
  if(process.env.CAVE_REVIEW_RECOVERY_ONLY!=='1'){
  const before=await page.evaluate(()=>window.__game.player.pos.x);await page.keyboard.down('ArrowRight');await page.waitForTimeout(700);await page.keyboard.up('ArrowRight');
  const after=await page.evaluate(()=>window.__game.player.pos.x);assert.ok(after>before+1,'real keyboard moves right through the side-on entry');
  await page.evaluate(()=>window.__game.player.respawn(window.__game.getLevel(),true));
  await page.waitForTimeout(200);await page.screenshot({path:`${output}/${mode}-entry.png`});
  await page.evaluate(()=>{
   const g=window.__game,p=g.player,realStep=p.step.bind(p),realCommit=p.commitRenderStep.bind(p);
   let stage=0,count=0,gap=0,frame=0,last={},done=false,failed=null;
   const gaps=[[76,79],[136,139],[184,187]],events=[];
   const record=()=>({frame,stage,gap,pos:p.pos.toArray(),grounded:p.grounded,state:p.state,phase:g.getLevel().caveCollapse.phase,front:g.getLevel().caveCollapse.front,collapsed:g.getLevel().caveCollapse.collapsed,checkpoint:g.getLevel().checkpoints[0].active});
   const sample=()=>{
    if(stage===0){if(p.pos.x>-50){stage=1;count=0;}return {moveX:1};}
    if(stage===1){if(++count>15){stage=2;return {moveX:1};}return {moveX:1,jumpHeld:true};}
    if(stage===2){if(p.pos.x>-1.8){stage=3;count=0;return {};}return {moveX:1};}
    if(stage===3){if(++count>=30)stage=4;return {};}
    if(stage===4){if(p.pos.z>gaps[gap][0]-3.5){stage=5;count=0;}return {moveY:-1,spinHeld:p.pos.z>3&&p.pos.z<9};}
    if(stage===5){if(++count>15){stage=6;return {moveY:-1};}return {moveY:-1,jumpHeld:true};}
    if(stage===6){if(p.pos.z>gaps[gap][1]+5&&p.grounded){gap++;stage=gap<3?4:7;events.push(record());}return {moveY:-1};}
    return {moveY:-1};
   };
   p.step=(dt,input,level)=>{
    if(done||failed){realStep(dt,input,level);return;}
    const request=sample(),s={...input,moveX:request.moveX??0,moveY:request.moveY??0};
    for(const k of ['jump','grind','spin','grab','transfer']){s[k+'Held']=!!request[k+'Held'];s[k+'Pressed']=s[k+'Held']&&!last[k+'Held'];}
    s.jumpReleased=!s.jumpHeld&&!!last.jumpHeld;s.restartPressed=false;last={...s};realStep(dt,s,level);
   };
   p.commitRenderStep=(...args)=>{realCommit(...args);if(done||failed)return;frame++;if(p.state==='dead'||p.isBailing)failed='route failure '+JSON.stringify(record());if(p.state==='finished'){done=true;events.push(record());}if(frame>6000)failed='timeout';};
   window.__caveReview={get status(){return {...record(),done,failed,events};},stop(){done=true;}};
  });
  let lastStage=-1,shotChase=false;
  for(let i=0;i<160;i++){
   await page.waitForTimeout(1000);const status=await page.evaluate(()=>window.__caveReview.status);
   if(status.stage!==lastStage){console.log(mode,JSON.stringify(status));lastStage=status.stage;}
   assert.equal(status.failed,null);
   if(status.stage===3)await page.screenshot({path:`${output}/${mode}-clearing.png`});
   if(!shotChase&&status.pos[2]>60&&status.pos[2]<130){await page.screenshot({path:`${output}/${mode}-chase.png`});shotChase=true;}
   if(status.done){assert.equal(status.state,'finished');assert.equal(status.phase,'escaped');report.runs.push({mode,...status});break;}
   if(i===159)throw Error('Browser route timed out');
  }
  }
  if(mode==='lite'){
   await page.evaluate(()=>{const g=window.__game;g.switchLevel('cave-collapse');g.gameFlow.hide();g.player.warpCheckpoint(g.getLevel(),1);});
   await page.keyboard.down('ArrowDown');
   await page.waitForFunction(()=>window.__game.player.pos.z>30,null,{timeout:20000});await page.keyboard.up('ArrowDown');
   await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:20000}).catch(async error=>{console.error('catch timeout',await page.evaluate(()=>{const g=window.__game;return {p:g.player.pos.toArray(),state:g.player.state,phase:g.getLevel().caveCollapse.phase,front:g.getLevel().caveCollapse.front,blocked:g.gameFlow.blocksGameplay};}));throw error;});
   const caught=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),phase:window.__game.getLevel().caveCollapse.phase}));
   await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.state==='ride'&&window.__game.getLevel().caveCollapse.phase==='waiting',null,{timeout:20000});
   assert.ok(caught.position[1]>-1,'falling cave rock catches the idle player on supported ground');
   await page.keyboard.down('ArrowDown');
   await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:25000});await page.keyboard.up('ArrowDown');
   const pit=await page.evaluate(()=>({position:window.__game.player.pos.toArray()}));assert.ok(pit.position[1]<-4,'walking into the causeway is a pit failure');
   await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.state==='ride'&&window.__game.getLevel().caveCollapse.phase==='waiting',null,{timeout:20000});
   const retry=await page.evaluate(()=>{const g=window.__game;return {position:g.player.pos.toArray(),spawn:g.getLevel().currentSpawn.toArray(),checkpoint:g.getLevel().checkpoints[0].active};});
   assert.ok(retry.checkpoint);assert.ok(Math.hypot(...retry.position.map((x,i)=>x-retry.spawn[i]))<3);
   report.recovery={caught,pit,retry};console.log('PASS lite: actual keyboard collapse catch, pit death and supported checkpoint retries');
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);console.log('PASS: requested browser gameplay checks and clean consoles');
}finally{await writeFile(output+'/validation.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
