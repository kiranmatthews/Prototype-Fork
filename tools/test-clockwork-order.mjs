import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withPuzzleRuntime,runInputPilot} from './test-puzzle-trilogy.mjs';
import {runClockworkGroundDoubleNegative,runClockworkGreenIsolationNegative} from './puzzle-clockwork-pilot.mjs';
const reports=[];
for(const pilot of [runClockworkGroundDoubleNegative,runClockworkGreenIsolationNegative]){
 const result=await withPuzzleRuntime('clockwork-gauntlet',r=>runInputPilot(r,pilot),{maxFrames:20000});
 assert.equal(result.deaths,0);reports.push(result);
}
await writeFile('/private/tmp/clockwork-negative-order.json',JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports.map(({test,deaths,capAlive,farSwitchUsed})=>({test,deaths,capAlive,farSwitchUsed})),null,2));
console.log('PASS Clockwork support-loss and green/far-circuit isolation through actual inputs.');
