import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);let module=process.env.PLAYWRIGHT_MODULE;
if(!module){try{module=require.resolve('playwright');}catch{module=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}}
const {chromium}=await import(module.startsWith('/')?pathToFileURL(module).href:module);
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5209').replace(/\/$/,'');
const out=process.env.SKY_CONSTRUCTION_BROWSER_OUTPUT||'/private/tmp/sky-construction-mechanics';await mkdir(out,{recursive:true});
const traces=process.env.SKY_CONSTRUCTION_OUTPUT||'/private/tmp/sky-construction-tests';
const flags=['jumpHeld','grindHeld','spinHeld','grabHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferHeld','transferPressed','jumpCancelled'];
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],results=[];
try{for(const [name,start] of [['skate',[-2.65,.12,6.8]],['tnt',[-1.85,.12,-106.65]]]){
 const native=JSON.parse(await readFile(traces+'/'+name+'.json','utf8'));
 assert.ok(native.result.pass);
 const frames=native.trace,data={v:2,level:'sky',date:new Date().toISOString(),tuning:{},tuningChanges:[],surfaceFrictionPolicy:1,
  mx:frames.map(f=>f.input.moveX),my:frames.map(f=>f.input.moveY),cy:frames.map(()=>0),
  b:frames.map(f=>flags.reduce((bits,k,i)=>bits|(f.input[k]?1<<i:0),0)),frames:frames.length,truncated:false};
 const page=await browser.newPage({viewport:{width:1280,height:720}});page.setDefaultTimeout(120000);page.setDefaultNavigationTimeout(120000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto(`${base}/?playtest&level=sky`);await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
 await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
 await page.evaluate(({start,data,name})=>{
  const g=window.__game,p=g.player,l=g.getLevel(),old=p.step;
  p.respawn(l,true,false,{position:p.pos.clone().fromArray(start),heading:p.pos.clone().set(0,0,-1)});
  const e=window.__skyMechanic={frames:0,tailFrames:0,tail:false,boardFrames:0,boardAirFrames:0,grindFrames:0,deaths:0,bails:0,tntLit:false,tntGone:false};
  const bomb=l.crates.find(c=>c.tnt&&Math.abs(c.mesh.position.z+109)<.1);
  p.step=function(...args){const active=g.replayer.active,result=old.apply(this,args);if(active||e.tail){
   if(active)e.frames=Math.max(e.frames,g.replayer.frame);else e.tailFrames++;if(p.freeSkate)e.boardFrames++;if(p.airFromSkate&&p.state==='air')e.boardAirFrames++;if(p.state==='grind')e.grindFrames++;
   if(p.totalDeaths)e.deaths=p.totalDeaths;if(p.isBailing)e.bails++;if(bomb?.fuse!==undefined)e.tntLit=true;if(bomb&&!bomb.alive)e.tntGone=true;
   if(active&&e.frames>=data.frames&&name==='tnt'&&!e.tntGone){e.tail=true;g.replayer.end();}
   if(e.frames>=data.frames&&(!e.tail||e.tntGone||e.tailFrames>=120)||e.deaths){e.final={position:p.pos.toArray(),state:p.state,grounded:p.grounded,speed:p.speed};g.replayer.end();p.step=old;g.gameFlow.showPause({levelName:'Sky Bridge',inWarpRoom:false});}
  }return result;};g.replayer.begin(data);
 },{start,data,name});
 await page.waitForFunction(()=>window.__skyMechanic.final);
 const result=await page.evaluate(()=>({...window.__skyMechanic,stamp:document.querySelector('.hud-build')?.textContent}));result.name=name;results.push(result);
 await page.screenshot({path:out+'/'+name+'.png'});await page.close();
 assert.equal(result.deaths,0,name+' must survive');assert.equal(result.bails,0,name+' must remain controlled');
 assert.equal(result.frames,data.frames,name+' must consume the whole ordinary-input take');
 if(name==='skate'){assert.ok(result.boardFrames>30);assert.ok(result.boardAirFrames>10);assert.ok(result.grindFrames>90);}
 else{assert.equal(result.tntLit,true);assert.equal(result.tntGone,true);assert.ok(result.tailFrames<120);}
 console.log(JSON.stringify(result));
 }assert.deepEqual(errors,[]);
}finally{await writeFile(out+'/report.json',JSON.stringify({base,results,errors},null,2));await browser.close();}
