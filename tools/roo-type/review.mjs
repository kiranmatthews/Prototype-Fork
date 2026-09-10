import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.ROO_LAB_URL||'http://127.0.0.1:5178/';
const out=process.env.ROO_REVIEW_DIR||'/private/tmp/roo-type-v2-review';await fs.mkdir(out,{recursive:true});
const report={errors:[],checks:{},captures:[]};
const root=new URL('../../',import.meta.url);
const font=await fs.readFile(new URL('public/fonts/RooRegular.ttf',root));
const provenance=JSON.parse(await fs.readFile(new URL('public/fonts/roo-font-v2-provenance.json',root),'utf8'));
assert.equal(Object.keys(provenance.glyphs).length,51);
for(const entry of Object.values(provenance.glyphs)){
 const model=await fs.readFile(new URL('art/roo-reference-match/'+entry.model,root));
 assert.equal(createHash('sha256').update(model).digest('hex'),entry.modelSha256);
 assert.equal(await fs.readFile(new URL('art/roo-reference-match/'+entry.prompt,root),'utf8'),entry.promptText);
}
report.checks.modelPasses=51;
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(base+'roo-type-lab.html');await page.waitForFunction(()=>window.rooTypeLab?.ready);await page.screenshot({path:out+'/lab-dark.png'});
 await page.locator('#backdrop').check();await page.screenshot({path:out+'/lab-light.png'});
 const download=page.waitForEvent('download');await page.locator('#png').click();await(await download).saveAs(out+'/roo-text.png');
 const zip=page.waitForEvent('download');await page.locator('#atlas').click();await(await zip).saveAs(out+'/roo-image-font-v2.zip');
 const{unzipSync}=await import('../../node_modules/three/examples/jsm/libs/fflate.module.js');
 const zipFiles=unzipSync(await fs.readFile(out+'/roo-image-font-v2.zip'));
 assert.equal(Object.keys(zipFiles).length,6);
 assert.equal(JSON.parse(new TextDecoder().decode(zipFiles['roo-font-v2-provenance.json'])).glyphCount,51);report.checks.exports=true;
 const shapes=await page.evaluate(async()=>{
  const source=await fetch('/fonts/roo-bevel-source-v1.json').then(r=>r.json());
  const results={};await document.fonts.load('400 1000px Roo');
  for(const palette of ['bonus','counter']){
   const m=await fetch(`/fonts/roo-${palette}-v2.json`).then(r=>r.json()),image=new Image();image.src=`/fonts/roo-${palette}-v2.png`;await image.decode();
   let worst={char:'',iou:1},partial=0,pink=0;const alphaHashes={};
   for(const [char,g]of Object.entries(m.glyphs)){
    if(!g.width)continue;
    const actual=document.createElement('canvas');actual.width=g.width;actual.height=g.height;const ctx=actual.getContext('2d');ctx.drawImage(image,g.x,g.y,g.width,g.height,0,0,g.width,g.height);
    const expected=document.createElement('canvas');expected.width=g.width;expected.height=g.height;const e=expected.getContext('2d'),b=source.glyphs[char].bounds;
    const sx=(g.inkRight-g.inkLeft)/(b[2]-b[0]),sy=(g.inkBottom-g.inkTop)/(b[3]-b[1]),cap=m.capPixels;
    e.setTransform(sx*cap/882,0,0,sy*cap/882,(g.inkLeft-b[0]*sx-g.left)*cap,(g.inkTop+b[3]*sy-76/882*sy-g.top)*cap);
    e.font='400 1000px Roo';e.textBaseline='alphabetic';e.fillStyle='#fff';e.fillText(char,0,0);
    const a=ctx.getImageData(0,0,g.width,g.height).data,d=e.getImageData(0,0,g.width,g.height).data;let union=0,intersection=0,hash=2166136261;
    for(let i=0;i<a.length;i+=4){const aa=a[i+3];hash=Math.imul(hash^aa,16777619);if(aa>0&&aa<255)partial++;if(aa>240&&a[i]>150&&a[i+2]>150&&a[i+1]<70)pink++;const x=aa>127,y=d[i+3]>127;if(x||y)union++;if(x&&y)intersection++;}
    const iou=intersection/union;if(iou<worst.iou)worst={char,iou};alphaHashes[char]=hash;
   }
   results[palette]={worst,partial,pink,alphaHashes,fontSha256:m.fontSha256,version:m.version};
  }
  return results;
 });
 const sha=createHash('sha256').update(font).digest('hex');
 for(const p of ['bonus','counter']){assert.equal(shapes[p].fontSha256,sha);assert.equal(shapes[p].version,2);assert.equal(shapes[p].pink,0);assert.ok(shapes[p].partial>5000);assert.ok(shapes[p].worst.iou>.96,JSON.stringify(shapes[p].worst));}
 assert.deepEqual(shapes.bonus.alphaHashes,shapes.counter.alphaHashes);delete shapes.bonus.alphaHashes;delete shapes.counter.alphaHashes;report.checks.shapes=shapes;
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/lab-phone.png',fullPage:true});await page.close();
 if(process.env.ROO_REVIEW_GAME!=='0')for(const lite of [true,false]){
  const game=await browser.newPage({viewport:{width:1280,height:720}});game.on('pageerror',e=>report.errors.push(e.message));
  await game.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''));
  await game.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await game.waitForFunction(()=>window.__game.ui.gameHudDiagnostics.rooAtlasReady);
  await game.evaluate(()=>{const g=window.__game,original=g.ui.setHUD.bind(g.ui);window.rooForceBonus=false;window.rooReviewFruit=42;g.ui.setHUD=(s,dt)=>original({...s,fruit:window.rooReviewFruit,lives:7,cratesBroken:0,cratesTotal:23,inventoryHeld:true,bonusMode:window.rooForceBonus},dt);});
  await game.waitForTimeout(600);assert.match(await game.locator('.hud-build').textContent(),/Codex\/sol fork/);
  const urls=await game.locator('.game-hud-layer svg image').evaluateAll(images=>images.map(i=>i.getAttribute('href')));assert.ok(urls.length>0&&urls.every(s=>s.includes('-v2.png')));
  report.checks[lite?'lite':'full']=await game.evaluate(()=>window.__game.ui.gameHudDiagnostics);
  await game.screenshot({path:out+`/game-${lite?'lite':'full'}.png`});
  const fonts=await game.locator('.hud-box-current,.hud-box-total').evaluateAll(es=>es.map(e=>getComputedStyle(e).fontSize));assert.equal(fonts[0],fonts[1]);
  const bandHeights=[];
  for(const n of [9,10,99]){await game.evaluate(n=>window.rooReviewFruit=n,n);await game.waitForTimeout(350);bandHeights.push(await game.locator('.hud-fruit-row .hud-num').evaluate(e=>e.getBoundingClientRect().height));}
  assert.ok(Math.max(...bandHeights)-Math.min(...bandHeights)<.5,'digit count changed the text cap band');
  await game.evaluate(()=>{window.rooForceBonus=true;window.__game.ui.setLevel('bonus-easy','bonus',0,true);});await game.waitForTimeout(600);
  assert.ok(await game.locator('.hud-bonus-title').isVisible());
  await game.screenshot({path:out+`/bonus-${lite?'lite':'full'}.png`});
  await game.setViewportSize({width:1672,height:941});await game.waitForTimeout(250);
  const caps={number:await game.locator('.hud-box-current').evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),title:await game.locator('.hud-bonus-title').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))};
  assert.ok(Math.abs(caps.number-107)<.1&&Math.abs(caps.title-165)<.1,`reference viewport cap sizes: ${JSON.stringify(caps)}`);
  await game.screenshot({path:out+`/bonus-reference-size-${lite?'lite':'full'}.png`});
  await game.setViewportSize({width:390,height:844});await game.waitForTimeout(300);await game.screenshot({path:out+`/bonus-phone-${lite?'lite':'full'}.png`});
  const mobile=await game.locator('.hud-fruit-row,.hud-crate-row,.hud-life-row').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom};}));
  for(const r of mobile)assert.ok(r.left>=-1&&r.right<=391&&r.top>=-1&&r.bottom<=845,JSON.stringify(r));
  assert.ok(mobile[1].bottom<mobile[0].top,'portrait bonus counters overlap vertically');
  await game.close();
 }
 assert.deepEqual(report.errors,[]);await fs.writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
