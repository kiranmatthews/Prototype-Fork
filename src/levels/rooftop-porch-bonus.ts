import type {CustomComponent,CustomLevelData} from '../level';
import {dressStormPorch} from './rooftop-porch-art';

const components:CustomComponent[]=[];
const cube={vertices:[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],
 indices:[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]};
const repairBoard={vertices:[] as number[],uvs:[] as number[]};
// Give each face its own metric UVs, matching the porch plank direction and
// density instead of stretching a single tiny tile over a 17-metre board.
for(const [i,vertex] of cube.indices.entries()){
 const x=cube.vertices[vertex*3]*3,y=cube.vertices[vertex*3+1]*.6,z=cube.vertices[vertex*3+2]*17.4;
 repairBoard.vertices.push(x,y,z);
 repairBoard.uvs.push(...(i<12?[x/3.4,y/3.4]:i<24?[x/3.4,z/3.4]:[z/3.4,y/3.4]));
}
export const STORM_PORCH_DECKS=[[-12,26,0],[32,70,0],[86,108,0]] as const;
export const STORM_PORCH_STEPS=[[73.5,.6],[78,1.2],[82.5,.6]] as const;
const deck=(a:number,b:number,y:number,nm:string,depth=17.4)=>components.push({t:'platform',p:[(a+b)/2,y-.45,depth===17.4?-4.5:0],
 s:[b-a,.9,depth],tex:'plank',color:'#b8c7c7',grp:1,nm});
const crate=(x:number,y:number,kind:CustomComponent['kind'],nm:string,outline=false)=>components.push({t:'crate',p:[x,y,0],kind,nm,
 grp:outline||kind==='bang'?20:2,...(outline?{outline:true}:{})});
for(const [a,b,y] of STORM_PORCH_DECKS)deck(a,b,y,'Sheltered painted porch floor');

// Read the high delivery shelf, keep its arrow, collect upstairs, then come
// back for the arrow. The permanent shelf cannot be destroyed by collecting it.
crate(-3,0,'wood','Welcome parcel');crate(-3,.96,'wood','Welcome parcel cap');
crate(1,0,'mystery','Calling-card parcel');
crate(7,0,'bouncy','Delivery shelf arrow');
deck(10,18,4.2,'Upper delivery shelf',3.6);
crate(12,4.2,'life','Upstairs invitation');crate(15.5,4.2,'mystery','Upstairs provisions');
crate(21,0,'wood','Repair supplies');crate(21,.96,'wood','Repair supplies cap');

// A real six-metre floor opening. Spin the upright maintenance leaf and wait
// for it to settle before crossing; scenery never supplies invisible support.
components.push({t:'spinbridge',p:[26,0,-4.5],s:[6,.34,17.4],cycle:.75,tex:'plank',color:'#c7cfca',grp:3,nm:'Fold-down porch repair bridge'});
crate(36,0,'wood','Bridge receiver parcel');crate(40,0,'mystery','Dry store delivery');
for(const [a,b,y] of [[44,48,1.2],[50,54,2.4],[56,60,1.2]])deck(a,b,y,'Stepped pantry storage bench',3.6);
crate(46,1.2,'wood','Lower pantry parcel');
crate(52,2.4,'multihit','Pantry fruit hamper');crate(52,3.36,'wood','Pantry hamper cap');
crate(58,1.2,'mystery','Descending pantry parcel');
crate(64,0,'wood','Bell-pull parcel');crate(64,.96,'life','Bell-pull parcel cap');

// The bell-pull switch restores three separate porch boards. Their stepped
// heights and visible gaps ask for three deliberate jumps, then a safe landing.
crate(68,0,'bang','Porch bell-pull switch');
for(const [i,[x,y]] of STORM_PORCH_STEPS.entries()){
 components.push({t:'mesh',p:[x,y-.3,-4.5],...repairBoard,tex:'plank',color:'#c4d0c9',outline:true,grp:20,nm:`Revealed porch board ${i+1}`});
 crate(x,y,i===1?'mystery':'wood',`Bell-pull crossing parcel ${i+1}`,true);
}
crate(91,0,'wood','Departure parcel');crate(91,.96,'wood','Departure parcel middle');crate(91,1.92,'life','Departure parcel crown');
crate(97,0,'mystery','Last dry delivery');
for(const [x,y] of [[5,1.5],[7,3.5],[9,5.8],[17,5.5],[20,2.2],[26,1.5],[29,1.8],[32,1.5],
 [43,2.2],[49,3.6],[55,3.6],[61,2.2],[71,2.3],[75.6,3.2],[80.2,3.7],[84.5,2.7],[88,1.4],[100,1.4]])
 components.push({t:'wumpa',p:[x,y,0],grp:2});
components.push({t:'gate',p:[103,0,0],yaw:90,grp:1,nm:'Storm Parlour return to the rooftops'});
for(const z of [-.83,.83])components.push({t:'wall',p:[48,-16,z],s:[148,56,.6],invisible:true,grp:4,nm:'Bonus depth boundary'});
components.push({t:'camnode',p:[-16,0,0],grp:4},{t:'camnode',p:[112,0,0],grp:4},
 {t:'camnode',p:[48,8,0],s:[148,54,18],cameraView:true,radius:1,cameraPosition:[2,10,26],cameraTarget:[2,5.3,0],
  cameraFollowDistance:26,cameraFollowTargetHeight:5.3,cameraIntroDistance:0,cameraFov:49,cameraAspect:1.3,grp:4,nm:'Sheltered porch side view'});
dressStormPorch(components);

export const ROOFTOP_PORCH_BONUS:CustomLevelData={
 v:1,name:'Bonus: The Storm Parlour',spawn:[-8,.12,0],killY:-4,hudMode:'bonus',sky:'coastal-storm',
 startWarpPad:false,keepPlayFog:true,cameraAirLift:.85,
 atmosphere:{backdrop:'painted sky',fogEnabled:true,fogColor:'#aebdca',fogNear:48,fogFar:225,
  rain:{intensity:.86,wind:[5.5,2.8],lens:0,shelter:{min:[-15,-16,-13.2],max:[112,12,.45]}},
  ambientSky:'#c7d8e8',ambientGround:'#87939b',ambientIntensity:1.12,
  sunColor:'#e3edf2',sunIntensity:1.1,sunDirection:[-.65,.58,.48],fillColor:'#b7ccda',fillIntensity:.6,
  shadowStrength:.48,drawDistance:350,fallbackTop:'#677d94',fallbackBottom:'#bdc9d1',fallbackFog:'#aebdca',fallbackSunColor:null},
 components,groups:[{id:1,nm:'Covered porch and raised pantry shelves'},{id:2,nm:'Twenty-three dry deliveries'},
  {id:3,nm:'Spin-deployed maintenance crossing'},{id:20,nm:'Bell-pull porch restoration circuit'},
  {id:4,nm:'Bonus camera and depth containment',editorOnly:true},{id:90,nm:'Colonial manor and white balustrade',editorOnly:true},
  {id:91,nm:'Rainy Carolina garden',editorOnly:true}],
};
