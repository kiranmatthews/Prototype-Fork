import type {WriteFlameHeat} from './flameHeatSource';

// Jak Fire Canyon heat-44, definitions 1099/1100: 2 m ripple radius beside
// 8–14 m flame sprites. Normalize both by the same flame width, never by the
// height of the whole rising plume. Source y velocity is 16 m/s (300 ticks/s).
const SOURCE_FLAME_WIDTH=11, SOURCE_RIPPLE_RADIUS=2, SOURCE_RISE=16;
const COUNT=18;
const fraction=(n:number)=>n-Math.floor(n);
const random=(n:number)=>fraction(Math.sin(n*12.9898)*43758.5453);

/** Small rising pockets through the upper flame. A bounded, staggered stream
 * uses the existing shared heat draw; each torch retains its own world scale. */
export function writeTorchHeat(emit:WriteFlameHeat,time:number,height:number,scale:number,burn:number,seed:number):void {
  if(burn<=.001)return;
  const sourceScale=.6*scale/SOURCE_FLAME_WIDTH;
  const radius=SOURCE_RIPPLE_RADIUS*sourceScale;
  for(let i=0;i<COUNT;i++){
    const clock=time+seed*.37+i/COUNT,cycle=Math.floor(clock),age=fraction(clock);
    const key=seed*17+i*19+cycle*23,angle=random(key)*Math.PI*2;
    const spread=(.08+.12*random(key+1))*scale;
    // Birth/retirement happen at zero warp, so wrapping the one-second source
    // lifetime cannot pop a patch back to the bottom of the flame.
    const envelope=Math.min(1,age/.08,(1-age)/.2);
    emit(Math.cos(angle)*spread,height+.75*scale+age*SOURCE_RISE*sourceScale,
      Math.sin(angle)*spread,radius,radius,2.4*burn*envelope,seed+i*.7+cycle*.11);
  }
}
