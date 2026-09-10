import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium }=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.ROO_LAB_URL||'http://127.0.0.1:5178/';
const out=process.env.ROO_REVIEW_DIR||'/private/tmp/roo-type-review';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const report={errors:[],captures:[],checks:{}};
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  await page.goto(base+'roo-type-lab.html');
  await page.waitForFunction(()=>window.rooTypeLab?.ready);
  await page.locator('#motion').uncheck();
  await page.evaluate(()=>window.rooTypeLab.setTime(0));
  report.checks.liveMetrics=await page.evaluate(()=>window.rooTypeLab.metrics());
  const capture=async name=>{await page.screenshot({path:`${out}/${name}.png`});report.captures.push(name);};
  await capture('live-front');
  const front=await page.evaluate(()=>window.rooTypeLab.renderer.domElement.toDataURL());
  await page.mouse.move(1050,300);await page.evaluate(()=>window.rooTypeLab.setTime(0));
  const relit=await page.evaluate(()=>window.rooTypeLab.renderer.domElement.toDataURL());
  assert.notEqual(front,relit,'Moving only the light must change the actual shading');
  await capture('live-relit');
  await page.locator('#turn').fill('18');await page.locator('#turn').dispatchEvent('input');
  await page.evaluate(()=>window.rooTypeLab.setTime(0));await capture('live-turn');
  await page.locator('#reset').click();
  await page.locator('#mode').selectOption('baked');
  await page.evaluate(()=>window.rooTypeLab.setTime(0));await capture('baked-font');
  await page.locator('#backdrop').check();await capture('baked-light-background');
  report.checks.silhouette=await page.evaluate(async()=>{
    const [{ROO_ATLAS_METRICS},{loadRooAtlases,RooAtlasPainter}]=await Promise.all([import('/src/roo-type/atlas-metrics.ts'),import('/src/roo-type/atlas.ts')]);
    await loadRooAtlases();await document.fonts.load('400 256px Roo');
    const image=new Image();image.src='/fonts/roo-counter-v1.png';await image.decode();
    const m=ROO_ATLAS_METRICS.counter;let worst={char:'',iou:1},partial=0;
    for(const [char,g]of Object.entries(m.glyphs)){
      if(!g.width)continue;
      const actual=document.createElement('canvas');actual.width=g.width;actual.height=g.height;
      const a=actual.getContext('2d');a.drawImage(image,g.x,g.y,g.width,g.height,0,0,g.width,g.height);
      const expected=document.createElement('canvas');expected.width=g.width;expected.height=g.height;
      const e=expected.getContext('2d');e.font=`400 ${m.capPixels*m.capBand.unitsPerEm/m.capBand.height}px Roo`;
      e.textBaseline='alphabetic';e.fillText(char,-g.left*m.capPixels,(-g.top+m.capBand.top/m.capBand.height)*m.capPixels);
      const ad=a.getImageData(0,0,g.width,g.height).data,ed=e.getImageData(0,0,g.width,g.height).data;
      let intersection=0,union=0;
      for(let i=3;i<ad.length;i+=4){const x=ad[i]>127,y=ed[i]>127;if(x&&y)intersection++;if(x||y)union++;if(ad[i]>0&&ad[i]<255)partial++;}
      const iou=intersection/union;if(iou<worst.iou)worst={char,iou};
    }
    const painter=new RooAtlasPainter(),ctx=document.createElement('canvas').getContext('2d');
    return{worst,partial,glyphs:Object.keys(m.glyphs).length,unsupportedFallsBack:painter.draw(ctx,'☃',0,0,{size:90})===false};
  });
  assert.ok(report.checks.silhouette.worst.iou>.97,JSON.stringify(report.checks.silhouette));
  assert.ok(report.checks.silhouette.partial>1000,'Bakes must contain antialiased alpha, not binary masks');
  assert.ok(report.checks.silhouette.unsupportedFallsBack);
  report.checks.metrics=await page.evaluate(()=>window.rooTypeLab.metrics());
  const titleDownload=page.waitForEvent('download');await page.locator('#png').click();
  const png=await titleDownload;await png.saveAs(`${out}/roo-title.png`);
  assert.equal((await fs.readFile(`${out}/roo-title.png`)).readUInt32BE(0),0x89504e47);
  const atlasDownload=page.waitForEvent('download');await page.locator('#atlas').click();
  const zip=await atlasDownload;await zip.saveAs(`${out}/roo-image-font.zip`);
  const {unzipSync}=await import('../../node_modules/three/examples/jsm/libs/fflate.module.js');
  const files=unzipSync(await fs.readFile(`${out}/roo-image-font.zip`));
  assert.deepEqual(Object.keys(files).sort(),['README.txt','roo-bonus-v1.json','roo-bonus-v1.png','roo-counter-v1.json','roo-counter-v1.png']);
  report.checks.pngAndZipExport=true;
  await page.setViewportSize({width:390,height:844});await capture('phone-lab');
  await page.close();

  if(process.env.ROO_REVIEW_GAME!=='0')for(const lite of [true,false]){
    const game=await browser.newPage({viewport:{width:1280,height:720}});
    game.on('pageerror',e=>report.errors.push(e.message));
    await game.goto(base+'?playtest&level=codex-lab'+(lite?'&lite':''));
    await game.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
    await game.waitForFunction(()=>window.__game.ui.gameHudDiagnostics?.rooAtlasReady,null,{timeout:30000});
    await game.evaluate(()=>{
      const g=window.__game;const original=g.input.update.bind(g.input);g.input.update=()=>{original();g.input.inventoryHeld=true;};
      g.player.fruit=42;g.player.lives=7;
    });
    await game.waitForTimeout(800);
    assert.ok(await game.locator('.game-hud-layer svg image').count(),'DOM/lite labels must use the same atlas');
    const stamp=await game.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);
    report.checks[lite?'liteHud':'fullHud']=await game.evaluate(()=>window.__game.ui.gameHudDiagnostics);
    await game.screenshot({path:`${out}/game-${lite?'lite':'full'}.png`});
    if(!lite){await game.keyboard.press('Escape');await game.screenshot({path:`${out}/game-pause.png`});}
    await game.close();
  }
  assert.deepEqual(report.errors,[]);
  report.checks.lightResponse=true;
  await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
