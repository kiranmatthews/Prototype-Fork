import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(v=>v.startsWith('http'))||'http://127.0.0.1:5248';
const out=process.env.COUNTRY_CLUB_OUTPUT||'/private/tmp/country-club-sculpt';await mkdir(out,{recursive:true});
const fixture=await build({entryPoints:['src/levels/country-club.ts'],bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await page.route('**/water-review-source.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(base+'/?playtest&level=country-club',{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='country-club'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 for(const s of [400,920,1590,2310,2820]){
  await page.evaluate(async s=>{const m=await import('/water-review-source.js'),g=window.__game,l=g.getLevel(),p=g.player,V=p.pos.constructor;p.respawn(l,true,false,{position:new V(...m.countryClubPoint(s,0,.1)),heading:new V(...m.countryClubFrame(s).f)});},s);
  await page.waitForTimeout(1500);await page.screenshot({path:`${out}/water-${s}.png`});
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/water-review.json',JSON.stringify({initialPlacements:[400,920,1590,2310,2820],errors}));
}finally{await browser.close();}
