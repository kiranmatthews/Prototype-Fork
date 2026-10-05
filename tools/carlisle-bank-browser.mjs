// Real keyboard evidence for Carlisle's explicitly redesigned analytic bank.
// Only the starting pose is placed; speed, stance, contact, catch and drop-in
// come from the authored input/physics pipeline, with no capture-only grace.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5242').replace(/\/$/,'');
const out=process.env.CARLISLE_BANK_OUTPUT||'/private/tmp/carlisle-bank-smoke';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],report={base,started:new Date().toISOString(),captureOnlyGrace:false,errors};
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const sample=()=>page.evaluate(()=>{const g=window.__game,p=g.player,h=g.getLevel().halfpipes[0];return{position:p.pos.toArray(),grounded:p.grounded,state:p.state,freeSkate:p.freeSkate,speed:p.speed,lives:p.lives,deaths:p.totalDeaths,
 lipStallT:p.lipStallT,pipeHang:p.pipeHang,ground:p.groundHit?.name,analyticContact:p.groundHit?.halfpipe===h,rideNormal:p.rideNormal.toArray(),heading:p.axisF.toArray(),radius:h.radius,lipX:h.lipX,lipY:h.lipY};});
try{
 await page.goto(`${base}/?playtest&level=test&frameprobe&renderdiag`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('test');await g.switchLevel('test');await g.getLevel().prepareJungleAssets();});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.profile=await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel(),h=l.halfpipes[0];
  const candidates=[-740,-760,-780,-800,-814],obstacles=[...l.crates.filter(c=>!c.pending).map(c=>(c.box.min.z+c.box.max.z)/2),...l.stones.map(s=>s.mesh.position.z)];
  const z=candidates.sort((a,b)=>Math.min(...obstacles.map(o=>Math.abs(b-o)))-Math.min(...obstacles.map(o=>Math.abs(a-o))))[0];
  g.campaign.startEphemeral();g.player.respawn(l,true,false,{position:g.player.pos.clone().set(-2.4,h.yBottom+.1,z),heading:g.player.pos.clone().set(0,0,-1)});g.player.lives=30;
  return{radius:h.radius,flatHalf:h.flatHalf,length:Math.abs(h.l1-h.l0),lipX:h.lipX,lipY:h.lipY,selectedAlong:z};
 });
 assert.equal(report.profile.radius,4.5);assert.equal(report.profile.flatHalf,3);assert.equal(report.profile.length,120);
 await page.waitForTimeout(500);report.start=await sample();assert.ok(report.start.grounded,'real supported flat start');
 await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');
 await page.waitForFunction(()=>window.__game.player.freeSkate&&window.__game.player.pos.x>-.5,null,{timeout:12000});report.commit=await sample();
 await page.keyboard.down('KeyE');
 await page.waitForFunction(()=>{const g=window.__game,p=g.player,h=g.getLevel().halfpipes[0];return p.grounded&&p.groundHit?.halfpipe===h&&p.pos.y>h.yBottom+.35;},null,{timeout:12000});
 report.bank=await sample();await page.screenshot({path:`${out}/bank-ride.png`});
 await page.waitForFunction(()=>window.__game.player.lipStallT>0||window.__game.player.state==='grind',null,{timeout:15000});
 // The approach stick points out of the bowl; retire it immediately when
 // balance takes over, before image capture latency can tip out the back.
 for(const key of ['ArrowRight','Space','KeyE'])await page.keyboard.up(key);
 report.lip=await sample();assert.ok(Math.abs(Math.abs(report.lip.position[0])-report.profile.lipX)<.6,'keyboard reaches actual redesigned coping');
 await page.screenshot({path:`${out}/coping-catch.png`});
 await page.waitForTimeout(80);await page.keyboard.down('Space');await page.keyboard.down('ArrowLeft');
 await page.waitForFunction(()=>{const p=window.__game.player;return p.state==='air'||p.pipeHang;},null,{timeout:5000});report.drop=await sample();
 await page.waitForFunction(()=>{const g=window.__game,p=g.player,h=g.getLevel().halfpipes[0];return p.grounded&&p.state==='ride'&&Math.abs(p.pos.x-h.cross)<h.flatHalf+.5&&Math.abs(p.pos.y-h.yBottom)<.15;},null,{timeout:15000});
 report.recovered=await sample();await page.screenshot({path:`${out}/drop-in-recovered.png`});
 for(const key of ['Space','ArrowLeft'])await page.keyboard.up(key);
 assert.equal(report.recovered.lives,report.start.lives,'bank/coping/drop-in keeps the reserve life');assert.equal(report.recovered.deaths,report.start.deaths,'bank recovery does not respawn');
 assert.deepEqual(errors,[],'actual bank shaders/input have no browser errors');report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;report.last=await sample().catch(()=>null);throw e;}
finally{for(const key of ['ArrowRight','ArrowLeft','Space','KeyE'])await page.keyboard.up(key).catch(()=>{});report.finished=new Date().toISOString();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({pass:report.pass,out,failure:report.failure}));}
