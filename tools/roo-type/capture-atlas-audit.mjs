import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const base=process.env.ROO_LAB_URL||'http://127.0.0.1:5178/',out=process.env.ROO_REVIEW_DIR||'/private/tmp/roo-type-v6-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={errors:[],sheets:[]};
try{
 const page=await browser.newPage({viewport:{width:1560,height:1620},deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(base+'tools/roo-type/atlas-audit.html');await page.waitForFunction(()=>window.atlasAudit?.ready);
 const characters=await page.evaluate(()=>window.atlasAudit.characters);
 for(const palette of ['counter','bonus'])for(let i=0;i<characters.length;i+=3){
  const chars=characters.slice(i,i+3);await page.evaluate(({chars,palette})=>window.atlasAudit.paint(chars,palette),{chars,palette});
  const name=`all-${palette}-${String(i/3+1).padStart(2,'0')}.png`;await page.screenshot({path:out+'/'+name});report.sheets.push({palette,chars,file:name});
 }
 await page.evaluate(()=>window.atlasAudit.paint(['A','0','"'],'counter',true));await page.screenshot({path:out+'/light-backdrop.png'});
 await fs.writeFile(out+'/atlas-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify({errors:report.errors,glyphs:characters.length,sheets:report.sheets.length}));
 if(report.errors.length)throw new Error(report.errors.join('\n'));
}finally{await browser.close();}
