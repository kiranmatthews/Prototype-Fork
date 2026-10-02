export { puzzleControls } from './puzzle-controls.mjs';
import { runPrimer } from './puzzle-primer-pilot.mjs';
import { runSwitchyardJourney } from './puzzle-switchyard-pilot.mjs';
import { runClockworkJourney } from './puzzle-clockwork-pilot.mjs';
export function* runPuzzleJourney(r) {
  const pilot={'crate-primer':runPrimer,'switchyard':runSwitchyardJourney,'clockwork-gauntlet':runClockworkJourney}[r.id];
  if(!pilot)throw Error('Missing pilot for '+r.id);
  const result=yield* pilot(r);
  if(r.p.state!=='finished'||!r.p.gemEarned)throw Error(`${r.id} did not collect its actual all-box gem before finish`);
  return {...result,gemEarned:r.p.gemEarned};
}
