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

// Low, readable groups sit off the clear running line. No crate occupies a
// launch lip, stone, halfpipe transition, rope landing or finish pad.
for(const [p,kind,name] of [
  [[9.7,0,9.1],'wood','clearing pair'],[[10.9,0,9.1],'mystery','clearing pair'],
  [[37.4,0,-23],'wood','forest entrance'],[[32.6,0,-26],'mask','before the descent'],
  [[37.4,-5.62,-57],'wood','first lower landing'],
  [[32.6,-9.55,-82],'mystery','second lower landing'],
  [[37.4,-13.5,-108],'wood','last lower landing'],
  [[32.6,-14,-123],'wood','fern grove pair'],[[31.4,-14,-123],'wood','fern grove pair'],
  [[37.4,-14,-133],'mystery','coastal checkpoint approach'],
  [[32.6,-14,-152],'multihit','quiet grove reward'],
  [[37.4,-14,-156],'wood','coastal reveal'],
  [[37.4,-14,-167],'wood','coastal shop'],[[38.6,-14,-167],'mystery','coastal shop'],
  [[32.6,-14,-179],'wood','shaded coast'],
  [[37.4,-14,-185],'wood','before village bend'],
  [[32.6,-14,-199],'mystery','village pair'],[[31.4,-14,-199],'wood','village pair'],
  [[37.4,-14,-209],'multihit','hut courtyard'],
  [[37.4,-14,-218],'wood','river checkpoint approach'],
  [[32.6,-14,-243],'wood','far riverbank'],
  [[37.4,-7.2,-293],'mask','cavern entrance'],
  [[32.5,-7.2,-344],'wood','halfpipe exit'],
  [[38.8,-7.2,-347.5],'mystery','straight rope runway'],
  [[32.5,-7.2,-349.2],'wood','straight rope runway'],
  [[37.5,-7.2,-390],'wood','sunlit finish path'],
  [[32.6,-7.2,-396],'life','last optional reward'],
] as [Point,NonNullable<CustomComponent['kind']>,string][])crate(p,kind,name);

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
