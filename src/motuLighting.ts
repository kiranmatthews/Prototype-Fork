import type {CustomAtmosphereData} from './levelAtmosphere';
import type {SkyPreset} from './level';
import type {VisualBloomValue} from './visual-treatment/settings';

type P=[number,number,number];
export interface MotuHeatLook {
  name:'daylight'|'sunset'|'moonlight';
  sky:SkyPreset;
  fogColor:string;
  sunOffset:P;
  lighting:CustomAtmosphereData;
  skyPalette?:{top:string;bottom:string;cloud:string;stars:boolean};
  discColor:P;
  discScale:number;
  lampPower:number;
  bloom:VisualBloomValue;
}
const bloom=(intensity:number,threshold:number,tint:P):VisualBloomValue=>({
  intensity,threshold,tint,scatter:.58,clamp:12,highQuality:true,downscale:2,maxIterations:5,
});
/** Each competition heat owns a complete coastal look. Runtime light and
 * visible celestial body use the same direction, including after retry. */
export const MOTU_HEATS:readonly MotuHeatLook[]=[
  {name:'daylight',sky:'coastal-town',fogColor:'#bddce9',sunOffset:[55,74,-39],
    lighting:{ambientSky:'#d9efff',ambientGround:'#ead0a1',ambientIntensity:1.3,
      sunColor:'#fff0cd',sunIntensity:2.75,fillColor:'#b9ddf2',fillIntensity:.42,
      shadowStrength:.62,fallbackTop:'#308fd0',fallbackBottom:'#d9eff6',fallbackStars:false,fallbackSunColor:null},
    discColor:[3.8,3.1,2.1],discScale:1,lampPower:0,bloom:bloom(.20,1.3,[1,.94,.82])},
  {name:'sunset',sky:'coastal-town',fogColor:'#f5bb8b',sunOffset:[88,24,30],
    lighting:{ambientSky:'#b7bbdf',ambientGround:'#b77955',ambientIntensity:1.08,
      sunColor:'#ffc383',sunIntensity:2.1,fillColor:'#afabdf',fillIntensity:.43,
      shadowStrength:.65,fallbackTop:'#645b9a',fallbackBottom:'#ffd39b',fallbackStars:false,fallbackSunColor:null},
    skyPalette:{top:'#55578d',bottom:'#f5bb8b',cloud:'#ffd0b2',stars:false},
    discColor:[5.1,2.5,.85],discScale:1.5,lampPower:.32,bloom:bloom(.30,1.1,[1,.81,.60])},
  {name:'moonlight',sky:'coastal-town',fogColor:'#293e60',sunOffset:[-35,66,-67],
    lighting:{ambientSky:'#8daacf',ambientGround:'#515c81',ambientIntensity:.84,
      sunColor:'#c8dfff',sunIntensity:.88,fillColor:'#819fd0',fillIntensity:.32,
      shadowStrength:.64,fallbackTop:'#08152d',fallbackBottom:'#263955',fallbackStars:true,fallbackSunColor:null},
    skyPalette:{top:'#08162d',bottom:'#293e60',cloud:'#607e9e',stars:true},
    discColor:[1.6,1.85,2.1],discScale:1.45,lampPower:1,bloom:bloom(.38,1.05,[1,.91,.77])},
];
export function motuHeatLook(runNumber:number):MotuHeatLook {
  return MOTU_HEATS[Math.max(0,Math.min(2,Number.isFinite(runNumber)?Math.floor(runNumber)-1:0))];
}
/** Four fixed warm floodlights: no moving light selection, extra shadow maps,
 * or camera-dependent geometry. Their visible fixtures share these positions. */
export const MOTU_FLOODS:{p:P;target:P}[]=[
  {p:[-86,19,-58],target:[-25,0,-58]},
  {p:[86,19,-70],target:[25,0,-70]},
  {p:[-10,20,65],target:[-10,0,8]},
  {p:[0,21,-182],target:[0,0,-124]},
];
