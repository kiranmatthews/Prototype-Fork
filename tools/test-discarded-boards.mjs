import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createServer } from 'vite';
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
const near = (a, b, message, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${message}: ${a} != ${b}`);
try {
    const { DiscardedBoards } = await server.ssrLoadModule('/src/skateboard/discarded.ts');
    const { sliceBoardGeometry } = await server.ssrLoadModule('/src/skateboard/fracture.ts');
    const { buildSkateboardDeckGeometry } = await server.ssrLoadModule('/src/skateboard/model.ts');
    const { DEFAULT_SKATEBOARD_SETTINGS: settings } = await server.ssrLoadModule('/src/skateboard/settings.ts');
    const geometry = buildSkateboardDeckGeometry(settings);
    const hash = g => createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer))
        .update(Buffer.from(g.attributes.uv.array.buffer)).update(Buffer.from(g.index.array.buffer)).digest('hex');
    const before = hash(geometry);
    for (const side of [-1, 1]) {
        const half = sliceBoardGeometry(geometry, side);
        assert.ok(side > 0 ? half.boundingBox.min.z >= -1e-7 : half.boundingBox.max.z <= 1e-7);
        assert.equal(half.attributes.uv.count, half.attributes.position.count);
        assert.equal(half.attributes.wearUv.count, half.attributes.position.count);
        assert.ok(half.groups.some(g => g.materialIndex === 0) && half.groups.some(g => g.materialIndex === 1));
        assert.ok([...half.attributes.position.array].every(Number.isFinite));
        half.dispose();
    }
    assert.equal(hash(geometry), before, 'fracturing mutated the original deck');
    const materials = Array.from({ length: 7 }, (_, i) => new THREE.MeshBasicMaterial({ color: i % 2 ? 0xf0a536 : 0x303030 }));
    const source = new THREE.Group();
    source.position.set(12, 2, 12);
    source.userData.settings = settings;
    source.userData.gripTop = settings.boardToGroundDistance;
    const deck = new THREE.Mesh(geometry, materials);
    deck.name = 'Deck_ContinuousRoundedKick';
    deck.position.y = settings.boardToGroundDistance;
    source.add(deck);
    const wheelGeometry = new THREE.CylinderGeometry(0.055, 0.055, 0.06, 10);
    const wheelMaterial = new THREE.MeshBasicMaterial({ color: 0x806090 });
    for (const z of [-0.3, 0.3])
        for (const x of [-0.17, 0.17]) {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.position.set(x, 0.055, z);
            wheel.rotation.z = Math.PI / 2;
            source.add(wheel);
        }
    const floor = new THREE.Mesh(new THREE.BoxGeometry(100, 1, 100), new THREE.MeshBasicMaterial());
    floor.position.y = -0.5;
    floor.updateMatrixWorld(true);
    const world = { groundMeshes: [floor], crumbles: [], killY: -20 };
    const advance = (pile, n = 600) => { for (let i = 0; i < n; i++)
        pile.update(1 / 60, world); };
    let borrowedDisposals = 0;
    for (const resource of [geometry, wheelGeometry, ...materials, wheelMaterial])
        resource.addEventListener('dispose', () => borrowedDisposals++);
    const persistent = new DiscardedBoards(() => 0.9);
    for (let i = 0; i < 120; i++) {
        source.position.set(10 + (i % 10) * 0.3, 2, 10 + Math.floor(i / 10) * 0.3);
        const body = persistent.spawn(source);
        persistent.release(body);
    }
    advance(persistent);
    assert.equal(persistent.diagnostics.active, 0, 'settled boards still run physics');
    assert.equal(persistent.diagnostics.settledPieces, 120, 'boards did not accumulate');
    assert.ok(persistent.diagnostics.batches <= 2, 'resting boards added individual draws');
    const stable = persistent.diagnostics;
    advance(persistent, 60 * 40);
    assert.deepEqual(persistent.diagnostics, stable, 'resting boards expired after 30 seconds');
    for (const batch of persistent.root.children) {
        assert.ok(batch.isInstancedMesh);
        assert.ok([...batch.instanceMatrix.array].every(Number.isFinite));
    }
    const broken = [];
    for (const [style, roll, pieces] of [['snap', 0.05, 2], ['fold', 0.2, 1]]) {
        source.position.set(12, 3, 12);
        const pile = new DiscardedBoards(() => roll);
        pile.spawn(source);
        advance(pile);
        assert.equal(pile.diagnostics[style === 'snap' ? 'snapped' : 'folded'], 1);
        assert.equal(pile.diagnostics.settledPieces, pieces);
        const batches = pile.diagnostics.batches;
        for (let i = 0; i < 8; i++)
            pile.spawn(source);
        advance(pile);
        assert.equal(pile.diagnostics.settledPieces, pieces * 9);
        assert.equal(pile.diagnostics.batches, batches, 'fractured boards did not reuse batches/resources');
        broken.push({ style, ...pile.diagnostics });
        pile.dispose();
    }
    const handoff = new DiscardedBoards(() => 0.9);
    // Exercise batched records after growth/compaction: remove a middle board,
    // then hit the board whose GPU slots moved into the holes.
    const attackPile = new DiscardedBoards(() => 0.9);
    const attackBoards = [];
    for (let i = 0; i < 24; i++) {
        source.position.set(-24 + i * 2, 2, 0);
        attackBoards.push(attackPile.spawn(source));
    }
    advance(attackPile);
    const around = body => new THREE.Box3().setFromCenterAndSize(body.root.position.clone().add(new THREE.Vector3(0, 0.3, 0)), new THREE.Vector3(1.6, 2, 2));
    const token = {};
    assert.equal(attackPile.spinAttack(around(attackBoards[7]), token), 1);
    assert.equal(attackPile.diagnostics.snapped, 1);
    assert.equal(attackPile.diagnostics.active, 2);
    assert.equal(attackPile.diagnostics.settledPieces, 23);
    assert.equal(attackPile.spinAttack(around(attackBoards[7]), token), 0, 'one spin broke and deleted the same deck');
    assert.equal(attackPile.spinAttack(around(attackBoards[23]), {}), 1, 'batch compaction lost another board');
    advance(attackPile);
    assert.equal(attackPile.diagnostics.settledPieces, 26);
    assert.ok(attackPile.spinAttack(new THREE.Box3(new THREE.Vector3(-50, -2, -50), new THREE.Vector3(50, 3, 50)), {}).valueOf() >= 24);
    assert.equal(attackPile.diagnostics.poofed, 4, 'pre-existing pieces did not poof');
    const awakeToken = {};
    assert.ok(attackPile.spinAttack(new THREE.Box3(new THREE.Vector3(-50, -2, -50), new THREE.Vector3(50, 3, 50)), awakeToken) > 0);
    assert.equal(attackPile.diagnostics.active, 0);
    assert.equal(attackPile.diagnostics.settledPieces, 0);
    assert.equal(attackPile.diagnostics.batches, 0);
    attackPile.dispose();
    source.position.set(12, 8, 12);
    const body = handoff.spawn(source);
    handoff.update(0, world);
    const initial = body.root.position.clone();
    handoff.step(body, 1 / 60, world);
    const stepped = body.root.position.clone();
    handoff.release(body);
    handoff.update(1 / 60, world);
    near(body.root.position.distanceTo(stepped), 0, 'remount double-stepped the discarded board');
    near(body.remaining, 30 - 1 / 60, 'legacy loose-board handoff timer changed');
    handoff.applyRenderInterpolation(0.5);
    near(body.root.position.distanceTo(initial.clone().lerp(stepped, 0.5)), 0, 'debris interpolation');
    handoff.restoreRenderPose();
    near(body.root.position.distanceTo(stepped), 0, 'debris pose restore');
    advance(handoff);
    assert.equal(handoff.diagnostics.settledPieces, 1);
    const inactive = new DiscardedBoards(() => 0.9);
    inactive.spawn(source);
    advance(inactive);
    assert.equal(inactive.diagnostics.settledPieces, 1, 'an inactive player froze its last board');
    const resettable = new DiscardedBoards(() => 0.05);
    const host = new THREE.Group();
    host.add(resettable.root);
    source.position.set(12, 3, 12);
    resettable.spawn(source);
    advance(resettable);
    assert.equal(resettable.diagnostics.settledPieces, 2);
    source.position.y = 8;
    const stale = resettable.spawn(source);
    resettable.update(0, world);
    resettable.update(1 / 60, world);
    resettable.applyRenderInterpolation(0.5);
    resettable.clear();
    assert.deepEqual(resettable.diagnostics, { thrown: 0, snapped: 0, folded: 0, active: 0, settledPieces: 0, batches: 0, lost: 0, poofed: 0 });
    assert.equal(resettable.root.parent, host, 'respawn detached the reusable pile owner');
    assert.equal(stale.root.visible, false);
    resettable.step(stale, 1 / 60, world);
    resettable.applyRenderInterpolation(0.5);
    resettable.restoreRenderPose();
    assert.equal(resettable.root.children.length, 0, 'stale handles/interpolation resurrected debris');
    assert.ok(resettable.spawn(source), 'cleared pile cannot accept a fresh discard');
    advance(resettable);
    assert.equal(resettable.diagnostics.settledPieces, 2, 'breakage no longer works after clearing');
    resettable.clear(); resettable.clear();
    resettable.dispose();
    persistent.dispose();
    handoff.dispose();
    inactive.dispose();
    assert.equal(persistent.root.children.length, 0);
    assert.equal(persistent.spawn(source), null, 'disposed level accepted another board');
    assert.equal(borrowedDisposals, 0, 'level cleanup disposed a live board resource');
    assert.equal(hash(geometry), before, 'debris changed the mounted deck geometry');
    console.log(JSON.stringify({ persistent: stable, broken, borrowedDisposals }, null, 2));
    console.log('PASS persistent board piles, split/fold breakage, batching, single stepping, interpolation and resource ownership');
}
finally {
    await server.close();
}
