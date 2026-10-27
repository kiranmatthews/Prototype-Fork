import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {writeFile,readFile} from 'node:fs/promises';
const bundle=await build({stdin:{contents:"export {COCONUT_CART_RALLY_LEVEL} from './src/levels/coconut-cart-rally';export {cartRallyPoint} from './src/levels/cart-stadium-layout';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const {COCONUT_CART_RALLY_LEVEL:level,cartRallyPoint}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const items=level.components.filter(c=>c.t==='crate'&&c.kind==='mystery'),walls=level.components.filter(c=>c.t==='wall'&&c.nm?.startsWith('Rally rock contact'));
assert.equal(items.length,28,'Keep all seven four-box rows');
const rows=[];
for(let i=0;i<items.length;i+=4){
 const points=items.slice(i,i+4).map(c=>c.p),station=-points.reduce((s,p)=>s+p[2],0)/4;
 const a=cartRallyPoint(station-8),b=cartRallyPoint(station+8),forward=[b[0]-a[0],b[2]-a[2]],across=[points[3][0]-points[0][0],points[3][2]-points[0][2]];
 const span=Math.hypot(...across),dot=Math.abs((forward[0]*across[0]+forward[1]*across[1])/(Math.hypot(...forward)*span)),errorDegrees=Math.asin(Math.min(1,dot))*180/Math.PI;
 assert.ok(errorDegrees<10,`Row ${station} must cross the approach, not follow it (${errorDegrees} degrees)`);
 assert.ok(Math.abs(span-18)<.001,'The row offers four separated lanes');
 const rockClearance=Math.min(...points.flatMap(p=>walls.map(w=>Math.hypot(Math.max(0,Math.abs(p[0]-w.p[0])-w.s[0]/2),Math.max(0,Math.abs(p[2]-w.p[2])-w.s[2]/2)))));
 assert.ok(rockClearance>8,'Every pickup remains clear of cliff collision');
 rows.push({station,errorDegrees,span,rockClearance,points});
}
const pack=JSON.parse(await readFile('public/levels.json','utf8')),published=pack.levels.find(e=>e.id==='coconut-cart-rally');
assert.deepEqual(published.data,JSON.parse(JSON.stringify(level)),'The synced level uses the same cross-track rows');
const report={passed:true,count:items.length,rows};if(process.env.RALLY_ITEM_ROW_REPORT)await writeFile(process.env.RALLY_ITEM_ROW_REPORT,JSON.stringify(report,null,2)+'\n');
console.log('PASS',JSON.stringify(report));
