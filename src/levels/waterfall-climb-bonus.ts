import type {CustomComponent,CustomLevelData} from '../level';
import {dressWaterfallBonus} from './waterfall-climb-art';

const C:CustomComponent[]=[];
const deck=(a:number,b:number,y:number,name:string)=>C.push({t:'platform',p:[(a+b)/2,y-.6,0],s:[b-a,1.2,6],
  tex:'solid',color:'#a7afb1',grp:1,nm:name});
const box=(x:number,y:number,name:string,kind:CustomComponent['kind']='wood',outline=false)=>C.push({t:'crate',p:[x,y,0],
  kind,nm:name,grp:outline||kind==='bang'?20:2,...outline?{outline:true}:{}});
deck(-14,9,0,'Spillway arrival');deck(22,31,1.2,'First waterwheel receiver');deck(34,52,2.4,'Bell keeper balcony');
deck(66,72,2.4,'Relay breathing island');deck(86,100,3.6,'Treasury switch terrace');deck(119,151,5.4,'Skywater treasury');
for(const [name,x,y,hold]of [['First waterwheel',9,0,7],['Upper waterwheel',52,2.4,5.5],['Last waterwheel',72,2.4,5.5]] as const)
  C.push({t:'spinbridge',p:[x,y,0],s:[10.8,.4,4.8],cycle:.32,hold,tex:'solid',color:'#c2ac7a',grp:3,nm:name});
box(-7,0,'Arrival parcel');box(-3,0,'Arrival pair');box(-3,.96,'Arrival pair cap');box(3,0,'First wheel supplies','mystery');
box(25,1.2,'First receiver cache');box(28,1.2,'First receiver pair');box(28,2.16,'First receiver cap');
box(39,2.4,'Bell rope launcher','bouncy');box(39,9.6,'High bell cache','life');box(47,2.4,'Bell keeper provisions','mystery');
box(68.5,2.4,'Safe island cache');box(89,3.6,'Treasury pair');box(89,4.56,'Treasury pair cap');
box(94,3.6,'Sluice seal switch','bang');
for(const [i,x]of [103.5,109,114.5].entries()){
  C.push({t:'platform',p:[x,3.6+i*.6,0],s:[3.5,1.2,5],outline:true,tex:'solid',color:'#a7afb1',grp:20,nm:`Revealed spillway stone ${i+1}`});
  box(x,4.2+i*.6,`Revealed spillway parcel ${i+1}`,'wood',true);
}
for(const [x,y,name,kind]of [[123,5.4,'Treasury lower','wood'],[123,6.36,'Treasury middle','wood'],[123,7.32,'Treasury crown','wood'],
  [128,5.4,'Lost river cache','mystery'],[133,5.4,'Keeper life','life'],[138,5.4,'Last spillway parcel','wood']] as const)box(x,y,name,kind);
for(let x=-10;x<143;x+=4.5)C.push({t:'wumpa',p:[x,1.2+(x>21?1.2:0)+(x>33?1.2:0)+(x>85?1.2:0)+(x>101?1.8:0),0],grp:2});
C.push({t:'gate',p:[145,5.4,0],yaw:90,w:5,nm:'Return from the hidden spillway'},
  {t:'pit',p:[68,-5,0],s:[180,1,18],invisible:true,nm:'Spillway water'},
  {t:'zone',p:[68,0,0],s:[190,1,30],dir:'E'},
  {t:'camnode',p:[-15,0,0]},{t:'camnode',p:[155,5.4,0]});
for(const z of [-1.3,1.3])C.push({t:'wall',p:[68,-10,z],s:[190,35,.6],invisible:true,nm:'Bonus side-view depth boundary'});
C.push({t:'mesh',p:[68,-4.7,0],vertices:[-95,0,-12,95,0,-12,95,0,12,-95,0,12],indices:[0,2,1,0,3,2],
  solid:false,doubleSided:true,tex:'solid',color:'#5f9fac',edgeGrinding:false,nm:'Greybox spillway water'});
dressWaterfallBonus(C);
export const WATERFALL_CLIMB_BONUS:CustomLevelData={v:1,name:'Bonus: The Hidden Spillway',spawn:[-10,.12,0],killY:-12,
  hudMode:'bonus',startWarpPad:false,sky:'day',fallRecoveryDrop:10,components:C,
  jungleAtmosphere:true,jungleStyle:'painterly',jungleDepthFade:false,keepPlayFog:true,
  atmosphere:{fogEnabled:true,fogNear:55,fogFar:180,fogColor:'#8dab9e',ambientSky:'#d5e7c8',ambientGround:'#426251',ambientIntensity:1.6,
    sunColor:'#ffe0a0',sunIntensity:1.7,fillColor:'#a4d7c8',fillIntensity:.7,drawDistance:220,shadowStrength:.6},
  groups:[{id:1,nm:'Permanent spillway landings'},{id:2,nm:'Keeper caches'},{id:3,nm:'Spin-timed waterwheel leaves'},
    {id:20,nm:'The sluice seal reveals three stepping stones'},
    {id:100,nm:'Ancient spillway masonry',editorOnly:true},{id:101,nm:'Water and foam',editorOnly:true},
    {id:102,nm:'Rooted ferns and hanging vegetation',editorOnly:true},{id:103,nm:'Carved sluice mechanisms',editorOnly:true}]};
