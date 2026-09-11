import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const out=new URL('../../art/roo-reference-match/bake/',import.meta.url),browser=await chromium.launch({headless:true,channel:'chrome'});
try{const page=await browser.newPage();await page.goto('http://127.0.0.1:5178/tools/roo-type/refine-font.html');await page.waitForFunction(()=>window.refineFont);
 for(const frame of [0,1,2]){const data=await page.evaluate(f=>window.refineFont(f),frame);for(const [palette,png]of Object.entries(data))await fs.writeFile(new URL(`roo-${palette}-v8${frame?'-light'+frame:''}.png`,out),Buffer.from(png.split(',')[1],'base64'));console.log('font frame '+frame);}
}finally{await browser.close();}
