/** World-space pockets of hot air, authored over exposed sandstone. */
export interface DesertHeatPatch {
  p: [number, number, number];
  /** Horizontal and vertical half extents in metres. */
  size: [number, number];
  /** Maximum inner-ring displacement in pixels at 720p. */
  strength: number;
}

export function validDesertHeat(value: unknown): value is DesertHeatPatch[] {
  const tuple=(v:unknown,n:number,limit:number)=>Array.isArray(v)&&v.length===n&&
    v.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=limit);
  return Array.isArray(value)&&value.length<=128&&value.every(p=>
    p&&typeof p==='object'&&Object.keys(p).every(k=>['p','size','strength'].includes(k))&&
    tuple(p.p,3,100_000)&&tuple(p.size,2,250)&&p.size.every((x:number)=>x>0)&&
    typeof p.strength==='number'&&Number.isFinite(p.strength)&&p.strength>0&&p.strength<=3);
}

/** Deliberately not inferred from sky, material, campaign island or bonus status. */
export const hasDesertHeat=(id:string)=>id==='bryce-canyon'||id==='bonus:bryce-canyon'||id==='bonus-bryce-canyon';
