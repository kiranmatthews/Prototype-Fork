import type {CustomComponent} from '../level';
import type {TempleRoute} from './jungle-sequels';

// Station, side and count describe optional caches on flat courts or the
// broad bottom of the giant bowl. Keep the charged line and tiki escape lane
// clear; no new donor sits within jumping distance of an existing high puzzle.
export const TEMPLE_OFFERING_GROUPS = [
  [1,-5,-3,5],[1,12,-3,5],
  [2,84,-3,5],[2,147,3,3],
  [3,277,-3,4],
  [4,289,-3,5],[4,356,3,5],
  [5,431,3,3],[5,480,-3,3],
  [6,544,3,5],[6,586,-3,2],
  [7,720,-3,5],[7,801,3,2],
  [9,948,3,5],[9,1032,3,3],
  [10,1107,-3,5],[10,1118,-3,5],
  [11,1162.5,-3.2,10],
  [12,1242,3,5],[12,1265,3,5],
  [13,1354,-3,5],[13,1378,-3,5],
] as const;

export function arrangeTempleCrates(route:TempleRoute):void {
  const replaced=new Set([
    'Protection before the first temple ascent','Protection for the skyline route',
    'Opening spin rhythm, on supported stone','Three-box skating pickup line',
    'Optional striped rhythm on the quiet back edge','Optional rhythm box clear of the pipe takeoff',
    'Slow down at the switch court','Rewards after the created bridge',
    'Landing rewards set behind the clear touchdown','Finish rewards beyond the clear touchdown',
    'Offering after the patrol: supported optional spin line',
    'Offering stack cap: jump or spin after reading the patrol',
    'Pilgrim stair offering: reward the deliberate climbing route',
  ]);
  const keep=(c:CustomComponent)=>c.t!=='crate'||!replaced.has(c.nm??'');
  route.data.components=route.data.components.filter(keep);
  route.sourceComponents=route.sourceComponents.filter(keep);
  const add=(c:CustomComponent)=>{
    route.data.components.push(c);
    route.sourceComponents.push({...c,p:route.toLocal(c.p)});
  };
  const shapes:Record<number,[number,number][]>={
    2:[[0,0],[0,.96]],
    3:[[-.48,0],[.48,0],[0,.96]],
    4:[[-.48,0],[.48,0],[-.48,.96],[.48,.96]],
    5:[[-.96,0],[0,0],[.96,0],[-.48,.96],[.48,.96]],
    10:[[-1.92,0],[-.96,0],[0,0],[.96,0],[1.92,0],[-1.92,.96],[-.96,.96],[0,.96],[.96,.96],[1.92,.96]],
  };
  const counts=new Map<number,number>();
  for(const [section,s,side,n] of TEMPLE_OFFERING_GROUPS){
    const number=(counts.get(section)??0)+1;counts.set(section,number);
    const p=route.toWorld(s,route.groundAt(s),side),f=route.frameAt(s);
    const alongX=Math.abs(f.fx)>=Math.abs(f.fz),sign=Math.sign(alongX?f.fx:f.fz);
    for(const [i,[u,h]] of shapes[n].entries())add({t:'crate',
      p:[p[0]+(alongX?u*sign:0),p[1]+h,p[2]+(alongX?0:u*sign)],grp:213,
      kind:i===n-1?([-5,544,1032].includes(s)?'mask':'mystery'):'wood',
      nm:`Ember offering / section ${section} / cache ${number} / box ${i+1}`});
  }
  // Keep the seven optional stair decisions and their earned lives. Move
  // each base inside the step's footprint, then add its ordinary companion.
  for(const [j,c] of route.climbs.entries())for(let i=1;i<c.steps;i+=2){
    const s=c.a+(i+.62)*(c.b-c.a)/c.steps,y=c.base+(c.top-c.base)*(i+1)/c.steps;
    for(let tier=0;tier<2;tier++)add({t:'crate',p:route.toWorld(s,y+.035+tier*.96,c.side-.8),grp:213,
      kind:tier===0?'wood':i+2>=c.steps?'life':'mystery',
      nm:`Ember stair offering / climb ${j+1} / step ${i+1} / box ${tier+1}`});
  }
}
