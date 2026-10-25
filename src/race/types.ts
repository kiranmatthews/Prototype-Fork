import type { MedalTimes, TimeMedal } from '../campaign';
import type { Object3D, Vector3 } from 'three';
import type { WipeoutCause } from '../character/wipeoutPolicy';

export type RacePoint = [number, number, number];
export type RaceKnot = [number, number, number, number];
export interface SkateRaceData {
  v: 1;
  racers: 8;
  vehicle?: 'golf-cart';
  seed: number;
  stages?: string[];
  /** Ordered world-space racing guide, with rideable width at each knot. */
  line: RaceKnot[];
  jumps: { takeoff: RacePoint; landing: RacePoint }[];
  finishWidth: number;
  originalLength: number;
}
export type RaceItem = 'banana' | 'green-shell' | 'red-shell' | 'blue-shell' | 'shock-shell' | 'mushroom' | 'shield' | 'horn' | 'water-bomb' | 'boomerang' | 'star' | 'tidal-wave';
export const RALLY_ITEM_NAMES:Partial<Record<RaceItem,string>>={banana:'BANANA BOMB TRIO','green-shell':'TRIPLE COCONUT CANNON','red-shell':'HOMING COCONUT','blue-shell':'CLUB PRESIDENT ERASER','shock-shell':'BAD WEATHER POLICY','water-bomb':'POOL PARTY MORTAR',horn:'FOURTEEN FORE!',mushroom:'QUESTIONABLE ENERGY DRINK',boomerang:'RETURN TO SENDER',star:'LIABILITY WAIVER','tidal-wave':'TSUNAMI TEE TIME'};
export const RALLY_ITEM_DESCRIPTIONS:Partial<Record<RaceItem,string>>={
  banana:'Drop three explosive peels behind your kart; the splash catches nearby rivals',
  'green-shell':'Fire three ricocheting coconuts; hold back to fire behind you',
  'red-shell':'A homing coconut tracks the racer ahead; spin, dodge or shield to counter',
  'blue-shell':'Marks the leader for a huge blast; leave the ring before it hits',
  'shock-shell':'Lightning damages every grounded rival after a warning; jump or shield',
  'water-bomb':'A giant pool-party splash; get out of the marked circle',
  horn:'Shunt every rival within 13 metres and clear nearby projectiles',
  mushroom:'Four seconds of extra kart power; save it for a straight or a jump approach',
  star:'Six seconds of protection and extra kart power; falls still count',
};
export type RacePhase = 'grid' | 'countdown' | 'running' | 'finished';
export type RaceMode = 'race' | 'time-trial';
export interface RacePlayerHooks {
  onFoot?: () => boolean;
  /** Exact static candidates for vertical probes, supplied only by the kart course. */
  groundCandidates?: (x:number,z:number) => Object3D[];
  canCollectItem?: () => boolean;
  hazard: (cause: WipeoutCause, origin?: Vector3) => void;
  unrecoverableFall?: () => boolean;
  fallStarted?: () => void;
  respawn?: () => void;
}
export interface RaceThreat {
  item: 'green-shell' | 'red-shell' | 'blue-shell' | 'shock-shell' | 'water-bomb' | 'boomerang' | 'tidal-wave';
  seconds:number; bearing:number; urgent:boolean;
}
export interface RaceHudState {
  vehicle?: 'golf-cart'; crystalReward?:boolean;
  cart?: {onFoot:boolean;target:string;distance:number|null;notice:string;actionReady:boolean;bearing:number|null};
  title:string; sections:readonly string[]; medalTimes:MedalTimes; medal:TimeMedal|null;
  phase: RacePhase; mode: RaceMode; countdown: number; runTime: number; elapsed: number; freeze: number;
  rank: number; item: RaceItem | null; shield: number; star: number; recovering: number;
  threats: readonly RaceThreat[];
  boxes: number; totalBoxes: number; won: boolean; timeTrialUnlocked: boolean;
  racers: { id: number; name: string; color: string; x: number; y: number; z: number; progress: number; finish: number | null }[];
  line: readonly RaceKnot[]; visible: boolean;
}
export const RACE_ROSTER = [
  { name: 'YOU', color: '#fff4c7' }, { name: 'ROXY', color: '#ef79b5' },
  { name: 'MOSS', color: '#79d887' }, { name: 'NOVA', color: '#70d9f4' },
  { name: 'MONDO', color: '#f2a14c' }, { name: 'PIP', color: '#d9b9ff' },
  { name: 'SOL', color: '#f1dc68' }, { name: 'VOSS', color: '#e46b5e' },
] as const;
export const RACE_ITEMS: Record<RaceItem,{name:string;color:string;description:string}> = {
  banana: {name:'BANANA PEEL',color:'#ffda39',description:'Drop behind you to trap a rival or block a shell'},
  'green-shell': {name:'GREEN SHELL',color:'#48b457',description:'Ricochets along the road; hold back when firing to defend behind'},
  'red-shell': {name:'RED SHELL',color:'#e95447',description:'Tracks the next racer, then commits; jump, sidestep, spin or block it'},
  'blue-shell': {name:'BLUE SHELL',color:'#418cde',description:'Circles the leader, then strikes the marked spot; dodge, boost, shield or horn'},
  'shock-shell': {name:'LIGHTNING',color:'#ffe568',description:'Charges before striking rivals; jump the strike or use a shield'},
  mushroom: {name:'MUSHROOM',color:'#ef4940',description:'A speed burst; time it with a blue shell dive to escape'},
  horn: {name:'AIR HORN',color:'#f6b34b',description:'Blasts nearby shells and rivals away, including a diving blue shell'},
  'water-bomb': {name:'WATER BOMB',color:'#39c9ed',description:'Lob a splash bomb; the marked landing gives rivals time to jump or move clear'},
  boomerang: {name:'BOOMERANG',color:'#e9ad48',description:'Sweeps out and back through rivals; jump, spin, shield or intercept it'},
  star: {name:'STAR',color:'#ffdc5b',description:'Ultra rare: six seconds of speed and weapon protection; ordinary falls still matter'},
  'tidal-wave': {name:'TIDAL WAVE',color:'#69e9ef',description:'Ultra rare: sends a rolling surge along the course; jump its crest or use protection'},
  shield: {name:'BUBBLE SHIELD',color:'#77daef',description:'Blocks the next hit'},
};
