// The game downloads a gameplay subset of the skate study. It must contain
// exactly the clips the riding overlay can ask for, copied unchanged from
// the full study the skate labs use. After changing clip names in
// src/skateReferenceLab/playableMotion.ts, run: node tools/skate-gameplay-motion.mjs
import assert from 'node:assert/strict';
import {FULL_BANK,GAMEPLAY_BANK,readBank,gameplayClipNames} from './skate-gameplay-motion.mjs';
const [full,subset]=await Promise.all([readBank(FULL_BANK),readBank(GAMEPLAY_BANK)]);
const wanted=await gameplayClipNames(full);
assert.deepEqual(subset.clips.map(c=>c.name),wanted,'gameplay subset is stale: rebuild it with tools/skate-gameplay-motion.mjs');
for(const name of ['R_IDLE_RIDE_N_0_CYC','OLLIE_LOW_A','BR_STAND_0_INTO_MOUNT','BR_DISMOUNT_LO_INTO_STAND_0','R_PUSHHSP_HSTR_N_0_CYC2','R_PUSHLSP_HSTR_N_0_INTO','R_IDLE_HCOM_N100','R_IDLE_HCOM_P100'])
  assert.ok(wanted.includes(name),`the derivation must find ${name}`);
const byName=new Map(full.clips.map(c=>[c.name,c]));
for(const clip of subset.clips)assert.deepEqual(clip,byName.get(clip.name),`${clip.name} must be copied unchanged`);
for(const key of Object.keys(full))if(key!=='clips'&&key!=='scope')assert.deepEqual(subset[key],full[key],`${key} must match the full study`);
console.log(`PASS gameplay skate motion: ${subset.clips.length} of ${full.clips.length} clips, exact copies, bones and metadata unchanged.`);
