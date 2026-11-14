import type {CustomComponent} from '../level';
import {looseFruitCluster} from './fruit-clusters';
import {TREEHOUSE_RIVER_STONES} from './treehouse-trials-continuity';

type Point=[number,number,number];
const rewards:CustomComponent[]=[];
const fruit=(p:Point,name:string)=>rewards.push({t:'wumpa',p,nm:'Trail fruit · '+name,grp:3});
const bunch=(p:Point,name:string)=>rewards.push(...looseFruitCluster(
  (side,forward)=>[p[0]+side,p[1],p[2]+forward], 'Treehouse '+name,3));
const crate=(p:Point,kind:CustomComponent['kind'],name:string)=>
  rewards.push({t:'crate',p,kind,nm:'Trail crate · '+name,grp:3});

// Authoring coordinates: the course's cave extension and continuity pass
// move rewards with their supporting terrain, just like checkpoints.
// Singles lead through the actual clearing, then down the three jump lines.
for(const p of [[1,1.1,9],[8,1.1,9],[14,1.2,5],[14,1.2,-2],
  [17,1.1,-9],[23,1.1,-15],[30,1.1,-17],[35,1.1,-19],
  [35,1.1,-24],[35,.35,-31],[35,-1.15,-38]] as Point[])fruit(p,'arrival and descent');
for(const [lip,launch,land,landing] of [[-46,-2.2,-50,-5.1],[-71,-5.9,-75,-9],[-98,-9.8,-102,-13]]){
  fruit([35,launch+1.1,lip+1],'downhill jump lip');
  fruit([35,launch+1.9,lip-2],'downhill jump arc');
  fruit([35,landing+1.1,land-2],'downhill receiving ground');
}
for(const p of [[35,-4.55,-57],[35,-4.98,-63],[35,-8.6,-82],[35,-9,-89],
  [35,-12.5,-108]] as Point[])fruit(p,'lower dirt trail');

// Gameplay Design Bible II–IV / VI: the opening teaches a small vocabulary;
// the all-box line asks for deliberate stops beside the clear running lane.
// Author touching formations on the 0.96 grid (runtime enlarges them ×1.2).
const stack=(p:Point,kinds:NonNullable<CustomComponent['kind']>[],job:string)=>
  kinds.forEach((kind,tier)=>crate([p[0],p[1]+tier*.96,p[2]],kind,job));
const pile=(p:Point,kinds:NonNullable<CustomComponent['kind']>[],job:string)=>
  kinds.forEach((kind,i)=>crate([p[0]+(i%2-.5)*.96,p[1]+Math.floor(i/2)*.96,p[2]],kind,job));

// 9 crates before C1. The two-high clearing L teaches a visible lid reward;
// the forest stack repeats it, and the mask is collected before the descent.
pile([10.3,0,9.1],['wood','wood','mystery'],'TEACH · clearing lid reward');
stack([37.7,0,-23],['multihit','wood','mystery'],'TEACH · striped support on safe forest ground');
pile([32.3,0,-26],['wood','wood','mask'],'PROTECT · before the descent');

// 10 between C1 and C2. These three singles are intentional landing markers,
// off the downhill centreline; the first rest after the jumps holds a wall.
crate([37.4,-5.62,-57],'wood','LANDING · first lower landing');
crate([32.6,-9.55,-82],'mystery','LANDING · second lower landing');
crate([37.4,-13.5,-108],'wood','LANDING · last lower landing');
pile([32.3,-14,-123],['wood','mystery','wood','mystery'],'REST · fern grove harvest wall');
stack([37.7,-14,-133],['wood','mystery','wood'],'COUNT · coastal checkpoint approach');

// 12 between C2 and C3. Multi-hit now supports a target; the arrow has an
// explicit overhead reward before the bonus asks the player to conserve it.
// This first arrow is a forgiving payout, not a double-jump-proof height lock.
stack([32.3,-14,-152],['multihit','wood','mystery'],'TEST · harvest lid before guarded striped base');
crate([37.7,-14,-167],'bouncy','TEACH · arrow under the shop rewards');
stack([37.7,-9.65,-167],['mystery','wood'],'TOOL TARGET · shop arrow rewards');
pile([32.3,-14,-199],['wood','wood','mystery'],'REWARD · shaded village pocket');
stack([37.7,-14,-209],['multihit','wood','mystery'],'TEST · village striped support');

// 10 between C3 and C4. The stepping stones and rock treads stay pickup-free;
// supported banks and the broad upper landing carry the collection stops.
pile([32.3,-14,-243],['wood','wood','mystery'],'REST · far riverbank');
pile([37.7,-14,-251],['wood','mystery','wood'],'ANTICIPATE · cave-climb waiting ground');
pile([32.3,-7.2,-286],['wood','mystery','wood','mystery'],'REWARD · upper climb landing');

// 10 between C4 and C5. The pipe is a deliberate skating breather. Its centre,
// transitions and coping stay clear; these groups occupy the flat end courts.
pile([37.7,-7.2,-293],['wood','wood','mask'],'PROTECT · cavern entrance');
stack([32.3,-7.2,-340],['wood','wood','mystery'],'REST · last flat of the pipe');
pile([37.7,-7.2,-344],['wood','mystery','wood','mystery'],'MODE CHANGE · dismount before the rope');

// 11 after C5. The checkpoint restores these before the one-way rope crossing.
// No box or enemy occupies the rope, its central run-up or its receiving pad.
stack([31.7,-7.2,-347.5],['wood','wood','mystery'],'LAST CHANCE · left of the rope runway');
stack([39.8,-7.2,-349.2],['multihit','wood','mystery'],'TEST · runway support at the right shoulder');
pile([37.7,-7.2,-390],['wood','mystery','wood','mystery'],'REWARD · sunlit finish wall');
crate([32.6,-7.2,-396],'mystery','COUNT · look beside the exit before leaving');

for(const [p,name] of [
  [[4,0,8],'clearing handful'],[[35,0,-25],'forest entrance handful'],
  [[35,-14,-121],'fern grove handful'],[[35,-14,-146],'quiet grove handful'],
  [[35,-14,-173],'coastal handful'],[[35,-14,-204],'village handful'],
  [[35,-14,-226],'riverbank handful'],[[35,-14,-244],'far bank handful'],
  [[35,-7.2,-292],'cavern rest handful'],[[35,-7.2,-344],'halfpipe exit handful'],
  [[35,-7.2,-391],'sunlit finish handful'],
] as [Point,string][])bunch(p,name);

for(const z of [-118,-128,-138,-142,-151,-158,-163,-169,-181,-187,-194,-202,-211,-219,-224])
  fruit([35,-12.9,z],'forest, coast and village line');
for(const stone of TREEHOUSE_RIVER_STONES)
  fruit([stone.x,stone.top+1.08,stone.z],'six stepping-stone crossing');
for(const p of [[35,-12.9,-241],[35,-12.9,-247],[35,-12.9,-250],
  [35,-12.7,-252],[35,-11.2,-260],[35,-9.5,-268],[35,-7.8,-276],[35,-6.3,-283]] as Point[])
  fruit(p,'river-to-cavern ascent');
for(const z of [-299,-306,-313,-320,-327,-334,-340])fruit([35,-6.1,z],'halfpipe centre line');
// The thirty-metre runway is an inserted span: place its breadcrumbs in the
// source interval so all of them inherit the extension without filling the gap.
for(const z of [-348.25,-348.6,-348.95,-349.3,-349.65,-350,-352])
  fruit([36.35,-6.1,z],'straight rope approach');
for(const z of [-356,-358,-366,-368])fruit([36.35,-4.8,z],'rope rail');
for(const z of [-376,-381,-386,-395,-399])fruit([35,-6.1,z],'finish approach');

export const TREEHOUSE_TRAIL_REWARDS=rewards;
