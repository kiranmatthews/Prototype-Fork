import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {withTempleRuntime} from './temple-test-runtime.mjs';
import {puzzleControls} from './puzzle-controls.mjs';

// Enter from the main trail, climb every new step using ordinary jumps, and
// rejoin the main court. No placement, tuning or state changes during a climb.
const reports=[];
for(const [index,id] of ['jungle-terraces','jungle-skyline'].entries()){
  const start=index?[250,17.37,1.25]:[160,9.12,1.25];
  await withTempleRuntime(async r=>{
    r.report={stage:'approach',actions:[],evidence:[]};
    const c=puzzleControls(r),route=r.sourceModule.JUNGLE_SEQUEL_ROUTES[index],climb=route.climbs[0];
    const {a,b,base,top,steps,side}=climb,span=(b-a)/steps;
    function* pilot(){
      yield* c.stepFor(25);
      yield* c.walk([a-8,base,-3.2],'approach the footpath fork');
      yield* c.hop([a-6,base,side+1.1],'jump onto the stair approach');
      for(let i=0;i<steps;i++){
        const edge=a+i*span,y=base+(top-base)*i/steps;
        yield* c.walk([edge-1.35,y,side],`approach step ${i+1}`);
        yield* c.hop([edge+1.6,base+(top-base)*(i+1)/steps,side],`climb step ${i+1}`,{tolerance:1.5});
        assert.equal(r.p.groundHit?.name,`Jungle temple climbing step ${i+1}`,'each jump must land on its intended step');
      }
      yield* c.walk([b+2,top,side],'reach the top landing');
      yield* c.hop([b+2,top,-3.3],'rejoin the main temple court');
      assert.equal(r.p.totalDeaths,0);assert.ok(r.p.grounded);
      assert.equal(r.report.evidence.filter(e=>e.action.startsWith('climb step')).length,steps);
      return {id,steps,from:base,to:top,frames:r.frame,deaths:r.p.totalDeaths,evidence:r.report.evidence};
    }
    const g=pilot();let n=g.next();
    try{while(!n.done){r.tick(n.value);n=g.next();}reports.push(n.value);console.log(JSON.stringify(n.value));}
    finally{await writeFile(`${tmpdir()}/${id}-climb.json`,JSON.stringify({report:r.report,trace:r.trace},null,2));}
  },{modulePath:'/src/levels/jungle-sequels.ts',levelId:id,start,maxFrames:12000});
}
console.log('PASS both Jungle sequel stair routes, including entry and reunion.');
