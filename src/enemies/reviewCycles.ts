import type {EnemyKind} from './types';
import {BULL} from './bull';

/** Shared inspection fixtures; these are not gameplay AI. */
export interface Segment {state:string;frames:number;speed:number;}
export const ENEMY_REVIEW_CYCLES:Record<EnemyKind,readonly Segment[]>={
  grunt:[{state:'patrol',frames:180,speed:2.4}],spiker:[{state:'patrol',frames:180,speed:2.2}],
  turtle:[{state:'patrol',frames:180,speed:1.5}],
  charger:[{state:'patrol',frames:96,speed:1.1},{state:'telegraph',frames:Math.round(BULL.windupSeconds*60),speed:0},{state:'dash',frames:60,speed:8},{state:'recover',frames:66,speed:0}],
  hopper:[{state:'crouch',frames:27,speed:0},{state:'leap',frames:43,speed:3.4}],
  floater:[{state:'hover',frames:156,speed:3.2},{state:'swoop',frames:48,speed:3.2}],
  sentry:[{state:'track',frames:78,speed:0},{state:'charge',frames:33,speed:0},{state:'fire',frames:9,speed:0},{state:'cooldown',frames:42,speed:0}],
  spinner:[{state:'out',frames:132,speed:0},{state:'in',frames:81,speed:0}],
  moa:[{state:'patrol',frames:180,speed:1.45},{state:'idle',frames:36,speed:0},{state:'squawk',frames:99,speed:0},{state:'windup',frames:38,speed:0},{state:'peck',frames:22,speed:0},{state:'recover',frames:54,speed:0}],
};
