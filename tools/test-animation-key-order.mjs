import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { createServer } from 'vite';

// Keep an independent eager-order oracle: all interpolation code is shared,
// but this module always performs the original stable time/ID sort.
const source = await readFile(new URL('../src/animation/sampling.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('sampling.ts', source, ts.ScriptTarget.Latest, true);
const order = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'sortedKeys');
const eagerSource = source.slice(0, order.body.getStart(ast)) +
  '{ return [...keys].sort((a, b) => a.time - b.time || a.id.localeCompare(b.id)); }' + source.slice(order.body.getEnd());
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true },
  plugins: [{ name: 'eager-key-order-reference', enforce: 'pre', load(id) {
    if (path.relative(process.cwd(), id.split('?')[0]) === 'src/animation/sampling.ts' && id.includes('eager-key-order')) return eagerSource;
  } }],
});
const originalSort = Array.prototype.sort;
try {
  const actual = await server.ssrLoadModule('/src/animation/sampling.ts');
  const eager = await server.ssrLoadModule('/src/animation/sampling.ts?eager-key-order');
  const methods = ['sampleScalarKeys', 'sampleVectorKeys', 'sampleQuaternionKeys'];
  const keysFor = (kind, count = 12) => Array.from({ length: count }, (_, i) => ({
    time: i / 4, id: `key-${String(i).padStart(2, '0')}`, interpolation: ['step', 'linear', 'cubic'][i % 3],
    value: kind === 0 ? Math.sin(i * .7) : kind === 1 ? [Math.sin(i), i * .2, Math.cos(i)] :
      [Math.sin(i * .21), .1, -.2, Math.cos(i * .21)].map(v => i % 2 ? -v : v),
    ...(kind < 2 && i % 4 === 0 ? { outTangent: kind === 0 ? .3 : [.2, -.3, .1] } : {}),
  }));
  let comparisons = 0;
  const outcome = (sample, keys, time) => {
    try { return { value: sample(keys, time) }; }
    catch (error) { return { error: error.name, message: error.message }; }
  };
  const compare = (kind, keys, label) => {
    const saved = structuredClone(keys), identities = [...keys];
    for (const time of [-1, 0, .001, .25, .499, .5, .75, 1.125, 2, 2.75, 4, NaN, Infinity, -Infinity]) {
      const sampled = outcome(actual[methods[kind]], keys, time);
      assert.deepEqual(sampled, outcome(eager[methods[kind]], keys, time), `${label}/${time}`);
      if (Number.isFinite(time) && Array.from(keys).every(k => k && Number.isFinite(k.time))) assert.equal(sampled.error, undefined);
      comparisons++;
    }
    assert.deepEqual(keys, saved, `${label}: sampler modified source keys`);
    assert.ok(keys.every((key, i) => key === identities[i]), 'sampler replaced source records');
  };
  for (let kind = 0; kind < 3; kind++) {
    for (const size of [0, 1, 2, 12, 41]) compare(kind, keysFor(kind, size), `size-${size}`);
    const keys = keysFor(kind);
    for (let edit = 0; edit < 100; edit++) {
      // Mutate the same array and key objects. No identity/version cache may
      // conceal a timeline drag, changed tie-break ID, replacement or tangent.
      if (edit % 7 === 0) keys.reverse();
      if (edit % 7 === 1) keys[2].time = keys[1].time;
      if (edit % 7 === 2) keys[1].id = edit % 2 ? 'a' : 'z';
      if (edit % 7 === 3) keys.splice(1, 0, { ...keysFor(kind, 1)[0], id: 'inserted', time: .37 });
      if (edit % 7 === 4) keys.splice(3, 1);
      if (edit % 7 === 5) keys[0] = { ...keys[0], interpolation: 'linear', time: -.5 };
      if (edit % 7 === 6) keys.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
      compare(kind, keys, `live-${kind}-${edit}`);
    }
    for (const nonfinite of [NaN, Infinity, -Infinity]) {
      const invalid = keysFor(kind); invalid[4].time = nonfinite; compare(kind, invalid, `nonfinite-${nonfinite}`);
    }
    const sparse = keysFor(kind); delete sparse[4]; compare(kind, sparse, 'sparse-input-fallback');
    const duplicates = keysFor(kind, 6);
    for (const key of duplicates) { key.time = .5; key.id = 'same'; }
    compare(kind, duplicates, 'stable-identical-time-and-id');
    const frozen = keysFor(kind); frozen.forEach(k => { if (Array.isArray(k.value)) Object.freeze(k.value); Object.freeze(k); });
    Object.freeze(frozen); compare(kind, frozen, 'frozen-input');
    const unorderedTies = keysFor(kind, 6);
    for (let i = 0; i < unorderedTies.length; i++) { unorderedTies[i].time = .5; unorderedTies[i].id = ['z', 'é', 'e', 'A', 'a', ''][i]; }
    compare(kind, unorderedTies, 'locale-tie-break');
  }
  const ordered = methods.map((_, i) => keysFor(i, 41));
  let sorts = 0;
  Array.prototype.sort = function (...args) { sorts++; return originalSort.apply(this, args); };
  for (let frame = 0; frame < 240; frame++) for (let kind = 0; kind < 3; kind++)
    actual[methods[kind]](ordered[kind], frame / 60);
  const optimizedSorts = sorts; sorts = 0;
  for (let frame = 0; frame < 240; frame++) for (let kind = 0; kind < 3; kind++)
    eager[methods[kind]](ordered[kind], frame / 60);
  assert.equal(optimizedSorts, 0); assert.equal(sorts, 720, 'reference did not exercise eager sorting');
  console.log(JSON.stringify({ passed: true, comparisons, liveEditsPerKind: 100, optimizedSorts, eagerSorts: sorts,
    frozenSourcePreserved: true, nonfiniteFallback: true, stableLocaleTies: true, retainedKeyCache: false }, null, 2));
} finally { Array.prototype.sort = originalSort; await server.close(); }
