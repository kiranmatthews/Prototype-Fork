/** Authored loose ground, independent of paint and global movement tuning. */
export function groundSpeedLimit(contact: { groundSpeedLimit?: number } | null | undefined): number {
  const limit=contact?.groundSpeedLimit;
  return typeof limit==='number'&&Number.isFinite(limit)&&limit>=.25&&limit<=12?limit:Infinity;
}

/** Deep sand scrubs carried momentum over a short distance, then permits a crawl. */
export function softGroundSpeed(speed:number,limit:number,dt:number):number {
  if(!Number.isFinite(limit)||Math.abs(speed)<=limit)return speed;
  return Math.sign(speed)*Math.max(limit,Math.abs(speed)-70*Math.max(0,dt));
}

/** Drive cannot fight the sand, but carried entry speed is scrubbed by drag. */
export function groundDriveCeiling(speed:number,nominal:number,contact:{groundSpeedLimit?:number}|null|undefined):number {
  return Math.min(nominal,Math.max(speed,groundSpeedLimit(contact)));
}
