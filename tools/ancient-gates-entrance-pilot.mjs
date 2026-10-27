import {puzzleControls} from './puzzle-controls.mjs';

/** Side pocket and the real deliberate-jump landing gate. */
export function* approachAncientHoard(r){
 const c=puzzleControls(r),{p,l}=r;
 yield* c.stepFor(20);c.check(p.grounded,'reliquary approach supported');
 yield* c.walk([1124,8,0],'read the optional reliquary');
 yield* c.walk([1124,8,-4.2],'turn into the reliquary alcove');
 const entries=r.report.bonusEntries??0;
 yield* c.charge();yield* c.tick({jumpReleased:true});
 yield* c.until(()=>p.grounded,()=>c.steer([1128,9.05,-4.2]),{label:'land deliberately on the hoard stone',limit:180});
 c.check(l.bonusPlatformAt(p.pos),'actual bonus stone support');
 r.report.evidence.push({action:'deliberate hoard landing',position:p.pos.toArray(),entriesBefore:entries,entriesAfter:r.report.bonusEntries});
 return p.pos.toArray();
}
