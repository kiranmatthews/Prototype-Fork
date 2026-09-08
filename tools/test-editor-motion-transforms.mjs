import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import * as THREE from "three";

// Real Editor transforms and Level construction/update/capture. Only the DOM
// drawing surface and registry persistence are replaced by deterministic
// fixtures; compare actual moving colliders, rail nodes, rope grips/velocity.
const domHarness = await readFile(new URL("./validate-editor-roundtrip.mjs", import.meta.url), "utf8");
new Function(domHarness.slice(domHarness.indexOf("function installHeadlessDom()"),
  domHarness.indexOf("\nfunction round(")) + "\ninstallHeadlessDom();")();
class Element {
  constructor(tag = "div") { this.tagName = tag.toUpperCase(); this.children = []; this.style = {}; this.dataset = {}; this.listeners = new Map(); this.textContent = ""; this.classList = { toggle() {} }; }
  set innerHTML(_value) { this.children = []; }
  appendChild(child) { this.children.push(child); return child; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  dispatch(type) { for (const fn of this.listeners.get(type) ?? []) fn({ target: this, preventDefault() {} }); }
  blur() { this.dispatch("blur"); }
}
const makeElement = document.createElement.bind(document);
document.createElement = tag => tag === "canvas" ? makeElement(tag) : new Element(tag);
const allElements = root => [root, ...root.children.flatMap(allElements)];
const clone = value => JSON.parse(JSON.stringify(value));
const fixture = components => ({ v: 1, name: "Motion transform regression", spawn: [0, 2, 0], killY: -40,
  components: [...components, { t: "platform", p: [0, -1, 0], s: [4, 1, 4] }, { t: "gate", p: [0, 0, -2] }] });
const server = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true, hmr: false, ws: false } });
let checks = 0, failures = 0;
const check = (name, callback) => {
  checks++;
  try { callback(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
};
try {
  const { Editor } = await server.ssrLoadModule("/src/editor.ts");
  const { Level, normalizeCustomLevelData, parseCustomLevelJson } = await server.ssrLoadModule("/src/level.ts");
  const editorFor = (data, count = 1) => {
    const editor = Object.create(Editor.prototype);
    Object.assign(editor, { data: clone(data), sel: Array.from({ length: count }, (_, i) => i),
      selVtxs: new Set(), resizeIdx: -1, panel: new Element(), propsEl: new Element(),
      numberGetters: new WeakMap(), commits: 0, targetId: "__motion_fixture", targetName: data.name,
      initialJson: JSON.stringify(data), initialTargetId: "__motion_fixture", lastCommitted: JSON.stringify(data),
      commit() { this.commits++; return true; }, renderProps() {},
      hooks: { rebuild() {}, resetPreview() {} },
    });
    return editor;
  };
  const build = data => new Level(new THREE.Scene(), { id: "__motion_fixture", name: data.name, data: clone(data) });
  const vectorNear = (actual, expected, message, tolerance = 1e-7) =>
    assert.ok(actual.distanceTo(expected) < tolerance,
      `${message}: actual ${actual.toArray()} expected ${expected.toArray()}`);
  const runtime = (level, t, index = 0) => t === "mover" ? level.movers[index] : t === "rail" ? level.movingRails[index] : level.ropeSwings[index];
  const offset = (item, t) => t === "mover" ? item.mesh.position.clone().sub(item.base)
    : t === "rail" ? item.object.position.clone() : item.anchor.clone().sub(item.travel.base);
  const baseComponent = t => ({ t, p: [3, 8, -9], speed: 1.3, phase: .7,
    ...(t === "mover" ? { s: [6, .8, 3], amp: 3 }
      : t === "rail" ? { amp: 3, pts: [[-2, 4, 0, 0], [2, 0, 0, 1], [-1, -6, 0, 2]], invisible: true }
        : { len: 6, amp: .8, range: 3, cycle: .6, travelPhase: 1.2 }),
  });
  function compareMotion(sourceData, editedData, t, transform, linear, grips = true) {
    assert.ok(normalizeCustomLevelData(editedData), "transformed level no longer validates");
    const source = build(sourceData), edited = build(editedData);
    try {
      const a = runtime(source, t), b = runtime(edited, t);
      for (const dt of [0, .125, .375, .5, 1, .25]) {
        source.update(dt); edited.update(dt);
        vectorNear(offset(b, t), offset(a, t).applyMatrix3(linear), `${t} travel offset`);
        if (t === "mover") {
          vectorNear(b.mesh.position, a.mesh.position.clone().applyMatrix4(transform), "moving collider position");
          vectorNear(b.lastDelta, a.lastDelta.clone().applyMatrix3(linear), "platform rider delta");
          b.mesh.updateWorldMatrix(true, false);
          vectorNear(b.mesh.getWorldPosition(new THREE.Vector3()), b.mesh.position, "collider world matrix");
        } else if (t === "rail") {
          assert.equal(a.rail.points.length, b.rail.points.length);
          b.rail.points.forEach((point, i) => vectorNear(point, a.rail.points[i].clone().applyMatrix4(transform), `grind point ${i}`));
          assert.equal(b.rail.object.children.length, 0, "invisible moving rail became visible");
        } else {
          vectorNear(b.anchor, a.anchor.clone().applyMatrix4(transform), "rope anchor");
          vectorNear(b.anchorVel, a.anchorVel.clone().applyMatrix3(linear), "ferry release velocity");
          assert.equal(b.phase, a.phase, "rotation changed swing phase");
          assert.equal(b.travel.phase, a.travel.phase, "rotation changed travel phase");
          if (grips) {
            vectorNear(edited.ropePointAt(b, 4, new THREE.Vector3()),
              source.ropePointAt(a, 4, new THREE.Vector3()).applyMatrix4(transform), "moving rope grip");
            vectorNear(edited.ropeVelAt(b, 4, new THREE.Vector3()),
              source.ropeVelAt(a, 4, new THREE.Vector3()).applyMatrix3(linear), "rope rider release velocity");
            for (const [level, rope] of [[source, a], [edited, b]]) {
              rope.pivot.updateWorldMatrix(true, true);
              vectorNear(rope.visual.endKnot.getWorldPosition(new THREE.Vector3()),
                level.ropePointAt(rope, rope.len, new THREE.Vector3()), "braided knot/contact endpoint", 1e-5);
              const ring = Math.floor(rope.visual.segments * .57), center = new THREE.Vector3();
              const positions = rope.visual.mesh.geometry.attributes.position;
              for (let side = 0; side < 12; side++) center.add(new THREE.Vector3().fromBufferAttribute(positions, ring * 13 + side));
              center.multiplyScalar(1 / 12).applyMatrix4(rope.visual.mesh.matrixWorld);
              const distance = ring / rope.visual.segments * rope.len;
              vectorNear(center, level.ropePointAt(rope, distance, new THREE.Vector3()), "braid centre/contact grip", 1e-5);
              assert.ok(Math.abs(level.ropeClosestDistance(rope, center) - distance) < .006,
                "closest-curve grab no longer meets the visible braided rope");
            }
          }
        }
      }
    } finally { source.dispose(); edited.dispose(); }
  }
  for (const quality of ["?lite", ""]) {
    window.location.search = quality;
    const mode = quality ? "lite" : "full";
    for (const t of ["mover", "rail", "ropeswing"]) {
      check(`${mode}: ${t} default/explicit signed axes follow ±90° without changing clocks`, () => {
        for (const axis of [undefined, "x", "y", "z"]) for (const travelSign of [undefined, -1]) for (const turn of [90, -90]) {
          const c = { ...baseComponent(t), ...(axis ? { axis } : {}), ...(travelSign ? { travelSign } : {}) };
          const data = fixture([c]), editor = editorFor(data); editor.rotateSelection(turn);
          const r = new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(turn));
          const pivot = new THREE.Vector3(c.p[0], 0, c.p[2]);
          const transform = new THREE.Matrix4().makeTranslation(...pivot.toArray()).multiply(r)
            .multiply(new THREE.Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
          compareMotion(data, editor.data, t, transform, new THREE.Matrix3().setFromMatrix4(r));
          assert.equal(editor.data.components[0].phase, c.phase);
          assert.equal(editor.data.components[0].travelPhase, c.travelPhase);
        }
      });
      check(`${mode}: ${t} repeated quarter turns restore motion and opposite turns cancel`, () => {
        const data = fixture([baseComponent(t)]), editor = editorFor(data);
        for (let i = 0; i < 4; i++) editor.rotateSelection(90);
        compareMotion(data, editor.data, t, new THREE.Matrix4(), new THREE.Matrix3());
        assert.equal(editor.data.components[0].travelSign, undefined, "positive default sign was unnecessarily materialized");
        editor.rotateSelection(-90); editor.rotateSelection(90);
        compareMotion(data, editor.data, t, new THREE.Matrix4(), new THREE.Matrix3());
      });
      check(`${mode}: ${t} signed group travel follows translation, rotation and world-axis scaling`, () => {
        const c = baseComponent(t), other = { t: "platform", p: [-7, 3, -1], s: [2, 1, 4] };
        const data = fixture([c, other]), editor = editorFor(data, 2);
        const pivot = new THREE.Vector3((c.p[0] + other.p[0]) / 2, 0, (c.p[2] + other.p[2]) / 2);
        const r = new THREE.Matrix4().makeRotationY(Math.PI / 2);
        editor.rotateSelection(90);
        const scale = new THREE.Vector3(2, 1, 3), anchor = new THREE.Vector3(1, -2, 3);
        editor.applyScaleNoCommit(...scale.toArray(), anchor);
        const transform = new THREE.Matrix4().makeTranslation(...anchor.toArray())
          .multiply(new THREE.Matrix4().makeScale(...scale.toArray()))
          .multiply(new THREE.Matrix4().makeTranslation(...anchor.clone().negate().toArray()))
          .multiply(new THREE.Matrix4().makeTranslation(...pivot.toArray())).multiply(r)
          .multiply(new THREE.Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
        // A circular rope swing is not an arbitrary affine deformable mesh;
        // here assert its anchor path/velocity, while rotations above assert grips.
        compareMotion(data, editor.data, t, transform, new THREE.Matrix3().setFromMatrix4(transform), false);
      });
    }
    check(`${mode}: source-owned Nightworks ferry retains independent clocks and flexible grips`, () => {
      const native = new Level(new THREE.Scene(), { id: "dark", name: "Nightworks" });
      let edited;
      try {
        const source = native.ropeSwings.find(rope => rope.travel && Math.abs(rope.travel.phase - rope.phase) > .1);
        assert.ok(source, "native phase sentinel disappeared");
        const captured = native.captureData();
        const c = captured.components.find(component => component.t === "ropeswing" && component.p[0] === -36 && component.p[2] === -202);
        assert.ok(c && c.travelPhase === Math.PI / 2, "source capture merged independent clocks");
        assert.equal(c.speed, 0, "natural length-dependent frequency became a rounded fixed speed");
        const normalized = parseCustomLevelJson(JSON.stringify(fixture([c])));
        assert.ok(normalized); edited = build(normalized);
        const rebuilt = edited.ropeSwings[0];
        for (const dt of [0, .125, .5, 1, 1, 30, .1]) {
          native.update(dt); edited.update(dt);
          vectorNear(rebuilt.anchor, source.anchor, "native ferry position");
          vectorNear(edited.ropePointAt(rebuilt, 4, new THREE.Vector3()),
            native.ropePointAt(source, 4, new THREE.Vector3()), "native ferry grip");
        }
        const scaled = editorFor(normalized); scaled.applyScaleNoCommit(1, 2, 1, new THREE.Vector3(...c.p));
        const taller = build(scaled.data);
        try { assert.equal(taller.ropeSwings[0].speed, Math.sqrt(11 / (2 * c.len)), "length edit did not retain natural rope timing"); }
        finally { taller.dispose(); }
      } finally { native.dispose(); edited?.dispose(); }
    });
    check(`${mode}: captured negative travel and independent phases survive reopening`, () => {
      for (const t of ["mover", "rail", "ropeswing"]) {
        const c = { ...baseComponent(t), travelSign: -1, axis: "z" }, data = fixture([c]);
        const native = build(data);
        try {
          native.update(.7); native.update(.2); native.builtFromData = null;
          const captured = native.captureData(), capturedMotion = captured.components.find(component => component.t === t);
          assert.equal(capturedMotion.travelSign, -1);
          if (t === "ropeswing") assert.equal(capturedMotion.travelPhase, c.travelPhase);
          compareMotion(data, fixture([capturedMotion]), t, new THREE.Matrix4(), new THREE.Matrix3());
        } finally { native.dispose(); }
      }
    });
    check(`${mode}: legacy natural rope capture retains speed zero and independent anchor clock`, () => {
      const data = fixture([{ ...baseComponent("ropeswing"), speed: 0, travelSign: -1 }]), native = build(data);
      try {
        // The current Nightworks is data-backed. Exercise the legacy helper
        // capture seam separately so its provenance does not become untested.
        native.builtFromData = null;
        const c = native.captureData().components.find(component => component.t === "ropeswing");
        assert.equal(c.speed, 0); assert.equal(c.travelPhase, 1.2); assert.equal(c.travelSign, -1);
        compareMotion(data, fixture([c]), "ropeswing", new THREE.Matrix4(), new THREE.Matrix3());
      } finally { native.dispose(); }
    });
    for (const t of ["platform", "mover", "phasepad"]) {
      check(`${mode}: asymmetric Nightworks ${t} hulls, support and torches follow group turns`, () => {
        for (const yaw of [0, 37, 90]) for (const turn of [90, -90]) {
          const c = { t, dkind: t === "platform" ? "nightplateau" : t === "mover" ? "nightsteppingrock" : "nightphaserock",
            p: [3, 8, -9], s: [6, 4, 3], yaw,
            ...(t === "mover" ? { amp: 3, axis: "x", phase: .7, speed: 1.3, lit: true }
              : t === "phasepad" ? { cycle: 4, phase: .15, amp: .55 } : {}) };
          const data = fixture([c, { t: "platform", p: [-7, 3, -1], s: [2, 1, 4] }]), editor = editorFor(data, 2);
          editor.rotateSelection(turn);
          assert.deepEqual(editor.data.components[0].s, c.s, "rock yaw and size were both rotated");
          const pivot = new THREE.Vector3(-2, 0, -5);
          const transform = new THREE.Matrix4().makeTranslation(...pivot.toArray())
            .multiply(new THREE.Matrix4().makeRotationY(THREE.MathUtils.degToRad(turn)))
            .multiply(new THREE.Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
          const a = build(data), b = build(editor.data);
          try {
            const source = a.nightworksRocks.solids[0].mesh, target = b.nightworksRocks.solids[0].mesh;
            for (const dt of [0, .25, .5, 2]) {
              a.update(dt); b.update(dt); a.root.updateMatrixWorld(true); b.root.updateMatrixWorld(true);
              const p = source.geometry.attributes.position, q = target.geometry.attributes.position;
              assert.equal(p.count, q.count);
              for (let i = 0; i < p.count; i++)
                vectorNear(new THREE.Vector3().fromBufferAttribute(q, i).applyMatrix4(target.matrixWorld),
                  new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(source.matrixWorld).applyMatrix4(transform),
                  `rock hull vertex ${i}`, .00005);
              assert.equal(a.groundMeshes.includes(source), b.groundMeshes.includes(target), "phase collision timing changed");
              const ray = new THREE.Raycaster(source.position.clone().add(new THREE.Vector3(0, 20, 0)), new THREE.Vector3(0, -1, 0));
              const before = ray.intersectObject(source, false)[0]; assert.ok(before, "source rock has no supported top");
              const expected = before.point.clone().applyMatrix4(transform);
              ray.set(expected.clone().add(new THREE.Vector3(0, 20, 0)), new THREE.Vector3(0, -1, 0));
              const after = ray.intersectObject(target, false)[0]; assert.ok(after, "rotated rock lost supported top");
              vectorNear(after.point, expected, "rotated support ray", .00005);
              assert.equal(a.torches.length, b.torches.length);
              a.torches.forEach((torch, i) => {
                vectorNear(b.torches[i].group.position, torch.group.position.clone().applyMatrix4(transform), "rock brazier");
                vectorNear(b.torches[i].lightAt, torch.lightAt.clone().applyMatrix4(transform), "rock moving light");
              });
            }
          } finally { a.dispose(); b.dispose(); }
        }
      });
      check(`${mode}: rotated Nightworks ${t} supports nonuniform world-axis scaling`, () => {
        const c = { t, dkind: t === "platform" ? "nightplateau" : t === "mover" ? "nightsteppingrock" : "nightphaserock",
          p: [3, 8, -9], s: [6, 4, 3], yaw: 0, ...(t === "mover" ? { amp: 3, phase: .7, speed: 1.3 } : {}) };
        const data = fixture([c]), rotated = editorFor(data); rotated.rotateSelection(90);
        const scaled = editorFor(rotated.data), anchor = new THREE.Vector3(...c.p), scale = new THREE.Vector3(2, 1.5, 3);
        scaled.applyScaleNoCommit(...scale.toArray(), anchor);
        const transform = new THREE.Matrix4().makeTranslation(...anchor.toArray())
          .multiply(new THREE.Matrix4().makeScale(...scale.toArray()))
          .multiply(new THREE.Matrix4().makeTranslation(...anchor.clone().negate().toArray()));
        const a = build(rotated.data), b = build(scaled.data);
        try {
          a.update(0); b.update(0);
          const source = a.nightworksRocks.solids[0].mesh, target = b.nightworksRocks.solids[0].mesh;
          source.updateWorldMatrix(true, false); target.updateWorldMatrix(true, false);
          const p = source.geometry.attributes.position, q = target.geometry.attributes.position;
          for (let i = 0; i < p.count; i++)
            vectorNear(new THREE.Vector3().fromBufferAttribute(q, i).applyMatrix4(target.matrixWorld),
              new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(source.matrixWorld).applyMatrix4(transform), "scaled rock hull", .00005);
        } finally { a.dispose(); b.dispose(); }
      });
    }
    check(`${mode}: diagonal moving rock ridge keeps its signed grind line over its collider`, () => {
      for (const yaw of [0, 45, 90, 137]) for (const travelSign of [1, -1]) {
        const c = { t: "rail", dkind: "nightrockridge", p: [3, 8, -9], len: 12, yaw, axis: "x", amp: 3, phase: .7, speed: 1.3, travelSign };
        const data = fixture([c]), editor = editorFor(data); editor.rotateSelection(90);
        const a = build(data), b = build(editor.data);
        try {
          const pivot = new THREE.Vector3(c.p[0], 0, c.p[2]);
          const transform = new THREE.Matrix4().makeTranslation(...pivot.toArray())
            .multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2))
            .multiply(new THREE.Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
          for (const dt of [0, .25, .5, 1]) {
            a.update(dt); b.update(dt);
            for (const level of [a, b]) {
              const rail = level.movingRails[0], mover = level.movers[0], p = mover.mesh.geometry.attributes.position;
              vectorNear(mover.mesh.position.clone().sub(mover.base), rail.object.position, "ridge solid and grind travel separated");
              const along = rail.rail.points.at(-1).clone().sub(rail.rail.points[0]).normalize(), across = new THREE.Vector3(-along.z, 0, along.x);
              let crossMin = Infinity, crossMax = -Infinity, alongMin = Infinity, alongMax = -Infinity;
              for (let i = 0; i < p.count; i++) {
                const vertex = new THREE.Vector3().fromBufferAttribute(p, i), cross = vertex.dot(across), forward = vertex.dot(along);
                crossMin = Math.min(crossMin, cross); crossMax = Math.max(crossMax, cross);
                alongMin = Math.min(alongMin, forward); alongMax = Math.max(alongMax, forward);
              }
              assert.ok(crossMax - crossMin < 1 && alongMax - alongMin > 8, "rock hull crossed its grind line at edited yaw");
            }
            const source = a.movers[0].mesh, target = b.movers[0].mesh;
            source.updateWorldMatrix(true, false); target.updateWorldMatrix(true, false);
            const p = source.geometry.attributes.position, q = target.geometry.attributes.position;
            for (let i = 0; i < p.count; i++) vectorNear(new THREE.Vector3().fromBufferAttribute(q, i).applyMatrix4(target.matrixWorld),
              new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(source.matrixWorld).applyMatrix4(transform), "rotated ridge hull", .00005);
            b.movingRails[0].rail.points.forEach((point, i) => vectorNear(point,
              a.movingRails[0].rail.points[i].clone().applyMatrix4(transform), "rotated ridge grind point"));
          }
        } finally { a.dispose(); b.dispose(); }
      }
    });
  }
  check("travel schema rejects wrong types, excessive phase and unsupported component owners", () => {
    for (const travelSign of [0, 2, -2, true, "-1", null, [], {}])
      assert.equal(normalizeCustomLevelData(fixture([{ ...baseComponent("mover"), travelSign }])), null);
    for (const travelPhase of [100001, -100001, true, "1", null, [], {}])
      assert.equal(normalizeCustomLevelData(fixture([{ ...baseComponent("ropeswing"), travelPhase }])), null);
    assert.equal(normalizeCustomLevelData(fixture([{ t: "platform", p: [0, 0, 0], travelSign: -1 }])), null);
    assert.equal(normalizeCustomLevelData(fixture([{ ...baseComponent("mover"), travelPhase: 1 }])), null);
    for (const t of ["mover", "rail", "ropeswing"])
      assert.ok(normalizeCustomLevelData(fixture([{ ...baseComponent(t), travelSign: 1 }])));
  });
  check("sparse motion inspectors remain pure and expose effective travel direction/phase", () => {
    for (const t of ["mover", "rail", "ropeswing"]) {
      const c = t === "ropeswing" ? { t, p: [0, 8, 0], range: 3, phase: .7 } : { t, p: [0, 8, 0], amp: 3 };
      const data = fixture([c]), editor = editorFor(data);
      editor.renderProps = Editor.prototype.renderProps;
      const before = JSON.stringify(editor.data); editor.renderProps();
      assert.equal(JSON.stringify(editor.data), before);
      const nodes = allElements(editor.propsEl);
      const direction = nodes.find(node => node.tagName === "BUTTON" && /^(travel|ferry):/.test(node.textContent));
      assert.ok(direction); direction.dispatch("click"); assert.equal(editor.data.components[0].axis, "z");
      const reversal = allElements(editor.propsEl).find(node => node.children[0]?.textContent === "reverse travel").children[1];
      reversal.checked = true; reversal.dispatch("change"); assert.equal(editor.data.components[0].travelSign, -1);
      reversal.checked = false; reversal.dispatch("change"); assert.equal(editor.data.components[0].travelSign, undefined);
      if (t === "ropeswing") {
        const phase = allElements(editor.propsEl).find(node => node.children[0]?.textContent === "ferry phase").children[1];
        assert.equal(Number(phase.value), .7); phase.value = "1.2"; phase.dispatch("change");
        assert.equal(editor.data.components[0].phase, .7); assert.equal(editor.data.components[0].travelPhase, 1.2);
      }
    }
  });
  check("sparse rock mover/phase inspectors expose actual dimensions and yaw without changing box defaults", () => {
    for (const t of ["platform", "mover", "phasepad"]) {
      const data = fixture([{ t, dkind: "nightsteppingrock", p: [0, 8, 0] }]), editor = editorFor(data);
      editor.renderProps = Editor.prototype.renderProps;
      const before = JSON.stringify(editor.data); editor.renderProps(); assert.equal(JSON.stringify(editor.data), before);
      assert.deepEqual(editor.defaultSizeFor(editor.data.components[0]), [5, 4, 5]);
      const fields = allElements(editor.propsEl);
      const width = fields.find(node => node.children[0]?.textContent === "width").children[1];
      const yaw = fields.find(node => node.children[0]?.textContent === "yaw °").children[1];
      assert.equal(Number(width.value), 5); assert.equal(Number(yaw.value), 0);
      width.value = "7"; width.dispatch("change"); assert.deepEqual(editor.data.components[0].s, [7, 4, 5]);
      yaw.value = "37"; yaw.dispatch("change"); assert.equal(editor.data.components[0].yaw, 37);
    }
    for (const t of ["mover", "phasepad"]) {
      const editor = editorFor(fixture([{ t, p: [0, 0, 0], s: [6, 2, 3] }]));
      editor.rotateSelection(90); assert.deepEqual(editor.data.components[0].s, [3, 2, 6]);
      assert.equal(editor.data.components[0].yaw, undefined, "ordinary box gained unsupported yaw");
    }
  });
} finally { await server.close(); }
console.log(`${checks - failures}/${checks} editor motion transform regressions passed`);
if (failures) process.exitCode = 1;
