import{chromium}from'/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import{mkdir}from'node:fs/promises';
const out='docs/blockworks-art/review-sheets';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1330},deviceScaleFactor:1});
for(let i=0;i<7;i++){
 await page.goto('http://127.0.0.1:5187/tools/blockworks-art/audit.html?mode=compact&page='+i);
 await page.waitForFunction(()=>window.auditPage?.ready);
 await page.screenshot({path:out+'/page-'+(i+1)+'.png',fullPage:true});
}
await browser.close();
