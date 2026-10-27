import type {CustomComponent,CustomLevelData} from '../level';
import {dressTribalBonus} from './tribal-run-art';
const C:CustomComponent[]=[];
const deck=(a:number,b:number,y:number,nm:string,grp=1,outline=false)=>C.push({t:'platform',p:[(a+b)/2,y-2.5,0],s:[b-a,5,7],tex:'solid',color:'#aeb8be',grp,nm,...outline?{outline:true}:{}});
const box=(x:number,y:number,name:string,kind:CustomComponent['kind']='wood',grp=2)=>C.push({t:'crate',p:[x,y,0],kind,grp,nm:name});
deck(-16,8,0,'Vault arrival');deck(10.5,19,1.2,'First listening step');deck(21.5,31,2.4,'Second listening step');
deck(31,59,0,'Resonance drum recovery floor');
deck(31,33,1.2,'Near drum recovery step');deck(38,41.5,1.2,'Far drum recovery step');
C.push({t:'trampoline',p:[35,2.4,0],s:[6,.8,7],speed:21,amp:1.1,tex:'solid',color:'#d0b77c',grp:3,nm:'The resonance drum'});
deck(42,60,6.8,'High echo gallery');
for(const [a,b]of [[63,67],[69.4,73.4],[75.8,79.8]])deck(a,b,6.8,'Revealed echo stepping stone',20,true);
deck(82.2,90,3.4,'Lower answering drum');deck(92.5,116,0,'Vault return court');
for(let i=0;i<3;i++)C.push({t:'crumble',p:[60.5+i,6.8,0],s:[1.1,.6,7],shake:1.7,speed:16,tex:'solid',color:'#cab18c',grp:3,nm:'Gallery breakaway lip '+i});
for(const [x,y,n]of [[-8,0,'First offering'],[-4,0,'Second offering'],[1,0,'Call'],[1,.96,'Call cap'],[14,1.2,'First response'],[25,2.4,'Second response'],[28,2.4,'Drum approach'],
 [45,6.8,'High echo'],[45,7.76,'High echo cap'],[49,6.8,'Vault cache'],[54,6.8,'Gallery gift'],[65,6.8,'Stone one'],[71.4,6.8,'Stone two'],[77.8,6.8,'Stone three'],
 [86,3.4,'Lower answer'],[97,0,'Return offering'],[101,0,'Last call'],[101,.96,'Last call cap'],[105,0,'Final answer']] as [number,number,string][])box(x,y,n);
box(57,6.8,'Reveal the three echoes','bang',20);box(109,0,'Vault life','life');
for(const [x,y]of [[8.8,2],[20.2,3.4],[35,5.1],[38,7.3],[40,8.1],[61.7,8.4],[68.2,8.4],[74.6,8.4],[81,7.2],[91.3,4.8]])C.push({t:'wumpa',p:[x,y,0],grp:2});
for(const z of [-.83,.83])C.push({t:'wall',p:[50,-14,z],s:[150,50,.6],invisible:true,grp:4,nm:'Vault side-view depth boundary'});
C.push({t:'pit',p:[50,-6,0],s:[150,1,24],color:'#607c85',grp:4,nm:'Visible vault pool'},
 {t:'camnode',p:[-18,0,0],grp:4},{t:'camnode',p:[120,0,0],grp:4},
 {t:'camnode',p:[50,7,0],s:[160,45,18],cameraView:true,radius:1,cameraPosition:[2,8.1,24],cameraTarget:[2,5.3,0],
  cameraFollowDistance:14.5,cameraFollowTargetHeight:2.4,cameraFov:48,cameraAspect:1.4,grp:4,nm:'Resonance Vault side-view'},
 {t:'gate',p:[113,0,0],yaw:90,grp:4,nm:'Return to Great Drum Court'});
export const TRIBAL_RUN_BONUS_LEVEL:CustomLevelData={v:1,name:'Bonus: The Resonance Vault',spawn:[-12,.12,0],killY:-14,hudMode:'bonus',startWarpPad:false,
 sky:'day',cameraAirLift:.75,atmosphere:{fogEnabled:true,fogNear:80,fogFar:180,fogColor:'#b4c6cb',ambientIntensity:1.8,sunIntensity:1.6,drawDistance:220},
 components:C,groups:[{id:1,nm:'Listening steps and echo gallery'},{id:2,nm:'Twenty offerings'},{id:3,nm:'Resonance drum and breakaway lip'},
 {id:20,nm:'Switch reveals the three echoes'},{id:4,nm:'Camera and return',editorOnly:true}]};
dressTribalBonus(TRIBAL_RUN_BONUS_LEVEL);
