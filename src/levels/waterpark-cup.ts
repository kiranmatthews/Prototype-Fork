import type {CustomComponent,CustomLevelData} from '../level';
import {RECOVERED_WATERPARK_LEVEL} from './waterpark-cup-base';

// The last non-linear park, recovered from 8710517, becomes a free-skate
// competition. Its courtyard, lazy river, bridges and perimeter rides remain.
const courseOnly=new Set(['checkpoint','clock','comboorb','crystal','wumpa','crate','bonusplatform','pit','camnode','zone']);
const components:CustomComponent[]=RECOVERED_WATERPARK_LEVEL.components
  .filter(c=>!courseOnly.has(c.t)&&!c.cameraView&&c.nm!=='Standing water in closed service well')
  .map(c=>({...c,
    ...(c.t==='vertramp'?{rails:true}:{}),
    ...(c.loopRadius!==undefined?{loopRequired:false}:{}),
    ...(c.t==='gate'?{invisible:true,nm:'Competition service exit'}:{}),
  }));
components.push({t:'coastwall',p:[-94,-8,80],pts:[[0,0],[270,0],[270,-282],[0,-282],[0,0]],w:.7,rise:85,nm:'Competition perimeter'});
export const WATERPARK_CUP_LEVEL:CustomLevelData={
  ...RECOVERED_WATERPARK_LEVEL,name:'Deadwater Cup',spawn:[31,12.15,-12],skatepark:true,
  cameraAirLift:undefined,medalTimes:undefined,killY:-40,components,
};
