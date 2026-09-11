import fs from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const root=new URL('../../',import.meta.url),out=new URL('art/roo-reference-match/bake/',root);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:1560,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto((process.env.ROO_LAB_URL||'http://127.0.0.1:5178/')+'tools/roo-type/raster-review.html'+(process.env.ROO_ALLOW_PARTIAL==='1'?'?partial':''));
 await page.waitForFunction(()=>window.rooRasterFont,null,{timeout:300000});
 if(process.env.ROO_PROOF_TEXT)await page.evaluate(({text,palette})=>window.rooRasterReview.paint([...text],palette),{text:process.env.ROO_PROOF_TEXT,palette:process.env.ROO_PROOF_PALETTE||'counter'});
 await page.screenshot({path:fileURLToPath(new URL('raster-proof.png',out))});
 await page.evaluate(({text,palette})=>window.rooRasterReview.angles(text?[...text].slice(0,2):undefined,palette),{text:process.env.ROO_ANGLE_TEXT,palette:process.env.ROO_PROOF_PALETTE||'counter'});await page.screenshot({path:fileURLToPath(new URL('raster-angles.png',out))});
 const data=await page.evaluate(()=>{const r=window.rooRasterFont;return{missing:r.missing,missingLighting:r.missingLighting,provenance:r.provenance,atlases:Object.fromEntries(Object.entries(r.atlases).map(([p,a])=>[p,{metrics:a.metrics,pngs:a.frames.map(c=>c.toDataURL('image/png'))}]))};});
 for(const [palette,a]of Object.entries(data.atlases)){
  for(const [frame,png]of a.pngs.entries())await fs.writeFile(new URL(`roo-${palette}-v6${frame?'-light'+frame:''}.png`,out),Buffer.from(png.split(',')[1],'base64'));
  await fs.writeFile(new URL(`roo-${palette}-v6.json`,out),JSON.stringify(a.metrics,null,2));delete a.pngs;
 }
 await fs.writeFile(new URL('raster-report.json',out),JSON.stringify({errors,...data},null,2));
 console.log(JSON.stringify({errors,glyphs:Object.keys(data.provenance).length,missing:data.missing,missingLighting:data.missingLighting,atlasSizes:Object.fromEntries(Object.entries(data.atlases).map(([p,a])=>[p,[a.metrics.width,a.metrics.height]]))}));
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
