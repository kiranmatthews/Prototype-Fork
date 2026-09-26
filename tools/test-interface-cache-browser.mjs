// Compare shared-interface Canvas pixels in the actual world-map DOM. Serve
// an unmodified baseline and the candidate with Vite before running this test.
// The renderer stub isolates Canvas ink; this does not measure GPU performance.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const [baseline,candidate]=process.argv.slice(2);
if(!baseline||!candidate)throw Error('Usage: node tools/test-interface-cache-browser.mjs <baseline-url> <candidate-url>');
const output=process.env.INTERFACE_CACHE_OUTPUT||'/private/tmp/interface-parity.json';
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/src/gameInterfaceSurface.ts?parity-baseline',async route=>route.fulfill({response:await route.fetch({url:new URL('/src/gameInterfaceSurface.ts',baseline).href})}));
await page.goto(new URL('/?playtest&level=warproom',candidate).href);
await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
await page.waitForTimeout(2500);
const result=await page.evaluate(async()=>{
 const old=await import('/src/gameInterfaceSurface.ts?parity-baseline'),next=await import('/src/gameInterfaceSurface.ts');
 const surfaces=[new old.GameInterfaceSurface(),new next.GameInterfaceSurface()];
 const renderer={domElement:document.createElement('canvas'),getPixelRatio:()=>2,getRenderTarget:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,getViewport:v=>v.set(0,0,1280,720),getScissor:v=>v.set(0,0,1280,720),getScissorTest:()=>false,setRenderTarget(){},setViewport(){},setScissor(){},setScissorTest(){},render(){}};
 const target={},size={width:1280,height:720},rows=[];
 const check=name=>{
  for(const surface of surfaces)surface.draw(renderer,size,target);
  const a=surfaces[0].surface?.canvas,b=surfaces[1].surface?.canvas;
  if(!a||!b)throw Error('Fixture has no visible interface');
  const aa=a.getContext('2d').getImageData(0,0,a.width,a.height).data,bb=b.getContext('2d').getImageData(0,0,b.width,b.height).data;
  let changed=0,max=0;for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i]){changed++;max=Math.max(max,Math.abs(aa[i]-bb[i]));}
  rows.push({name,changed,max,oldUploads:surfaces[0].diagnostics.surface.textureUploads,newUploads:surfaces[1].diagnostics.surface.textureUploads});
 };
 check('map-initial');check('map-steady');
 const root=document.querySelector('.world-map-ui'),button=root.querySelector('.world-map-action'),label=button.querySelector('.secondary-silver');
 label.style.fontSize='24.125px';check('fractional-font');
 label.style.transform='translate(.375px, .125px)';check('fractional-transform');
 root.style.opacity='.432';check('ancestor-prompt-opacity');
 root.style.opacity='1';button.focus();check('focus');
 const touch=document.createElement('div');touch.className='tc-zone';touch.innerHTML='<button class="tc-btn" style="position:fixed;left:10px;bottom:80px;width:100px;height:55px;display:block;opacity:.52;background:rgb(10,20,30);border:2px solid white;border-radius:12px;letter-spacing:1px">JUMP</button>';document.body.append(touch);check('touch-reveal');check('touch-steady');
 touch.firstChild.style.opacity='.61';check('touch-transition');
 touch.firstChild.style.backgroundColor='rgb(30,40,50)';check('touch-color');
 touch.remove();check('touch-hide');
 root.hidden=true;for(const surface of surfaces)surface.draw(renderer,size,target);root.hidden=false;check('map-reveal');
 size.width=960;size.height=540;check('raster-resize');
 size.width=1280;size.height=720;for(const surface of surfaces)surface.draw(renderer,size,null);
 const dim=surfaces.map(s=>[s.surface.canvas.width,s.surface.canvas.height]);
 return{rows,directDimensions:dim};
});
await writeFile(output,JSON.stringify({baseline,candidate,result,errors},null,2));
assert.deepEqual(errors,[]);assert.ok(result.rows.every(row=>row.changed===0));assert.equal(result.rows[1].newUploads,result.rows[0].newUploads);assert.deepEqual(result.directDimensions,[[2560,1440],[2560,1440]]);console.log(JSON.stringify(result));
}finally{await browser.close();}
