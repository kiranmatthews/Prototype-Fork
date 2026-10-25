import {puzzleControls} from './puzzle-controls.mjs';

/** Ordinary input through each authored decision, including returning for the
 * preserved launcher. Shared by native physics and the real browser loop. */
export function* runStormPorch(r){
 const c=puzzleControls(r),{p,l}=r,deaths=p.totalDeaths;
 const box=name=>c.crateNamed(name);
 const hit=function*(name){if(box(name).alive)yield* c.hit(box(name),name);};
 yield* c.stepFor(20);c.check(p.grounded,'supported covered arrival');
 c.check(!p.groundHit.slippy,'covered floor must be dry');
 for(const name of ['Welcome parcel','Welcome parcel cap','Calling-card parcel'])yield* hit(name);
 yield* c.bounce(box('Delivery shelf arrow'),[11,4.2,0],'keep the arrow and reach the upstairs delivery shelf');
 for(const name of ['Upstairs invitation','Upstairs provisions'])yield* hit(name);
 yield* c.hop([19,0,0],'descend from the delivery shelf');
 yield* hit('Delivery shelf arrow');
 for(const name of ['Repair supplies','Repair supplies cap'])yield* hit(name);
 yield* c.walk([24.8,0,0],'read the folded repair bridge');
 yield* c.tick({spinHeld:true});
 yield* c.until(()=>l.spinBridges[0].deployed,{}, {label:'wait for the porch bridge to settle',limit:100});
 yield* c.walk([33.5,0,0],'cross the restored dry maintenance leaf');
 for(const name of ['Bridge receiver parcel','Dry store delivery'])yield* hit(name);
 yield* c.walk([42.5,0,0],'pantry steps approach');
 yield* c.hop([44.8,1.2,0],'first pantry bench');yield* hit('Lower pantry parcel');
 yield* c.walk([47,1.2,0],'upper pantry takeoff');
 yield* c.hop([50.4,2.4,0],'upper pantry bench');
 for(const name of ['Pantry fruit hamper','Pantry hamper cap'])yield* hit(name);
 yield* c.hop([56.6,1.2,0],'descending pantry bench');yield* hit('Descending pantry parcel');
 yield* c.hop([61.5,0,0],'return to the main porch floor');
 for(const name of ['Bell-pull parcel','Bell-pull parcel cap','Porch bell-pull switch'])yield* hit(name);
 yield* c.hop([69.4,0,0],'clear the spent bell switch');
 for(const [i,[x,y]] of [[73.5,.6],[78,1.2],[82.5,.6]].entries()){
  c.check(!box(`Bell-pull crossing parcel ${i+1}`).pending,'bell reveals every crossing parcel');
  yield* c.hop([x,y,0],`restored porch board ${i+1}`,{airButtons:{spinHeld:true}});
  yield* hit(`Bell-pull crossing parcel ${i+1}`);
 }
 yield* c.hop([87,0,0],'last porch landing');
 for(const name of ['Departure parcel','Departure parcel middle','Departure parcel crown','Last dry delivery'])yield* hit(name);
 yield* c.clearAll('all twenty-three storm deliveries');
 const result=yield* c.finish('return from the Storm Parlour');
 c.check(p.totalDeaths===deaths,'porch traversal cannot conceal a reset');
 return {state:p.state,cratesBroken:p.cratesBroken,totalCrates:l.totalCrates,deaths:p.totalDeaths-deaths,...result};
}
