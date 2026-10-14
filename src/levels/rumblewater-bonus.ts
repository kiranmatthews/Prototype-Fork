import type {CustomComponent,CustomLevelData} from '../level';
type P=[number,number,number];
const C:CustomComponent[]=[];
const prop=(dkind:CustomComponent['dkind'],p:P,s:P,yaw=0,nm='Sluicekeeper temple masonry')=>
 C.push({t:'decor',dkind,p,s,yaw,scenerySolid:false,solid:false,grp:90,nm});
const deck=(a:number,b:number,y:number,nm:string)=>{
 C.push({t:'platform',p:[(a+b)/2,y-.65,0],s:[b-a,1.3,6.4],artProxy:true,grp:1,nm});
 const n=Math.ceil((b-a)/6);
 for(let i=0;i<n;i++)prop('templeplatform',[a+(i+.5)*(b-a)/n,y-.5,0],[(b-a)/n,.5,6.4],0,nm+' Meshy paving');
 for(let x=a+2;x<b;x+=7)prop('coastv2buttress',[x,y-9,0],[7.2,8.6,7.3],90,nm+' gorge pier');
};
const crate=(x:number,y:number,kind:CustomComponent['kind']='wood',nm='Temple store crate',outline=false)=>
 C.push({t:'crate',p:[x,y,0],kind,nm,grp:outline||kind==='bang'?20:2,...outline?{outline:true}:{}});
export const RUMBLEWATER_BONUS_TERRACES=[[-12,7,0],[7,12,.8],[12,17,1.6],[17,27,2.4],[30,39,1.2],[52,63,0],[68,90,0]] as const;
for(const [a,b,y]of RUMBLEWATER_BONUS_TERRACES)deck(a,b,y,'Sluicekeeper stepped aqueduct');
// Climb a real stepped spillway, collecting three progressively taller caches.
crate(1,0);crate(1,.96);crate(9,.8,'mystery');crate(14,1.6);crate(14,2.56);
crate(21,2.4,'bouncy','Kept arrow below the carved bell');
crate(21,9.6,'life','Bell-tower high cache');
crate(25,2.4,'mystery');
// The switch reveals three separate stepping stones and their rewards.
// Water remains between them: this is a short hop sequence, not a filled bridge.
crate(35,1.2,'bang','Sluicekeeper island switch');
for(const x of [41,45.5,50]){
 C.push({t:'platform',p:[x,.6,0],s:[3.4,1.2,5.4],dkind:'bw-flagstone-deck-v4',outline:true,tex:'stone',color:'#b3b6a2',grp:20,nm:'Revealed river stepping stone'});
 C.push({t:'decor',dkind:'stoneshaft',p:[x,-8,0],s:[1.8,8,1.8],scenerySolid:true,grp:90,nm:'Grounded river-island pier'});
 prop('stonebase',[x,-8.7,0],[3.6,.8,3.6],0,'River-island pier footing');
 crate(x,1.2,'wood','Revealed island reward '+x,true);
}
crate(55,0);crate(55,.96);crate(56,0);crate(56,.96);crate(56,1.92);crate(57,0);crate(60,0,'mystery');
// A five-metre collapsing timber sluice is crossed before the final cache.
for(const x of [63.9,65.5,67.1])C.push({t:'crumble',p:[x,0,0],s:[1.7,.6,6.4],shake:.85,speed:18,tex:'bridge-timber',grp:3,nm:'Falling sluice teeth'});
crate(71,0);crate(74,0,'life');crate(78,0,'mystery');
C.push({t:'gate',p:[84,0,0],yaw:90,nm:'Return to the protected mill culvert'});
for(const [a,b,y]of [[5,18,2.5],[26,31,4],[37,52,2.3],[62,69,1.8]])for(let x=a;x<=b;x+=2)
 C.push({t:'wumpa',p:[x,y+Math.sin((x-a)/(b-a)*Math.PI),0],grp:2});
// The camera sees an open-front temple, its aqueduct piers and the same creek.
for(let x=-8;x<90;x+=14){
 prop('templewall',[x,-3,-7],[14,11,2.5],0,'Carved rear wall above the sluice');
 prop('stoneshaft',[x,-3,-5.8],[1.8,10,1.8]);
 prop('stonecapital',[x,7,-5.8],[2.8,1.1,2.8]);
 prop('coastv2buttress',[x,-14,-7],[14,12,14]);
 prop('bw-hanging-vines',[x+4,2,-5.5],[3,5,.8],0,'Ivy rooted in the temple parapet');
 prop('coastfern',[x+3,-2.6,-3.9],[3.2,1.6,2.6],x*7,'Ferns on the wet stone ledge');
 C.push({t:'torch',p:[x+1,2.2,-5.5],rise:2,w:.6,nm:'Bracketed temple lamp'});
 prop('stonecapital',[x+1,1.85,-5.5],[.8,.35,.9]);
}
for(const x of [-6,24,77])prop('roofedtemple',[x,-3,-21],[19,20,18],0,'Sluicekeeper temple above the river');
for(const [a,b,y]of RUMBLEWATER_BONUS_TERRACES)for(let x=a+1;x<b;x+=3.5)for(const z of [-2.85,2.85])
 prop('coastv2grass',[x,y-.12,z],[1.5,.45,1],x*33,'Grass rooted between aqueduct pavers');
for(const x of [-18,7,37,62,96])prop('custardwillow',[x,-5,-28],[13,13,12],x*3,'Willows on the far temple bank');
C.push({t:'mesh',p:[40,-5,-8],vertices:[-80,0,-40,80,0,-40,80,0,28,-80,0,28],indices:[0,2,1,0,3,2],uvs:[0,0,24,0,24,10,0,10],
 solid:false,doubleSided:true,tex:'custard-water',materialStyle:'jungle-stream',color:'#6b9b8b',opacity:.87,lethal:true,castShadow:false,nm:'Rumblewater bonus millpond'});
C.push({t:'pit',p:[40,-5.3,0],s:[120,1,18],invisible:true,nm:'Visible millpond contact'});
for(const z of [-.83,.83])C.push({t:'wall',p:[40,-14,z],s:[132,52,.6],invisible:true,nm:'Side-view bonus depth boundary'});
C.push({t:'camnode',p:[-16,0,0]},{t:'camnode',p:[96,0,0]},
 {t:'camnode',p:[40,7,0],s:[140,48,18],cameraView:true,radius:1,cameraPosition:[2,8.2,22],cameraTarget:[2,5.6,0],
  cameraFollowDistance:13.4,cameraFollowTargetHeight:2.7,cameraIntroDistance:0,cameraFov:46,cameraAspect:1.3,nm:'Sluicekeeper side-view journey'});
export const RUMBLEWATER_BONUS_LEVEL:CustomLevelData={v:1,name:'Bonus: Sluicekeeper’s Cache',spawn:[-7,.12,0],killY:-11,hudMode:'bonus',sky:'carlisle',startWarpPad:false,keepPlayFog:true,cameraAirLift:.85,
 atmosphere:{fogEnabled:true,fogNear:65,fogFar:180,fogColor:'#c8c5a8',ambientSky:'#f2e4c8',ambientGround:'#7a8570',ambientIntensity:2.2,sunColor:'#fff0c9',sunIntensity:2.4,fillColor:'#abc5bf',fillIntensity:.8,drawDistance:220,shadowStrength:.6},
 components:C,groups:[{id:1,nm:'Climb the stepped aqueduct'},{id:2,nm:'Ordered temple caches'},{id:3,nm:'Falling sluice teeth'},{id:20,nm:'One switch reveals three river islands'},{id:90,nm:'Meshy temple and creek scenery',editorOnly:true}]};
