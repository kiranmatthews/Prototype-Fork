import * as THREE from 'three';

/**
 * THE LOOK OF A SPEED PAD. A black slab with green chevrons that run the way it
 * sends a rider (its local -Z, turned by its yaw), framed in a line of green
 * light, with a low curtain of light standing on each side of it and a pool of
 * green on the floor around it. Bloom is off by default in this game, so the
 * glow is made of unlit and additive surfaces, not of a post effect.
 *
 * Everything here is dressing: it hangs off the pad's own mesh, which stays the
 * one thing a rider's ground ray meets and the one thing that carries its data.
 */

/** Neon green of the chevrons, the frame and the sparks a rider throws off it. */
export const SPEED_PAD_GREEN = 0x4dff5e;
const BODY = 0x070d09;
const BODY_GLOW = 0x04210c;

/** Metres from one green chevron to the next along the pad. */
const PERIOD = 1.25;
/** Metres across one chevron: a wide pad carries several side by side. */
const CHEVRON_WIDTH = 4;
/** How far its point leads its ends, in periods: 45 degrees on a chevron of the width above. */
const LEAD = CHEVRON_WIDTH / 2 / PERIOD;
/** Metres a second the chevrons run. */
const RUN = 3.4;
const CURTAIN_HEIGHT = 0.62;
const TILE = 256;

function chevronCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TILE; canvas.height = TILE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#040806';
  ctx.fillRect(0, 0, TILE, TILE);
  // One tile is one chevron across and one period along. Texture v runs the way the pad sends a rider, and
  // canvas y runs against it. A band from v = k + from to v = k + to, bent forward by LEAD at the middle:
  const band = (k: number, from: number, to: number, fill: string): void => {
    const y = (v: number): number => (1 - v) * TILE;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, y(k + from)); ctx.lineTo(TILE / 2, y(k + from + LEAD)); ctx.lineTo(TILE, y(k + from));
    ctx.lineTo(TILE, y(k + to)); ctx.lineTo(TILE / 2, y(k + to + LEAD)); ctx.lineTo(0, y(k + to));
    ctx.closePath(); ctx.fill();
  };
  for (let k = -Math.ceil(LEAD) - 1; k <= 1; k++) {
    band(k, 0.02, 0.5, '#0c5a1c'); // the dim tail of each chevron
    band(k, 0.1, 0.5, '#22d83f');
    band(k, 0.2, 0.5, '#4dff5e');
    band(k, 0.4, 0.5, '#d5ffd0'); // its hot leading edge
  }
  return canvas;
}

function curtainCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 4; canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const fade = ctx.createLinearGradient(0, 64, 0, 0); // bright at the foot, gone at the top
  fade.addColorStop(0, 'rgba(255,255,255,0.85)');
  fade.addColorStop(0.25, 'rgba(255,255,255,0.34)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 4, 64);
  return canvas;
}

/** One level's speed pads: a shared set of materials, and the one clock that runs and pulses them all. */
export class SpeedPadLook {
  private readonly chevrons: THREE.CanvasTexture;
  private readonly top: THREE.MeshBasicMaterial;
  private readonly body = new THREE.MeshLambertMaterial({ color: BODY, emissive: BODY_GLOW });
  private readonly frame: THREE.MeshBasicMaterial;
  private readonly curtain: THREE.MeshBasicMaterial;
  private readonly pool: THREE.MeshBasicMaterial;
  private readonly bar = new THREE.BoxGeometry(1, 1, 1);
  private clock = 0;

  /** `finish` gives a new texture the game's colour space and filtering; `halo` is its shared soft round glow. */
  constructor(finish: (texture: THREE.CanvasTexture) => THREE.CanvasTexture, halo: THREE.Texture) {
    this.chevrons = finish(new THREE.CanvasTexture(chevronCanvas()));
    this.chevrons.wrapS = this.chevrons.wrapT = THREE.RepeatWrapping;
    const fade = finish(new THREE.CanvasTexture(curtainCanvas()));
    fade.wrapS = THREE.RepeatWrapping; fade.wrapT = THREE.ClampToEdgeWrapping;
    // The chevrons sit a hair over the slab's own top face: the offset keeps the two from fighting at a distance.
    this.top = new THREE.MeshBasicMaterial({ map: this.chevrons, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.frame = new THREE.MeshBasicMaterial({ color: SPEED_PAD_GREEN, toneMapped: false });
    const light = { color: SPEED_PAD_GREEN, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      toneMapped: false, side: THREE.DoubleSide, fog: false };
    this.curtain = new THREE.MeshBasicMaterial({ ...light, map: fade, opacity: 0.5 });
    this.pool = new THREE.MeshBasicMaterial({ ...light, map: halo, opacity: 0.55 });
  }

  /** Dress a pad's mesh: `size` is its [across, thick, along], as authored. */
  dress(pad: THREE.Mesh, size: readonly number[]): void {
    const across = size[0], thick = Math.max(0.08, size[1]), along = size[2];
    const look = new THREE.Group();
    look.name = 'Speed pad look';
    // The pad's own material is left as it was authored (a level editor reads its colour back off it): the
    // black slab is a shell drawn a millimetre outside it.
    const shell = new THREE.Mesh(this.bar, this.body);
    shell.scale.set(across + 0.004, thick + 0.002, along + 0.004);
    look.add(shell);
    const rim = Math.min(0.14, across * 0.06, along * 0.06);
    // The chevrons: one across for each few metres of width, one period for each 1.25 m of length.
    const face = new THREE.PlaneGeometry(across - rim * 2, along - rim * 2);
    const uv = face.attributes.uv as THREE.BufferAttribute;
    const columns = Math.max(1, Math.round(across / CHEVRON_WIDTH)), rows = along / PERIOD;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * columns, uv.getY(i) * rows);
    const top = new THREE.Mesh(face, this.top);
    top.rotation.x = -Math.PI / 2; // the plane's up becomes the pad's -Z: the way it sends a rider
    top.position.y = thick / 2 + 0.004;
    look.add(top);
    // The frame of light round them.
    const strip = (w: number, l: number, x: number, z: number): void => {
      const mesh = new THREE.Mesh(this.bar, this.frame);
      mesh.scale.set(w, thick + 0.024, l);
      mesh.position.set(x, 0.006, z);
      look.add(mesh);
    };
    strip(rim, along + 0.012, across / 2 - rim / 2 + 0.006, 0); strip(rim, along + 0.012, -across / 2 + rim / 2 - 0.006, 0);
    strip(across - rim * 2, rim * 0.6, 0, along / 2 - rim * 0.3 + 0.006); strip(across - rim * 2, rim * 0.6, 0, -along / 2 + rim * 0.3 - 0.006);
    // A low curtain of light standing on each side...
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(along, CURTAIN_HEIGHT), this.curtain);
      wall.rotation.y = Math.PI / 2;
      wall.position.set(side * (across / 2 - rim / 2), thick / 2 + CURTAIN_HEIGHT / 2, 0);
      wall.renderOrder = 3;
      look.add(wall);
    }
    // ...and a pool of it on the floor around.
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(across + 3.2, along + 3.2), this.pool);
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = thick / 2 - 0.012;
    pool.renderOrder = 2;
    look.add(pool);
    look.traverse(object => { object.userData.speedPadLook = true; object.castShadow = false; object.receiveShadow = false; });
    pad.add(look);
  }

  /** The chevrons run, and the light breathes. */
  update(dt: number): void {
    this.clock += Math.max(0, dt);
    // (a feature of the texture sits at v less the offset: a falling offset carries it forward)
    this.chevrons.offset.y = -((this.clock * RUN / PERIOD) % 1);
    const breath = 0.5 + 0.5 * Math.sin(this.clock * 5.2);
    this.curtain.opacity = 0.34 + 0.22 * breath;
    this.pool.opacity = 0.42 + 0.2 * breath;
  }
}
