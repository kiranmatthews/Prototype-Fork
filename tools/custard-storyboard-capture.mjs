import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CUSTARD_URL||'http://127.0.0.1:5198/';
const phase=process.env.CUSTARD_CAPTURE_PHASE||'before';
const out=new URL(`../docs/custard-creek-storyboard/${phase}/`,import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
try{
 await page.goto(base+'?playtest&level=custard-creek'+(process.env.CUSTARD_FULL?'':'&lite'),{timeout:180000});await ready();
 await page.waitForTimeout(1600);
 await page.screenshot({path:new URL('main-reference.png',out).pathname});
 await page.evaluate(()=>window.__game.enterBonusRound());
 await page.waitForFunction(()=>window.__game.getCurrentLevel().id.startsWith('bonus'),null,{timeout:180000});await ready();
 await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
 const sections=[['01-arrival',-12],['02-towpath',-4],['03-first-hop',5.4],['04-raised-cache',12],['05-second-hop',19],['06-reedbank',26.5],['07-mill-view',34.5],['08-rewards',42],['09-return',47]],report=[];
 for(const [name,x] of sections){
  await page.evaluate(x=>{const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().set(x,x>=4&&x<=20?.47:.12,0),heading:p.pos.clone().set(1,0,0)});p.commitRenderStep(l);},x);
  await page.waitForTimeout(950);
  if(!await page.evaluate(()=>window.__game.player.grounded))throw new Error(`${name} has unsupported player spawn`);
  await page.screenshot({path:new URL(name+'.png',out).pathname});
  report.push(await page.evaluate(({name,x})=>({name,x,level:window.__game.getCurrentLevel().id,position:window.__game.player.pos.toArray(),camera:window.__game.camera.position.toArray(),quaternion:window.__game.camera.quaternion.toArray(),fov:window.__game.camera.fov}),{name,x}));
 }
 await writeFile(new URL('capture.json',out),JSON.stringify({baseCommit:'b0b8835',stage:phase,viewport:[1440,810],sections:report,errors},null,2));
 console.log(JSON.stringify({out:out.pathname,sections:report,errors},null,2));
}finally{await browser.close();}
