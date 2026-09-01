import * as THREE from 'three';

export type CartoonGloveSide = 'left' | 'right';
export type CartoonFingerName = 'index' | 'middle' | 'outer';
export type CartoonGlovePoseName = 'open' | 'relaxed' | 'curl' | 'fist' | 'pinch' | 'grab';

export interface CartoonGloveMaterials {
  glove: THREE.Material;
  stitch: THREE.Material;
}

export interface CartoonFingerChain {
  readonly proximal: THREE.Bone;
  readonly middle: THREE.Bone;
  readonly distal: THREE.Bone;
  readonly tipSocket: THREE.Object3D;
  readonly restSpread: number;
}

export interface CartoonThumbChain {
  readonly metacarpal: THREE.Bone;
  readonly proximal: THREE.Bone;
  readonly distal: THREE.Bone;
  readonly tipSocket: THREE.Object3D;
  readonly restOpposition: number;
}

export interface CartoonGlovePose {
  indexCurl: number;
  middleCurl: number;
  outerCurl: number;
  thumbCurl: number;
  thumbOpposition: number;
  spread: number;
  cup: number;
}

export interface CartoonGloveRig {
  readonly side: CartoonGloveSide;
  readonly root: THREE.Group;
  readonly fingers: Readonly<Record<CartoonFingerName, CartoonFingerChain>>;
  readonly thumb: CartoonThumbChain;
  readonly gripSocket: THREE.Object3D;
  readonly joints: Readonly<Record<string, THREE.Bone>>;
  readonly sockets: Readonly<Record<string, THREE.Object3D>>;
  readonly bones: readonly THREE.Bone[];
}

export const CARTOON_GLOVE_POSES: Readonly<Record<CartoonGlovePoseName, Readonly<CartoonGlovePose>>> =
  Object.freeze({
    open: Object.freeze({
      indexCurl: 0,
      middleCurl: 0,
      outerCurl: 0,
      thumbCurl: 0,
      thumbOpposition: 0,
      spread: 0.45,
      cup: 0,
    }),
    relaxed: Object.freeze({
      indexCurl: 0.18,
      middleCurl: 0.22,
      outerCurl: 0.28,
      thumbCurl: 0.15,
      thumbOpposition: 0.12,
      spread: 0.12,
      cup: 0.08,
    }),
    curl: Object.freeze({
      indexCurl: 0.56,
      middleCurl: 0.62,
      outerCurl: 0.68,
      thumbCurl: 0.48,
      thumbOpposition: 0.45,
      spread: -0.1,
      cup: 0.26,
    }),
    fist: Object.freeze({
      indexCurl: 1,
      middleCurl: 1,
      outerCurl: 1,
      thumbCurl: 0.92,
      thumbOpposition: 0.78,
      spread: -0.28,
      cup: 0.5,
    }),
    pinch: Object.freeze({
      indexCurl: 0.82,
      middleCurl: 0.45,
      outerCurl: 0.55,
      thumbCurl: 0.78,
      thumbOpposition: 1,
      spread: 0.08,
      cup: 0.24,
    }),
    grab: Object.freeze({
      indexCurl: 0.9,
      middleCurl: 0.92,
      outerCurl: 0.94,
      thumbCurl: 0.82,
      thumbOpposition: 0.72,
      spread: -0.18,
      cup: 0.4,
    }),
  });

const FINGER_LENGTHS: Readonly<Record<CartoonFingerName, readonly [number, number, number]>> =
  Object.freeze({
    index: Object.freeze([0.066, 0.054, 0.044] as const),
    middle: Object.freeze([0.071, 0.057, 0.046] as const),
    outer: Object.freeze([0.061, 0.051, 0.042] as const),
  });

const FINGER_ROOT_Y: Readonly<Record<CartoonFingerName, number>> = Object.freeze({
  index: -0.13,
  middle: -0.142,
  outer: -0.126,
});

const REST_CURL = 0;

function clamp01(value: number): number {
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

function segmentGeometry(radius: number, length: number, radialSegments = 9): THREE.CapsuleGeometry {
  const geometry = new THREE.CapsuleGeometry(
    radius,
    Math.max(0.004, length - radius * 2),
    3,
    radialSegments,
  );
  geometry.translate(0, -length * 0.5, 0);
  return geometry;
}

function centeredSegmentGeometry(
  radius: number,
  length: number,
  radialSegments = 9,
): THREE.CapsuleGeometry {
  return new THREE.CapsuleGeometry(
    radius,
    Math.max(0.004, length - radius * 2),
    3,
    radialSegments,
  );
}

const GEOMETRY = Object.freeze({
  palm: new THREE.SphereGeometry(1, 10, 8),
  heel: new THREE.SphereGeometry(1, 9, 7),
  knuckle: new THREE.SphereGeometry(1, 8, 6),
  cuff: new THREE.TorusGeometry(0.078, 0.024, 7, 12),
  cuffInner: new THREE.TorusGeometry(0.069, 0.009, 5, 12),
  cuffSleeve: new THREE.CylinderGeometry(0.066, 0.074, 0.06, 10, 1, false),
  stitch: centeredSegmentGeometry(0.0065, 0.07, 7),
  index: Object.freeze(FINGER_LENGTHS.index.map((length, index) =>
    segmentGeometry([0.029, 0.027, 0.025][index], length))),
  middle: Object.freeze(FINGER_LENGTHS.middle.map((length, index) =>
    segmentGeometry([0.03, 0.028, 0.0255][index], length))),
  outer: Object.freeze(FINGER_LENGTHS.outer.map((length, index) =>
    segmentGeometry([0.0285, 0.0265, 0.0245][index], length))),
  thumb: Object.freeze([
    segmentGeometry(0.032, 0.072),
    segmentGeometry(0.029, 0.057),
  ]),
});

function defaultMaterials(): CartoonGloveMaterials {
  return {
    glove: new THREE.MeshStandardMaterial({
      name: 'cartoon-glove-white',
      color: 0xeee8dc,
      roughness: 0.68,
      metalness: 0,
      flatShading: true,
    }),
    stitch: new THREE.MeshStandardMaterial({
      name: 'cartoon-glove-stitch',
      color: 0x1b1a19,
      roughness: 0.54,
      metalness: 0,
      flatShading: true,
    }),
  };
}

function markRenderable(mesh: THREE.Mesh, semantic: string): THREE.Mesh {
  mesh.name = semantic;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.characterPart = semantic;
  return mesh;
}

function makeBone(
  name: string,
  side: CartoonGloveSide,
  digit: string,
  stage: string,
): THREE.Bone {
  const bone = new THREE.Bone();
  bone.name = name;
  bone.userData.anatomicalSide = side;
  bone.userData.digit = digit;
  bone.userData.phalange = stage;
  bone.userData.rotationLimit = {
    // The glove closes toward negative local X. Keep metadata in the same
    // signed frame as the shipped poses so future constraint solvers do not
    // clamp a valid fist back toward the bind pose.
    x: [-1.6, 0.2],
    y: [-0.35, 0.35],
    z: [-0.85, 0.85],
  };
  return bone;
}

function fingerSemantic(digit: CartoonFingerName, stage: 'Proximal' | 'Middle' | 'Distal', side: CartoonGloveSide): string {
  return `finger${digit[0].toUpperCase()}${digit.slice(1)}${stage}${side[0].toUpperCase()}${side.slice(1)}`;
}

function makeFinger(
  side: CartoonGloveSide,
  digit: CartoonFingerName,
  sideSign: number,
  palm: THREE.Object3D,
  material: THREE.Material,
): CartoonFingerChain {
  const lengths = FINGER_LENGTHS[digit];
  const indexX = digit === 'index' ? -sideSign * 0.038 : digit === 'outer' ? sideSign * 0.04 : 0;
  const restSpread = digit === 'index' ? -sideSign * 0.07 : digit === 'outer' ? sideSign * 0.08 : 0;
  const stages = ['proximal', 'middle', 'distal'] as const;
  const bones = stages.map((stage) => makeBone(
    `finger-${digit}-${stage}-${side}`,
    side,
    digit,
    stage,
  ));
  bones[0].position.set(indexX, FINGER_ROOT_Y[digit], 0.006);
  bones[1].position.y = -lengths[0] + 0.022;
  bones[2].position.y = -lengths[1] + 0.022;
  palm.add(bones[0]);
  bones[0].add(bones[1]);
  bones[1].add(bones[2]);
  for (let index = 0; index < bones.length; index++) {
    const mesh = markRenderable(
      new THREE.Mesh(GEOMETRY[digit][index], material),
      `glove-${digit}-${stages[index]}-${side}`,
    );
    mesh.scale.z = 1.08;
    bones[index].add(mesh);
  }
  const tipSocket = new THREE.Object3D();
  tipSocket.name = `socket-finger-${digit}-${side}`;
  tipSocket.position.set(0, -lengths[2] + 0.01, 0.004);
  tipSocket.userData.contactNormal = [0, -1, 0];
  bones[2].add(tipSocket);
  return {
    proximal: bones[0],
    middle: bones[1],
    distal: bones[2],
    tipSocket,
    restSpread,
  };
}

/** Build one complete hand in wrist-local space. Right is a true X reflection. */
export function createCartoonGlove(
  side: CartoonGloveSide,
  suppliedMaterials?: CartoonGloveMaterials,
): CartoonGloveRig {
  const materials = suppliedMaterials ?? defaultMaterials();
  const sideSign = side === 'left' ? 1 : -1;
  const root = new THREE.Group();
  root.name = `cartoon-glove-${side}`;
  root.userData.cartoonGloveRig = {
    kind: 'procedural-cartoon-glove',
    spec: 'docs/CARTOON_GLOVE_SCULPT_SPEC.json',
    side,
    digitCount: 3,
    thumbCount: 1,
    mirroredAxis: 'X',
  };

  const cuff = markRenderable(new THREE.Mesh(GEOMETRY.cuff, materials.glove), `glove-cuff-${side}`);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.y = -0.004;
  cuff.scale.set(1.14, 0.94, 1);
  root.add(cuff);
  const cuffInner = markRenderable(
    new THREE.Mesh(GEOMETRY.cuffInner, materials.glove),
    `glove-cuff-inner-${side}`,
  );
  cuffInner.rotation.x = Math.PI / 2;
  cuffInner.position.set(0, -0.017, 0);
  cuffInner.scale.set(1.12, 0.92, 1);
  root.add(cuffInner);
  const cuffSleeve = markRenderable(
    new THREE.Mesh(GEOMETRY.cuffSleeve, materials.glove),
    `glove-cuff-sleeve-${side}`,
  );
  cuffSleeve.position.set(0, -0.031, 0);
  cuffSleeve.scale.z = 1.06;
  root.add(cuffSleeve);

  const palm = markRenderable(new THREE.Mesh(GEOMETRY.palm, materials.glove), `glove-palm-${side}`);
  palm.position.set(0, -0.086, 0.004);
  palm.scale.set(0.087, 0.104, 0.064);
  root.add(palm);
  const heel = markRenderable(new THREE.Mesh(GEOMETRY.heel, materials.glove), `glove-heel-${side}`);
  heel.position.set(-sideSign * 0.025, -0.051, -0.002);
  heel.scale.set(0.07, 0.066, 0.058);
  root.add(heel);

  const fingers = {
    index: makeFinger(side, 'index', sideSign, root, materials.glove),
    middle: makeFinger(side, 'middle', sideSign, root, materials.glove),
    outer: makeFinger(side, 'outer', sideSign, root, materials.glove),
  } satisfies Record<CartoonFingerName, CartoonFingerChain>;

  for (const [digit, chain] of Object.entries(fingers) as [CartoonFingerName, CartoonFingerChain][]) {
    const knuckle = markRenderable(
      new THREE.Mesh(GEOMETRY.knuckle, materials.glove),
      `glove-knuckle-${digit}-${side}`,
    );
    const scale = digit === 'middle' ? 0.034 : 0.032;
    knuckle.scale.set(scale, scale * 0.92, scale * 1.08);
    knuckle.position.copy(chain.proximal.position).add(new THREE.Vector3(0, 0.008, -0.001));
    root.add(knuckle);
  }

  const thumbMetacarpal = makeBone(`thumb-metacarpal-${side}`, side, 'thumb', 'metacarpal');
  const thumbProximal = makeBone(`thumb-proximal-${side}`, side, 'thumb', 'proximal');
  const thumbDistal = makeBone(`thumb-distal-${side}`, side, 'thumb', 'distal');
  const restOpposition = -sideSign * 0.82;
  thumbMetacarpal.position.set(-sideSign * 0.074, -0.061, 0.008);
  thumbMetacarpal.rotation.z = restOpposition;
  // Give the metacarpal a real (short, palm-embedded) child span. A zero-length
  // semantic control serializes poorly in formats that validate bone length.
  thumbProximal.position.y = -0.018;
  thumbDistal.position.y = -0.05;
  root.add(thumbMetacarpal);
  thumbMetacarpal.add(thumbProximal);
  thumbProximal.add(thumbDistal);
  const thumbMeshes = [
    markRenderable(new THREE.Mesh(GEOMETRY.thumb[0], materials.glove), `glove-thumb-proximal-${side}`),
    markRenderable(new THREE.Mesh(GEOMETRY.thumb[1], materials.glove), `glove-thumb-distal-${side}`),
  ];
  thumbMeshes[0].scale.z = 1.08;
  thumbMeshes[1].scale.z = 1.08;
  thumbProximal.add(thumbMeshes[0]);
  thumbDistal.add(thumbMeshes[1]);
  const thumbTipSocket = new THREE.Object3D();
  thumbTipSocket.name = `socket-thumb-${side}`;
  thumbTipSocket.position.set(0, -0.047, 0.004);
  thumbTipSocket.userData.contactNormal = [-sideSign, -0.3, 0];
  thumbDistal.add(thumbTipSocket);

  for (const stitchAngle of [-0.68, 0.68]) {
    const stitch = markRenderable(
      new THREE.Mesh(GEOMETRY.stitch, materials.stitch),
      `glove-stitch-${stitchAngle < 0 ? 'a' : 'b'}-${side}`,
    );
    stitch.position.set(0, -0.083, 0.068);
    stitch.rotation.z = stitchAngle;
    stitch.scale.set(1, 1, 0.78);
    root.add(stitch);
  }

  const gripSocket = new THREE.Object3D();
  gripSocket.name = `socket-grip-${side}`;
  gripSocket.position.set(0, -0.14, 0.045);
  gripSocket.userData.gripAxis = [0, 1, 0];
  gripSocket.userData.palmNormal = [0, 0, 1];
  root.add(gripSocket);

  const joints: Record<string, THREE.Bone> = {
    [fingerSemantic('index', 'Proximal', side)]: fingers.index.proximal,
    [fingerSemantic('index', 'Middle', side)]: fingers.index.middle,
    [fingerSemantic('index', 'Distal', side)]: fingers.index.distal,
    [fingerSemantic('middle', 'Proximal', side)]: fingers.middle.proximal,
    [fingerSemantic('middle', 'Middle', side)]: fingers.middle.middle,
    [fingerSemantic('middle', 'Distal', side)]: fingers.middle.distal,
    [fingerSemantic('outer', 'Proximal', side)]: fingers.outer.proximal,
    [fingerSemantic('outer', 'Middle', side)]: fingers.outer.middle,
    [fingerSemantic('outer', 'Distal', side)]: fingers.outer.distal,
    [`thumbMetacarpal${side[0].toUpperCase()}${side.slice(1)}`]: thumbMetacarpal,
    [`thumbProximal${side[0].toUpperCase()}${side.slice(1)}`]: thumbProximal,
    [`thumbDistal${side[0].toUpperCase()}${side.slice(1)}`]: thumbDistal,
  };
  const sockets = {
    grip: gripSocket,
    indexTip: fingers.index.tipSocket,
    middleTip: fingers.middle.tipSocket,
    outerTip: fingers.outer.tipSocket,
    thumbTip: thumbTipSocket,
  };
  const rig: CartoonGloveRig = {
    side,
    root,
    fingers,
    thumb: {
      metacarpal: thumbMetacarpal,
      proximal: thumbProximal,
      distal: thumbDistal,
      tipSocket: thumbTipSocket,
      restOpposition,
    },
    gripSocket,
    joints,
    sockets,
    bones: Object.freeze(Object.values(joints)),
  };
  return rig;
}

export function setCartoonGlovePose(
  rig: CartoonGloveRig,
  pose: Readonly<CartoonGlovePose>,
): void {
  const sideSign = rig.side === 'left' ? 1 : -1;
  const curls: Readonly<Record<CartoonFingerName, number>> = {
    index: clamp01(pose.indexCurl),
    middle: clamp01(pose.middleCurl),
    outer: clamp01(pose.outerCurl),
  };
  const curlAngles: Readonly<Record<CartoonFingerName, readonly [number, number, number]>> = {
    index: [0.92, 1.28, 1.08],
    middle: [0.96, 1.34, 1.12],
    outer: [0.9, 1.26, 1.08],
  };
  for (const digit of ['index', 'middle', 'outer'] as const) {
    const chain = rig.fingers[digit];
    const curl = curls[digit];
    const angles = curlAngles[digit];
    chain.proximal.rotation.set(
      REST_CURL - angles[0] * curl,
      -sideSign * 0.08 * clamp01(pose.cup),
      chain.restSpread * (1 + THREE.MathUtils.clamp(pose.spread, -0.6, 0.8)),
    );
    chain.middle.rotation.set(REST_CURL - angles[1] * curl, 0, 0);
    chain.distal.rotation.set(REST_CURL - angles[2] * curl, 0, 0);
  }
  const thumbCurl = clamp01(pose.thumbCurl);
  const opposition = clamp01(pose.thumbOpposition);
  rig.thumb.metacarpal.rotation.set(
    0,
    sideSign * 0.12 * opposition,
    rig.thumb.restOpposition + sideSign * 0.72 * opposition,
  );
  rig.thumb.proximal.rotation.set(-0.82 * thumbCurl, 0, 0);
  rig.thumb.distal.rotation.set(-1.08 * thumbCurl, 0, 0);
}

export function blendCartoonGlovePose(
  from: Readonly<CartoonGlovePose>,
  to: Readonly<CartoonGlovePose>,
  weight: number,
): CartoonGlovePose {
  const t = clamp01(weight);
  return {
    indexCurl: THREE.MathUtils.lerp(from.indexCurl, to.indexCurl, t),
    middleCurl: THREE.MathUtils.lerp(from.middleCurl, to.middleCurl, t),
    outerCurl: THREE.MathUtils.lerp(from.outerCurl, to.outerCurl, t),
    thumbCurl: THREE.MathUtils.lerp(from.thumbCurl, to.thumbCurl, t),
    thumbOpposition: THREE.MathUtils.lerp(from.thumbOpposition, to.thumbOpposition, t),
    spread: THREE.MathUtils.lerp(from.spread, to.spread, t),
    cup: THREE.MathUtils.lerp(from.cup, to.cup, t),
  };
}
