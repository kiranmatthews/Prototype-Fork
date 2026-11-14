import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withThemedBonusRuntime} from './test-themed-bonus-puzzles.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusWrongOrder} from './themed-bonus-pilot.mjs';
const reports=[];
for(const index of [0,1,2])await withThemedBonusRuntime('drowned-crown',r=>{
 r.course={...r.course,rooms:[r.course.rooms[index]]};
 reports.push(runInputPilot(r,runThemedBonusWrongOrder));
 r.p.respawn(r.l,true);assert.ok(r.l.crates.every(b=>b.alive));assert.equal(r.l.crates.filter(b=>b.pending).length,9);
 assert.ok(r.l.outlinedSurfaces.every(s=>!s.active));reports[reports.length-1].retryRestores=true;
},{start:[index===0?1:index===1?35:61,.12,0]});
await writeFile(process.env.MERCHANT_ORDER_OUTPUT||'/tmp/merchant-bonus-order.json',JSON.stringify(reports,null,2)+'\n');
console.log('PASS ledger donor loss, early TNT spin, skipped bridge and full retry restore');
