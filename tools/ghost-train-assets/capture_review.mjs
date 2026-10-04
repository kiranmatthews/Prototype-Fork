import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=process.argv[2]||'http://127.0.0.1:5235';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:800,height:800}});
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  const destination=new URL('../../.img2threejs/ghost-train/review/',import.meta.url);
  await mkdir(destination,{recursive:true});
  for (const name of ['castle-arch','ghost-cart','banquet-turkey','banquet-cake','clockwork-knight']) {
    for (const angle of [0,40,90,180]) {
      await page.goto(`${base}/tools/ghost-train-assets/asset-review.html?asset=${name}&angle=${angle}`);
      await page.waitForFunction(name=>window.assetReady===name,name);
      await page.screenshot({path:fileURLToPath(new URL(`${name}-${angle}.png`,destination))});
    }
  }
  if(errors.length)throw new Error(JSON.stringify(errors));
  console.log(JSON.stringify({models:5,angles:[0,40,90,180],errors}));
} finally {await browser.close();}
