import * as THREE from 'three';
import type { CustomComponent } from './level';
import {
  buildWoodPathLayout, UNITY_BEACH_BOARDWALK_PROFILE,
  type WoodPathLayout, type WoodPathProfile,
} from './woodPathKit';
import { buildWoodPathMeshes, WOOD_PATH_PLANK_WEIGHTS, WOOD_PATH_POLE_WEIGHTS, BRIDGE_AGED_PALETTE, BRIDGE_FROZEN_PALETTE } from './woodPathMeshes';
import { createIceMaterial } from './surfacePresentation';

export interface CarlisleTimberDeck {
  root: THREE.Group;
  layout: WoodPathLayout;
  dispose(): void;
}
const owners = new WeakMap<THREE.Mesh, CarlisleTimberDeck>();
export const SUSPENSION_BOARD_THICKNESS = .18;
export const SUSPENSION_BEARER_X = 1.72;
export const SUSPENSION_BEARER_Y = -.3;
export const SUSPENSION_BEARER_RADIUS = .12;
export const FROZEN_BOARD_GLAZE = .1;
let lashingGeometry: THREE.TorusGeometry | null = null;
let lashingMaterial: THREE.MeshLambertMaterial | null = null;
let frozenMaterial: THREE.MeshPhongMaterial | null = null;

function addSuspensionLashings(root: THREE.Group, layout: WoodPathLayout, top: number): void {
  lashingGeometry ??= new THREE.TorusGeometry(1,.13,4,12);
  lashingGeometry.userData.shared = true;
  lashingMaterial ??= new THREE.MeshLambertMaterial({color:0x736047});
  lashingMaterial.userData.shared = true;
  const boards = layout.planks.filter((_,i)=>i%2===0);
  const mesh = new THREE.InstancedMesh(lashingGeometry,lashingMaterial,boards.length*2);
  mesh.name = 'Rope lashings around transverse boards and lower bearers';
  mesh.userData.visualOnly = true; mesh.userData.suspensionLashings = true;
  let i=0;
  for(const board of boards)for(const side of [-1,1]) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(side*SUSPENSION_BEARER_X,top-.19,board.center[2]),
      new THREE.Quaternion(),new THREE.Vector3(.15,.22,.12));
    mesh.setMatrixAt(i++,matrix);
  }
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); root.add(mesh);
}

function freezeBoardFaces(root: THREE.Group, planks: THREE.Group): void {
  if (!frozenMaterial) {
    frozenMaterial=createIceMaterial(); frozenMaterial.color.set('#c4e8f0');
    frozenMaterial.opacity=.66; frozenMaterial.transparent=true; frozenMaterial.depthWrite=false;
    frozenMaterial.userData.shared=true; frozenMaterial.name='Frozen water over visible timber boards';
  }
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(const child of planks.children) {
    const boards=child as THREE.InstancedMesh;
    if(!boards.isInstancedMesh)continue;
    const glaze=new THREE.InstancedMesh(boards.geometry,frozenMaterial,boards.count);
    glaze.name='Frozen board faces · translucent glaze';glaze.userData.visualOnly=true;glaze.userData.frozenBoardGlaze=true;
    for(let i=0;i<boards.count;i++) {
      boards.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);
      position.y+=(SUSPENSION_BOARD_THICKNESS+FROZEN_BOARD_GLAZE)/2;
      scale.y=FROZEN_BOARD_GLAZE;
      matrix.compose(position,rotation,scale);glaze.setMatrixAt(i,matrix);
    }
    glaze.computeBoundingBox();glaze.computeBoundingSphere();root.add(glaze);
  }
}
export const MAX_CARLISLE_TIMBER_LENGTH = 20_000;
const sampling = (length: number, moving: boolean) => ({
  plankSpacing: Math.max(.67, length / 320),
  bentSpacing: Math.max(moving ? Math.max(1.7, Math.min(3.2, length * .46)) : 6.8, length / 40),
});

/** Conservative authoring work, including member instances, frame samples
 * and support resolution. Direct callers also receive bounded subdivisions. */
export function estimateCarlisleTimberWork(depth: number, moving: boolean): number {
  if (!Number.isFinite(depth) || depth < 0 || depth > MAX_CARLISLE_TIMBER_LENGTH) return Infinity;
  if (depth === 0) return 0;
  const spacing = sampling(depth, moving);
  const planks = Math.ceil(depth / spacing.plankSpacing), bays = Math.ceil(depth / spacing.bentSpacing);
  return 2 * planks + 7 * (bays + 1) + (moving ? 2 : 8) * bays;
}

/** Dress the actual native local envelope, preserving its collider and motion.
 * Only a cloned collider material is hidden; children inherit the native
 * object's movement, shaking, scale and collapse visibility. The rustic kit
 * supplies real chipped boards, hewn beams and braces from its shared atlas. */
export function dressCarlisleTimberDeck(mesh: THREE.Mesh, component: CustomComponent,
  moving: boolean): CarlisleTimberDeck | null {
  const existing = owners.get(mesh); if (existing) return existing;
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box || box.isEmpty()) return null;
  const width = box.max.x - box.min.x, length = box.max.z - box.min.z;
  if (!Number.isFinite(width + length + box.max.y) || width < .25 || length < .25 ||
    width > MAX_CARLISLE_TIMBER_LENGTH || length > MAX_CARLISLE_TIMBER_LENGTH ||
    Math.max(Math.abs(box.min.y), Math.abs(box.max.y)) > 100_000) return null;
  const index = Number(component.nm?.match(/\d+$/)?.[0] ?? 0);
  const rawSeed = index || Math.round(component.p[0] * 17 + component.p[2] * 31);
  const seed = Number.isFinite(rawSeed) ? Math.trunc(rawSeed) : 7319;
  const height = box.max.y - box.min.y;
  const suspended = component.tex === 'bridge-timber' || component.tex === 'bridge-ice';
  const frozen = component.tex === 'bridge-ice';
  const rotten = suspended && component.t === 'crumble';
  const top = box.max.y - (frozen ? FROZEN_BOARD_GLAZE : 0), centerX = (box.max.x + box.min.x) / 2;
  const pierDepth = moving ? Math.max(.7, Math.min(1.3, height + .28)) : 9 + ((Math.abs(seed) % 3) * 1.5);
  const spacing = sampling(length, moving);
  const profile: WoodPathProfile = {
    ...UNITY_BEACH_BOARDWALK_PROFILE,
    deckThickness: suspended ? SUSPENSION_BOARD_THICKNESS : .145,
    plankThickness: suspended ? SUSPENSION_BOARD_THICKNESS : .145,
    plankSpacing: suspended ? Math.max(.58,length/320) : spacing.plankSpacing,
    plankGap: rotten ? .045 : .024,
    plankSideOverhang: suspended ? 0 : .045, plankYawJitterDegrees: suspended ? (rotten ? 1.5 : .35) : 1.65,
    plankScaleJitter: suspended ? (rotten ? .025 : .01) : .038, plankVerticalJitter: 0,
    bentSpacing: spacing.bentSpacing,
    deckSideInset: Math.min(.30, width * .14), crossbeamOverhang: .11,
    postRadius: moving ? .11 : .17, crossbeamRadius: .105,
    ledgerRadius: .095, braceRadius: moving ? .055 : .083,
    lowerLedgers: !moving, diagonalBraces: !moving,
    handrails: false, tonalBucketCount: 4,
  };
  const layout = buildWoodPathLayout({
    length,
    sampleAtDistance: distance => ({
      center: [centerX, top, box.max.z - distance],
      forward: [0, 0, -1], right: [-1, 0, 0], up: [0, 1, 0], width,
    }),
  }, {
    profile, plankSeed: seed + 7319, poleSeed: seed + 19411,
    plankVariantWeights: suspended ? (rotten ? [8,0,3] : [0,5,1]) : WOOD_PATH_PLANK_WEIGHTS,
    poleVariantWeights: WOOD_PATH_POLE_WEIGHTS,
    fallbackBaseY: top - pierDepth, includeSupports: !suspended, includeHandrails: false,
  });
  if(moving&&component.tex==='creek-raft'){
    // Three hewn floats and transverse ties make a ferry hull from the same
    // shared kit. Every member stays below the original walkable deck.
    layout.poles.length=0;
    const member=(start:[number,number,number],end:[number,number,number],radius:number,role:'top-ledger'|'crossbeam',variant:number)=>{
      const a=new THREE.Vector3(...start),b=new THREE.Vector3(...end),delta=b.clone().sub(a),length=delta.length();
      layout.poles.push({kind:'pole',index:layout.poles.length,role,start,end,
        center:a.add(b).multiplyScalar(.5).toArray(),direction:delta.normalize().toArray(),length,radius,variantIndex:variant,tonalBucket:2});
    };
    for(const side of [-1,0,1])member([centerX+side*width*.31,top-.79,box.min.z+.15],
      [centerX+side*width*.31,top-.79,box.max.z-.15],.39,'top-ledger',side===0?1:0);
    for(const t of [-.36,0,.36])member([box.min.x+.03,top-.24,(box.min.z+box.max.z)/2+length*t],
      [box.max.x-.03,top-.24,(box.min.z+box.max.z)/2+length*t],.17,'crossbeam',1);
  }
  const [planks, beams] = buildWoodPathMeshes(layout, seed + 7319,
    rotten ? BRIDGE_AGED_PALETTE : frozen ? BRIDGE_FROZEN_PALETTE : undefined);
  const root = new THREE.Group();
  root.name = moving ? 'Carlisle worn moving timber deck' : 'Carlisle worn timber pier bridge';
  root.userData.carlisleTimberDressing = true;
  if(component.tex==='creek-raft')root.userData.timberRaft=true;
  root.userData.visualOnly = true;
  root.add(planks, beams);
  if (suspended) {
    root.name = frozen ? 'Frozen boards on lower ropes' : rotten ? 'Rotten split boards on lower ropes' : 'Transverse boards on lower ropes';
    root.userData.suspensionDeck = {rotten,frozen,boardTop:top,boardThickness:SUSPENSION_BOARD_THICKNESS,
      bearerX:SUSPENSION_BEARER_X,bearerY:top+SUSPENSION_BEARER_Y};
    addSuspensionLashings(root,layout,top);
    if(frozen)freezeBoardFaces(root,planks);
  }
  root.traverse(object => {
    const child = object as THREE.Mesh;
    if (!child.isMesh) return;
    child.userData.visualOnly = true;
    child.userData.edgeGrinding = false;
    child.userData.castShadow = false;
    child.castShadow = false;
    child.receiveShadow = true;
  });
  return ownSkin(mesh, root, layout, false);
}

function ownSkin(mesh: THREE.Mesh, root: THREE.Group, layout: WoodPathLayout,
  beam: boolean): CarlisleTimberDeck {
  const original = mesh.material;
  const materials = (Array.isArray(original) ? original : [original]).map(material => {
    const hidden = material.clone();
    hidden.visible = false; hidden.userData.shared = false;
    return hidden;
  });
  const hidden = Array.isArray(original) ? materials : materials[0];
  mesh.material = hidden;
  mesh.add(root);
  mesh.userData.carlisleTimberDressed = true;
  mesh.userData[beam ? 'carlisleTimberBeam' : 'carlisleTimberDeck'] = true;
  let disposed = false;
  const owner: CarlisleTimberDeck = {
    root, layout,
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      root.traverse(object => {
        const instance = object as THREE.InstancedMesh;
        if (instance.isInstancedMesh) instance.dispose();
      });
      // Borrowed geometry, atlas, textures and kit material are never disposed.
      if (mesh.material === hidden) mesh.material = original;
      for (const material of materials) material.dispose();
      delete mesh.userData.carlisleTimberDeck;
      delete mesh.userData.carlisleTimberBeam;
      delete mesh.userData.carlisleTimberDressed;
      owners.delete(mesh);
    },
  };
  owners.set(mesh, owner);
  return owner;
}

/** Fit one actual hewn/split kit member into a native gallows member's local
 * envelope. It follows its parent pose and adds no bob, pivot or hit volume. */
export function dressCarlisleTimberBeam(mesh: THREE.Mesh, seed: number): CarlisleTimberDeck | null {
  seed = Number.isFinite(seed) ? Math.trunc(seed) : 0;
  const existing = owners.get(mesh); if (existing) return existing;
  mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox; if (!box || box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.x + size.y + size.z) || Math.min(size.x, size.y, size.z) < .01 ||
    Math.max(size.x, size.y, size.z) > MAX_CARLISLE_TIMBER_LENGTH) return null;
  const axis = size.x >= size.y && size.x >= size.z ? 0 : size.y >= size.z ? 1 : 2;
  const start = center.clone(), end = center.clone(), direction = new THREE.Vector3();
  start.setComponent(axis, box.min.getComponent(axis)); end.setComponent(axis, box.max.getComponent(axis));
  direction.setComponent(axis, 1);
  const layout = buildWoodPathLayout({ length: 0, sampleAtDistance: () => ({
    center: center.toArray(), forward: [0, 0, 1], right: [1, 0, 0], up: [0, 1, 0], width: 1,
  }) }, { includePlanks: false, includeSupports: false, includeHandrails: false });
  layout.poles.push({
    kind: 'pole', index: 0, role: 'crossbeam', start: start.toArray(), end: end.toArray(),
    center: center.toArray(), direction: direction.toArray(), length: size.getComponent(axis),
    radius: Math.min(size.getComponent((axis + 1) % 3), size.getComponent((axis + 2) % 3)) / 2,
    variantIndex: ((Math.trunc(seed) % 3) + 3) % 3, tonalBucket: 2,
  });
  const [unused, beams] = buildWoodPathMeshes(layout, seed);
  unused.clear();
  const root = new THREE.Group(); root.name = 'Carlisle weathered hewn gallows member';
  root.userData.carlisleTimberDressing = true; root.userData.visualOnly = true; root.add(beams);
  const matrix = new THREE.Matrix4();
  root.traverse(object => {
    const member = object as THREE.InstancedMesh; if (!member.isInstancedMesh) return;
    member.getMatrixAt(0, matrix);
    member.geometry.computeBoundingBox();
    const rendered = member.geometry.boundingBox!.clone().applyMatrix4(matrix);
    const renderedSize = rendered.getSize(new THREE.Vector3()), renderedCenter = rendered.getCenter(new THREE.Vector3());
    const scale = size.clone().divide(renderedSize);
    const fitting = new THREE.Matrix4().makeScale(scale.x, scale.y, scale.z);
    fitting.setPosition(center.x - renderedCenter.x * scale.x, center.y - renderedCenter.y * scale.y,
      center.z - renderedCenter.z * scale.z);
    matrix.premultiply(fitting); member.setMatrixAt(0, matrix); member.instanceMatrix.needsUpdate = true;
    member.computeBoundingBox(); member.computeBoundingSphere();
    member.userData.visualOnly = true; member.userData.edgeGrinding = false;
    member.userData.castShadow = false; member.castShadow = false; member.receiveShadow = true;
  });
  return ownSkin(mesh, root, layout, true);
}

/** Run before Level's ordinary traversal so native material ownership returns
 * to that traversal; shared rustic templates/atlas remain available to peers. */
export function disposeCarlisleTimberDeck(mesh: THREE.Mesh): void {
  owners.get(mesh)?.dispose();
}
