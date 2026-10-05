// Ordered lane distance from supported spawn to the authored finish plane.
// Spawn uses an XZ projection so the spawn's small support clearance adds no
// fictitious course distance; each retained segment is measured in 3D.
export function slipstreamPlayableLength(data) {
  const points = data.components.filter(c => c.t === 'camnode' && !c.cameraView).map(c => c.p);
  const gate = data.components.find(c => c.t === 'gate');
  if (points.length < 2 || !gate) throw Error('Ordered lane and finish gate required');
  const lengths = points.slice(1).map((p, i) => Math.hypot(...p.map((v, k) => v - points[i][k])));
  const arc = [0]; for (const length of lengths) arc.push(arc.at(-1) + length);
  let spawnS = 0, spawnDistance = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = Math.max(0, Math.min(1, ((data.spawn[0] - a[0]) * dx + (data.spawn[2] - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    const y = a[1] + (b[1] - a[1]) * t;
    const distance = Math.hypot(a[0] + dx * t - data.spawn[0], a[2] + dz * t - data.spawn[2], y - data.spawn[1]);
    if (distance < spawnDistance) { spawnDistance = distance; spawnS = arc[i] + lengths[i] * t; }
  }
  const yaw = (gate.yaw ?? 0) * Math.PI / 180;
  const signed = p => (p[0] - gate.p[0]) * Math.sin(yaw) + (p[2] - gate.p[2]) * Math.cos(yaw);
  let gateS;
  for (let i = 0; i < points.length - 1; i++) {
    const a = signed(points[i]), b = signed(points[i + 1]);
    if ((a > 0 && b <= 0) || (a >= 0 && b < 0)) {
      const t = a / (a - b || 1), p = points[i].map((v, k) => v + (points[i + 1][k] - v) * t);
      if (Math.hypot(p[0] - gate.p[0], p[2] - gate.p[2]) < 15) gateS = arc[i] + lengths[i] * t;
    }
  }
  if (gateS === undefined) throw Error('Finish plane does not cross the ordered course lane');
  return { playable: gateS - spawnS, fullLane: arc.at(-1), spawnS, gateS };
}
