import {puzzleControls} from './puzzle-controls.mjs';
export function* runRumblewaterBonus(r){
 const c=puzzleControls(r),{p,l}=r;
 const at=(x,y)=>c.crateSpecAt(x,y);
 const hit=function*(x,y,label){const box=at(x,y);if(box.alive)yield* c.hit(box,label);};
 function* harvest(a,b,label){
  const boxes=l.crates.filter(box=>box.alive&&!box.pending&&!box.bang&&box.mesh.position.x>=a&&box.mesh.position.x<=b)
   .sort((a,b)=>a.box.min.y-b.box.min.y||a.mesh.position.x-b.mesh.position.x);
  for(const box of boxes)if(box.alive)yield* c.hit(box,label);
 }
 yield* c.stepFor(20);c.check(p.grounded,'supported temple bonus spawn');
 yield* harvest(.5,2.5,'arrival harvest');
 yield* c.walk([5.8,0,0],'first spillway stair');
 yield* c.hop([8.3,.8,0],'first carved stair',{airButtons:{spinHeld:true}});yield* hit(9,.8,'first stair cache');
 yield* c.walk([10.8,.8,0],'second spillway stair');
 yield* c.hop([13,1.6,0],'second carved stair',{airButtons:{spinHeld:true}});yield* harvest(13.5,14.5,'middle harvest');
 yield* c.walk([15.8,1.6,0],'top spillway stair');yield* c.hop([18.4,2.4,0],'bell terrace');
 yield* c.highArrowBox(at(21,2.4),c.crateNamed('Bell-tower high cache'),'claim bell cache before its arrow');
 yield* hit(25,2.4,'bell terrace exit cache');yield* c.walk([26,2.4,0],'first real water gap approach');
 yield* c.hop([31,1.2,0],'descend across the millpond');yield* c.hit(at(35,1.2),'reveal three island reward stacks');
 yield* c.hop([37.5,1.2,0],'clear the spent switch');yield* c.walk([38,1.2,0],'island sequence takeoff');
 for(const x of [41,45.5,50]){
  c.check(!at(x,1.2).pending,'switch did not reveal island reward');
  yield* c.hop([x,1.2,0],'river island '+x,{airButtons:{spinHeld:true}});
  yield* harvest(x-.5,x+.5,'island reward '+x);
 }
 yield* c.hop([53.5,0,0],'far bank of the sluice');
 for(const [x,y]of [[55,0],[55,.96],[56,0],[56,.96],[56,1.92],[57,0]])yield* hit(x,y,'storehouse cache '+x+'/'+y);
 yield* harvest(58.5,61.5,'storehouse resting stock');
 yield* c.walk([62,0,0],'falling timber entrance');yield* c.hop([65.3,0,0],'land on falling sluice timbers');yield* c.hop([69.2,0,0],'leave timber before it collapses');
 yield* harvest(72,81,'return court harvest walls');
 yield* c.clearAll('all Sluicekeeper crates');yield* c.finish('return through the temple gate');
 return {state:p.state,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths,gem:p.gemEarned};
}
