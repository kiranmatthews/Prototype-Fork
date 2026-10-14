import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=process.argv[2]||'/private/tmp/drowned-crash-assets';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],evidence=[];
try{const page=await browser.newPage({viewport:{width:3840,height:2160},deviceScaleFactor:1});page.on('pageerror',e=>errors.push(e.message));
for(const [name,yaw,elev,label] of [['crash-cavern-rock',0,.3,'front'],['crash-cavern-rock',Math.PI,.3,'back'],['crash-cavern-skylight',.3,-.65,'below']]){
await page.goto('http://127.0.0.1:5277/tools/drowned-crown/excellence/asset-preview.html?asset='+name+'&yaw='+yaw+'&elev='+elev);await page.waitForFunction(()=>window.assetReady);const sample=await page.evaluate(()=>window.assetReady);await page.screenshot({path:out+'/'+name+'-'+label+'.png'});evidence.push({...sample,yaw,elev,label});}
await writeFile(out+'/review.json',JSON.stringify({evidence,errors},null,2)+'\n');if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({views:evidence.length,errors}));}finally{await browser.close();}
