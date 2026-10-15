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
export type RaceItem = 'rocket' | 'pulse' | 'shield' | 'trap' | 'boost';
export type RacePhase = 'grid' | 'countdown' | 'running' | 'finished';
export type RaceMode = 'race' | 'time-trial';
export interface RacePlayerHooks {
  hazard: (cause: WipeoutCause, origin?: Vector3) => void;
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
  rocket: {name:'HOMING BOLT',color:'#f18c61',description:'Chases the racer ahead'},
  pulse: {name:'SHOCK RING',color:'#70d9f4',description:'Stuns nearby racers'},
  shield: {name:'BUBBLE SHIELD',color:'#87e9c3',description:'Blocks the next hit'},
  trap: {name:'SPIN TRAP',color:'#d4a3fa',description:'Drops a trap behind you'},
  boost: {name:'TURBO',color:'#ffda72',description:'A short burst of speed'},
};
