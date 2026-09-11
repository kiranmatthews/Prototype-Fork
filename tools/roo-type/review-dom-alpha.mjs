import fs from 'node:fs/promises';
import {execFileSync}from'node:child_process';
import{pathToFileURL}from'node:url';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const out=process.env.ROO_REVIEW_DIR||'/private/tmp/roo-type-v7-review';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
 const page=await browser.newPage({viewport:{width:900,height:300}});
 await page.goto((process.env.ROO_LAB_URL||'http://127.0.0.1:5178/')+'tools/roo-type/alpha-review.html');await page.waitForFunction(()=>window.rooAlphaReview?.ready);
 for(const p of [-1,-.5,0,.5,1]){await page.evaluate(p=>window.rooAlphaReview.setPhase(p),p);await page.locator('#host').screenshot({path:out+'/dom-alpha-'+p+'.png',omitBackground:true});}
}finally{await browser.close();}
const result=execFileSync(process.env.PYTHON_BIN||'python3',['-c',`from PIL import Image
import numpy as np,json,sys
from pathlib import Path
p=Path(sys.argv[1]);a=[np.array(Image.open(p/('dom-alpha-'+n+'.png')).convert('RGBA')).astype(int) for n in ['-1','-0.5','0','0.5','1']]
assert all(x.shape==a[0].shape for x in a)
error=max(int(np.abs(x[:,:,3]-a[2][:,:,3]).max()) for x in a)
partial=int(((a[2][:,:,3]>0)&(a[2][:,:,3]<255)).sum())
assert error<=1,('DOM crossfade alpha error',error)
assert partial>100 and a[2][:,:,3].min()==0
assert np.abs(a[0][:,:,:3]-a[-1][:,:,:3]).max()>0
print(json.dumps({'domMaxAlphaError':error,'partialAlphaPixels':partial}))`,out],{encoding:'utf8'});
await fs.writeFile(out+'/dom-alpha-report.json',result);console.log(result);
