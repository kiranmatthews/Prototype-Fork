import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const assetDirectory = resolve(root, "public/characters/quaternius-female");
const assetPath = resolve(assetDirectory, "mannequin-f.glb");
const provenancePath = resolve(assetDirectory, "provenance.json");
const licensePath = resolve(assetDirectory, "LICENSE.txt");
const evaluationSourcePath = resolve(root, "src/character/quaterniusEvaluationModel.ts");
const playerSourcePath = resolve(root, "src/player.ts");
const animationStudioSourcePath = resolve(root, "src/animationStudio.ts");
const mainSourcePath = resolve(root, "src/main.ts");
const packagePath = resolve(root, "package.json");
const readText = (path) => readFile(path, "utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const EXPECTED_BYTE_LENGTH = 1_442_824;
const EXPECTED_SHA256 =
  "2ee6cc3fe888d9b144afa8cc4b2ab7bfc5d13a0d5b7548df777f61f64ad65fa6";
const EXPECTED_NOTICE_SHA256 =
  "5230ee974248c97ed97c560bb81be990ea981e020b04b742f191760f2b2baebc";

function compileEvaluationModule(source) {
  const output = ts.transpileModule(
    source.replaceAll("import.meta.env.BASE_URL", JSON.stringify("/")),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: evaluationSourcePath,
    },
  ).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(
    module,
    module.exports,
    (specifier) => {
      if (specifier === "three") return THREE;
      if (specifier.endsWith("GLTFLoader.js")) return { GLTFLoader: class LoaderStub {} };
      throw new Error(`unexpected evaluation-model import: ${specifier}`);
    },
  );
  return module.exports;
}

function parseGlb(bytes) {
  assert.ok(bytes.length >= 20, "GLB is large enough to contain its header and JSON chunk");
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", "GLB magic");
  assert.equal(bytes.readUInt32LE(4), 2, "GLB container version");
  assert.equal(bytes.readUInt32LE(8), bytes.length, "GLB declared byte length");

  const chunks = [];
  let offset = 12;
  while (offset < bytes.length) {
    assert.ok(offset + 8 <= bytes.length, "GLB chunk header is in bounds");
    const byteLength = bytes.readUInt32LE(offset);
    const type = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + byteLength;
    assert.ok(end <= bytes.length, "GLB chunk payload is in bounds");
    chunks.push({ byteLength, type, bytes: bytes.subarray(start, end) });
    offset = end;
  }
  assert.equal(offset, bytes.length, "GLB chunks consume the complete file");
  assert.deepEqual(
    chunks.map(({ type }) => type),
    [0x4e4f534a, 0x004e4942],
    "GLB contains one JSON chunk followed by one BIN chunk",
  );

  const document = JSON.parse(chunks[0].bytes.toString("utf8").trimEnd());
  const binary = chunks[1].bytes;
  assert.equal(document.buffers.length, 1, "single embedded glTF buffer");
  assert.equal(document.buffers[0].uri, undefined, "no external buffer dependency");
  assert.equal(
    binary.length,
    document.buffers[0].byteLength,
    "BIN chunk matches the declared glTF buffer",
  );
  return { document, binary };
}

function sourceSection(source, start, end, label) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `${label}: missing start marker ${JSON.stringify(start)}`);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : source.length;
  assert.notEqual(endIndex, -1, `${label}: missing end marker ${JSON.stringify(end)}`);
  return source.slice(startIndex, endIndex);
}

function assertInOrder(source, fragments, label) {
  let previous = -1;
  for (const fragment of fragments) {
    const index = source.indexOf(fragment, previous + 1);
    assert.notEqual(index, -1, `${label}: missing ${JSON.stringify(fragment)}`);
    assert.ok(index > previous, `${label}: ${JSON.stringify(fragment)} is out of order`);
    previous = index;
  }
}

const [
  assetBytes,
  provenanceSource,
  licenseBytes,
  readme,
  evaluationSource,
  playerSource,
  animationStudioSource,
  mainSource,
  packageSource,
] = await Promise.all([
  readFile(assetPath),
  readText(provenancePath),
  readFile(licensePath),
  readText(resolve(assetDirectory, "README.md")),
  readText(evaluationSourcePath),
  readText(playerSourcePath),
  readText(animationStudioSourcePath),
  readText(mainSourcePath),
  readText(packagePath),
]);
const provenance = JSON.parse(provenanceSource);

assert.equal(assetBytes.length, EXPECTED_BYTE_LENGTH, "stable mannequin byte length");
assert.equal(sha256(assetBytes), EXPECTED_SHA256, "byte-for-byte UAL2 mannequin hash");

assert.equal(provenance.schemaVersion, 1);
assert.deepEqual(provenance.asset, {
  file: "mannequin-f.glb",
  mediaType: "model/gltf-binary",
  byteLength: EXPECTED_BYTE_LENGTH,
  sha256: EXPECTED_SHA256,
});
assert.deepEqual(provenance.source, {
  author: "Quaternius",
  pack: "Universal Animation Library 2",
  edition: "Standard",
  page: "https://quaternius.com/packs/universalanimationlibrary2.html",
  animationViewer: "https://quaternius.com/animviewer.html",
  archivePath: "Female Mannequin/Unreal-Godot/Mannequin_F.glb",
  sourceSha256: EXPECTED_SHA256,
  includedLicenseSha256:
    "6d01f55c6e4c49a2c9963e147e561945ae2c83958c8ca667d90a6bffdbfac061",
  includedFemaleReadmeSha256:
    "3447416d55d5cf3a82311c4941578068d544cc4cfa1d49a6a26a28c98b96c393",
  importedOn: "2026-08-31",
});
assert.deepEqual(provenance.license, {
  spdx: "CC0-1.0",
  name: "CC0 1.0 Universal",
  url: "https://creativecommons.org/publicdomain/zero/1.0/",
  noticeFile: "LICENSE.txt",
  noticeSha256: EXPECTED_NOTICE_SHA256,
});
assert.equal(sha256(licenseBytes), EXPECTED_NOTICE_SHA256, "preserved CC0 notice hash");
assert.match(licenseBytes.toString("utf8"), /CC0 1\.0 Universal/);
assert.match(licenseBytes.toString("utf8"), /Models by @Quaternius/);
assert.deepEqual(provenance.modifications, [
  "Renamed Mannequin_F.glb to mannequin-f.glb for a stable web path.",
  "No binary content, geometry, skinning, skeleton, materials, transforms, or buffers were modified.",
]);
assert.match(readme, /Quaternius.*Universal Animation Library 2/s);
assert.match(readme, /CC0 1\.0 Universal/);
assert.match(readme, new RegExp(EXPECTED_SHA256));

const { document } = parseGlb(assetBytes);
const inventory = provenance.inventory;
assert.equal(inventory.containerVersion, 2);
assert.equal(document.asset.version, "2.0");
assert.equal(document.scene, 0);
assert.equal(document.scenes.length, inventory.sceneCount);
assert.equal(document.nodes.length, inventory.nodeCount);
assert.equal(document.meshes.length, inventory.meshCount);
assert.equal(document.skins.length, inventory.skinCount);
assert.equal(document.materials.length, inventory.materialCount);
assert.equal(document.images?.length ?? 0, inventory.imageCount);
assert.equal(document.textures?.length ?? 0, inventory.textureCount);
assert.equal(document.animations?.length ?? 0, inventory.animationCount);
assert.deepEqual(document.extensionsUsed ?? [], inventory.extensionsUsed);
assert.deepEqual(document.extensionsRequired ?? [], [], "no decoder or runtime extension required");
assert.deepEqual(
  document.materials.map((material) => ({
    name: material.name,
    baseColorFactor: material.pbrMetallicRoughness.baseColorFactor,
    metallicFactor: material.pbrMetallicRoughness.metallicFactor,
    roughnessFactor: material.pbrMetallicRoughness.roughnessFactor,
    doubleSided: material.doubleSided,
  })),
  inventory.materials,
  "material inventory matches the binary",
);

assert.deepEqual(document.scenes[0].nodes, [66], "single authored asset root");
assert.equal(document.nodes[66].name, "Armature");
assert.deepEqual(document.nodes[66].children, [65, 64]);
const meshNodes = document.nodes
  .map((node, index) => ({ ...node, index }))
  .filter((node) => node.mesh !== undefined);
assert.equal(meshNodes.length, 1, "one glTF mesh node");
assert.equal(meshNodes[0].name, inventory.mesh.nodeName);
assert.equal(meshNodes[0].mesh, 0);
assert.equal(meshNodes[0].skin, 0, "mesh node is attached to the humanoid skin");

const mesh = document.meshes[meshNodes[0].mesh];
assert.equal(mesh.name, inventory.mesh.name);
assert.equal(mesh.primitives.length, 2, "body and joint-overlay primitives");
assert.equal(mesh.weights, undefined, "no authored mesh morph weights");
assert.equal(meshNodes[0].weights, undefined, "no authored node morph weights");

let morphTargetCount = 0;
for (const [index, primitive] of mesh.primitives.entries()) {
  const expected = inventory.mesh.primitives[index];
  const attributes = Object.keys(primitive.attributes).sort();
  assert.deepEqual(attributes, [...expected.attributes].sort(), `primitive ${index} attributes`);
  assert.equal(primitive.mode ?? 4, 4, `primitive ${index} uses indexed triangles`);
  assert.equal(document.materials[primitive.material].name, expected.material);

  const position = document.accessors[primitive.attributes.POSITION];
  const normal = document.accessors[primitive.attributes.NORMAL];
  const joints = document.accessors[primitive.attributes.JOINTS_0];
  const weights = document.accessors[primitive.attributes.WEIGHTS_0];
  const indices = document.accessors[primitive.indices];
  assert.equal(position.count, expected.vertices, `primitive ${index} vertex count`);
  assert.equal(indices.count, expected.indices, `primitive ${index} index count`);
  assert.equal(indices.count / 3, expected.triangles, `primitive ${index} triangle count`);
  assert.equal(indices.componentType, 5123, `primitive ${index} uint16 indices`);
  assert.equal(position.componentType, 5126, `primitive ${index} float positions`);
  assert.equal(position.type, "VEC3", `primitive ${index} position shape`);
  assert.equal(normal.componentType, 5126, `primitive ${index} float normals`);
  assert.equal(normal.type, "VEC3", `primitive ${index} normal shape`);
  assert.equal(normal.count, position.count, `primitive ${index} normal coverage`);
  assert.equal(joints.type, "VEC4", `primitive ${index} four-way joint indices`);
  assert.ok([5121, 5123].includes(joints.componentType), `primitive ${index} integer joints`);
  assert.equal(joints.count, position.count, `primitive ${index} joint coverage`);
  assert.equal(weights.componentType, 5126, `primitive ${index} float skin weights`);
  assert.equal(weights.type, "VEC4", `primitive ${index} four-way skin weights`);
  assert.equal(weights.count, position.count, `primitive ${index} weight coverage`);
  assert.equal(position.sparse, undefined, `primitive ${index} positions are directly editable`);
  assert.equal(normal.sparse, undefined, `primitive ${index} normals are directly editable`);

  morphTargetCount += primitive.targets?.length ?? 0;
  assert.equal(primitive.targets, undefined, `primitive ${index} starts without authored morphs`);
}
assert.equal(morphTargetCount, inventory.morphTargetCount);

const skin = document.skins[meshNodes[0].skin];
assert.equal(skin.name, inventory.skin.name);
assert.equal(inventory.skin.inverseBindMatrices, true);
assert.equal(inventory.skin.bindPose, "T-pose");
assert.equal(
  inventory.skin.coordinateSystem,
  "Y-up after the asset root transform; anatomical left is +X",
);
assert.equal(skin.joints.length, inventory.jointCount);
const jointNames = skin.joints.map((nodeIndex) => document.nodes[nodeIndex]?.name);
assert.deepEqual(jointNames, inventory.skin.jointNamesInSkinOrder);
assert.equal(new Set(jointNames).size, inventory.jointCount, "skin joint names are unique");
for (const requiredJoint of [
  "root",
  "pelvis",
  "spine_01",
  "spine_02",
  "spine_03",
  "neck_01",
  "Head",
  "clavicle_l",
  "upperarm_l",
  "lowerarm_l",
  "hand_l",
  "thigh_l",
  "calf_l",
  "foot_l",
  "ball_l",
  "clavicle_r",
  "upperarm_r",
  "lowerarm_r",
  "hand_r",
  "thigh_r",
  "calf_r",
  "foot_r",
  "ball_r",
]) {
  assert.ok(jointNames.includes(requiredJoint), `required retarget joint ${requiredJoint}`);
}
const inverseBindMatrices = document.accessors[skin.inverseBindMatrices];
assert.equal(inverseBindMatrices.componentType, 5126, "float inverse bind matrices");
assert.equal(inverseBindMatrices.type, "MAT4");
assert.equal(inverseBindMatrices.count, skin.joints.length);

const evaluationApi = compileEvaluationModule(evaluationSource);
assert.equal(
  evaluationApi.QUATERNIUS_FEMALE_MODEL_PATH,
  "characters/quaternius-female/mannequin-f.glb",
  "runtime uses the repository-owned model path",
);
assert.equal(
  resolve(root, "public", evaluationApi.QUATERNIUS_FEMALE_MODEL_PATH),
  assetPath,
  "runtime model path resolves to the hashed asset",
);
assert.doesNotMatch(evaluationApi.QUATERNIUS_FEMALE_MODEL_PATH, /^[a-z]+:/i);
assert.equal(
  evaluationApi.QUATERNIUS_EXPECTED_TARGET_BONE_COUNT,
  skin.joints.length,
  "runtime skeleton guard matches the shipped skin",
);
assert.deepEqual(
  [...evaluationApi.QUATERNIUS_TARGET_BONE_NAMES],
  jointNames,
  "runtime target-bone order matches the GLB skin order",
);
assert.deepEqual(
  Object.keys(evaluationApi.QUATERNIUS_TARGET_TO_SOURCE_BONE),
  jointNames,
  "retarget map explicitly covers every shipped target joint",
);
const mappedSourceBones = Object.values(evaluationApi.QUATERNIUS_TARGET_TO_SOURCE_BONE)
  .filter((name) => name !== null);
assert.equal(mappedSourceBones.length, 22, "all 22 live source bones are mapped");
assert.equal(new Set(mappedSourceBones).size, mappedSourceBones.length, "source mapping is one-to-one");
assert.deepEqual(
  Object.fromEntries(
    Object.entries(evaluationApi.QUATERNIUS_TARGET_TO_SOURCE_BONE)
      .filter(([, sourceName]) => sourceName !== null),
  ),
  {
    pelvis: "hips",
    spine_01: "torso-root",
    spine_02: "spine",
    spine_03: "chest",
    neck_01: "neck",
    Head: "head",
    clavicle_l: "clavicle-left",
    upperarm_l: "shoulder-left",
    lowerarm_l: "elbow-left",
    hand_l: "wrist-left",
    clavicle_r: "clavicle-right",
    upperarm_r: "shoulder-right",
    lowerarm_r: "elbow-right",
    hand_r: "wrist-right",
    thigh_l: "hip-left",
    calf_l: "knee-left",
    foot_l: "ankle-left",
    ball_l: "toe-left",
    thigh_r: "hip-right",
    calf_r: "knee-right",
    foot_r: "ankle-right",
    ball_r: "toe-right",
  },
  "retarget map uses the player rig's stable semantic names",
);
assert.deepEqual(
  evaluationApi.QUATERNIUS_DEFORMATION_SEGMENTS,
  [
    { id: "torso.lower", targetBone: "spine_02", targetEndpoint: "spine_03" },
    { id: "torso.upper", targetBone: "spine_03", targetEndpoint: "neck_01" },
    { id: "arm.upper.left", targetBone: "upperarm_l", targetEndpoint: "lowerarm_l" },
    { id: "arm.lower.left", targetBone: "lowerarm_l", targetEndpoint: "hand_l" },
    { id: "arm.upper.right", targetBone: "upperarm_r", targetEndpoint: "lowerarm_r" },
    { id: "arm.lower.right", targetBone: "lowerarm_r", targetEndpoint: "hand_r" },
    { id: "leg.upper.left", targetBone: "thigh_l", targetEndpoint: "calf_l" },
    { id: "leg.lower.left", targetBone: "calf_l", targetEndpoint: "foot_l" },
    { id: "leg.upper.right", targetBone: "thigh_r", targetEndpoint: "calf_r" },
    { id: "leg.lower.right", targetBone: "calf_r", targetEndpoint: "foot_r" },
  ],
  "runtime deformation/morph segments stay aligned with target chains",
);

const EvaluationModel = evaluationApi.QuaterniusEvaluationModel;
assert.equal(typeof EvaluationModel, "function");
for (const method of [
  "load",
  "setVisible",
  "rebindSource",
  "updateAfterSourcePose",
  "reset",
  "dispose",
]) {
  assert.equal(typeof EvaluationModel.prototype[method], "function", `adapter method ${method}`);
}
assert.equal(typeof EvaluationModel.load, "function");
assert.equal(typeof EvaluationModel.fromScene, "function");
assert.equal(typeof evaluationApi.loadQuaterniusEvaluationModel, "function");
assert.equal(typeof evaluationApi.createQuaterniusEvaluationModelFromScene, "function");
assert.match(
  evaluationSource,
  /import\.meta\.env\.BASE_URL[^;]*QUATERNIUS_FEMALE_MODEL_PATH/,
  "default URL respects the deployed base path",
);

// Integration contracts live at the host boundary instead of in the adapter.
// Keep them here with the binary/runtime-harness checks: a valid mannequin is
// not useful if it can silently regress to the source body, lag a studio pose,
// or become unreachable from the browser test surface.
assert.match(
  playerSource,
  /import\s*\{\s*QuaterniusEvaluationModel,\s*type QuaterniusEvaluationDiagnostics,\s*\}\s*from '\.\/character\/quaterniusEvaluationModel';/s,
  "Player imports the repository-owned Quaternius presentation adapter",
);
assert.match(
  playerSource,
  /private characterPresentationModeValue: CharacterPresentationMode = 'quaternius-female';/,
  "new Players request the female evaluation surface by default",
);
assert.match(
  playerSource,
  /private characterTailVisibleValue = true;/,
  "the procedural tail remains visible by default",
);
assertInOrder(
  sourceSection(playerSource, "constructor(scene: THREE.Scene)", "  // Reaching for or holding the grab", "Player construction"),
  [
    "this.rebuildHumanoidSkeleton();",
    "this.playerAnimationBridge = new PlayerAnimationBridge(this.group, this.bodyGroup);",
    "this.installQuaterniusEvaluationModel();",
  ],
  "Player construction creates the live source skeleton before loading the presentation skin",
);

const activeMode = sourceSection(
  playerSource,
  "  get activeCharacterPresentationMode(): CharacterPresentationMode",
  "  get characterPresentationDiagnostics",
  "Player active presentation mode",
);
assertInOrder(
  activeMode,
  [
    "this.characterPresentationModeValue === 'quaternius-female'",
    "this.quaterniusEvaluationModel?.readiness === 'ready'",
    "return 'quaternius-female';",
    "this.characterPresentationModeValue === 'meshy-fox'",
    "this.meshyFoxEvaluationModel?.readiness === 'ready'",
    "return 'meshy-fox';",
    "return 'procedural';",
  ],
  "Player resolves both evaluation surfaces and falls back to the procedural body while loading",
);

const presentationState = sourceSection(
  playerSource,
  "  get characterPresentationSurfaceState(): {",
  "  setCharacterPresentationMode(mode: CharacterPresentationMode): void",
  "Player presentation surface state",
);
for (const fragment of [
  "label: 'RIG'",
  "'MESHY FOX'",
  "'MESHY…'",
  "ready,",
  "active,",
  "Meshy Violet Vixen native skin · click for the procedural source body",
  "Procedural source body · click for the Quaternius female mannequin",
]) {
  assert.ok(presentationState.includes(fragment), `presentation surface exposes ${fragment}`);
}

const tailVisibility = sourceSection(
  playerSource,
  "  get characterTailVisibilityState(): {",
  "  /** Compact host contract used by Animation Studio's BODY switch. */",
  "Player tail visibility",
);
assertInOrder(
  tailVisibility,
  [
    "label: this.characterTailVisibleValue ? 'ON' : 'OFF'",
    "setCharacterTailVisible(visible: boolean): void",
    "localStorage.setItem(",
    "CHARACTER_TAIL_VISIBILITY_STORAGE_KEY",
    "this.syncCharacterTailVisibility();",
    "this.resetRenderInterpolation();",
    "toggleCharacterTailVisibility(): void",
  ],
  "the tail switch reports, persists, immediately applies, and render-snaps its state",
);
assert.match(
  playerSource,
  /localStorage\.getItem\(CHARACTER_TAIL_VISIBILITY_STORAGE_KEY\)[\s\S]*?saved === '0'[\s\S]*?saved === '1'/,
  "Player restores only the two valid persisted tail states",
);
assert.match(
  playerSource,
  /private syncCharacterTailVisibility\(\): void \{[\s\S]*?this\.tail\.root\.visible = this\.characterTailVisibleValue;/,
  "the toggle owns only the procedural animal tail root",
);

const setMode = sourceSection(
  playerSource,
  "  setCharacterPresentationMode(mode: CharacterPresentationMode): void",
  "  toggleCharacterPresentationMode(): void",
  "Player presentation mode setter",
);
assertInOrder(
  setMode,
  [
    "this.characterPresentationModeValue = mode;",
    "if (mode === 'meshy-fox') this.ensureMeshyFoxLoad();",
    "localStorage.setItem('solProtoCharacterPresentationV1', mode);",
    "this.syncCharacterPresentation();",
    "this.resetRenderInterpolation();",
  ],
  "changing presentation mode persists the request, resyncs visibility, then snaps rendering",
);

const syncPresentation = sourceSection(
  playerSource,
  "  syncCharacterPresentation(): void",
  "  private installQuaterniusEvaluationModel(): void",
  "Player presentation synchronization",
);
assertInOrder(
  syncPresentation,
  [
    "this.characterPresentationModeValue === 'quaternius-female'",
    "female?.readiness === 'ready'",
    "this.characterPresentationModeValue === 'meshy-fox'",
    "meshy?.readiness === 'ready'",
    "if (showFemale) female.updateAfterSourcePose();",
    "if (showMeshy) meshy.updateAfterSourcePose();",
    "female?.setVisible(showFemale);",
    "meshy?.setVisible(showMeshy);",
    "source.object.visible = showFemale || showMeshy ? false : source.visible;",
    "this.syncCharacterTailVisibility();",
  ],
  "Player updates the selected evaluation pose and reclaims source/tail visibility after snapshots",
);

const installPresentation = sourceSection(
  playerSource,
  "  private installQuaterniusEvaluationModel(): void",
  "  /**\n   * Rebuild bind inverses",
  "Player presentation installation",
);
assert.match(
  installPresentation,
  /typeof window\.requestAnimationFrame !== 'function'/,
  "headless movement harnesses do not issue asynchronous presentation-asset requests",
);
assertInOrder(
  installPresentation,
  [
    "localStorage.getItem('solProtoCharacterPresentationV1')",
    "saved === 'procedural' || saved === 'quaternius-female' || saved === 'meshy-fox'",
    "visible: false,",
    "void model.load().then(() => {",
    "this.syncCharacterPresentation();",
    "this.resetRenderInterpolation();",
  ],
  "Player honors only valid saved modes and resyncs/snaps after asynchronous readiness",
);
assert.match(
  installPresentation,
  /\.catch\(\(error: unknown\) => \{[\s\S]*?this\.syncCharacterPresentation\(\);[\s\S]*?procedural body stays/s,
  "a failed mannequin load keeps the procedural fallback synchronized",
);

const rebuildSkeleton = sourceSection(
  playerSource,
  "  private rebuildHumanoidSkeleton(): void",
  "  get animationPreviewActive(): boolean",
  "Player skeleton rebuild",
);
assertInOrder(
  rebuildSkeleton,
  [
    "this.humanoidSkeleton = new THREE.Skeleton(bones);",
    "this.humanoidSkeleton.calculateInverses();",
    "this.quaterniusEvaluationModel?.rebindSource(",
    "this.meshyFoxEvaluationModel?.rebindSource(",
  ],
  "a rebuilt source skeleton is rebound into the evaluation model",
);
for (const [start, end, label] of [
  ["  resetAnimationPreview(): void", "  /** Restore the entry pose and return pose ownership to gameplay. */", "preview reset"],
  ["  exitAnimationPreview(): void", "  /**\n   * Animation Studio's scalar-track adapter.", "preview exit"],
]) {
  const previewMethod = sourceSection(playerSource, start, end, `Player ${label}`);
  assertInOrder(
    previewMethod,
    ["this.resetRenderInterpolation();", "this.syncCharacterPresentation();"],
    `Player ${label} resynchronizes the presentation skin after pose restoration`,
  );
}
const finalVisualStep = sourceSection(
  playerSource,
  "    // Authored clips are the final pose layer.",
  "\n\n  // Character skins:",
  "Player final visual step",
);
assertInOrder(
  finalVisualStep,
  ["this.playerAnimationBridge.applyOverlay(dt);", "this.syncCharacterPresentation();"],
  "Player copies the final authored pose, not a pre-overlay pose, to the mannequin",
);

assert.match(
  animationStudioSource,
  /syncPresentation\?: \(\) => void;[\s\S]*?presentationSurface\?: AnimationStudioPresentationSurface;[\s\S]*?tailVisibility\?: AnimationStudioTailVisibility;/,
  "Animation Studio context exposes host-owned BODY and tail presentation controls",
);
const studioFrame = sourceSection(
  animationStudioSource,
  "  frame(dt: number): void {\n    if (!this.open) return;",
  "  close(): void",
  "Animation Studio frame",
);
assertInOrder(
  studioFrame,
  [
    "if (this.needsSample) this.sampleCurrentPose();",
    "if (this.onionEnabled && this.onionDirty) this.updateOnionSkin();",
    "this.ctx.syncPresentation?.();",
    "this.refreshPresentationSurfaceButton();",
    "this.refreshTailVisibilityButton();",
  ],
  "Animation Studio syncs and refreshes all character presentation controls once per settled frame",
);
const studioToolbar = sourceSection(
  animationStudioSource,
  "    if (this.ctx.presentationSurface) {",
  "    const importButton = button('Import'",
  "Animation Studio BODY toolbar",
);
assertInOrder(
  studioToolbar,
  [
    "button('BODY · …', 'Switch character presentation surface')",
    "this.ctx.presentationSurface?.toggle();",
    "this.ctx.syncPresentation?.();",
    "this.refreshPresentationSurfaceButton();",
  ],
  "Animation Studio BODY selector toggles and immediately resynchronizes the surface",
);
const refreshBodySelector = sourceSection(
  animationStudioSource,
  "  private refreshPresentationSurfaceButton(): void",
  "  private buildClipPanel",
  "Animation Studio BODY selector refresh",
);
assertInOrder(
  refreshBodySelector,
  [
    "button.textContent = `BODY · ${state.label}`;",
    "button.disabled = false;",
    "button.toggleAttribute('data-loading', !state.ready);",
    "button.classList.toggle('ast-active', state.active);",
  ],
  "Animation Studio BODY selector reflects the host surface state",
);
const refreshTailSelector = sourceSection(
  animationStudioSource,
  "  private refreshTailVisibilityButton(): void",
  "  private buildClipPanel",
  "Animation Studio TAIL selector refresh",
);
assertInOrder(
  refreshTailSelector,
  [
    "button.textContent = `TAIL · ${state.label}`;",
    "button.classList.toggle('ast-active', state.active);",
    "button.setAttribute('aria-pressed', state.active ? 'true' : 'false');",
  ],
  "Animation Studio TAIL selector exposes and reflects the persistent silhouette state",
);
assertInOrder(
  studioToolbar,
  [
    "button('TAIL · …', 'Show or hide the procedural character tail')",
    "this.ctx.tailVisibility?.toggle();",
    "this.ctx.syncPresentation?.();",
    "this.refreshTailVisibilityButton();",
  ],
  "Animation Studio TAIL selector applies and immediately resynchronizes the silhouette",
);

const mainStudioWiring = sourceSection(
  mainSource,
  "async function openAnimationStudioTool(): Promise<void>",
  "// Openable WITHOUT a console",
  "main Animation Studio wiring",
);
assertInOrder(
  mainStudioWiring,
  [
    "const rig = player.enterAnimationPreview();",
    "syncPresentation: () => player.syncCharacterPresentation(),",
    "getState: () => player.characterPresentationSurfaceState,",
    "toggle: () => player.toggleCharacterPresentationMode(),",
    "getState: () => player.characterTailVisibilityState,",
    "toggle: () => player.toggleCharacterTailVisibility(),",
    "player.exitAnimationPreview();",
  ],
  "main wires Player presentation controls into the animation preview lifecycle",
);
const debugSurface = sourceSection(
  mainSource,
  "(window as unknown as Record<string, unknown>).__game = {",
  "};\n",
  "main debug surface",
);
assert.ok(
  debugSurface.includes("getCharacterPresentationDiagnostics: () => player.characterPresentationDiagnostics,"),
  "__game exposes character presentation diagnostics for browser harnesses",
);
assert.ok(
  debugSurface.includes("mode: 'procedural' | 'quaternius-female' | 'meshy-fox',"),
  "__game exposes explicit character presentation switching for browser harnesses",
);
for (const fragment of [
  "getCharacterTailVisibility: () => player.characterTailVisible,",
  "setCharacterTailVisible: (visible: boolean) => player.setCharacterTailVisible(visible),",
  "toggleCharacterTailVisibility: () => player.toggleCharacterTailVisibility(),",
]) {
  assert.ok(debugSurface.includes(fragment), `__game exposes tail control: ${fragment}`);
}
assert.equal(
  [...mainSource.matchAll(/label: "TAIL"/g)].length,
  2,
  "desktop and touch presentation toolbars both expose the tail toggle",
);

const packageManifest = JSON.parse(packageSource);
assert.equal(
  packageManifest.scripts["check:character-evaluation"],
  "node tools/test-quaternius-evaluation-model.mjs && node tools/test-quaternius-evaluation-runtime.mjs && node tools/test-meshy-fox-evaluation.mjs",
  "package exposes the Quaternius integration harness",
);
assert.match(
  packageManifest.scripts.build,
  /npm run check:character-evaluation/,
  "production build executes the Quaternius integration harness",
);

console.log(
  `PASS Quaternius UAL2 evaluation mannequin + integration contracts: ${skin.joints.length} joints, ` +
    `${mesh.primitives.length} skinned primitives, ${assetBytes.length} bytes, ${sha256(assetBytes)}`,
);
