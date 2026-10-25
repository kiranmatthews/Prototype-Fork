import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.env.CART_POLISH_OUTPUT??'/private/tmp/cart-polish-browser',base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5493';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1280,height:720},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=coconut-cart-rally`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getSkateRace()?.carts&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.getByRole('button',{name:'RACE',exact:true}).click();await page.waitForFunction(()=>window.__game.getSkateRace().phase==='running',null,{timeout:30000});
 await page.evaluate(()=>{const g=window.__game,r=g.getSkateRace();r.carts.drive=()=>({moveX:0,moveY:0});g.renderQualitySettings.setRegularResolution(null);});
 await page.waitForTimeout(1500);
 const sample=()=>page.evaluate(async()=>{const g=window.__game,r=g.getSkateRace(),s=[],ms={},originals=[];for(const [obj,key]of [[r,'step'],[r.carts,'present'],[r.carts.fleet,'present']]){const name=obj===r?'raceStep':obj===r.carts?'cartPresentation':'fleetPresentation',fn=obj[key];ms[name]=[];obj[key]=function(...a){const t=performance.now(),out=fn.apply(this,a);ms[name].push(performance.now()-t);return out;};originals.push(()=>obj[key]=fn);}
  let last=performance.now();for(let i=0;i<180;i++)await new Promise(resolve=>requestAnimationFrame(t=>{if(i>10)s.push(t-last);last=t;resolve();}));for(const restore of originals)restore();
  const stat=v=>{v.sort((a,b)=>a-b);return {meanMs:v.reduce((a,b)=>a+b,0)/v.length,p50Ms:v[Math.floor(v.length*.5)],p95Ms:v[Math.floor(v.length*.95)]};};return {frame:stat(s),...Object.fromEntries(Object.entries(ms).map(([k,v])=>[k,stat(v)])),render:g.getRenderFrameStats(),fleet:r.carts.fleet.stats,flames:r.carts.effects.flames.count,stamp:document.querySelector('.hud-build')?.textContent};});
 const calm=await sample();await page.screenshot({path:`${out}/calm.png`});
 await page.evaluate(()=>{const c=window.__game.getSkateRace().carts;for(let i=0;i<8;i++)c.hit(i,undefined,1);});await page.waitForTimeout(1500);
 const fires=await sample();await page.screenshot({path:`${out}/fires.png`});
 const resources=await page.evaluate(()=>({objects:window.__game.scene?.children.length??null}));
 assert.deepEqual(errors,[]);const report={calm,fires,resources,errors};await writeFile(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
