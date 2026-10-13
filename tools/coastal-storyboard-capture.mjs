import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require.resolve('playwright');}catch{playwright=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(playwright).href);
import {mkdir,writeFile} from 'node:fs/promises';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=root+'docs/coastal-storyboard';
const after=process.argv.includes('--after'),lite=!after||process.argv.includes('--lite');
const folder=after?'after':'before';
await mkdir(out+'/'+folder,{recursive:true});
const sections=[
 ['01-market-welcome','Market welcome',-15,12,'Opening market street; sunny welcoming town and first collectibles'],
 ['02-market-descent','Market descent',180,8.8,'Descending main street; layered terracotta roofs and ocean reveal'],
 ['03-harbour-crossing','Harbour crossing',405,4,'First canal jump, harbour plaza and seafront shops'],
 ['04-canal-low','Canal low street',530,4,'Low canal promenade, waterfront cafes and shaded arcades'],
 ['05-canal-plaza','Raised canal plaza',710,9,'Raised plaza with climb sequence, blue-green shutters and flowering planters'],
 ['06-cliff-crossing','Canal to cliff crossing',875,6,'Second gap, sculpted cream sandstone cliffs and uphill district'],
 ['07-cliff-ascent','Cliff ascent',1040,5,'Uphill road framed by hillside villas and palms'],
 ['08-clifftop-plaza','Clifftop plaza',1200,15,'Panoramic clifftop promenade and sun-warmed villas'],
 ['09-surf-arcade','Surf arcade',1480,7,'Playful surf shops and ice-cream arcade with scalloped striped awnings'],
 ['10-arcade-crossing','Low arcade crossing',1785,2,'Third gap and arrival into colourful festival district'],
 ['11-festival-rise','Festival rise',1990,5,'Uphill festival street with high bunting and cheerful seaside shops'],
 ['12-festival-plaza','Festival high plaza',2150,13,'Broad sunlit festival plaza and clock-tower landmark'],
 ['13-lighthouse-crossing','Lighthouse crossing',2655,2.5,'Lighthouse district, fourth canal gap, cream coral lighthouse landmark'],
 ['14-finish-promenade','Finish promenade',2920,7,'Celebratory waterfront finish boulevard and distant lighthouse'],
].map(([id,title,distance,y,brief])=>({id,title,level:'coastal-street-run',position:[0,y+.12,-distance],brief}));
sections.push(...[
 ['15-bonus-arrival','Rooftop Deliveries: arrival',-6,'Side-view rooftop arrival among the same pastel seafront town'],
 ['16-bonus-bounce','Rooftop Deliveries: bounce puzzle',12,'Side-view rooftop finite-bounce crate puzzle; retain every crate and platform'],
 ['17-bonus-fuse','Rooftop Deliveries: fuse and exit',40,'Side-view rooftop TNT puzzle and return gate above the friendly harbour'],
].map(([id,title,x,brief])=>({id,title,level:'bonus-coastal',position:[x,.12,0],brief})));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto((process.env.COASTAL_BASE??'http://127.0.0.1:5264/')+'?playtest&level=coastal-street-run'+(lite?'&lite':''),{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 let current='';
 for(const s of sections){
  if(process.env.COASTAL_SCENES&&!process.env.COASTAL_SCENES.split(',').includes(s.id))continue;
  if(current!==s.level){await page.evaluate(async id=>{const g=window.__game;g.restoreBuiltin(id);await g.switchLevel(id);await g.getLevel().prepareJungleAssets();},s.level);current=s.level;}
  await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(s=>{const g=window.__game,p=g.player,l=g.getLevel();g.campaign.startEphemeral();p.respawn(l,true,false,{position:p.pos.clone().set(...s.position),heading:p.camDir.clone().set(s.level==='bonus-coastal'?1:0,0,s.level==='bonus-coastal'?0:-1)});p.invulnTimer=120;p.invulnSilent=true;p.lives=99;},s);
  await page.waitForTimeout(1300);
  await page.evaluate(async()=>window.__game.getLevel().prepareJungleAssets());
  await page.waitForTimeout(200);
  s.capture=await page.evaluate(()=>{const g=window.__game;return {player:g.player.pos.toArray(),grounded:g.player.grounded,camera:g.camera.position.toArray(),target:g.player.camDir.toArray(),fov:g.camera.fov,stamp:document.querySelector('.hud-build')?.textContent,assets:g.getLevel().jungleAssetDiagnostics,render:{...g.renderer.info.render}};});
  await page.screenshot({path:out+'/'+folder+'/'+s.id+'.png'});
  console.log(s.id,JSON.stringify(s.capture));
 }
 await writeFile(out+'/'+(after?`review-${lite?'lite':'full'}.json`:'sections.json'),JSON.stringify({capturedAt:new Date().toISOString(),camera:'unaltered player gameplay camera',mode:lite?'lite':'full',sections,errors},null,2)+'\n');
 console.log('ERRORS',JSON.stringify(errors));
 if(errors.length)throw new Error('Browser errors: '+errors.join('\n'));
}finally{await browser.close();}
