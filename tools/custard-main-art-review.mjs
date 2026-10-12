import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.CUSTARD_URL||'http://127.0.0.1:5198/';
const out=new URL('../docs/custard-creek-storyboard/main/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[],report={sections:[],errors};
const page=await browser.newPage({viewport:{width:1440,height:810}});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(base+'?playtest&level=custard-creek'+(process.env.CUSTARD_LITE?'&lite':''),{timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{window.__creek=await import('/src/levels/custard-creek.ts');await window.__game.getLevel().prepareJungleAssets();});
 for(const [name,s,u] of [['opening',65,0],['forest',575,-2],['halfpipe',955,0],['ferry',1590,2],['waterfall-approach',2380,0],['waterfall-brink',2420,3]]){
  await page.evaluate(([s,u])=>{const g=window.__game,p=g.player,l=g.getLevel(),m=window.__creek;
   p.respawn(l,true,false,{position:p.pos.clone().fromArray(m.custardPoint(s,m.custardHeight(s)+.12,u)),heading:p.pos.clone().fromArray(m.custardTangent(s))});p.commitRenderStep(l);},[s,u]);
  await page.waitForTimeout(1300);
  await page.screenshot({path:new URL(name+'.png',out).pathname});
  report.sections.push(await page.evaluate(name=>({name,position:window.__game.player.pos.toArray(),state:window.__game.player.state,grounded:window.__game.player.grounded,
   scenery:window.__game.getLevel().jungleAssetDiagnostics,render:window.__game.renderer.info.render}),name));
 }
 await writeFile(new URL('review.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify({sections:report.sections.map(({scenery,...r})=>({...r,assets:scenery?.assets})),errors},null,2));
}finally{await browser.close();}
