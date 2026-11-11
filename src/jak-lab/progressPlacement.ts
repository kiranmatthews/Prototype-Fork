import {sinRotation} from './sunParticles';
import type {ProgressHudDefinition,ProgressPage,ScreenHudProfile} from './types';

const f=Math.fround,i=Math.trunc;
const add=(a:number,b:number)=>f(f(a)+f(b)),mul=(a:number,b:number)=>f(f(a)*f(b));
const adjust=(value:number,offset:number)=>Math.max(0,value-offset);
export const isProgressStats=(page:ProgressPage)=>['fuel-cell','money','buzzer'].includes(page);
export interface ProgressPosition {x:number;y:number;z:number}
export interface ProgressPlacementState {
  positions:ProgressPosition[];states:number[];yaws:number[];
}
export interface ProgressPlacementInput {
  page:ProgressPage;nextPage:ProgressPage;offset:number;transition:number;clock:number;
  taskStates:number[];taskIndex:number;option:number;lastOptionChange:number;
  filledSlots:boolean[];cardReady:boolean;levelOpen:boolean;statTransition:boolean;levelTransition:0|1|2;
}
export function initialProgressPlacement(definition:ProgressHudDefinition,profile:ScreenHudProfile):ProgressPlacementState {
  return {positions:profile.layers.map(({position:[x,y,z]})=>({x,y,z})),states:[...definition.states],
    yaws:definition.icons.map(icon=>icon.yaw)};
}
/** Particle-only part of progress-normal's post: page draw, common controls,
 * then adjust-sprites. Positions persist, so the button arc uses last frame's
 * right frame position exactly as the original does. Font/model-only writes
 * are deliberately outside this particle exhibit. */
export function placeProgress(definition:ProgressHudDefinition,profile:ScreenHudProfile,
  state:ProgressPlacementState,input:ProgressPlacementInput) {
  const {page,offset,transition,clock,taskStates,taskIndex,option,statTransition,levelTransition}=input;
  const {positions,states,yaws}=state,scales={...profile.scales};
  for(const key of ['sides-x-scale','sides-y-scale','button-scale'])scales[key]=f(scales[key]);
  const amount=mul(1/definition.maximumOffset,offset),inverse=f(1-f(transition/definition.transitionMaximum));
  const left=scales['left-x-offset'],right=scales['right-x-offset'];
  const priorRight=positions[2].x;
  for(const index of [5,6,7,8,9,10,11,12,13,14,15,19,20,21,22,23,24,25,26,27,28,29,30,31])positions[index].x=-320;
  if(page==='fuel-cell'&&input.levelOpen) {
    const count=taskStates.length,start=definition.eggStartingX[count]-left;
    const spacing=statTransition?47:i(mul(47,inverse));
    const horizontal=statTransition?(page!==input.nextPage?-transition:transition):0;
    const vertical=statTransition?0:levelTransition===1?-transition:transition;
    let x=start+i((47*count-spacing*count)/2);
    for(let index=0;index<4;index++)yaws[index]=add(yaws[index],mul(182.04445,.5));
    for(let task=0;task<count;task++) {
      const index=task+6;states[index]=taskStates[task];
      positions[index].x=x+horizontal;positions[index].y=vertical+204;
      if(task===taskIndex){positions[5].x=x+horizontal;positions[5].y=vertical+204;}
      x+=spacing;
    }
    for(let task=count;task<8;task++){positions[task+6].x=horizontal-320;positions[task+6].y=vertical+194;}
  } else if(page==='money'||page==='buzzer') {
    const index=page==='money'?15:14;
    const horizontal=statTransition?(page!==input.nextPage?-transition:transition):i(transition/16);
    const vertical=statTransition?0:levelTransition===1?-transition:transition;
    positions[index].x=horizontal+150-left;positions[index].y=vertical+214;
  } else if(page==='save-game') {
    let travel=Math.max(0,(transition-256)*2);if(travel>500)travel=700;
    positions[19].x=202-adjust(travel,150)-left;
    positions[20].x=202+adjust(travel,100)-left;
    positions[21].x=202-adjust(travel,50)-left;
    positions[22].x=202+travel-left;
    positions[21].y=255;positions[22].y=336;
    const elapsed=clock-input.lastOptionChange;
    for(let slot=0;slot<4;slot++) {
      const visible=elapsed<=600||elapsed%1200<600||option!==slot||transition!==0;
      positions[slot+23].x=input.cardReady&&input.filledSlots[slot]&&visible?66-left:-320;
    }
  } else if(page==='auto-save') {
    positions[31].y=profile.id==='16:9'?170:180;
    positions[31].x=(clock%300<270||inverse!==1?205:-320)-left;
  }
  if(isProgressStats(page)) {
    const commonTransition=statTransition||levelTransition?0:transition;
    const radius=f(-94+priorRight),step=i(commonTransition/5),button=scales['button-scale'];
    for(const [index,base,delay] of [[27,-36,0],[28,-21,10],[29,-6,15],[30,9,20]]) {
      const angle=mul(182.04445,f(f(base/button)-(delay?adjust(step,delay):step)));
      positions[index].x=90+i(mul(radius,sinRotation(add(16384,angle))));
      positions[index].y=224+i(mul(radius,sinRotation(angle)));
    }
    const across=i(mul(300,amount));
    positions[18].x=adjust(commonTransition,50)+394+across+right;
    positions[18].y=40-i(mul(80,amount));
    positions[16].x=adjust(commonTransition,100)+425+across+right;
    positions[16].y=112-i(mul(60,amount));
    positions[17].x=adjust(commonTransition,150)+442+across+i(mul(.7,right));
    positions[17].y=193;
  }
  positions[2].x=f(right+409+i(mul(301.5,amount)));positions[1].x=59+left;
  const sx=scales['sides-x-scale'],sy=scales['sides-y-scale'];
  scales['left-side-x-scale']=mul(4096,add(f(3.5/sx),mul(10,amount)));
  scales['left-side-y-scale']=mul(4096,add(sy,mul(10,amount)));
  scales['right-side-x-scale']=mul(4096,add(f(6/sx),mul(4,amount)));
  scales['right-side-y-scale']=mul(4096,add(sy,mul(4,amount)));
  return {origins:positions.map(p=>({x:add(-256,p.x),y:mul(.5,f(p.y-224)),z:p.z})),scales};
}
