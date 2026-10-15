import type { MedalTimes, TimeMedal } from '../campaign';
import type { Vector3 } from 'three';
import type { WipeoutCause } from '../character/wipeoutPolicy';

export type RacePoint = [number, number, number];
export type RaceKnot = [number, number, number, number];
export interface SkateRaceData {
  v: 1;
  racers: 8;
  seed: number;
  stages?: string[];
  /** Ordered world-space racing guide, with rideable width at each knot. */
  line: RaceKnot[];
  jumps: { takeoff: RacePoint; landing: RacePoint }[];
  finishWidth: number;
  originalLength: number;
}
export type RaceItem = 'banana' | 'green-shell' | 'red-shell' | 'blue-shell' | 'shock-shell' | 'mushroom' | 'shield' | 'horn';
export type RacePhase = 'grid' | 'countdown' | 'running' | 'finished';
export type RaceMode = 'race' | 'time-trial';
export interface RacePlayerHooks {
  canCollectItem?: () => boolean;
  hazard: (cause: WipeoutCause, origin?: Vector3) => void;
  unrecoverableFall?: () => boolean;
  fallStarted?: () => void;
  respawn?: () => void;
}
export interface RaceThreat {
  item: 'green-shell' | 'red-shell' | 'blue-shell' | 'shock-shell';
  seconds:number; bearing:number; urgent:boolean;
}
export interface RaceHudState {
  title:string; sections:readonly string[]; medalTimes:MedalTimes; medal:TimeMedal|null;
  phase: RacePhase; mode: RaceMode; countdown: number; elapsed: number;
  rank: number; item: RaceItem | null; shield: number; recovering: number;
  threats: readonly RaceThreat[];
  boxes: number; totalBoxes: number; won: boolean;
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
  shield: {name:'BUBBLE SHIELD',color:'#77daef',description:'Blocks the next hit'},
};
