import type {CustomComponent} from '../level';
import {hollowPoint,hollowFloorRise,hollowRadius,hollowGroup} from './hollowwake-route';

/** Damp-cave wildlife, authored between jumps and away from decision throats.
 * All-left and all-right routes each meet nine foes: spin the scavengers, read a frog's hop, then
 * choose a side or stomp the slower armoured mossbacks. Never block a shelter. */
export const HOLLOWWAKE_ENCOUNTERS:readonly {s:number;branch:number;u:number;foe:'grunt'|'hopper'|'turtle';range:number;speed:number;name:string}[]=[
 {s:72,branch:-1,u:0,foe:'grunt',range:1.2,speed:.8,name:'Wake drain crab · first spin target'},
 {s:264,branch:0,u:1.2,foe:'grunt',range:1.5,speed:1.2,name:'Left drain scavenger'},
 {s:236,branch:1,u:-1.2,foe:'grunt',range:1.5,speed:1.2,name:'Right drain scavenger'},
 {s:596,branch:0,u:-1,foe:'hopper',range:2,speed:2.2,name:'Broken sluice spring frog'},
 {s:562,branch:1,u:1,foe:'hopper',range:2,speed:2.2,name:'Banked drain spring frog'},
 {s:988,branch:0,u:1.5,foe:'turtle',range:1,speed:.8,name:'Low siphon mossback · open left lane'},
 {s:958,branch:1,u:-1.2,foe:'hopper',range:2,speed:2.4,name:'Rising ribway spring frog'},
 {s:1342,branch:0,u:1.5,foe:'grunt',range:1.2,speed:1.4,name:'Wormwheel scavenger · first beat'},
 {s:1492,branch:0,u:-1.5,foe:'hopper',range:2.2,speed:2.6,name:'Wormwheel frog · opposite bank'},
 {s:1424,branch:1,u:1.5,foe:'turtle',range:1.1,speed:1,name:'Wormwheel mossback · open left lane'},
 {s:1864,branch:0,u:-1.5,foe:'hopper',range:2.5,speed:2.8,name:'Drowned crossing spring frog'},
 {s:1810,branch:1,u:1.6,foe:'turtle',range:1.1,speed:1,name:'Raised crossing mossback'},
 {s:1950,branch:1,u:-1.3,foe:'grunt',range:1.5,speed:1.7,name:'Crossing drain crab · opposite bank'},
 {s:2208,branch:0,u:1.6,foe:'hopper',range:2.1,speed:2.9,name:'Wreck throat frog · first beat'},
 {s:2284,branch:0,u:-1.7,foe:'turtle',range:1,speed:1.2,name:'Wreck throat mossback · switch right'},
 {s:2228,branch:1,u:-1.6,foe:'hopper',range:2.2,speed:3,name:'Final siphon spring frog'},
 {s:2370,branch:1,u:1.6,foe:'turtle',range:1,speed:1.2,name:'Last mossback · clear run to catwalk'},
];
export function hollowwakeEnemies():CustomComponent[]{
 return HOLLOWWAKE_ENCOUNTERS.map(e=>({t:'enemy',foe:e.foe,
  p:hollowPoint(e.s,e.branch,e.u,hollowFloorRise(e.u,hollowRadius(e.s))),
  range:e.range,speed:e.speed,terrainSupports:true,grp:hollowGroup(e.s),nm:e.name}));
}
/** Reserve time to read one threat; supplies never close its escape lane. */
export const hollowEnemyClearance=(s:number,branch:number)=>HOLLOWWAKE_ENCOUNTERS.some(e=>(e.branch<0||e.branch===branch)&&Math.abs(e.s-s)<34);
