import fs from 'node:fs/promises';import {pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const out=new URL('../../art/roo-reference-match/bake/',import.meta.url);await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.ROO_LAB_URL||'http://127.0.0.1:5178/')+'tools/roo-type/neutral-font.html');await page.waitForFunction(()=>window.neutralFont);
 for(const frame of [0,1,2]){
  const png=await page.evaluate(frame=>window.neutralFont(frame),frame),name=`roo-bonus-v9${frame?'-light'+frame:''}.png`;
  await fs.writeFile(new URL(name,out),Buffer.from(png.split(',')[1],'base64'));console.log(name);
 }
 if(errors.length)throw new Error(errors.join('\n'));
}finally{await browser.close();}
