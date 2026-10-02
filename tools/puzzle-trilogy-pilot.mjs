export { puzzleControls } from './puzzle-controls.mjs';
import { runPrimer } from './puzzle-primer-pilot.mjs';
import { runSwitchyardJourney } from './puzzle-switchyard-pilot.mjs';
import { runClockworkJourney } from './puzzle-clockwork-pilot.mjs';
export function* runPuzzleJourney(r) {
  const pilot={'crate-primer':runPrimer,'switchyard':runSwitchyardJourney,'clockwork-gauntlet':runClockworkJourney}[r.id];
  if(!pilot)throw Error('Missing pilot for '+r.id);
  const result=yield* pilot(r);
  if(r.p.state!=='finished')throw Error(`${r.id} did not finish its actual main route`);
  if(r.p.bonusCrates!==0||r.p.gemEarned!==(r.l.bonusCrateTotal===0))
    throw Error(`${r.id} main-route reward state does not respect its linked bonus requirement`);
  return {...result,gemEarned:r.p.gemEarned};
}
