import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import { Vector3 } from "three";

// Exercise the real parser/storage boundary; no WebGL or network is needed.
const storage = new Map();
let denyWrites = false;
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem(key, value) {
    if (denyWrites) throw new Error("quota exceeded");
    storage.set(key, String(value));
  },
  removeItem: (key) => storage.delete(key),
};
globalThis.window = { location: { search: "?lite" }, addEventListener() {} };
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: "custom", logLevel: "silent" });
let checks = 0;
try {
  const api = await server.ssrLoadModule("/src/level.ts");
  const {
    normalizeCustomLevelData: normalize, parseCustomLevelJson: parse,
    normalizeUserLevelEntries, setUserLevels, getUserLevels, levelJsonTextWithinLimits,
    MAX_LEVEL_FILE_BYTES, MAX_LEVEL_PACK_BYTES, MAX_USER_LEVELS,
  } = api;
  const base = () => ({ v: 1, name: "Shared course", spawn: [0, 1, 0], killY: -20,
    components: [{ t: "platform", p: [0, 0, 0], s: [20, 1, 30] },
      { t: "gate", p: [0, 0.5, -10] }] });
  const reject = (value, reason) => {
    assert.equal(normalize(value), null, reason);
    checks++;
  };
  const rejectComponent = (component, reason) => reject({ ...base(), components: [component] }, reason);
  assert.ok(normalize(base()));
  const original = base();
  const copy = normalize(original);
  copy.components[0].p[0] = 100;
  assert.equal(original.components[0].p[0], 0, "validation must isolate caller-owned data");
  assert.deepEqual(normalize(normalize(base())), normalize(base()), "migration must stay idempotent");
  const oldMap={...base(),components:[{t:'worldmap',p:[0,0,0],pts:api.worldMapComponentPoints().slice(0,9)}]};
  const expanded=normalize(oldMap);
  assert.equal(expanded.components[0].pts.length,11,'legacy editable map lost its new branch hubs');
  assert.deepEqual(expanded.components[0].pts.slice(0,9),oldMap.components[0].pts,'legacy hub identities shifted');
  assert.deepEqual(normalize(expanded),expanded,'map expansion must be idempotent');
  assert.equal(oldMap.components[0].pts.length,9,'normalizing mutated the original map');
  const unchangedMap={...oldMap,components:[{t:'worldmap',p:[0,0,0],pts:[[-45,27,0,1.35],[-30,18,0,1.75],[-14,28,0,3.1],[-13,7,0,2.55],[-29,-3,0,5.25],[13,2,0,1.35],[27,16,0,1.75],[46,5,0,3.05],[32,-13,0,5.1]]}]};
  assert.deepEqual(normalize(unchangedMap).components[0].pts,api.worldMapComponentPoints(),'unchanged old defaults masked the new layout');
  const priorBranchMap={...oldMap,components:[{t:'worldmap',p:[0,0,0],pts:[[-63,18,0,1.35],[-44,18,0,1.75],[-26,18,0,2.1],[-44,-3,0,2.55],[-9,18,0,2.85],[23,16,0,1.35],[42,14,0,1.75],[61,14,0,2.4],[79,14,0,3.1],[-26,-3,0,2.85],[42,26,0,2.3]]}]};
  assert.deepEqual(normalize(priorBranchMap).components[0].pts,api.worldMapComponentPoints(),'old default map capture masked the island expansion');
  const authoredBranchMap=structuredClone(priorBranchMap);authoredBranchMap.components[0].pts[0][0]+=1;
  assert.deepEqual(normalize(authoredBranchMap).components[0].pts,authoredBranchMap.components[0].pts,'island expansion overwrote custom hub positions');
  const occupied=structuredClone(oldMap);occupied.components[0].pts[0]=api.worldMapComponentPoints()[9];
  const occupiedMigrated=normalize(occupied);
  assert.deepEqual(occupiedMigrated.components[0].pts.slice(0,9),occupied.components[0].pts);
  assert.deepEqual(normalize(occupiedMigrated),occupiedMigrated,'new hubs collided with custom old positions');
  assert.ok(!api.BUILTIN_LEVELS.some(e=>e.id==='jungle-cliff'));
  assert.equal(setUserLevels([{id:'jungle-cliff',name:'Jungle Cliff',data:base()}]),true);
  assert.equal(api.findLevel('jungle-cliff'),null,'stored override resurrected retired level');
  assert.ok(!api.levelList().some(e=>e.id==='jungle-cliff'));
  assert.equal(getUserLevels()[0].id,'jungle-cliff','retirement erased recoverable user data');
  setUserLevels([]);

  // Accept/reopen must obey one contract. Legacy migration adds mandatory
  // furniture and per-node widths; validate its result, not only its input.
  for (const spawn of [[100_000, 1, 0], [-100_000, 1, 0], [0, 1, -100_000]])
    reject({ ...base(), spawn }, "migration placed required furniture outside coordinate limits");
  reject({ ...base(), components: [{ t: "platform", p: [0, 100_000, 0], s: [8, 2, 8] }] },
    "migration placed default gate above coordinate limits");
  reject({ ...base(), components: Array.from({ length: 10_000 }, () => ({ t: "platform", p: [0, 0, 0] })) },
    "migration exceeded component count");
  const nearComponentLimit = { ...base(), components: Array.from({ length: 9997 }, () => ({ t: "platform", p: [0, 0, 0] })) };
  const canonicalLimit = normalize(nearComponentLimit);
  assert.ok(canonicalLimit, "limit must still allow the three required objects");
  assert.equal(canonicalLimit.components.length, 10_000);
  assert.deepEqual(normalize(canonicalLimit), canonicalLimit, "accepted limit cannot fail on reopen");
  const retitledLegacy = parse(JSON.stringify({ name: "Test Course", data: { ...base(),
    components: [{ t: "enemy", p: [0, -252, 4] }] } }));
  assert.ok(retitledLegacy);
  assert.deepEqual(normalize(retitledLegacy), retitledLegacy, "wrapper title must not defer source repairs until the next open");

  // Prototype pollution, stored payloads and hooks cannot survive the boundary.
  for (const key of ["__proto__", "prototype", "constructor"]) {
    for (const target of ["level", "component", "group", "environment"]) {
      const data = base();
      const hostile = JSON.parse(`{"${key}":{"polluted":true}}`);
      if (target === "level") Object.assign(data, Object.fromEntries(Object.entries(hostile)));
      if (target === "component") Object.defineProperty(data.components[0], key, { value: hostile[key], enumerable: true });
      if (target === "group") data.groups = [{ id: 1, ...hostile }];
      if (target === "environment") data.ocean = { p: [0, 0, 0], length: 20, width: 30, seaward: 1, ...hostile };
      reject(data, `${key} in ${target} was accepted`);
    }
  }
  assert.equal({}.polluted, undefined);
  reject({ ...base(), payload: "<script>alert(1)</script>" }, "unknown level field");
  rejectComponent({ t: "platform", p: [0, 0, 0], url: "https://evil.example/asset" }, "arbitrary URL field");
  reject({ ...base(), jungleAtmosphere: "false" }, "mistyped atmosphere flag");
  reject({ ...base(), name: "x".repeat(121) }, "unbounded level title");
  rejectComponent({ t: "decor", dkind: "vines", p: [0, 0, 0], n: 100_000 }, "strand expansion");
  for (const [dkind, s] of [
    ["templeplatform", [100_000, 1, 100_000]],
    ["templewall", [100_000, 100_000, 1]],
    ["templewall", [100_000, 0.0001, 1]],
    ["roofedtemple", [100_000, 100_000, 100_000]],
    ["hangingarch", [100_000, 100_000, 1]],
  ]) rejectComponent({ t: "decor", dkind, p: [0, 0, 0], s }, "masonry assembly expansion");
  reject({ ...base(), components: Array.from({ length: 1000 }, () => ({
    t: "decor", dkind: "roofedtemple", p: [0, 0, 0],
  })) }, "aggregate masonry assembly expansion");
  // Bound estimates are checked against real builder output over varied
  // dimensions, damage variants and floor choices; no WebGL is involved.
  const assemblies = await server.ssrLoadModule("/src/jungleAssemblies.ts");
  for (const dkind of assemblies.JUNGLE_ASSEMBLY_KINDS) {
    for (const s of [undefined, [0.1, 0.1, 0.1], [2.25, 0.8, 2], [9, 10, 8],
      [21, 12, 13], [40, 0.9, 28], [18, 35, 32], [0.4, 40, 1], [80, 0.2, 0.4]]) {
      for (const vr of [0, 1]) for (const openFloor of [false, true]) {
        const spec = { dkind, p: [0, 0, 0], s, vr, openFloor, seed: 17 };
        assert.ok(assemblies.jungleAssemblyParts(spec).length <= assemblies.jungleAssemblyWork(spec),
          `masonry budget undercounted ${JSON.stringify(spec)}`);
      }
    }
    assert.ok(normalize({ ...base(), components: [{ t: "decor", dkind, p: [0, 0, 0] }] }),
      `ordinary ${dkind} must remain importable`);
  }
  rejectComponent({ t: "woodpath", p: [0, 0, 0], widths: [1e300] }, "width overflow");
  rejectComponent({ t: "woodpath", p: [0, 0, 0], plankPalette: "https://evil.example/model.glb" }, "palette URL");
  rejectComponent({ t: "woodpath", p: [0, 0, 0], polePalette: "../../private-model" }, "palette traversal");
  rejectComponent({ t: "pipe", p: [0, 0, 0], rise: -1 }, "legacy migration bypass");
  rejectComponent({ t: "vertramp", p: [0, 0, 0], pts: [], len: 100_000 }, "empty-path fallback bypass");
  rejectComponent({ t: "woodpath", p: [0, 0, 0], pts: [[0, 0], [0, -19_999]], scaffold: true, spacing: 0.18 }, "generated scaffold budget");
  rejectComponent({ t: "terrain", p: [0, 0, 0], pts: [[0, 0], [0, -19_999]], berms: true }, "generated berm budget");
  rejectComponent({ t: "vertramp", p: [0, 0, 0], curve: "spline", closed: true,
    pts: [[0, 0], [6000, 0], [12_000, 0]] }, "closing edge must count toward path budget");
  rejectComponent({ t: "platform", p: [0, 0, 0], pts: [[0, 0], [0, 1], [0, 2]] }, "zero-area polygon");
  rejectComponent({ t: "platform", p: [0, 0, 0], pts: [[0, 0], [4, 4], [0, 2], [3, 0]] }, "self-intersecting polygon with nonzero signed area");
  rejectComponent({ t: "platform", p: [0, 0, 0], s: [1e-100, 1, 1] }, "Float32 geometry underflow");
  rejectComponent({ t: "wall", p: [0, 0, 0],
    pts: [[0, -100_000], [0.1, -100_000], [0.1, 100_000], [0, 100_000]] },
    "thin wall must not bypass scan work by producing no old-style slabs");
  for (const t of ["platform", "wall", "trampoline", "speedpad"])
    rejectComponent({ t, p: [0, 0, 0], s: [100_000, 2, 100_000], yaw: 45 }, "rotated slab expansion");
  rejectComponent({ t: "speedpad", p: [0, 0, 0], s: [100_000, 2, 100_000], yaw: 90 },
    "quarter-turn mechanic pad scan budget");
  const collider = { walls: [] };
  api.Level.prototype.fillWallSlabs.call(collider, [[-2, 0], [2, 0], [2, 600], [-2, 600]], 0, 0, 0, 3);
  assert.ok(collider.walls.length > 240, "long walls must not truncate at the old slab cap");
  for (const z of [0.01, 239.5, 400, 599.99])
    assert.ok(collider.walls.some(box => box.containsPoint(new Vector3(0, 1, z))), `missing collision at Z=${z}`);
  const narrow = { walls: [] };
  api.Level.prototype.fillWallSlabs.call(narrow, [[0, 0.1], [0.1, 0.1], [0.1, 0.2], [0, 0.2]], 0, 0, 0, 3);
  assert.ok(narrow.walls.some(box => box.containsPoint(new Vector3(0.05, 1, 0.15))),
    "short thin wall fell between scanline samples");
  const diagonal = { walls: [] };
  api.Level.prototype.fillWallSlabs.call(diagonal, [[0, 0], [20, 0.1], [20, 0.2], [0, 0.1]], 0, 0, 0, 3);
  for (let step = 1; step < 20; step++)
    assert.ok(diagonal.walls.some(box => box.containsPoint(new Vector3(step, 1, step / 200 + 0.05))),
      "steep diagonal contains collision gaps");
  assert.ok(!diagonal.walls.some(box => box.containsPoint(new Vector3(1, 1, 0.15))),
    "diagonal collider filled broad empty space");
  reject({ ...base(), components: Array.from({ length: 2049 }, () => ({ t: "crate", p: [0, 0, 0] })) }, "crate runtime budget");
  const { CAMPAIGN_LEVELS } = await server.ssrLoadModule("/src/campaign.ts");
  rejectComponent({ t: "worldmap", p: [0, 0, 0], pts: CAMPAIGN_LEVELS.map(() => [0, 0, 0, 0]) }, "coincident campaign hubs");
  reject({ ...base(), ocean: { p: [0, 0, 0], length: 20, width: 20, seaward: 1 },
    components: [{ t: "worldmap", p: [0, 0, 0] }] }, "duplicate ocean ownership");
  reject({ ...base(), components: [0, 1].map(() => ({ t: "vertramp", p: [0, 0, 0], trafficRoad: true })) }, "multiple traffic paths");
  reject({ ...base(), groups: [{ id: Number.MAX_SAFE_INTEGER }], layers: [{ id: 1, name: "legacy" }] }, "group migration integer overflow");
  reject({ ...base(), components: Array.from({ length: 1025 }, () => ({ t: "enemy", p: [0, 0, 0] })) }, "dynamic entity budget");
  for (const component of [
    { t: "crumble" }, { t: "rope" }, { t: "trickgate" }, { t: "returnportal" },
    { t: "thorn" }, { t: "rail", amp: 4 },
  ]) reject({ ...base(), components: Array.from({ length: 1025 }, () => ({ ...component, p: [0, 0, 0] })) },
    `per-frame ${component.t} work must share the dynamic entity budget`);
  reject({ ...base(), ocean: { p: [0, 0, 0], length: 10, width: 20, seaward: 1, longitudinalSegments: 1024, lateralSegments: 512 } }, "ocean product limit");
  const coast = { p: [0, 0, 0], length: 20, width: 20, seaward: 1,
    shore: [[0, 0, 1, 0], [0, -20, 1, 0]], extendTails: true };
  assert.ok(normalize({ ...base(), ocean: coast }), "authored shoreline profile");
  assert.ok(normalize({ ...base(), ocean: { ...coast, geometryVersion: 2 } }), "canonical ocean version");
  for (const geometryVersion of [1, 3, "2", null])
    reject({ ...base(), ocean: { ...coast, geometryVersion } }, "invalid ocean geometry version");
  for (const shore of [[[0, 0, 1, 0]], [[0, 0, 0, 0], [0, 20, 0, 0]],
    [[0, 0, 2, 0], [0, 20, 1, 0]], [[0, 0, 1, 0], [0, 30_000, 1, 0]]])
    reject({ ...base(), ocean: { ...coast, shore } }, "invalid shoreline profile");
  reject({ ...base(), ocean: { ...coast, extendTails: "true" } }, "mistyped shore tail flag");
  const triangle = { t: "mesh", p: [0, 0, 0], vertices: [0, 0, 0, 1, 0, 0, 0, 0, 1],
    indices: [0, 1, 2], normals: [0, 1, 0, 0, 1, 0, 0, 1, 0],
    uvs: [0, 0, 1, 0, 0, 1], colors: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    doubleSided: true, beachSand: true, edgeGrinding: false };
  assert.ok(normalize({ ...base(), components: [triangle] }), "bounded authored native triangle");
  for (const [field, value, reason] of [
    ["vertices", [0, 0, 0], "missing triangle"],
    ["vertices", Array(12_291).fill(0), "mesh vertex cap"],
    ["vertices", [0, 0, 0, 1, 0, 0, 0, 0, 1e300], "mesh coordinate overflow"],
    ["indices", [0, 1, 3], "out-of-bounds mesh index"],
    ["indices", [0, 1, 1.5], "fractional mesh index"],
    ["indices", [0, 1], "incomplete triangle indices"],
    ["indices", Array(12_291).fill(0), "mesh triangle cap"],
    ["normals", [0, 1, 0], "mismatched mesh normal count"],
    ["normals", [0, 2, 0, 0, 1, 0, 0, 1, 0], "mesh normal range"],
    ["uvs", [0, 0], "mismatched mesh UV count"],
    ["colors", [2, 0, 0, 0, 1, 0, 0, 0, 1], "mesh color range"],
    ["doubleSided", "true", "mesh boolean coercion"],
  ]) rejectComponent({ ...triangle, [field]: value }, reason);
  rejectComponent({ t: "crate", p: [0, 0, 0], vertices: triangle.vertices }, "mesh payload on another primitive");
  reject({ ...base(), components: Array.from({ length: 129 }, () => ({ t: "enemy", foe: "car", p: [0, 0, 0] })) }, "traffic projection count");


  let invoked = 0;
  const accessor = base();
  Object.defineProperty(accessor, "name", { get() { invoked++; return "unsafe"; }, enumerable: true });
  reject(accessor, "accessor object");
  reject({ ...base(), toJSON() { invoked++; return base(); } }, "toJSON hook");
  assert.equal(invoked, 0, "validation invoked an attacker hook");
  const cyclic = base(); cyclic.extra = cyclic;
  reject(cyclic, "cyclic object");
  const sparse = base(); sparse.components = new Array(100);
  reject(sparse, "sparse component array");
  reject({ ...base(), spawn: [NaN, 0, 0] }, "NaN tuple");
  reject({ ...base(), spawn: [Infinity, 0, 0] }, "infinite tuple");
  reject({ ...base(), components: [{ ...base().components[0], bogus: { a: { a: { a: {} } } } }] }, "opaque nested metadata");

  const sparseIds = { ...base(), groups: [{ id: 1_000_000 }], layers: [{ id: 2, name: "Legacy" }] };
  assert.deepEqual(normalize(normalize(sparseIds)), normalize(sparseIds), "legacy ids near ceiling must remain valid/idempotent");
  assert.ok(normalize({ ...base(), components: [{ t: "platform", p: [0, 0, 0],
    pts: [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]] }] }), "explicit polygon closing point");
  const level = normalize(base());
  assert.ok(parse(JSON.stringify(base())));
  assert.equal(parse(JSON.stringify({ id: "u4", name: "New title", data: base() })).name, "New title");
  for (const value of [null, 7, [], { data: base(), name: {} }, { data: base(), unexpected: 1 },
    { data: base(), id: "<img src=x onerror=alert(1)>" }]) {
    assert.equal(parse(JSON.stringify(value)), null, "invalid file wrapper"); checks++;
  }
  assert.equal(parse("{"), null);
  const nestedBomb = "[".repeat(50_000) + "0" + "]".repeat(50_000);
  assert.equal(levelJsonTextWithinLimits(nestedBomb), false, "deep raw JSON reached the parser");
  const nativeJsonParse = JSON.parse;
  let parserCalls = 0;
  JSON.parse = (...args) => { parserCalls++; return nativeJsonParse(...args); };
  try { assert.equal(parse(nestedBomb), null); }
  finally { JSON.parse = nativeJsonParse; }
  assert.equal(parserCalls, 0, "single-file depth bomb allocated parsed containers");
  assert.equal(levelJsonTextWithinLimits(JSON.stringify({ ...base(), name: '{ [ \" safe \" ] }' })), true,
    "quoted braces and escaped quotes must not count as nesting");
  assert.equal(levelJsonTextWithinLimits('"' + '\\u0061'.repeat(256) + '"'), true,
    "legal fully escaped bounded text must pass preflight");
  assert.equal(parse(" ".repeat(MAX_LEVEL_FILE_BYTES + 1)), null, "file length cap");
  assert.equal(parse(JSON.stringify({ ...base(), name: "界".repeat(MAX_LEVEL_FILE_BYTES / 2) })), null, "UTF-8 byte cap");

  // Packs cannot silently strip bad rows and overwrite a healthy local list.
  const valid = [{ id: "u1", name: "Stored course", data: level }];
  assert.equal(setUserLevels(valid), true);
  const before = JSON.stringify(getUserLevels());
  for (const invalid of [[...valid, { id: "u2", name: "Bad", data: null }], [...valid, ...valid],
    [{ id: "__proto__", name: "Bad", data: level }],
    Array.from({ length: MAX_USER_LEVELS + 1 }, (_, i) => ({ ...valid[0], id: `u${i}` }))]) {
    assert.equal(normalizeUserLevelEntries(invalid), null);
    assert.equal(setUserLevels(invalid), false);
    assert.equal(JSON.stringify(getUserLevels()), before, "invalid pack erased prior work");
    checks++;
  }
  denyWrites = true;
  assert.equal(setUserLevels([{ ...valid[0], name: "Session copy" }]), false);
  assert.equal(getUserLevels()[0].name, "Session copy", "quota failure must preserve exportable session state");
  denyWrites = false;

  const { fetchRemoteLevels } = await server.ssrLoadModule("/src/sync.ts");
  let responseFactory;
  globalThis.fetch = async (url, options) => {
    assert.match(url, /^\.\/levels\.json\?t=\d+$/);
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal, "remote fetch must have a timeout signal");
    return responseFactory();
  };
  const makePackResponse = value => new Response(JSON.stringify(value));
  responseFactory = () => makePackResponse({ v: 2, levels: valid });
  const remoteGood = await fetchRemoteLevels();
  assert.ok(remoteGood);
  assert.equal(remoteGood.levels[0].id, "u1");
  const localBeforeRemote = JSON.stringify(getUserLevels());
  let streamCancelled = false;
  for (const [reason, factory] of [
    ["future pack version", () => makePackResponse({ v: 3, levels: valid })],
    ["opaque pack field", () => makePackResponse({ v: 2, levels: valid, script: "alert(1)" })],
    ["partial invalid pack", () => makePackResponse({ v: 2, levels: [...valid, { id: "bad", name: "Bad", data: null }] })],
    ["duplicate pack identity", () => makePackResponse({ v: 2, levels: [...valid, ...valid] })],
    ["invalid JSON", () => new Response("{")],
    ["deep raw JSON", () => new Response(nestedBomb)],
    ["invalid UTF-8", () => new Response(new Uint8Array([123, 255, 125]))],
    ["HTTP failure", () => new Response("server error", { status: 500 })],
    ["declared oversized file", () => new Response("{}", { headers: { "content-length": String(MAX_LEVEL_PACK_BYTES + 1) } })],
    ["stream exceeds size despite header", () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(MAX_LEVEL_PACK_BYTES + 1)); },
      cancel() { streamCancelled = true; },
    }), { headers: { "content-length": "2" } })],
  ]) {
    responseFactory = factory;
    parserCalls = 0;
    if (reason === "deep raw JSON") JSON.parse = (...args) => { parserCalls++; return nativeJsonParse(...args); };
    try { assert.equal(await fetchRemoteLevels(), null, reason); }
    finally { JSON.parse = nativeJsonParse; }
    if (reason === "deep raw JSON") assert.equal(parserCalls, 0, "remote depth bomb reached JSON.parse");
    assert.equal(JSON.stringify(getUserLevels()), localBeforeRemote, `${reason} mutated the local store`);
    checks++;
  }
  assert.equal(streamCancelled, true, "oversized network stream was not cancelled");
  // A multibyte character split across chunks still decodes correctly.
  const chunkedPack = new TextEncoder().encode(JSON.stringify({ v: 2, levels: [{ ...valid[0], name: "Café" }] }));
  const splitAt = chunkedPack.indexOf(0xc3) + 1;
  responseFactory = () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(chunkedPack.slice(0, splitAt));
      controller.enqueue(chunkedPack.slice(splitAt));
      controller.close();
    },
  }));
  assert.equal((await fetchRemoteLevels()).levels[0].name, "Café");

  const published = JSON.parse(await readFile(new URL("../public/levels.json", import.meta.url), "utf8"));
  assert.ok(normalizeUserLevelEntries(published.levels), "published pack was rejected");
  for (const entry of api.BUILTIN_LEVELS) if (entry.data) {
    assert.ok(normalize(entry.data), `${entry.id} source level was rejected`);
    checks++;
  }
  console.log(`Level security boundary: ${checks} adversarial and source compatibility checks passed.`);
} finally {
  await server.close();
}
