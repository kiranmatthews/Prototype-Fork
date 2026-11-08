import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withTempleRuntime} from './temple-test-runtime.mjs';
import {puzzleControls} from './puzzle-controls.mjs';

// Both pilgrim stairs: step off the bank onto the first step where their
// heights meet, climb every step with ordinary jumps, rejoin the terrace.
const reports=[];
for(const index of [0,1]){
  const id='jungle-terraces';
  await withTempleRuntime(async r=>{
    r.report={stage:'approach',actions:[],evidence:[]};
    const c=puzzleControls(r),route=r.sourceModule.JUNGLE_SEQUEL_ROUTES[0],climb=route.climbs[index];
    const {a,b,base,top,steps,side}=climb,span=(b-a)/steps,stepY=i=>base+(top-base)*(i+1)/steps;
    function* pilot(){
      yield* c.stepFor(25);
      const foot=[a+span-3.2,route.groundAt(a+span-3.2),-3.2];
      yield* c.until(()=>c.distance(foot)<.7,()=>{c.check(r.p.grounded,'bank approach lost support');return c.steer(foot,Math.min(.6,c.distance(foot)/2));},{label:'ride the bank beside the first step'});
      yield* c.stepFor(12);
      yield* c.hop([a+span-1.4,stepY(0),side],'step off the bank onto the first stair',{tolerance:1.5,heightTolerance:.3});
      assert.equal(r.p.groundHit?.name,'Jungle temple climbing step 1');
      for(let i=1;i<steps;i++){
        const edge=a+i*span;
        yield* c.walk([edge-1.35,stepY(i-1),side],`approach step ${i+1}`);
        yield* c.hop([edge+1.6,stepY(i),side],`climb step ${i+1}`,{tolerance:1.5});
        assert.equal(r.p.groundHit?.name,`Jungle temple climbing step ${i+1}`,'each jump must land on its intended step');
      }
      yield* c.walk([b-1.2,top,side],'reach the top step');
      yield* c.hop([b+2.2,top,-3.0],'rejoin the terrace',{tolerance:1.7});
      assert.equal(r.p.totalDeaths,0);assert.ok(r.p.grounded);
      assert.equal(r.report.evidence.filter(e=>e.action.startsWith('climb step')).length,steps-1);
      return {id,steps,from:base,to:top,frames:r.frame,deaths:r.p.totalDeaths,evidence:r.report.evidence};
    }
    const g=pilot();let n=g.next();
    try{while(!n.done){r.tick(n.value);n=g.next();}reports.push(n.value);console.log(JSON.stringify(n.value));}
    finally{await writeFile(`${tmpdir()}/${id}-climb-${index}.json`,JSON.stringify({report:r.report,trace:r.trace},null,2));}
  },{modulePath:'/src/levels/jungle-sequels.ts',levelId:id,start:[index?1047:367,index?24.12:.12,-1.25],maxFrames:12000});
}
console.log('PASS both Temple of Embers pilgrim stairs, including entry and reunion.');
