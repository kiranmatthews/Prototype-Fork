import {puzzleControls} from './puzzle-controls.mjs';
export function* runRumblewaterBonus(r){
 const c=puzzleControls(r),{p,l}=r;
 const at=(x,y)=>c.crateSpecAt(x,y);
 const hit=function*(x,y,label){const box=at(x,y);if(box.alive)yield* c.hit(box,label);};
 yield* c.stepFor(20);c.check(p.grounded,'supported temple bonus spawn');
 yield* hit(1,0,'arrival stack base');yield* hit(1,.96,'arrival stack cap');
 yield* c.walk([5.8,0,0],'first spillway stair');
 yield* c.hop([8.3,.8,0],'first carved stair',{airButtons:{spinHeld:true}});yield* hit(9,.8,'first stair cache');
 yield* c.walk([10.8,.8,0],'second spillway stair');
 yield* c.hop([13,1.6,0],'second carved stair',{airButtons:{spinHeld:true}});yield* hit(14,1.6,'middle cache base');yield* hit(14,2.56,'middle cache cap');
 yield* c.walk([15.8,1.6,0],'top spillway stair');yield* c.hop([18.4,2.4,0],'bell terrace');
 yield* c.highArrowBox(at(21,2.4),at(21,9.6),'claim bell cache before its arrow');
 yield* hit(25,2.4,'bell terrace exit cache');yield* c.walk([26,2.4,0],'first real water gap approach');
 yield* c.hop([31,1.2,0],'descend across the millpond');yield* c.hit(at(35,1.2),'reveal three river stepping stones');
 yield* c.hop([37.5,1.2,0],'clear the spent switch');yield* c.walk([38,1.2,0],'island sequence takeoff');
 for(const x of [41,45.5,50]){
  c.check(!at(x,1.2).pending,'switch did not reveal island reward');
  yield* c.hop([x,1.2,0],'river island '+x,{airButtons:{spinHeld:true}});
  yield* hit(x,1.2,'island reward '+x);
 }
 yield* c.hop([53.5,0,0],'far bank of the sluice');
 for(const [x,y]of [[55,0],[55,.96],[56,0],[56,.96],[56,1.92],[57,0],[60,0]])yield* hit(x,y,'storehouse cache '+x+'/'+y);
 yield* c.walk([62,0,0],'falling timber entrance');yield* c.hop([65.3,0,0],'land on falling sluice timbers');yield* c.hop([69.2,0,0],'leave timber before it collapses');
 for(const x of [71,74,78])yield* hit(x,0,'return court cache '+x);
 yield* c.clearAll('all original Sluicekeeper crates');yield* c.finish('return through the temple gate');
 return {state:p.state,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths,gem:p.gemEarned};
}
