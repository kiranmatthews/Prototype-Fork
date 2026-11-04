import {SPAGHETTI_RAILS_PLATFORMING_LEVEL as P1} from './spaghetti-platformer-p1';

// P1's actual folded knots, landings, three-way branches and collectibles.
// At 52 m/s terminal speed, a 192 m repeat takes 3.69 s (4.06 s from rest
// with board gravity). Each lower copy turns five degrees about the maze.
const data=structuredClone(P1);
data.verticalLoop={minY:0,height:192,twist:{degrees:5,center:[-50,-130]}};
delete data.fallRecoveryDrop;
data.components=data.components.filter(c=>c.t!=='pit');
data.cameraAirLift=1;
data.atmosphere={backdrop:'fog',fogEnabled:true,fogNear:110,fogFar:430,
 fogColor:'#344756',drawDistance:620,ambientSky:'#d7e1e9',ambientGround:'#8596a4',ambientIntensity:1.45,
 sunColor:'#ffe5c3',sunIntensity:1.3,sunDirection:[.4,.85,.3],fillColor:'#a4c9de',fillIntensity:.7,shadowStrength:.45};
export const SPAGHETTI_RAILS_PLATFORMING_LEVEL=data;
