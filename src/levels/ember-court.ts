import type {CustomComponent,CustomLevelData} from '../level';
import {COURT_SOLIDS,COURT_EXTRA_TORCHES} from '../fire-lab/court-layout';

// Broad, safe inspection arena. All traversal uses ordinary Bone Man physics;
// the low side terraces invite jumps without gating access to any fire study.
const prop=(x:number,y:number,z:number,w:number,h:number,d:number):CustomComponent=>({
  t:'wall',p:[x,y-h/2,z],s:[w,h,d],invisible:true,
});
export const EMBER_COURT_LEVEL:CustomLevelData={
  v:1,name:'Ember Court · Fire Lab',spawn:[0,.12,13],killY:-10,
  startWarpPad:false,emberCourt:true,sky:'sunset',keepPlayFog:true,
  cameraRig:{camDist:10,camHeight:6,camPitch:28,camFov:60},
  atmosphere:{fogEnabled:true,fogNear:45,fogFar:125,fogColor:'#33483f',
    ambientSky:'#b5d5d2',ambientGround:'#26382f',ambientIntensity:1.35,
    sunColor:'#ffdaae',sunIntensity:2.2,fillColor:'#7ab7d0',fillIntensity:1.7,
    backdrop:'fog',drawDistance:150},
  components:[
    ...COURT_SOLIDS,
    prop(0,.65,-5,3.3,1.3,3.3),prop(0,1.6,-20,8,.9,2.5),
    prop(8.35,1.4,-8,1.4,2.8,1.8),prop(-9,1.8,-19,2.3,1.3,2.3),
    prop(-10,1.6,3,1.8,3.2,1.8),prop(0,2.4,-32.5,2.8,2.5,1.8),
    ...[[-5,0,7],...COURT_EXTRA_TORCHES].map(([x,y,z])=>prop(x,y+1,z,.5,2,.5)),
    ...[13.5,14.6].map(x=>prop(x,.5,9,1,1,1)),
    ...[6.7,1.2].map(z=>prop(10,.43,z,3.4,.48,.6)),
    ...[[0,1.15,-24.4,5.8,8.8]].flatMap(([x,y,z,w,h])=>[
      prop(x-w/2,y+h/2,z,1.35,h,1.8),prop(x+w/2,y+h/2,z,1.35,h,1.8),
      prop(x,y+h-.2,z,w+2.2,.8,2),
    ]),
    // Two broad steps on each side let the player jump up to the altar terrace.
    ...[-6,6].flatMap(x=>[
      {t:'platform' as const,p:[x,.25,-11.5] as [number,number,number],s:[3.4,.6,3] as [number,number,number],color:'#b3a47c'},
      {t:'platform' as const,p:[x,.65,-14] as [number,number,number],s:[3.4,1.4,2.6] as [number,number,number],color:'#b3a47c'},
    ]),
    {t:'checkpoint',p:[2,0,-10.5]},
    {t:'gate',p:[0,1.15,-29]},
    {t:'camnode',p:[0,0,15]},
    {t:'camnode',p:[0,0,-10]},
    {t:'camnode',p:[0,1.15,-32]},
  ],
};
