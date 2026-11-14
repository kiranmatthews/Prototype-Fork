import assert from 'node:assert/strict';
import {withThemedBonusRuntime} from './test-themed-bonus-puzzles.mjs';
import {runInputPilot} from './test-puzzle-trilogy.mjs';
import {runThemedBonusWrongOrder} from './themed-bonus-pilot.mjs';
await withThemedBonusRuntime('treehouse-trail',r=>{
 const report=runInputPilot(r,runThemedBonusWrongOrder);
 assert.ok(report.result.rewardRemaining>0,'wrong order must leave inaccessible rewards');
 r.l.reset(true);
 assert.ok(r.l.crates.every(c=>c.alive),'bonus retry must restore the access arrow and every reward');
 console.log('PASS Canopy Cache: spending the arrow first blocks the high gallery; native reset restores the entire puzzle.');
});
