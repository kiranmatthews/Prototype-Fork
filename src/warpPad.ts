// WARP PAD — the end-of-level warp platform.
//
// Rebuilt from a video reference through the img2threejs sculpt pipeline; the
// authored spec (component tree, materials, repetition systems, review targets)
// lives at forge/warp-pad/object-sculpt-spec.json. This file is the shippable
// implementation of that spec in the project's own idiom: flat-shaded low-poly
// primitives, one small canvas texture, additive unlit VFX, and a plain
// update(dt) instead of a generated animation graph.
//
// Two systems share an axis and nothing else:
//   PLINTH   inert masonry — a 14-faceted drum, an oversailing top course, and
//            a flat paving disc that is the walkable surface.
//   COLUMN   live emitter — a ring of flame tongues, a tapering plume, and six
//            rings that rise up the column and rotate.
//
// Everything under the column is additive, unlit and depthWrite-off, so it
// reads as light rather than surface. That is the one rule that makes or breaks
// this effect: shade the plasma and it turns into orange plastic.

import * as THREE from 'three';

// ONE SCALE KNOB. The first build was authored at gate scale (9.7 across) and
// read as a monument; a third of that is a prop you skate up to. Everything
// below is a spec dimension multiplied by S, rather than a Group.scale, so the
// derived numbers stay true — a Group.scale would leave the point light's
// distance and the exported collider radius describing the old size.
const S = 1 / 3;

// Spec dimensions, in world units (player capsule 0.92 tall, crate 0.96).
const R_BODY = 4.6 * S; // drum body radius — 1.53
const R_RIM = 4.85 * S; // top course oversails the body — 1.62
const R_DISC = 4.4 * S; // walkable paving disc — 1.47
// Blockout review failed here first: at 0.34 + 0.16 the drum was 19:1 wide to
// tall and vanished behind the deck edge, nothing like the reference's stocky
// plinth. The ratio that survived review is 4.4:1 — still not the reference's
// measured 1.9:1, because a drum that deep would be a wall across the finish
// line — and S preserves that ratio while shrinking the whole prop.
const H_BODY = 1.7 * S;
const H_RIM = 0.5 * S;
export const WARP_PAD_TOP = H_BODY + H_RIM; // 0.73 — the surface you ride onto
export const WARP_PAD_RADIUS = R_RIM;
const COL_TOP = 7.5 * S; // plume tip — 2.5, about two and a half crates up
// THE GLOW YOU CAN JUMP INTO — the plasma column as a trigger volume, in
// gate-local units. The BASE is the load-bearing number: a player standing on
// the deck beside the pad has a box topping out at 0.92, so a base of 1.23
// means brushing past at ground level is still not a finish. You have to be up
// IN the column, which is the whole point of jumping into it.
export const WARP_PAD_GLOW_RADIUS = 1.25;
export const WARP_PAD_GLOW_BASE = H_BODY + H_RIM + 0.5;
export const WARP_PAD_GLOW_TOP = COL_TOP + 0.8;
const FACETS = 14; // 7-8 visible across the front arc, mirrored round the axis
const TONGUES = 18;
const RINGS = 6;
const R_RING = 5.2 * S; // rings read wider than the drum in the reference

// Deterministic jitter: the pad must look identical on every load and in replays.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// One shared 128px canvas for the stone — the project's texel density, nearest
// filtered. Carries the paving wedges, the moss crown and the seam darkening
// that the spec's localOverrides call for, because the geometry is far too
// low-poly to bake real AO into.
function stoneTexture(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const rand = rng(0x57a7e);
  // base: damp grey-green limestone, mottled
  g.fillStyle = '#77836f';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) {
    const v = rand();
    g.fillStyle = v > 0.5 ? 'rgba(141,148,131,0.30)' : 'rgba(74,81,66,0.34)';
    const w = 3 + rand() * 11;
    g.fillRect(rand() * S, rand() * S, w, 2 + rand() * 6);
  }
  // moss crown: the top of the map is upward-facing stone, so it greens up;
  // the bottom picks up splash-back soil where the drum meets the ground
  const moss = g.createLinearGradient(0, 0, 0, S);
  moss.addColorStop(0, 'rgba(120,150,96,0.34)');
  moss.addColorStop(0.45, 'rgba(120,150,96,0.05)');
  moss.addColorStop(1, 'rgba(107,90,65,0.42)');
  g.fillStyle = moss;
  g.fillRect(0, 0, S, S);
  // mortar seams: vertical block joints, darkened either side for contact
  g.strokeStyle = 'rgba(38,42,34,0.85)';
  g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    const x = (i * S) / 4;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, S);
    g.stroke();
  }
  g.strokeStyle = 'rgba(38,42,34,0.5)';
  g.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = 14 + (i * S) / 3.4;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(S, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The disc is read top-down, so it gets its own map: a ring of radial
// flagstones around a centre disc, which is what the reference shows once the
// flame stops washing it out.
function discTexture(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const rand = rng(0xd15c);
  g.fillStyle = '#868f7e';
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 200; i++) {
    g.fillStyle = rand() > 0.5 ? 'rgba(150,156,140,0.28)' : 'rgba(104,112,98,0.30)';
    g.fillRect(rand() * S, rand() * S, 2 + rand() * 7, 2 + rand() * 7);
  }
  const cx = S / 2;
  g.strokeStyle = 'rgba(52,58,48,0.8)';
  g.lineWidth = 1.5;
  for (let i = 0; i < FACETS; i++) {
    const a = (i / FACETS) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 12, cx + Math.sin(a) * 12);
    g.lineTo(cx + Math.cos(a) * cx, cx + Math.sin(a) * cx);
    g.stroke();
  }
  g.beginPath();
  g.arc(cx, cx, 12, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cx, cx * 0.82, 0, Math.PI * 2);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Vertex-coloured lathe profile: white-yellow at the core, orange at the edge,
// fading to nothing at the tip. The colour ramp is sampled from the reference
// plate rather than invented (see colorMaterialRecipe in the spec).
function plumeGeometry(height: number): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const STEPS = 10;
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    // Review pass 3: a mid-height swell read as an onion/light-bulb. A flame is
    // widest LOW and tapers the whole way up, so the profile is now a decaying
    // power curve with only a slight shoulder near the base.
    const r =
      3.1 * S * (1 - t) ** 1.5 * (1 + 0.35 * Math.sin(Math.PI * t * 0.9)) + 0.08 * S;
    pts.push(new THREE.Vector2(Math.max(0.05 * S, r), t * height));
  }
  const geo = new THREE.LatheGeometry(pts, 12);
  const pos = geo.attributes.position;
  const col: number[] = [];
  const hot = new THREE.Color('#fff2c0');
  const mid = new THREE.Color('#ffb03a');
  const cool = new THREE.Color('#e5341c');
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / height, 0, 1);
    if (t < 0.55) tmp.copy(hot).lerp(mid, t / 0.55);
    else tmp.copy(mid).lerp(cool, (t - 0.55) / 0.45);
    // dim toward the tip so it dissolves instead of ending in a hard edge
    const f = (1 - t) ** 1.35;
    col.push(tmp.r * f, tmp.g * f, tmp.b * f);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

export interface WarpPad {
  group: THREE.Group;
  /** the drum meshes, for the level to push into its ground/collision set */
  solids: THREE.Mesh[];
  update(dt: number): void;
  dispose(): void;
}

/**
 * Build one warp pad. Origin is the footprint centre ON the ground plane, so a
 * level places it at a floor coordinate and the disc lands at WARP_PAD_TOP.
 */
export function createWarpPad(): WarpPad {
  const group = new THREE.Group();
  group.name = 'warp pad';
  const rand = rng(0x3a17);
  const disposables: (THREE.BufferGeometry | THREE.Material | THREE.Texture)[] = [];
  const keep = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(x: T): T => {
    disposables.push(x);
    return x;
  };

  // ---- PLINTH: lit, opaque, flat-shaded masonry ---------------------------
  const stoneTex = keep(stoneTexture());
  stoneTex.repeat.set(4, 1);
  const stoneMat = keep(
    new THREE.MeshLambertMaterial({ map: stoneTex, flatShading: true }),
  );
  const discMat = keep(
    new THREE.MeshLambertMaterial({ map: keep(discTexture()), flatShading: true }),
  );

  // 14-sided prism, not a smoothed cylinder: the facets ARE the read. The
  // bottom is slightly narrower so the drum sits into the ground.
  const body = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(R_BODY, R_BODY * 0.94, H_BODY, FACETS, 1)),
    stoneMat,
  );
  body.position.y = H_BODY / 2;
  body.name = 'warp plinth body';
  group.add(body);

  // the top course oversails the body — that shadow line is an identity edge
  const rim = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(R_RIM, R_RIM, H_RIM, FACETS, 1)),
    stoneMat,
  );
  rim.position.y = H_BODY + H_RIM / 2 - 0.02 * S; // small overlap: no z-fighting seam
  rim.name = 'warp plinth rim';
  group.add(rim);

  const disc = new THREE.Mesh(
    keep(new THREE.CylinderGeometry(R_DISC, R_DISC, 0.06 * S, FACETS, 1)),
    discMat,
  );
  disc.position.y = WARP_PAD_TOP - 0.02 * S;
  disc.name = 'warp pad';
  group.add(disc);

  // ---- COLUMN: additive, unlit, depthWrite off ----------------------------
  const column = new THREE.Group();
  column.position.y = WARP_PAD_TOP;
  column.name = 'warp column';
  group.add(column);

  const plasmaMat = keep(
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      // Review pass 2: at 1.0 the lathe read as a solid yellow cone that OCCLUDED
      // the rings behind it. The reference's column is wispy — rings pass behind
      // and in front of it. 0.5 puts the plume back to being light you see through.
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  const plume = new THREE.Mesh(keep(plumeGeometry(COL_TOP - WARP_PAD_TOP - 0.4 * S)), plasmaMat);
  plume.position.y = 0.4 * S;
  plume.renderOrder = 3;
  column.add(plume);

  // A ring of individual tongues, NOT a skirt — the gaps between them against
  // the disc are what sells the base of the effect.
  const tongueGeo = keep(new THREE.ConeGeometry(0.34 * S, 1.0 * S, 4, 1, true));
  const tongueMat = keep(
    new THREE.MeshBasicMaterial({
      color: '#ff7a1e',
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  const tongues: THREE.Mesh[] = [];
  const tonguePhase: number[] = [];
  for (let i = 0; i < TONGUES; i++) {
    const a = (i / TONGUES) * Math.PI * 2;
    const m = new THREE.Mesh(tongueGeo, tongueMat);
    const h = 1.3 + rand() * 1.1; // multiplies the already-scaled cone
    m.scale.set(1, h, 1);
    m.position.set(Math.cos(a) * 2.4 * S, 0.5 * h * S, Math.sin(a) * 2.4 * S);
    m.renderOrder = 3;
    column.add(m);
    tongues.push(m);
    tonguePhase.push(rand() * Math.PI * 2);
  }

  // Six thin bands sharing one geometry, each on its own rise phase. They fade
  // in low and out high, so the stack reads as a continuous climb rather than
  // six objects looping.
  // Review pass 3: six identical coaxial hoops read as a lampshade. The
  // reference's arcs vary in size, thickness and tilt, and no two are alike.
  // Each ring gets its own geometry (they are 88 triangles each) plus a small
  // fixed tilt, so the stack looks like turbulence rather than a machine.
  const ringGeos: THREE.BufferGeometry[] = [];
  const ringTilt: number[] = [];
  const rings: THREE.Mesh[] = [];
  const ringMats: THREE.MeshBasicMaterial[] = [];
  for (let i = 0; i < RINGS; i++) {
    const wob = 0.62 + rand() * 0.66; // 0.62..1.28 of the nominal radius
    ringGeos.push(keep(new THREE.TorusGeometry(R_RING * wob, (0.13 + rand() * 0.2) * S, 4, 20)));
    ringTilt.push((rand() - 0.5) * 0.22);
    const mat = keep(
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? '#ff4a14' : '#ffae2b',
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    );
    const m = new THREE.Mesh(ringGeos[i], mat);
    m.rotation.x = Math.PI / 2; // lay it flat: the reference sees them near edge-on
    m.rotation.y = ringTilt[i]; // ...but not perfectly flat
    m.renderOrder = 4;
    column.add(m);
    rings.push(m);
    ringMats.push(mat);
  }

  // The emitter is its own key light — in the reference the only thing lighting
  // the stone is the column.
  // distance is world units and is NOT affected by object scale, so it has to
  // shrink by hand or a 1/3-size pad would light a full-size area
  const light = new THREE.PointLight(0xff9a3c, 1.6, 12 * S);
  light.position.set(0, 0.9 * S, 0);
  column.add(light);

  let t = 0;
  const RISE = COL_TOP - WARP_PAD_TOP;
  const pad: WarpPad = {
    group,
    solids: [body, rim, disc],
    update(dt: number): void {
      t = (t + dt) % 1000;
      for (let i = 0; i < RINGS; i++) {
        // each ring owns a slice of the cycle, so they are evenly spread
        // uneven phase offsets: evenly spaced rings marched in lockstep
        const k = (t * 0.42 + (i / RINGS) + 0.07 * Math.sin(i * 2.4)) % 1;
        const m = rings[i];
        m.position.y = 0.25 * S + k * RISE;
        m.rotation.z = t * (0.9 + i * 0.17) + i;
        // wider as they climb, matching the plume's flare
        const s = 0.55 + k * 0.55;
        m.scale.set(s, s, 1);
        // in fast at the bottom, out slowly at the top
        ringMats[i].opacity = Math.min(1, k * 6) * (1 - k) ** 0.55;
      }
      // two summed rates so the flicker never reads as a loop
      const flick = 1 + 0.06 * Math.sin(t * 9.1) + 0.04 * Math.sin(t * 14.7);
      plume.scale.set(1, flick, 1);
      for (let i = 0; i < TONGUES; i++) {
        const m = tongues[i];
        m.scale.y = m.scale.y * 0.0 + (0.75 + 0.25 * Math.sin(t * 11 + tonguePhase[i]));
        m.position.y = 0.5 * m.scale.y;
      }
      // the bounce and the source agree
      light.intensity = 1.6 * flick;
    },
    dispose(): void {
      for (const d of disposables) d.dispose();
    },
  };

  // Runtime hierarchy the spec's actionReadiness block promises.
  group.userData.sculptRuntime = {
    sockets: {
      stand: new THREE.Vector3(0, WARP_PAD_TOP, 0),
      trigger: new THREE.Vector3(0, 3.5 * S, 0),
      light: new THREE.Vector3(0, WARP_PAD_TOP + 0.9 * S, 0),
    },
    colliders: { stand: { type: 'cylinder-top-plane', y: WARP_PAD_TOP, radius: R_DISC } },
    update: (dt: number) => pad.update(dt),
  };
  return pad;
}
