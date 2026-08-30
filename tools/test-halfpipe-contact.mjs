import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as THREE from "three";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = await readFile(`${root}src/halfpipe.ts`, "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const module = { exports: {} };
new Function("module", "exports", "require", output)(
  module,
  module.exports,
  (specifier) => {
    if (specifier === "three") return THREE;
    throw new Error(`unexpected halfpipe import: ${specifier}`);
  },
);
const { Halfpipe } = module.exports;

const meshIntersectionSource = await readFile(
  `${root}src/meshIntersections.ts`,
  "utf8",
);
const meshIntersectionOutput = ts.transpileModule(meshIntersectionSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const meshIntersectionModule = { exports: {} };
new Function("module", "exports", "require", meshIntersectionOutput)(
  meshIntersectionModule,
  meshIntersectionModule.exports,
  (specifier) => {
    if (specifier === "three") return THREE;
    throw new Error(`unexpected mesh-intersection import: ${specifier}`);
  },
);
const { boxIntersectsMeshTriangles } = meshIntersectionModule.exports;

const pipe = new Halfpipe(
  -10,
  10,
  0,
  3,
  6,
  new THREE.MeshBasicMaterial(),
);
const cross = 6;
const u = pipe.crossToU(cross);
const surfaceY = pipe.surfaceY(u);

assert.equal(pipe.isRideSide(cross, surfaceY + 0.5), true);
assert.equal(pipe.isRideSide(cross, surfaceY), true);
assert.equal(pipe.isRideSide(cross, surfaceY - 0.04), true);
assert.equal(pipe.isRideSide(cross, surfaceY - 0.5), false);
assert.equal(pipe.isRideSide(pipe.lipX + 0.2, pipe.lipY - 1), false);
assert.equal(pipe.isRideSide(pipe.lipX + 2, pipe.lipY + 0.1), true);
assert.equal(pipe.isRideSide(0, pipe.yBottom - 0.5), false);

const validCrossing = pipe.rideSideCrossing(
  cross,
  surfaceY + 0.5,
  cross,
  surfaceY - 0.5,
);
assert.ok(validCrossing);
assert.ok(validCrossing.pen > 0);
assert.ok(
  pipe.rideSideCrossing(
    pipe.lipX + 0.2,
    pipe.lipY + 0.5,
    pipe.lipX - 0.1,
    pipe.lipY - 1.5,
  ),
  "air above the coping must retain a legitimate drop-in catch",
);
assert.equal(
  pipe.rideSideCrossing(
    cross,
    surfaceY - 0.5,
    cross,
    surfaceY - 0.75,
  ),
  null,
  "an under-shell sample must not become an analytic catch",
);
assert.equal(
  pipe.rideSideCrossing(
    pipe.lipX + 0.2,
    pipe.lipY - 1,
    pipe.lipX - 0.1,
    pipe.lipY - 1,
  ),
  null,
  "a behind-coping sample must not become an analytic catch",
);
assert.equal(
  pipe.rideSideCrossing(
    cross,
    surfaceY + 0.5,
    cross,
    surfaceY - pipe.radius,
  ),
  null,
  "a deeply buried sample is not a one-step crossing",
);

const triangleGeometry = new THREE.BufferGeometry();
triangleGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 0, 0, 1], 3),
);
const triangleMesh = new THREE.Mesh(
  triangleGeometry,
  new THREE.MeshBasicMaterial(),
);
assert.equal(
  boxIntersectsMeshTriangles(
    new THREE.Box3(
      new THREE.Vector3(-0.1, -0.1, -0.1),
      new THREE.Vector3(0.1, 0.1, 0.1),
    ),
    triangleMesh,
  ),
  true,
);
assert.equal(
  boxIntersectsMeshTriangles(
    new THREE.Box3(
      new THREE.Vector3(3, -0.1, 3),
      new THREE.Vector3(4, 0.1, 4),
    ),
    triangleMesh,
  ),
  false,
);
triangleMesh.position.set(4, 0, 4);
assert.equal(
  boxIntersectsMeshTriangles(
    new THREE.Box3(
      new THREE.Vector3(3.9, -0.1, 3.9),
      new THREE.Vector3(4.1, 0.1, 4.1),
    ),
    triangleMesh,
  ),
  true,
  "mesh world transforms must participate in authoring-time collision checks",
);

console.log(
  "Validated concave halfpipe support, rejection of backside catches, and exact collider/mesh intersection checks.",
);
