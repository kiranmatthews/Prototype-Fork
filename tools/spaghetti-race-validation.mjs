import assert from 'node:assert/strict';

/** Check native race records without rerunning the simulation for reporting. */
export function assertSpaghettiRaceTraversal(report,{club=false,loopHeight=0}={}){
 assert.equal(report.tuningUnchanged,true);
 assert.ok(report.riders.every(a=>a.finish!==null),'Every active racer finishes using production controls');
 assert.ok(report.riders.every(a=>a.falls===0&&a.deaths===0),'Every racer completes without a death or race reset');
 if(report.fault){assert.ok(report.wrap>=loopHeight);return;}
 assert.ok(report.riders[0].authoredGrindMetres>report.length*.5,'The reference line uses the authored rail network');
 const rivals=report.riders.slice(1);if(!rivals.length)return;
 if(club){
  // Long downhill decks make recovery-heavy individual routes legitimate.
  // Require every rival to catch several authored rails, and substantial
  // grinding across the field; do not improve their skill to meet a quota.
  assert.ok(rivals.every(a=>a.authoredGrindMetres>100&&new Set(a.rails.filter(i=>i>=0)).size>=3),'Every club rival traverses several authored rails');
  const average=rivals.reduce((sum,a)=>sum+a.authoredGrindMetres,0)/rivals.length;
  assert.ok(average>report.length*.3,'The club field makes substantial use of the authored rail network');
 }else assert.ok(rivals.every(a=>a.authoredGrindMetres>report.length*.5),'Every default rival uses the authored rail network');
}
