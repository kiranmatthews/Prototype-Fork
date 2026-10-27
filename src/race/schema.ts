import type { SkateRaceData } from './types';
/** Bounded editor/save boundary; future courses use the same runtime contract. */
export function validSkateRace(value: unknown): value is SkateRaceData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as SkateRaceData;
  const keys = ['v','racers','vehicle','gemReward','seed','stages','line','jumps','grinds','railChoices','finishWidth','originalLength'];
  const point = (v: unknown, n: number): v is number[] => Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 100000);
  return Object.keys(r).every(k => keys.includes(k)) && r.v === 1 && r.racers === 8 && (r.vehicle===undefined||r.vehicle==='golf-cart') && (r.gemReward===undefined||r.gemReward==='win') && Number.isSafeInteger(r.seed) &&
    (r.stages===undefined||Array.isArray(r.stages)&&r.stages.length>0&&r.stages.length<=16&&r.stages.every(s=>typeof s==='string'&&s.length>0&&s.length<=60)) &&
    Number.isFinite(r.originalLength) && r.originalLength > 0 && r.originalLength < 20000 &&
    Number.isFinite(r.finishWidth) && r.finishWidth >= 4 && r.finishWidth <= 100 &&
    Array.isArray(r.line) && r.line.length >= 2 && r.line.length <= 4096 && r.line.every(p => point(p,4) && p[3] >= 2 && p[3] <= 100) &&
    (r.grinds===undefined||Array.isArray(r.grinds)&&r.grinds.length<=64&&r.grinds.every(g=>g&&Object.keys(g).every(k=>['start','end','lanes'].includes(k))&&point(g.start,3)&&point(g.end,3)&&Array.isArray(g.lanes)&&g.lanes.length>=1&&g.lanes.length<=7&&g.lanes.every(n=>Number.isFinite(n)&&Math.abs(n)<=30))) &&
    (r.railChoices===undefined||Array.isArray(r.railChoices)&&r.railChoices.length<=16&&r.railChoices.every(g=>g&&Object.keys(g).every(k=>['from','to','paths'].includes(k))&&point(g.from,3)&&point(g.to,3)&&Array.isArray(g.paths)&&g.paths.length>=2&&g.paths.length<=5&&g.paths.every(path=>Array.isArray(path)&&path.length>=1&&path.length<=12&&path.every(name=>typeof name==='string'&&name.length>0&&name.length<=160)))) &&
    Array.isArray(r.jumps) && r.jumps.length <= 64 && r.jumps.every(j => j && Object.keys(j).every(k => k === 'takeoff' || k === 'landing') && point(j.takeoff,3) && point(j.landing,3));
}
