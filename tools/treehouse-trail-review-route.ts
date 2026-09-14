import * as THREE from 'three';
import type { CustomLevelData } from '../src/level';

/** Follow source-owned lane order; neither X nor Z must be monotonic. */
export function treehouseReviewRoute(data: CustomLevelData, overshoot = 3): THREE.Vector3[] {
  const nodes = data.components.filter(c => c.t === 'camnode' && !c.cameraView).map(c => new THREE.Vector3(...c.p));
  const gate = data.components.find(c => c.t === 'gate');
  if (nodes.length < 2 || !gate) throw new Error('Review requires an ordered camera lane and finish gate');
  const arc = [0];
  for (let i = 1; i < nodes.length; i++) arc.push(arc[i - 1] + nodes[i - 1].distanceTo(nodes[i]));
  const nearest = (point: THREE.Vector3) => {
    let best = { distance: Infinity, arc: 0, segment: 0 };
    for (let i = 1; i < nodes.length; i++) {
      const delta = nodes[i].clone().sub(nodes[i - 1]);
      const t = THREE.MathUtils.clamp(point.clone().sub(nodes[i - 1]).dot(delta) / Math.max(delta.lengthSq(), 1e-8), 0, 1);
      const distance = point.distanceToSquared(nodes[i - 1].clone().addScaledVector(delta, t));
      if (distance < best.distance) best = { distance, arc: arc[i - 1] + delta.length() * t, segment: i - 1 };
    }
    return best;
  };
  const spawn = new THREE.Vector3(...data.spawn), finish = new THREE.Vector3(...gate.p);
  const start = nearest(spawn), end = nearest(finish);
  if (end.arc <= start.arc) throw new Error('Finish must follow spawn in authored lane order');
  const route = [spawn, ...nodes.filter((_, i) => arc[i] > start.arc + .01 && arc[i] < end.arc - .01), finish];
  if (overshoot > 0) route.push(finish.clone().addScaledVector(nodes[end.segment + 1].clone().sub(nodes[end.segment]).setY(0).normalize(), overshoot));
  return route;
}

/** Derive the optional climb from the same support chunks being reviewed. */
export function treehouseStairRoute(data: CustomLevelData): THREE.Vector3[] {
  const decks = data.components.filter(c => c.nm === 'Treehouse landing support').sort((a,b) => a.p[1] - b.p[1]);
  const balcony = data.components.find(c => c.nm === 'Treehouse balcony support');
  const approach = data.components.find(c => c.nm === 'Treehouse side path');
  if (!decks.length || !balcony || !approach) throw new Error('Missing treehouse support chunks');
  const top = (c: typeof balcony) => new THREE.Vector3(c.p[0], c.p[1] + (c.s?.[1] ?? 0) / 2, c.p[2]);
  const edgeX = approach.p[0] + (approach.pts ? Math.max(...approach.pts.map(p => p[0])) : (approach.s?.[0] ?? 0) / 2);
  return [new THREE.Vector3(edgeX, top(approach).y, decks[0].p[2]), ...decks.map(top), top(balcony)];
}
