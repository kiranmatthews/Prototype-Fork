/** Shared editable-node fillets. Heights follow the same rounded path as X/Z. */
export function roundCorners(
  pts: readonly (readonly number[])[],
  closed: boolean,
): { x: number; z: number; y: number; i: number }[] {
  const n = pts.length;
  const out: { x: number; z: number; y: number; i: number }[] = [];
  const push = (x: number, z: number, y: number, i: number): void => {
    const last = out[out.length - 1];
    if (
      last &&
      (last.x - x) * (last.x - x) + (last.z - z) * (last.z - z) < 4e-4
    )
      return;
    out.push({ x, z, y, i });
  };
  const yOf = (k: number): number => pts[((k % n) + n) % n][3] ?? 0;
  for (let i = 0; i < n; i++) {
    const r = pts[i][2] ?? 0;
    const px = pts[i][0];
    const pz = pts[i][1];
    const py = yOf(i);
    if (r <= 0.01 || n < 3 || (!closed && (i === 0 || i === n - 1))) {
      push(px, pz, py, i);
      continue;
    }
    const A = pts[(i - 1 + n) % n];
    const B = pts[(i + 1) % n];
    const inX = px - A[0];
    const inZ = pz - A[1];
    const outX = B[0] - px;
    const outZ = B[1] - pz;
    const inL = Math.hypot(inX, inZ);
    const outL = Math.hypot(outX, outZ);
    if (inL < 1e-4 || outL < 1e-4) {
      push(px, pz, py, i);
      continue;
    }
    const t = Math.min(r, inL * 0.49, outL * 0.49);
    const ax = px - (inX / inL) * t;
    const az = pz - (inZ / inL) * t;
    const bx = px + (outX / outL) * t;
    const bz = pz + (outZ / outL) * t;
    // heights at the trim points sit on the straight edges' slopes
    const ay = py + (yOf(i - 1) - py) * (t / inL);
    const by = py + (yOf(i + 1) - py) * (t / outL);
    const SEGS = 6;
    for (let k = 0; k <= SEGS; k++) {
      const u = k / SEGS;
      const w0 = (1 - u) * (1 - u);
      const w1 = 2 * u * (1 - u);
      const w2 = u * u;
      push(
        w0 * ax + w1 * px + w2 * bx,
        w0 * az + w1 * pz + w2 * bz,
        w0 * ay + w1 * py + w2 * by,
        i,
      );
    }
  }
  return out;
}
