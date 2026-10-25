import type { SkateRaceData } from './types';
/** Bounded editor/save boundary; future courses use the same runtime contract. */
export function validSkateRace(value: unknown): value is SkateRaceData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as SkateRaceData;
  const keys = ['v','racers','vehicle','seed','stages','line','jumps','finishWidth','originalLength'];
  const point = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 100000);
  return Object.keys(r).every(k => keys.includes(k)) && r.v === 1 && r.racers === 8 && (r.vehicle===undefined||r.vehicle==='golf-cart') && Number.isSafeInteger(r.seed) &&
    (r.stages===undefined||Array.isArray(r.stages)&&r.stages.length>0&&r.stages.length<=16&&r.stages.every(s=>typeof s==='string'&&s.length>0&&s.length<=60)) &&
    Number.isFinite(r.originalLength) && r.originalLength > 0 && r.originalLength < 20000 &&
    Number.isFinite(r.finishWidth) && r.finishWidth >= 4 && r.finishWidth <= 100 &&
    Array.isArray(r.line) && r.line.length >= 2 && r.line.length <= 4096 && r.line.every(p => point(p,4) && p[3] >= 2 && p[3] <= 100) &&
    Array.isArray(r.jumps) && r.jumps.length <= 64 && r.jumps.every(j => j && Object.keys(j).every(k => k === 'takeoff' || k === 'landing') && point(j.takeoff,3) && point(j.landing,3));
}
