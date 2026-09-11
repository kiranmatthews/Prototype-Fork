import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.ROO_LAB_URL||'http://127.0.0.1:5178/';
const out=process.env.ROO_REVIEW_DIR||'/private/tmp/roo-type-v6-review';await fs.mkdir(out,{recursive:true});
const report={errors:[],checks:{},captures:[]};
const root=new URL('../../',import.meta.url);
const font=await fs.readFile(new URL('public/fonts/RooRegular.ttf',root));
const provenance=JSON.parse(await fs.readFile(new URL('public/fonts/roo-font-v6-provenance.json',root),'utf8'));
assert.equal(Object.keys(provenance.glyphs).length,51);
for(const entry of Object.values(provenance.glyphs)){
 const model=await fs.readFile(new URL('art/roo-reference-match/'+entry.model,root));
 assert.equal(createHash('sha256').update(model).digest('hex'),entry.modelSha256);
 assert.equal(await fs.readFile(new URL('art/roo-reference-match/'+entry.prompt,root),'utf8'),entry.promptText);
 for(const input of entry.inputs??[])assert.equal(createHash('sha256').update(await fs.readFile(new URL('art/roo-reference-match/'+input.file,root))).digest('hex'),input.sha256);
 for(const light of Object.values(entry.glisten??{})){
  assert.equal(createHash('sha256').update(await fs.readFile(new URL('art/roo-reference-match/'+light.model,root))).digest('hex'),light.modelSha256);
  assert.equal(await fs.readFile(new URL('art/roo-reference-match/'+light.prompt,root),'utf8'),light.promptText);
  assert.equal(light.inputs[0].file,entry.model);assert.equal(light.inputs[0].sha256,entry.modelSha256);
 }
 assert.equal(Object.keys(entry.glisten??{}).length,2);
}
report.checks.modelPasses=51;
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.goto(base+'roo-type-lab.html');await page.waitForFunction(()=>window.rooTypeLab?.ready);await page.screenshot({path:out+'/lab-dark.png'});
 await page.locator('#backdrop').check();await page.screenshot({path:out+'/lab-light.png'});
 const download=page.waitForEvent('download');await page.locator('#png').click();await(await download).saveAs(out+'/roo-text.png');
 const zip=page.waitForEvent('download');await page.locator('#atlas').click();await(await zip).saveAs(out+'/roo-image-font-v6.zip');
 const{unzipSync}=await import('../../node_modules/three/examples/jsm/libs/fflate.module.js');
 const zipFiles=unzipSync(await fs.readFile(out+'/roo-image-font-v6.zip'));
 assert.equal(Object.keys(zipFiles).length,10);
 assert.equal(JSON.parse(new TextDecoder().decode(zipFiles['roo-font-v6-provenance.json'])).glyphCount,51);report.checks.exports=true;
 const shapes=await page.evaluate(async()=>{
  const results={};
  for(const palette of ['bonus','counter']){
   const m=await fetch(`/fonts/roo-${palette}-v6.json`).then(r=>r.json()),image=new Image();image.src=`/fonts/roo-${palette}-v6.png`;await image.decode();
   let partial=0,pink=0;const alphaHashes={},cropped=[];
   for(const [char,g]of Object.entries(m.glyphs)){
    if(!g.width)continue;
    const actual=document.createElement('canvas');actual.width=g.width;actual.height=g.height;const ctx=actual.getContext('2d');ctx.drawImage(image,g.x,g.y,g.width,g.height,0,0,g.width,g.height);
    const a=ctx.getImageData(0,0,g.width,g.height).data;let hash=2166136261,edge=false;
    for(let i=0;i<a.length;i+=4){const aa=a[i+3];hash=Math.imul(hash^aa,16777619);if(aa>0&&aa<255)partial++;if(aa>240&&a[i]>150&&a[i+2]>150&&a[i+1]<70)pink++;const pixel=i/4,x=pixel%g.width,y=Math.floor(pixel/g.width);if(aa&&(x===0||x===g.width-1||y===0||y===g.height-1))edge=true;}
    if(edge)cropped.push(char);alphaHashes[char]=hash;
   }
   results[palette]={partial,pink,cropped,alphaHashes,fontSha256:m.fontSha256,version:m.version,contourSource:m.contourSource,capPixels:m.capPixels};
  }
  return results;
 });
 const sha=createHash('sha256').update(font).digest('hex');
 for(const p of ['bonus','counter']){assert.equal(shapes[p].fontSha256,sha);assert.equal(shapes[p].version,6);assert.equal(shapes[p].contourSource,'model-artwork');assert.equal(shapes[p].capPixels,512);assert.equal(shapes[p].pink,0);assert.deepEqual(shapes[p].cropped,[]);assert.ok(shapes[p].partial>5000);}
 assert.deepEqual(shapes.bonus.alphaHashes,shapes.counter.alphaHashes);delete shapes.bonus.alphaHashes;delete shapes.counter.alphaHashes;report.checks.shapes=shapes;
 report.checks.lightFrames=await page.evaluate(async()=>{
  const results={};
  for(const palette of ['bonus','counter']){
   const m=await fetch(`/fonts/roo-${palette}-v6.json`).then(r=>r.json()),frames=[];
   for(const frame of [0,1,2]){const image=new Image();image.src=`/fonts/roo-${palette}-v6${frame?'-light'+frame:''}.png`;await image.decode();const canvas=document.createElement('canvas');canvas.width=m.width;canvas.height=m.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);frames.push(ctx.getImageData(0,0,m.width,m.height).data);}
   let alphaMismatches=0,grayPixels=0,maxNeutralRatio=0;const unchanged=[];
   for(let i=0;i<frames[0].length;i+=4){for(const frame of [1,2])if(frames[frame][i+3]!==frames[0][i+3])alphaMismatches++;const rgb=frames[0].slice(i,i+3),hi=Math.max(...rgb),lo=Math.min(...rgb);if(frames[0][i+3]>250&&hi>80&&hi<220&&hi-lo<8)grayPixels++;}
   for(const[char,g]of Object.entries(m.glyphs)){if(!g.width)continue;let changed=0,opaque=0,neutral=0;for(let y=g.y;y<g.y+g.height;y++)for(let x=g.x;x<g.x+g.width;x++){const p=(y*m.width+x)*4;if(frames[0][p+3]>128&&[0,1,2].some(c=>frames[1][p+c]!==frames[2][p+c]))changed++;if(frames[0][p+3]>250){opaque++;const rgb=frames[0].slice(p,p+3);if(Math.max(...rgb)-Math.min(...rgb)<10)neutral++;}}if(!changed)unchanged.push(char);maxNeutralRatio=Math.max(maxNeutralRatio,neutral/Math.max(1,opaque));}
   results[palette]={alphaMismatches,grayPixels,maxNeutralRatio,unchanged};
  }
  return results;
 });
 for(const result of Object.values(report.checks.lightFrames)){assert.equal(result.alphaMismatches,0);assert.equal(result.grayPixels,0,'checkerboard/gray pixels remain in the font');assert.ok(result.maxNeutralRatio<.02,'neutral matte occupies a visible part of a colored glyph');assert.deepEqual(result.unchanged,[]);}
 report.checks.crossfade=await page.evaluate(()=>{
  const images=[];
  for(const light of [-1,-.5,0,.5,1]){const canvas=document.createElement('canvas');canvas.width=800;canvas.height=260;window.rooTypeLab.painter.draw(canvas.getContext('2d'),'WWW',400,130,{size:165,palette:'bonus',tracking:-.095*165,lightPosition:light});images.push(canvas.getContext('2d').getImageData(0,0,800,260).data);}
  let maxAlphaError=0,changed=0;const phaseErrors=images.map(()=>0);for(let i=0;i<images[0].length;i+=4){for(const [j,frame]of images.entries()){const error=Math.abs(frame[i+3]-images[2][i+3]);phaseErrors[j]=Math.max(phaseErrors[j],error);maxAlphaError=Math.max(maxAlphaError,error);}if(images[0][i+3]>128&&[0,1,2].some(c=>images[0][i+c]!==images[4][i+c]))changed++;}
  return{maxAlphaError,phaseErrors,changed};
 });
 assert.ok(report.checks.crossfade.maxAlphaError<=1,`crossfade changes alpha at overlapping letter edges: ${JSON.stringify(report.checks.crossfade)}`);assert.ok(report.checks.crossfade.changed>0);
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/lab-phone.png',fullPage:true});await page.close();
 if(process.env.ROO_REVIEW_GAME!=='0')for(const lite of [true,false]){
  const game=await browser.newPage({viewport:{width:1280,height:720}});game.on('pageerror',e=>report.errors.push(e.message));
  await game.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''));
  await game.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await game.waitForFunction(()=>window.__game.ui.gameHudDiagnostics.rooAtlasReady);
  await game.evaluate(()=>{const g=window.__game,original=g.ui.setHUD.bind(g.ui);window.rooForceBonus=false;window.rooReviewFruit=42;g.ui.setHUD=(s,dt)=>original({...s,fruit:window.rooReviewFruit,lives:7,cratesBroken:0,cratesTotal:23,inventoryHeld:true,bonusMode:window.rooForceBonus},dt);});
  await game.waitForTimeout(600);assert.match(await game.locator('.hud-build').textContent(),/Codex\/sol fork/);
  const urls=await game.locator('.game-hud-layer svg image').evaluateAll(images=>images.map(i=>i.getAttribute('href')));assert.ok(urls.length>0&&urls.every(s=>/-v6(?:-light[12])?\.png/.test(s)));
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
