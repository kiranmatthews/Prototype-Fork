import type { CustomComponent, CustomLevelData } from '../level';

// Airborne +X bonus. Every reward has permanent smooth support; the density
// volumes carry all of the billowing detail without changing jump physics.
export const SKYSTREAM_BONUS_ISLANDS = [
  {left:-14,right:4,top:180,depth:8.4,boxes:[-9,-6,-3,0]},
  {left:6.6,right:18.6,top:180.4,depth:7.8,boxes:[9,12,15]},
  {left:21.2,right:29.2,top:181,depth:7.2,boxes:[24,26.5]},
  {left:31.8,right:43.8,top:180.3,depth:9,boxes:[34.5,37.5,40.5]},
  {left:46.4,right:57.4,top:180.7,depth:7.6,boxes:[49,52,55]},
  {left:60,right:76,top:180,depth:9.4,boxes:[63,66,69]},
];
const components:CustomComponent[]=[];
let box=0;
for(const [i,island] of SKYSTREAM_BONUS_ISLANDS.entries()){
  const {left,right,top,depth,boxes}=island;
  components.push({t:'platform',p:[(left+right)/2,top-.09,0],s:[right-left,.18,depth],
    cloudRoad:true,tex:'solid',seed:7301+i*1949,nm:`Cumulus landing ${i+1}`,grp:1});
  for(const x of boxes){
    const kind=++box===17?'life':box===18?'mask':'wood';
    components.push({t:'crate',p:[x,top,0],kind,nm:`Cloud cache ${box}`,grp:2});
  }
  for(const x of [left+1.4,(left+right)/2,right-1.4])
    components.push({t:'wumpa',p:[x,top+1.15,0],grp:2});
  if(i<SKYSTREAM_BONUS_ISLANDS.length-1)
    components.push({t:'wumpa',p:[right+1.3,top+1.8,0],nm:'Fruit over the next cloud gap',grp:2});
}
// Cloud banks occupy several depths below and behind the landing silhouettes.
// Their volume domains are scenery, never an invisible bypass over the jumps.
for(const [i,[x,y,z,w,d]] of [
  [-22,171,-32,26,18],[12,174,-46,31,20],[45,169,-34,28,18],
  [76,175,-52,32,20],[103,168,-26,24,16],[-6,162,20,23,16],
].entries())components.push({t:'platform',p:[x,y-.09,z],s:[w,.18,d],cloudRoad:true,
  solid:false,tex:'solid',seed:11729+i*3761,nm:'Distant floating cumulus bank',grp:4});
for(const z of [-.83,.83])components.push({t:'wall',p:[31,160,z],s:[104,48,.6],
  invisible:true,nm:'Bonus play plane',grp:3});
components.push(
  {t:'zone',p:[31,180,0],s:[104,1,18],dir:'E',grp:3},
  {t:'camnode',p:[-16,180,0],radius:5,grp:3},
  {t:'camnode',p:[78,180,0],radius:5,grp:3},
  {t:'gate',p:[72,180,0],yaw:90,nm:'Cloud bonus return',grp:3},
);
export const SKYSTREAM_BONUS_LEVEL:CustomLevelData={
  v:1,name:'Bonus: Cumulus Cache',spawn:[-12,180.12,0],killY:166,
  hudMode:'bonus',sky:'clouds',keepPlayFog:true,jungleDepthFade:false,ledgeGrabs:false,
  atmosphere:{fogColor:'#d8e8f5',fogNear:90,fogFar:300,drawDistance:440,
    sunDirection:[-.34,.38,-.86],sunIntensity:2.1,ambientIntensity:.85},
  components,groups:[{id:1,nm:'Six floating cloud landings'},{id:2,nm:'Cloud rewards'},
    {id:3,nm:'Side-view bonus route',editorOnly:true},{id:4,nm:'Distant cumulus banks',editorOnly:true}],
};
