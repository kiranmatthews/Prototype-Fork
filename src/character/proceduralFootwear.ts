import * as THREE from 'three';

export const PROCEDURAL_FOOTWEAR_SCHEMA_VERSION = 1 as const;
export const PROCEDURAL_FOOTWEAR_STYLE_ID = 'legacy-skate-meshy-palette-v1' as const;

export const PROCEDURAL_FOOTWEAR_PALETTE = Object.freeze({
  upper: 0x111111,
  sock: 0x692124,
  cuff: 0x52181c,
  accent: 0xf3f1f4,
  outsole: 0xefe6d6,
  foxing: 0x17181c,
});

export const PROCEDURAL_FOOTWEAR_CONTACT = Object.freeze({
  soleY: -0.05,
  heelZ: -0.07,
  footCenterZ: 0.065,
  toeZ: 0.2,
});

export type ProceduralFootwearSide = 'left' | 'right';

export interface ProceduralFootwearRig {
  readonly knee: THREE.Bone;
  readonly ankle: THREE.Bone;
  readonly side: ProceduralFootwearSide;
}

export interface ProceduralFootwearComponent {
  readonly side: ProceduralFootwearSide;
  readonly ankleRoot: THREE.Group;
  readonly sock: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshLambertMaterial>;
  readonly cuff: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshLambertMaterial>;
  readonly shoe: THREE.Mesh<THREE.SphereGeometry, THREE.MeshLambertMaterial>;
  readonly sole: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshLambertMaterial>;
  readonly foxing: THREE.Mesh<THREE.CapsuleGeometry, THREE.MeshLambertMaterial>;
  readonly laces: readonly THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>[];
  readonly sideStripes: readonly THREE.Mesh<THREE.TubeGeometry, THREE.MeshLambertMaterial>[];
  readonly triangleCount: number;
}

interface SharedFootwearResources {
  readonly sockGeometry: THREE.CylinderGeometry;
  readonly cuffGeometry: THREE.CylinderGeometry;
  readonly shoeGeometry: THREE.SphereGeometry;
  readonly laceGeometry: THREE.BoxGeometry;
  readonly soleGeometry: THREE.CapsuleGeometry;
  readonly foxingGeometry: THREE.CapsuleGeometry;
  readonly tongueGeometry: THREE.SphereGeometry;
  readonly stripeNegativeGeometry: THREE.TubeGeometry;
  readonly stripePositiveGeometry: THREE.TubeGeometry;
  readonly upperMaterial: THREE.MeshLambertMaterial;
  readonly sockMaterial: THREE.MeshLambertMaterial;
  readonly cuffMaterial: THREE.MeshLambertMaterial;
  readonly accentMaterial: THREE.MeshLambertMaterial;
  readonly outsoleMaterial: THREE.MeshLambertMaterial;
  readonly foxingMaterial: THREE.MeshLambertMaterial;
}

let sharedResources: SharedFootwearResources | null = null;

function flatMaterial(name: string, color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ name, color, flatShading: true });
}

function stripeGeometry(x: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x, -0.024, 0.035),
    new THREE.Vector3(x, -0.018, 0.058),
    new THREE.Vector3(x, -0.025, 0.085),
    new THREE.Vector3(x, -0.014, 0.116),
    new THREE.Vector3(x, -0.02, 0.145),
  ], false, 'catmullrom', 0.42);
  const geometry = new THREE.TubeGeometry(curve, 12, 0.004, 5, false);
  geometry.userData.sharedImmutable = true;
  return geometry;
}

function resources(): SharedFootwearResources {
  if (sharedResources) return sharedResources;
  // The original radii are opened just enough to clear the source-derived
  // lower-leg tip at the authored 1.37 leg thickness. Length and placement
  // stay legacy; the slightly fuller tube also matches the Meshy sock style.
  const sockGeometry = new THREE.CylinderGeometry(0.045, 0.052, 0.075, 10);
  const cuffGeometry = new THREE.CylinderGeometry(0.054, 0.054, 0.012, 10);
  const shoeGeometry = new THREE.SphereGeometry(0.085, 10, 7);
  const laceGeometry = new THREE.BoxGeometry(0.105, 0.016, 0.05);
  const soleGeometry = new THREE.CapsuleGeometry(0.0675, 0.135, 2, 10);
  const foxingGeometry = new THREE.CapsuleGeometry(0.0685, 0.135, 2, 10);
  const tongueGeometry = new THREE.SphereGeometry(0.055, 8, 5);
  soleGeometry.rotateX(Math.PI / 2);
  foxingGeometry.rotateX(Math.PI / 2);
  for (const geometry of [
    sockGeometry,
    cuffGeometry,
    shoeGeometry,
    laceGeometry,
    soleGeometry,
    foxingGeometry,
    tongueGeometry,
  ]) geometry.userData.sharedImmutable = true;
  sharedResources = {
    sockGeometry,
    cuffGeometry,
    shoeGeometry,
    laceGeometry,
    soleGeometry,
    foxingGeometry,
    tongueGeometry,
    stripeNegativeGeometry: stripeGeometry(-0.069),
    stripePositiveGeometry: stripeGeometry(0.069),
    upperMaterial: flatMaterial('procedural-footwear-upper', PROCEDURAL_FOOTWEAR_PALETTE.upper),
    sockMaterial: flatMaterial('procedural-footwear-sock', PROCEDURAL_FOOTWEAR_PALETTE.sock),
    cuffMaterial: flatMaterial('procedural-footwear-cuff', PROCEDURAL_FOOTWEAR_PALETTE.cuff),
    accentMaterial: flatMaterial('procedural-footwear-accent', PROCEDURAL_FOOTWEAR_PALETTE.accent),
    outsoleMaterial: flatMaterial('procedural-footwear-outsole', PROCEDURAL_FOOTWEAR_PALETTE.outsole),
    foxingMaterial: flatMaterial('procedural-footwear-foxing', PROCEDURAL_FOOTWEAR_PALETTE.foxing),
  };
  return sharedResources;
}

function triangleCount(geometry: THREE.BufferGeometry): number {
  return (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;
}

function finishMesh<TGeometry extends THREE.BufferGeometry>(
  mesh: THREE.Mesh<TGeometry, THREE.MeshLambertMaterial>,
  name: string,
  part: string,
  side: ProceduralFootwearSide,
): THREE.Mesh<TGeometry, THREE.MeshLambertMaterial> {
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.characterPart = part;
  mesh.userData.footwearSurface = true;
  mesh.userData.anatomicalSide = side;
  mesh.userData.styleId = PROCEDURAL_FOOTWEAR_STYLE_ID;
  return mesh;
}

/**
 * Restores the original procedural sock / shoe / sole envelope while applying
 * the black, brick-red and warm-white language of the supplied Meshy design.
 * Sock pieces remain direct knee children; every shoe piece remains below the
 * ankle. That hierarchy is the contract used by shin scaling, Foot size and
 * the live sole-to-deck planting solver.
 */
export function createProceduralFootwear(
  rig: ProceduralFootwearRig,
): ProceduralFootwearComponent {
  const r = resources();
  const { knee, ankle, side } = rig;

  const sock = finishMesh(
    new THREE.Mesh(r.sockGeometry, r.sockMaterial),
    `sock-${side}`,
    'procedural-footwear-sock',
    side,
  );
  sock.position.y = -0.205;
  knee.add(sock);

  const cuff = finishMesh(
    new THREE.Mesh(r.cuffGeometry, r.cuffMaterial),
    `sock-cuff-${side}`,
    'procedural-footwear-cuff',
    side,
  );
  cuff.position.y = -0.177;
  knee.add(cuff);

  const ankleRoot = new THREE.Group();
  ankleRoot.name = `procedural-footwear-${side}`;
  ankleRoot.userData.characterPart = 'procedural-footwear';
  ankleRoot.userData.footwearSurface = true;
  ankleRoot.userData.anatomicalSide = side;
  ankleRoot.userData.styleId = PROCEDURAL_FOOTWEAR_STYLE_ID;
  ankle.add(ankleRoot);

  const shoe = finishMesh(
    new THREE.Mesh(r.shoeGeometry, r.upperMaterial),
    `shoe-${side}`,
    'procedural-footwear-upper',
    side,
  );
  shoe.scale.set(0.85, 0.5, 1.5);
  shoe.position.set(0, -0.006, 0.065);
  ankleRoot.add(shoe);

  const tongue = finishMesh(
    new THREE.Mesh(r.tongueGeometry, r.upperMaterial),
    `shoe-tongue-${side}`,
    'procedural-footwear-tongue',
    side,
  );
  tongue.scale.set(0.76, 0.23, 0.82);
  tongue.position.set(0, 0.018, 0.082);
  tongue.rotation.x = 0.22;
  ankleRoot.add(tongue);

  // The two original white straps become chunky cartoon lace bars. Their
  // legacy geometry and broad placement remain; the rear bar sits slightly
  // lower/forward so Foot size 1.53 cannot push it through the fitted sock.
  const laceA = finishMesh(
    new THREE.Mesh(r.laceGeometry, r.accentMaterial),
    `shoe-lace-${side}-front`,
    'procedural-footwear-lace',
    side,
  );
  laceA.position.set(0, 0.006, 0.13);
  laceA.rotation.x = 0.35;
  ankleRoot.add(laceA);
  const laceB = finishMesh(
    new THREE.Mesh(r.laceGeometry, r.accentMaterial),
    `shoe-lace-${side}-rear`,
    'procedural-footwear-lace',
    side,
  );
  laceB.position.set(0, -0.012, 0.075);
  laceB.rotation.x = 0.15;
  ankleRoot.add(laceB);
  const laces = [laceA, laceB] as const;

  const sole = finishMesh(
    new THREE.Mesh(r.soleGeometry, r.outsoleMaterial),
    `sole-${side}`,
    'procedural-footwear-outsole',
    side,
  );
  sole.scale.y = 0.26;
  sole.position.set(0, -0.0325, 0.065);
  ankleRoot.add(sole);

  // The dark band sits above and slightly outside the outsole. Its complete
  // bounds remain above the -0.05 contact plane, so it cannot change planting.
  const foxing = finishMesh(
    new THREE.Mesh(r.foxingGeometry, r.foxingMaterial),
    `shoe-foxing-${side}`,
    'procedural-footwear-foxing',
    side,
  );
  foxing.scale.y = 0.09;
  foxing.position.set(0, -0.013, 0.065);
  ankleRoot.add(foxing);

  const sideStripes = [
    finishMesh(
      new THREE.Mesh(r.stripeNegativeGeometry, r.accentMaterial),
      `shoe-side-stripe-${side}-negative`,
      'procedural-footwear-side-stripe',
      side,
    ),
    finishMesh(
      new THREE.Mesh(r.stripePositiveGeometry, r.accentMaterial),
      `shoe-side-stripe-${side}-positive`,
      'procedural-footwear-side-stripe',
      side,
    ),
  ] as const;
  for (const stripe of sideStripes) ankleRoot.add(stripe);

  const geometries = [
    r.sockGeometry,
    r.cuffGeometry,
    r.shoeGeometry,
    r.tongueGeometry,
    r.laceGeometry,
    r.laceGeometry,
    r.soleGeometry,
    r.foxingGeometry,
    r.stripeNegativeGeometry,
    r.stripePositiveGeometry,
  ];
  const component: ProceduralFootwearComponent = {
    side,
    ankleRoot,
    sock,
    cuff,
    shoe,
    sole,
    foxing,
    laces,
    sideStripes,
    triangleCount: geometries.reduce((sum, geometry) => sum + triangleCount(geometry), 0),
  };
  ankleRoot.userData.proceduralFootwear = component;
  return component;
}
