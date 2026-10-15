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
export type RaceItem = 'banana' | 'green-shell' | 'red-shell' | 'blue-shell' | 'shock-shell' | 'mushroom' | 'shield';
export type RacePhase = 'grid' | 'countdown' | 'running' | 'finished';
export type RaceMode = 'race' | 'time-trial';
export interface RacePlayerHooks {
  hazard: (cause: WipeoutCause, origin?: Vector3) => void;
  unrecoverableFall?: () => boolean;
  fallStarted?: () => void;
  respawn?: () => void;
}
export interface RaceHudState {
  title:string; sections:readonly string[]; medalTimes:MedalTimes; medal:TimeMedal|null;
  phase: RacePhase; mode: RaceMode; countdown: number; elapsed: number;
  rank: number; item: RaceItem | null; shield: number; recovering: number;
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
  banana: {name:'BANANA PEEL',color:'#ffda39',description:'Drop a peel behind you'},
  'green-shell': {name:'GREEN SHELL',color:'#48b457',description:'A straight shell that ricochets off the road edges'},
  'red-shell': {name:'RED SHELL',color:'#e95447',description:'Homes in on the next racer ahead'},
  'blue-shell': {name:'BLUE SHELL',color:'#418cde',description:'Chases the leader and bursts on impact'},
  'shock-shell': {name:'SHOCK SHELL',color:'#e8ac25',description:'Strikes every other racer'},
  mushroom: {name:'MUSHROOM',color:'#ef4940',description:'A short burst of speed'},
  shield: {name:'BUBBLE SHIELD',color:'#77daef',description:'Blocks the next hit'},
};
