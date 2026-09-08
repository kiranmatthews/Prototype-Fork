import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "vite";
import * as THREE from "three";

// Reuse the same DOM-only shim as the Level roundtrip harness. All scene
// construction, meshes, transforms, materials and raycasts below are real.
const harness = await readFile(new URL("./validate-editor-roundtrip.mjs", import.meta.url), "utf8");
new Function(harness.slice(harness.indexOf("function installHeadlessDom()"),
  harness.indexOf("\nfunction round(")) + "\ninstallHeadlessDom();")();
const server = await createServer({ appType: "custom", logLevel: "silent",
  server: { middlewareMode: true, hmr: false, ws: false } });
const clone = value => JSON.parse(JSON.stringify(value));
const sampleData = components => ({ v: 1, name: "Scenery transform sentinel", spawn: [0, 1, 0], killY: -30,
  components: [...components, { t: "platform", p: [0, -1, 0], s: [4, 1, 4] }, { t: "gate", p: [0, 0, -2] }] });
const requiredRoles = ["centre line", "edge line", "barrier beam", "barrier post scenery", "rock face",
  "hillside", "crag", "sea cliff", "high ridge", "bay island"];
let checks = 0, failures = 0;
const check = (label, run, quiet = false) => {
  checks++;
  try { run(); if (!quiet) console.log(`PASS ${label}`); }
  catch (error) { failures++; console.error(`FAIL ${label}: ${error.stack}`); }
};
const triangles = meshes => {
  const result = [];
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const g = mesh.geometry, normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < (g.index?.count ?? p.count); i++) {
      const vertex = g.index ? g.index.getX(i) : i;
      result.push({ p: new THREE.Vector3().fromBufferAttribute(p, vertex).applyMatrix4(mesh.matrixWorld),
        n: n ? new THREE.Vector3().fromBufferAttribute(n, vertex).applyNormalMatrix(normalMatrix) : null });
    }
  }
  return result;
};
const assertTriangles = (actual, expected, label, transform = null) => {
  assert.equal(actual.length, expected.length, `${label}: triangle corners were lost or duplicated`);
  const normalMatrix = transform && new THREE.Matrix3().getNormalMatrix(transform);
  for (let i = 0; i < actual.length; i++) {
    const point = transform ? expected[i].p.clone().applyMatrix4(transform) : expected[i].p;
    // Source batches store absolute Float32 coordinates across a 2.5km road;
    // editor meshes retain double-precision anchors and Float32 local offsets.
    assert.ok(actual[i].p.distanceTo(point) < 0.0003, `${label}: corner ${i} moved ${actual[i].p.distanceTo(point)}m`);
    assert.ok(actual[i].n && expected[i].n, `${label}: missing surface normal`);
    const normal = normalMatrix ? expected[i].n.clone().applyNormalMatrix(normalMatrix) : expected[i].n;
    assert.ok(actual[i].n.distanceTo(normal) < 0.000003, `${label}: corner ${i} changed its shading normal`);
  }
};
const assertMaterial = (actual, expected, label) => {
  assert.equal(actual.type, expected.type, `${label}: lighting model changed`);
  for (const key of ["color", "emissive"])
    assert.ok(Math.max(...["r", "g", "b"].map(axis => Math.abs(actual[key][axis] - expected[key][axis]))) < 0.000001,
      `${label}: ${key} changed`);
  for (const key of ["side", "opacity", "transparent", "fog", "depthTest", "depthWrite", "alphaTest", "vertexColors", "blending"])
    assert.equal(actual[key], expected[key], `${label}: ${key} changed`);
  if (expected.map) assert.equal(actual.map, expected.map, `${label}: texture was replaced`);
  else assert.ok(!actual.map || actual.userData.texKind === "solid", `${label}: untextured scenery gained a patterned texture`);
};
const allMeshes = level => { const out = []; level.pickRoot.traverse(object => { if (object.isMesh) out.push(object); }); return out; };
const pineMeshes = (level, role) => allMeshes(level).filter(mesh => mesh.name === `pine ${role}` ||
  (mesh.userData.editorIdx === 0 && mesh.material?.color?.getHex() === (role === "trunk" ? 0x6b4a2e : 0x2e6b34)));
try {
  const api = await server.ssrLoadModule("/src/level.ts");
  const build = data => new api.Level(new THREE.Scene(), { id: "scenery-regression", name: data.name, data: clone(data) });
  for (const query of ["?lite", ""]) {
    window.location.search = query;
    api.setEditorBuild(false);
    const quality = query ? "lite" : "full";
    const source = new api.Level(new THREE.Scene(), { id: "descent", name: "The Descent" });
    let rebuilt;
    try {
      const captured = source.captureData(), normalized = api.normalizeCustomLevelData(captured);
      const mesh = captured.components.filter(c => c.t === "mesh");
      const summary = { quality, sourceScenery: source.capturedSceneryMeshes.length,
        sceneryCount: mesh.filter(c => c.solid === false).length,
        vertices: mesh.reduce((sum,c)=>sum+c.vertices.length/3,0),
        triangles: mesh.reduce((sum,c)=>sum+(c.indices?.length??c.vertices.length)/3,0),
        pineCount: captured.components.filter(c=>c.dkind==='pine').length,
        bytes: new TextEncoder().encode(JSON.stringify(captured)).byteLength };
      console.log(`Descent export ${JSON.stringify(summary)}`);
      if (process.env.LEGACY_SCENERY_DIAGNOSTICS)
        await writeFile(`${process.env.LEGACY_SCENERY_DIAGNOSTICS}/descent-capture-${quality}.json`,JSON.stringify(captured));
      check(`${quality}: complete source export stays within existing interchange budgets`, () => {
        assert.ok(normalized, "complete Descent capture was rejected although its individual components are valid");
        assert.ok(summary.bytes <= api.MAX_LEVEL_FILE_BYTES);
        assert.ok(summary.vertices <= 100_000 && summary.triangles <= 100_000);
        assert.ok(api.parseCustomLevelJson(JSON.stringify(captured)), "export cannot be parsed for sharing");
        assert.deepEqual(api.normalizeCustomLevelData(normalized), normalized, "source export changes on reopening");
        assert.equal(summary.pineCount, 214, "native roadside pine placements were lost");
      });
      rebuilt = build(normalized ?? captured);
      const data = normalized ?? captured;
      const capturedEntries = data.components.map((c,index)=>({c,index})).filter(({c})=>c.t==='mesh'&&c.solid===false);
      const rebuiltMeshes = allMeshes(rebuilt);
      check(`${quality}: every native scenery owner has editable components and a declared group`, () => {
        for (const {c} of capturedEntries) assert.ok(data.groups.some(group=>group.id===c.grp));
        for (const name of requiredRoles) assert.ok(source.capturedSceneryMeshes.some(mesh=>mesh.name===name), `missing source role ${name}`);
      });
      // Groups may intentionally share multiple visual/collision owners. Match
      // consecutive chunk triangle spans, not a one-mesh-per-group assumption.
      let cursor=0;
      source.capturedSceneryMeshes.forEach((original,i)=>check(`${quality}: ${original.name} ${i+1} triangle/material/collision fidelity`,()=>{
        const expected=triangles([original]), entries=[];
        let corners=0;
        while(corners<expected.length&&cursor<capturedEntries.length){
          const entry=capturedEntries[cursor++]; entries.push(entry);
          corners+=entry.c.indices?.length??entry.c.vertices.length/3;
        }
        assert.equal(corners,expected.length,"native geometry chunk boundary changed");
        const actual=entries.map(({c,index})=>{
          assert.equal(c.nm,original.name); assert.equal(c.solid,false); assert.equal(c.edgeGrinding,false);
          const object=rebuiltMeshes.find(mesh=>mesh.userData.editorIdx===index&&mesh.name===c.nm);
          assert.ok(object,"captured scenery did not rebuild");
          assert.ok(!rebuilt.groundMeshes.includes(object),"visual scenery became standable ground");
          assertMaterial(object.material,original.material,original.name); return object;
        });
        assertTriangles(triangles(actual),expected,original.name);
      },true));
      check(`${quality}: scenery capture contains no extra or duplicated owners`,()=>assert.equal(cursor,capturedEntries.length));
      check(`${quality}: wall and guardrail visual owners retain their physical assemblies`,()=>{
        const mountains=data.groups.filter(group=>group.nm?.startsWith("Mountain wall "));
        const barriers=data.groups.filter(group=>group.nm?.endsWith("guardrail"));
        assert.ok(mountains.length>1); assert.equal(barriers.length,2);
        for(const group of mountains){
          const members=data.components.filter(c=>c.grp===group.id);
          assert.ok(members.some(c=>c.t==='mesh'&&c.nm==='rock face'));
          assert.ok(members.some(c=>c.t==='wall'&&c.invisible));
          assert.equal(group.editorOnly,true);
        }
        for(const group of barriers){
          const members=data.components.filter(c=>c.grp===group.id);
          assert.ok(members.some(c=>c.t==='mesh'&&c.nm==='barrier beam'));
          assert.ok(members.some(c=>c.t==='mesh'&&c.nm==='barrier post scenery'));
          assert.equal(members.filter(c=>c.t==='rail').length,1);
        }
      });
      for(const kind of ["Mountain wall ","Sea-side guardrail"]){
        const group=data.groups.find(group=>group.nm?.startsWith(kind));
        const members=data.components.filter(c=>c.grp===group.id).map(clone);
        const before=build({...sampleData(members),groups:[clone(group)]});
        const delta=new THREE.Vector3(1000,7,1000);
        const moved=members.map(c=>({...clone(c),p:c.p.map((v,i)=>v+delta.getComponent(i))}));
        const after=build({...sampleData(moved),groups:[clone(group)]});
        try{check(`${quality}: moving ${kind} carries collision or grind geometry`,()=>{
          const transform=new THREE.Matrix4().makeTranslation(...delta.toArray());
          assertTriangles(triangles(allMeshes(after).filter(m=>m.userData.editorIdx<members.length&&m.userData.visualOnly)),
            triangles(allMeshes(before).filter(m=>m.userData.editorIdx<members.length&&m.userData.visualOnly)),kind,transform);
          for(const c of moved.filter(c=>c.t==='wall')){
            const expected=new THREE.Box3(new THREE.Vector3(c.p[0]-c.s[0]/2,c.p[1],c.p[2]-c.s[2]/2),
              new THREE.Vector3(c.p[0]+c.s[0]/2,c.p[1]+c.s[1],c.p[2]+c.s[2]/2));
            assert.ok(after.walls.some(box=>box.min.distanceTo(expected.min)<1e-6&&box.max.distanceTo(expected.max)<1e-6));
          }
          const rail=members.find(c=>c.t==='rail');
          if(rail){
            assert.equal(after.rails.length,before.rails.length);
            const original=before.rails.find(r=>r.points.length===rail.pts.length);
            const shifted=after.rails.find(r=>r.points.length===rail.pts.length);
            assert.ok(original&&shifted); original.points.forEach((point,i)=>assert.ok(shifted.points[i].distanceTo(point.clone().add(delta))<1e-5));
          }
        });}finally{after.dispose();before.dispose();}
      }
      for (const role of ["trunk", "crown"]) check(`${quality}: native pine ${role} capture preserves geometry and materials`, () => {
        const original = pineMeshes(source, role), actual = pineMeshes(rebuilt, role);
        assert.ok(original.length && actual.length, "native pine meshes are missing");
        assert.equal(original[0].material.color.getHex(), role === "trunk" ? 0x6b4a2e : 0x2e6b34,
          "pine owner changed the source palette");
        assertTriangles(triangles(actual), triangles(original), `native pine ${role}`);
        for (const object of actual) assertMaterial(object.material, original[0].material, `pine ${role}`);
      });
      for (const editorMode of [false, true]) {
        api.setEditorBuild(editorMode);
        const original = clone(captured.components.find(c => c.dkind === "pine"));
        const changed = { ...clone(original), p: original.p.map((v,i)=>v+[5,2,-7][i]), yaw: original.yaw+73, w: original.w*1.4 };
        const before = build(sampleData([original])), after = build(sampleData([changed]));
        try {
          check(`${quality}: pine move/yaw/scale preserves its owner in ${editorMode ? "editor" : "play"}`, () => {
            const transform = new THREE.Matrix4().makeTranslation(...changed.p)
              .multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(73)))
              .multiply(new THREE.Matrix4().makeScale(1.4,1.4,1.4))
              .multiply(new THREE.Matrix4().makeTranslation(...original.p.map(v=>-v)));
            for (const role of ["trunk","crown"])
              assertTriangles(triangles(pineMeshes(after,role)), triangles(pineMeshes(before,role)), `moved pine ${role}`, transform);
            assert.deepEqual(after.captureData().components.find(c=>c.dkind==='pine'), changed);
            for (const role of ["trunk","crown"])
              assert.ok(pineMeshes(after,role).every(mesh=>!after.groundMeshes.includes(mesh)), "pine foliage became ground");
          });
        } finally { after.dispose(); before.dispose(); }
      }
      api.setEditorBuild(false);
      for (const name of requiredRoles) {
        const component = clone(captured.components.find(c=>c.t==='mesh'&&c.solid===false&&c.nm===name));
        component.p=[5000,100,5000]; delete component.grp;
        const isolated = build(sampleData([component]));
        const baseline = build(sampleData([]));
        try {
          check(`${quality}: ${name} remains pickable without phantom ground or grind collision`, () => {
            const object = allMeshes(isolated).find(mesh=>mesh.userData.editorIdx===0 && mesh.name===name);
            assert.ok(object);
            const corners = triangles([object]);
            let point, normal;
            for (let i=0;i<corners.length;i+=3) {
              const [a,b,c]=corners.slice(i,i+3).map(v=>v.p);
              normal=b.clone().sub(a).cross(c.clone().sub(a));
              if (normal.length()>0.000001) { normal.normalize(); point=a.clone().add(b).add(c).multiplyScalar(1/3); break; }
            }
            assert.ok(point, "scenery contains no pickable triangle");
            const ray=new THREE.Raycaster(point.clone().addScaledVector(normal,2),normal.clone().negate());
            assert.ok(ray.intersectObject(object,false).length,"editor cannot pick the moved scenery");
            assert.equal(ray.intersectObjects(isolated.groundMeshes,false).length,0,"a visual-only mesh catches gameplay ground rays");
            assert.equal(isolated.groundMeshes.length,baseline.groundMeshes.length);
            assert.equal(isolated.walls.length,baseline.walls.length);
            assert.equal(isolated.rails.length,baseline.rails.length);
          });
        } finally { isolated.dispose(); baseline.dispose(); }
      }
    } finally { rebuilt?.dispose(); source.dispose(); api.setEditorBuild(false); }
  }
} finally { await server.close(); }
console.log(`${checks-failures}/${checks} legacy scenery capture checks passed`);
if (failures) process.exitCode=1;
