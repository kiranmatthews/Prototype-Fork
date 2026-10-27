import type {CustomComponent,CustomLevelData} from '../level';
import {dressWaterfallBonus} from './waterfall-climb-art';

const C:CustomComponent[]=[];
const deck=(a:number,b:number,y:number,name:string)=>C.push({t:'platform',p:[(a+b)/2,y-.6,0],s:[b-a,1.2,6],
  tex:'solid',color:'#a7afb1',grp:1,nm:name});
const box=(x:number,y:number,name:string,kind:CustomComponent['kind']='wood',outline=false)=>C.push({t:'crate',p:[x,y,0],
  kind,nm:name,grp:outline||kind==='bang'?20:2,...outline?{outline:true}:{}});
deck(-14,9,0,'Spillway arrival');deck(22,31,1.2,'First waterwheel receiver');deck(34,52,2.4,'Bell keeper balcony');
deck(78,90,2.4,'Ferry shore');deck(110,128,4.5,'Treasury switch terrace');deck(148,180,6.8,'Skywater treasury');
C.push({t:'spinbridge',p:[9,0,0],s:[10.8,.4,4.8],cycle:.32,hold:7,tex:'solid',color:'#c2ac7a',grp:3,nm:'First waterwheel'});
C.push({t:'mover',p:[64,2.4,0],s:[7.5,.6,5.4],axis:'x',amp:7,speed:.55,phase:0,tex:'creek-raft',grp:3,nm:'Bell keeper ferry'});
for(const [i,x,y]of [[0,96,3.1],[1,104,3.8]])C.push({t:'crumble',p:[x,y,0],s:[6,.6,5.4],shake:2.1,speed:24,tex:'waterfall-timber',color:'#c68f61',grp:3,nm:'Rotten treasury beam '+(i+1)});
box(-7,0,'Arrival parcel');box(-3,0,'Arrival pair');box(-3,.96,'Arrival pair cap');box(3,0,'First wheel supplies','mystery');
box(25,1.2,'First receiver cache');box(28,1.2,'First receiver pair');box(28,2.16,'First receiver cap');
box(39,2.4,'Bell rope launcher','bouncy');box(39,9.6,'High bell cache','life');box(47,2.4,'Bell keeper provisions','mystery');
box(81,2.4,'Ferry shore pair');box(81,3.36,'Ferry shore pair cap');
box(96,3.1,'Rotten beam parcel 1');box(104,3.8,'Rotten beam parcel 2');
box(114,4.5,'Treasury pair');box(114,5.46,'Treasury pair cap');box(121,4.5,'Sluice seal switch','bang');
for(const [i,x,y]of [[0,133.5,5.2],[1,141.5,6]]){
 C.push({t:'platform',p:[x,y-.6,0],s:[4.8,1.2,5],outline:true,tex:'solid',color:'#a7afb1',grp:20,nm:'Revealed spillway stone '+(i+1)});
 box(x,y,'Revealed spillway parcel '+(i+1),'wood',true);
}
for(const [x,y,name,kind]of [[153,6.8,'Treasury lower','wood'],[153,7.76,'Treasury crown','wood'],[161,6.8,'Keeper life','life'],[168,6.8,'Last spillway parcel','mystery']] as const)box(x,y,name,kind);
for(const [x,y]of [[11,1.8],[17,1.8],[32,3.6],[55,3.6],[74,3.6],[92,4.4],[100,5],[108,5.7],[130,6.4],[138,7],[146,7.8]])C.push({t:'wumpa',p:[x,y,0],grp:2});
C.push({t:'gate',p:[174,6.8,0],yaw:90,w:5,nm:'Return from the hidden spillway'},
 {t:'pit',p:[84,-5,0],s:[210,1,18],invisible:true,nm:'Spillway water'},
 {t:'zone',p:[84,0,0],s:[220,1,30],dir:'E'},
 {t:'camnode',p:[-15,0,0]},{t:'camnode',p:[184,6.8,0]});
for(const z of [-1.3,1.3])C.push({t:'wall',p:[84,-10,z],s:[220,35,.6],invisible:true,nm:'Bonus side-view depth boundary'});
C.push({t:'mesh',p:[68,-4.7,0],vertices:[-95,0,-12,95,0,-12,95,0,12,-95,0,12],indices:[0,2,1,0,3,2],
  solid:false,doubleSided:true,tex:'solid',color:'#5f9fac',edgeGrinding:false,nm:'Greybox spillway water'});
// Dressing was enabled after the replacement gameplay review.
const dressed=true;if(dressed)dressWaterfallBonus(C);
export const WATERFALL_CLIMB_BONUS:CustomLevelData={v:1,name:'Bonus: The Hidden Spillway',spawn:[-10,.12,0],killY:-12,
  hudMode:'bonus',startWarpPad:false,sky:'day',fallRecoveryDrop:10,components:C,
  jungleAtmosphere:true,jungleStyle:'painterly',jungleDepthFade:false,keepPlayFog:true,
  atmosphere:{fogEnabled:true,fogNear:55,fogFar:180,fogColor:'#8dab9e',ambientSky:'#d5e7c8',ambientGround:'#426251',ambientIntensity:1.6,
    sunColor:'#ffe0a0',sunIntensity:1.7,fillColor:'#a4d7c8',fillIntensity:.7,drawDistance:220,shadowStrength:.6},
  groups:[{id:1,nm:'Permanent spillway landings'},{id:2,nm:'Keeper caches'},{id:3,nm:'Timed wheel, ferry and rotten beams'},
    {id:20,nm:'The sluice seal reveals two stepping stones'},
    {id:100,nm:'Ancient spillway masonry',editorOnly:true},{id:101,nm:'Water and foam',editorOnly:true},
    {id:102,nm:'Rooted ferns and hanging vegetation',editorOnly:true},{id:103,nm:'Carved sluice mechanisms',editorOnly:true}]};
