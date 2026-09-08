import assert from "node:assert/strict";

// Called by the real Vite/headless Level harness in validate-editor-roundtrip.
export function assertEditorRuntimeAuthoring({ Level, setEditorBuild, worldMapComponentPoints, normalizeCustomLevelData, migrateCustomLevel }, THREE, { editOceanShoreline, straightenOceanShoreline, UnityOcean }) {
  const search = window.location.search;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const makeData = (components) => ({
    v: 1,
    name: "Editor runtime authoring sentinel",
    spawn: [0, 2, 12],
    killY: -40,
    components: [
      ...components,
      { t: "platform", p: [0, -1, 0], s: [4, 1, 40] },
      { t: "gate", p: [0, 0, -16] },
    ],
  });
  const create = (data) => new Level(new THREE.Scene(), {
    id: "__runtime_authoring_sentinel", name: data.name, data: clone(data),
  });
  try {
    window.location.search = "?lite";
    for (const tex of ["grass", "jungle", "sunsoil"]) {
      const terrain = {t:"terrain",p:[0,0,0],pts:[[0,0],[0,-20]],w:5,amp:0,tex,color:"#3d8a45"};
      const authored = {...makeData([terrain]),jungleAtmosphere:true};
      const painted = create(authored);
      try {
        assert.deepEqual(painted.captureData().components.find(c=>c.t==="terrain"),terrain,
          "atmosphere rewrote the editor's terrain material");
        const ground=painted.groundMeshes.find(mesh=>mesh.userData.terrainComp);
        assert.ok(ground); assert.equal(ground.material.userData.texKind,tex);
        assert.equal(ground.material.color.getHexString(),"3d8a45");
      } finally {painted.dispose();}
    }

    const data = makeData([
      { t: "rail", p: [3, 4, -3], pts: [[0, 0, 0, 0], [2, -4, 0.5, 1], [-2, -8, 0, 2]], amp: 5, speed: 0.75, axis: "y", invisible: true },
      { t: "rail", p: [7, 4, -3], len: 9, yaw: 35, amp: 2, speed: 1, axis: "x", invisible: true },
    ]);
    const level = create(data);
    try {
      assert.equal(level.movingRails.length, 2, "reshaping a rail into a node path discarded its motion");
      const original = level.movingRails.map(({ rail }) => rail.points.map((point) => point.clone()));
      for (const { rail } of level.movingRails)
        assert.equal(rail.object.children.length, 0, "an invisible travelling rail grew visible bars");
      level.update(0.5);
      level.update(0.01);
      level.movingRails.forEach(({ rail, object }, index) => {
        assert.ok(object.position.length() > 0.1, "travelling rail did not move");
        rail.points.forEach((point, node) => assert.ok(
          point.distanceTo(original[index][node].clone().add(object.position)) < 1e-9,
          "travelling path collision separated from its visual transform",
        ));
      });
      // Simulate the hand-built capture seam after the rail has animated.
      level.builtFromData = null;
      const captured = level.captureData();
      const path = captured.components.find((component) => component.t === "rail" && component.pts && component.amp);
      assert.ok(path?.invisible, "capture lost a travelling path or its visibility");
      const rebuilt = create(captured);
      try {
        const recaptured = rebuilt.movingRails.find(({ rail }) => rail.points.length > 2);
        assert.ok(recaptured, "captured travelling path rebuilt as a straight rail");
        recaptured.rail.points.forEach((point, index) => assert.ok(
          point.distanceTo(original[0][index]) < 0.025,
          "capture baked live travel into authored path nodes",
        ));
      } finally { rebuilt.dispose(); }
    } finally { level.dispose(); }

    const bonusData = makeData([{ t: "bonusplatform", p: [4, 2, -5], to: [6, 3, -2] }]);
    const bonus = create(bonusData);
    try {
      assert.equal(bonus.bonusPlatformAt(new THREE.Vector3(4, 2.42, -5)), true);
      assert.deepEqual(bonus.bonusReturnPoint().toArray(), [6, 3, -2]);
      bonus.builtFromData = null;
      const captured = bonus.captureData();
      assert.equal(captured.components.filter((component) => component.t === "bonusplatform").length, 1);
      assert.equal(captured.components.filter((component) => component.t === "platform").length, 1,
        "bonus entrance deck was flattened into a duplicate platform");
      const movedData = makeData([{ t: "bonusplatform", p: [14, 7, -15], to: [16, 8, -12] }]);
      const moved = create(movedData);
      try {
        assert.equal(moved.bonusPlatformAt(new THREE.Vector3(4, 2.42, -5)), false);
        assert.equal(moved.bonusPlatformAt(new THREE.Vector3(14, 7.42, -15)), true);
        assert.deepEqual(moved.bonusReturnPoint().toArray(), [16, 8, -12]);
      } finally { moved.dispose(); }
    } finally { bonus.dispose(); }

    const sourceMap = new Level(new THREE.Scene(), { id: "warproom", name: "World Map" });
    try {
      const captured = sourceMap.captureData();
      assert.equal(captured.hudMode, "hub");
      assert.deepEqual(captured.components.map(({ t }) => t), ["worldmap"],
        "world map capture flattened its route graph/terrain");
      assert.ok(normalizeCustomLevelData(captured), "native map capture does not pass interchange validation");
      const translated = clone(captured);
      const component = translated.components[0];
      component.p = [30, 5, -20];
      component.yaw = 90;
      component.pts = worldMapComponentPoints();
      component.pts[0][0] += 4;
      component.pts[0][3] += 2;
      const copy = create(translated);
      try {
        assert.equal(copy.isCampaignMap, true, "an editable map lost campaign navigation");
        const sourcePosition = sourceMap.campaignMapPose("jungle").position.clone().add(new THREE.Vector3(4, 2, 0));
        const expected = new THREE.Vector3(sourcePosition.z + 30, sourcePosition.y + 5, -sourcePosition.x - 20);
        const pose = copy.campaignMapPose("jungle");
        assert.ok(pose.position.distanceTo(expected) < 1e-8, "moved hub pose stayed at its source location");
        assert.ok(pose.heading.distanceTo(new THREE.Vector3(-1, 0, 0)) < 1e-8);
        const edge = copy.campaignMapTravel("jungle", "test-course", 0);
        assert.ok(edge.position.distanceTo(expected) < 1e-8, "map route did not follow its edited hub");
        assert.equal(copy.water.seaLevel, sourceMap.water.seaLevel + 5, "map ocean ignored the map elevation");
        copy.root.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(expected.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(0, -1, 0));
        assert.ok(ray.intersectObjects(copy.groundMeshes, false).some((hit) => Math.abs(hit.point.y - expected.y + 0.1) < 0.01),
          "edited map hub lost its supported arrival point");
      } finally { copy.dispose(); }
    } finally { sourceMap.dispose(); }

    const roadData = makeData([
      { t: "vertramp", p: [0, 2, 0], pts: [[0, 0, 0, 0], [0, -12, 0, -1], [8, -24, 0, -2]],
        curve: "spline", vkind: "half", w: 6, rise: 0.5, arc: 18, vert: false, trafficRoad: true, edgeGrinding: false },
      { t: "enemy", foe: "car", p: [2, 1, -12], speed: 8 },
      { t: "tumblezone", p: [20, -5, -12], s: [6, 8, 10] },
      { t: "coastwall", p: [15, -5, 0], pts: [[0, 0], [0, -30]], w: 0.5, rise: 15 },
    ]);
    const roadLevel = create(roadData);
    try {
      const car = roadLevel.enemies.find((enemy) => enemy.kind === "car");
      assert.ok(car, "traffic enemy did not build");
      const carStart = car.group.position.clone();
      for (let index = 0; index < 60; index++) roadLevel.update(1 / 60);
      assert.ok(car.group.position.distanceTo(carStart) > 2, "car froze on an editable short road");
      assert.ok(car.x0 >= 0 && car.x0 <= roadLevel.roadRibbon.len, "short-road wrap put car outside its route");
      assert.equal(roadLevel.tumbleBoxes.some((box) => box.containsPoint(new THREE.Vector3(20, -5, -12))), true);
      const contact = roadLevel.resolveCoastBoundary(new THREE.Vector3(12, 1, -10), new THREE.Vector3(18, 1, -10), 0.5, 1, 0.5);
      assert.ok(contact && contact.x < 15, "editable coast wall no longer blocks high-speed crossings");
      const deck = roadLevel.root.children.find((object) => object.userData.vertComp?.trafficRoad);
      const chunk = new THREE.Mesh(deck.geometry, deck.material);
      chunk.userData = deck.userData;
      roadLevel.root.add(chunk);
      roadLevel.builtFromData = null;
      const captured = roadLevel.captureData();
      assert.equal(captured.components.filter((component) => component.trafficRoad).length, 1,
        "chunked source road captured duplicate complete roads");
      const capturedCar = captured.components.find((component) => component.foe === "car");
      assert.ok(new THREE.Vector3(...capturedCar.p).distanceTo(carStart) < 0.1,
        "source capture converted traffic route cursor into a world position");
      assert.equal(captured.components.filter((component) => component.t === "tumblezone").length, 1);
    } finally { roadLevel.dispose(); }

    const meshLevel = create(makeData([]));
    try {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute([
        0, 0, 0, 4, 1, 0, 0, 0, -4,
        10, 0, 0, 14, 2, 0, 10, 0, -4,
      ], 3));
      geometry.setIndex([0, 1, 2, 3, 4, 5]);
      geometry.computeVertexNormals();
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 2));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(Array.from({ length: 18 }, (_, index) => index % 3 === 0 ? 0.25 : 0.75), 3));
      const source = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
      source.name = "sloping separated triangle sentinels";
      source.position.set(100, 5, -100);
      source.rotation.y = 0.43;
      source.scale.set(2, 1.5, 0.5);
      source.userData.beachSandFriction = true;
      source.userData.edgeGrinding = false;
      meshLevel.root.add(source);
      meshLevel.groundMeshes.push(source);
      source.updateWorldMatrix(true, false);
      const probe = new THREE.Vector3(1, 0.25, -1).applyMatrix4(source.matrixWorld);
      const gap = new THREE.Vector3(7, 0, -1).applyMatrix4(source.matrixWorld);
      meshLevel.builtFromData = null;
      const captured = meshLevel.captureData();
      const native = captured.components.find((component) => component.t === "mesh");
      assert.ok(native?.vertices && native.normals && native.uvs && native.colors,
        "triangle capture dropped its shape/normal/UV/colour attributes");
      assert.equal(native.beachSand, true);
      assert.equal(native.doubleSided, true);
      assert.ok(normalizeCustomLevelData(captured), "captured triangle data cannot be imported");
      const rebuilt = create(captured);
      try {
        rebuilt.root.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(probe.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0));
        const hit = ray.intersectObjects(rebuilt.groundMeshes, false)[0];
        assert.ok(hit && Math.abs(hit.point.y - probe.y) < 0.00001,
          "captured sloping mesh changed its collision height");
        ray.set(gap.clone().add(new THREE.Vector3(0, 10, 0)), new THREE.Vector3(0, -1, 0));
        assert.equal(ray.intersectObjects(rebuilt.groundMeshes, false).length, 0,
          "captured mesh filled its empty gap with a bounding slab");
      } finally { rebuilt.dispose(); }
      const grid = new THREE.Mesh(new THREE.PlaneGeometry(20, 20, 70, 70).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial());
      grid.position.set(200, 2, -100);
      const chunks = meshLevel.captureSurfaceMesh(grid, { edgeGrinding: false });
      assert.ok(chunks.length > 1, "large surface did not split into bounded editable chunks");
      assert.equal(chunks.reduce((count, component) => count + component.indices.length, 0), grid.geometry.index.count,
        "chunking dropped triangles from an authored surface");
      for (const chunk of chunks) {
        assert.ok(chunk.vertices.length <= 4096 * 3 && chunk.indices.length <= 4096 * 3);
        assert.ok(normalizeCustomLevelData(makeData([chunk])), "mesh chunk exceeded the interchange contract");
      }
      grid.geometry.dispose(); grid.material.dispose();
    } finally { meshLevel.dispose(); }

    for (const sourceCoordinates of ["three", "unity"]) {
      const oceanData = { ...makeData([]), ocean: {
        geometryVersion: 2, p: [10, -3, -20], yaw: 90, length: 21, width: 24, seaward: 1,
        longitudinalSegments: 16, lateralSegments: 8, sourceCoordinates,
        shore: [[0, 0, 1, 0], [4, -10, 1, 0], [2, -20, 1, 0]],
      } };
      assert.ok(normalizeCustomLevelData(oceanData), "curved ocean cannot be imported");
      const coast = create(oceanData);
      try {
        const first = coast.water.shore[0];
        const last = coast.water.shore.at(-1);
        assert.ok(Math.abs(first.x - 10) < 1e-8 && Math.abs(first.z + 20) < 1e-8);
        assert.ok(Math.abs(last.x + 10) < 1e-8 && Math.abs(last.z + 22) < 1e-8,
          "ocean shape did not follow editor translation/yaw");
        const expectedNormal = new THREE.Vector2(-2, -10).normalize();
        assert.ok(Math.abs(last.sx - expectedNormal.x) < 1e-8 && Math.abs(last.sz - expectedNormal.y) < 1e-8,
          "ocean rotated geometry without its shore-facing direction");
        assert.equal(coast.water.seaLevel, -3);
      } finally { coast.dispose(); }
    }

    const oceanVertices = water => water.group.children.map(mesh => Array.from(mesh.geometry.attributes.position.array));
    const assertVertices = (actual, expected, label) => {
      assert.equal(actual.length, expected.length, label);
      actual.forEach((mesh, i) => {
        assert.equal(mesh.length, expected[i].length, label);
        mesh.forEach((value, j) => assert.ok(Math.abs(value - expected[i][j]) < 0.0001, `${label}: mesh ${i} value ${j}: ${value} vs ${expected[i][j]}`));
      });
    };
    const assertWaterFacingUp = water => {
      for (const mesh of water.group.children) {
        const p = mesh.geometry.attributes.position, indices = mesh.geometry.index;
        for (let i = 0; i < indices.count; i += 3) {
          const a = new THREE.Vector3().fromBufferAttribute(p, indices.getX(i));
          const b = new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + 1));
          const c = new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + 2));
          assert.ok(b.sub(a).cross(c.sub(a)).y >= -0.00001, "editable ocean is backface-culled from above");
        }
      }
    };
    for (const quality of ["?lite", ""]) for (const sourceCoordinates of ["three", "unity"])
      for (const seaward of [-1, 1]) for (const curved of [false, true]) {
        window.location.search = quality;
        const old = { p: [10, -3, -20], yaw: 37, length: 40, width: 24, seaward,
          longitudinalSegments: 16, lateralSegments: 8, sourceCoordinates,
          ...(curved ? { shore: [[3, 20, seaward, 0], [7, 2, seaward, 0], [2, -20, seaward, 0]] } : {}),
        };
        // Build the published v1 geometry directly through the real ocean
        // renderer. Migration may fix transforms, never move existing files.
        const a = old.yaw * Math.PI / 180, cosine = Math.cos(a), sine = Math.sin(a);
        const sign = sourceCoordinates === "unity" ? -1 : 1;
        const shore = curved ? old.shore.map(([x, z, nx, nz]) => ({
          x: old.p[0] + x * cosine + z * sine, z: (old.p[2] - x * sine + z * cosine) * sign,
          sx: nx * cosine + nz * sine, sz: (-nx * sine + nz * cosine) * sign, beachSlope: 0, bedSlope: 0,
        })) : [1, -1].map(end => ({
          x: old.p[0] - end * sine * old.length / 2, z: old.p[2] + end * cosine * old.length / 2,
          sx: cosine * seaward, sz: sine * seaward, beachSlope: 0, bedSlope: 0,
        }));
        const published = new UnityOcean({ shore, seaLevel: old.p[1], shoreDirX: cosine * seaward,
          shoreDirZ: sine * seaward, course: [], terrainHeight: () => old.p[1], sourceCoordinates,
          oceanWidth: old.width, shoreSampleMetres: old.length / old.longitudinalSegments,
          lateralSegments: old.lateralSegments,
        });
        const canonical = normalizeCustomLevelData({ ...makeData([]), ocean: old });
        assert.ok(canonical, "legacy ocean failed coordinate migration");
        assert.equal(canonical.ocean.geometryVersion, 2);
        assert.deepEqual(migrateCustomLevel(clone(canonical)), canonical, "ocean migration is not idempotent");
        const migrated = create(canonical);
        try {
          assertVertices(oceanVertices(migrated.water), oceanVertices(published), "legacy ocean changed its world footprint");
          assertWaterFacingUp(migrated.water);
          const movedData = clone(canonical);
          movedData.ocean.p = movedData.ocean.p.map((value, axis) => value + [5, 2, -7][axis]);
          const moved = create(movedData);
          try {
            const expected = oceanVertices(migrated.water).map(mesh => mesh.map((value, index) => value + [5, 2, -7][index % 3]));
            assertVertices(oceanVertices(moved.water), expected, "ocean ignored ordinary world translation");
          } finally { moved.dispose(); }
          if (!curved) {
            const editedData = clone(canonical);
            editOceanShoreline(editedData.ocean);
            const edited = create(editedData);
            try {
              assertVertices(oceanVertices(edited.water), oceanVertices(migrated.water), "entering shoreline node editing moved the ocean");
              assertWaterFacingUp(edited.water);
              assert.ok(straightenOceanShoreline(editedData.ocean));
              const straight = create(editedData);
              try { assertVertices(oceanVertices(straight.water), oceanVertices(migrated.water), "leaving shoreline node editing moved the ocean"); }
              finally { straight.dispose(); }
            } finally { edited.dispose(); }
          } else {
            const straightData = clone(canonical);
            const start = migrated.water.shore[0], end = migrated.water.shore.at(-1);
            assert.ok(straightenOceanShoreline(straightData.ocean));
            const straight = create(straightData);
            try {
              const actualStart = straight.water.shore[0], actualEnd = straight.water.shore.at(-1);
              assert.ok(Math.hypot(start.x - actualStart.x, start.z - actualStart.z) < 1e-8);
              assert.ok(Math.hypot(end.x - actualEnd.x, end.z - actualEnd.z) < 1e-8,
                "straightening reset the shoreline's endpoint placement");
              assertWaterFacingUp(straight.water);
            } finally { straight.dispose(); }
          }
        } finally { migrated.dispose(); published.dispose(); }
      }

    for (const quality of ["?lite", ""]) for (const id of ["beachfront", "descent"]) {
      window.location.search = quality;
      const native = new Level(new THREE.Scene(), { id, name: id });
      try {
        const ocean = native.captureData().ocean;
        assert.equal(ocean.geometryVersion, 2, "source capture did not use editor ocean coordinates");
        const rebuilt = create({ ...makeData([]), ocean });
        try { assertVertices(oceanVertices(rebuilt.water), oceanVertices(native.water), `${id} ${quality} native ocean capture changed geometry`); }
        finally { rebuilt.dispose(); }
      } finally { native.dispose(); }
    }

    window.location.search = "";
    const legacy = ["fern", "broadleaf", "flowers", "toadstool", "toadstools", "mossrock", "jungletree", "palm", "vines", "planter", "coastalhouse"];
    const batchNames = new Set(["fern", "leafy", "bloomA", "bloomB", "bloomC", "toadStem", "toadCap", "toadSpot", "mossRock", "jTrunk", "jCanopy", "vine"]);
    const vertices = (level) => {
      level.root.updateMatrixWorld(true);
      const points = [];
      for (const root of level.root.children) {
        if (root.userData.editorIdx !== 0 && !batchNames.has(root.name) && !root.name.startsWith("coastal:")) continue;
        root.traverse((object) => {
          const attribute = object.geometry?.attributes?.position;
          if (!attribute) return;
          for (let index = 0; index < attribute.count; index++)
            points.push(new THREE.Vector3().fromBufferAttribute(attribute, index).applyMatrix4(object.matrixWorld));
        });
      }
      return points;
    };
    for (const editor of [false, true]) {
      setEditorBuild(editor);
      for (const dkind of legacy) {
        const p = [6, 3, -4];
        const base = create(makeData([{ t: "decor", dkind, p }]));
        const scale = dkind === "flowers" || dkind === "planter" || dkind === "coastalhouse" ? 2 : 1;
        const changed = create(makeData([{ t: "decor", dkind, p, yaw: 90,
          ...(dkind === "coastalhouse" ? { s: [23, 16, 78] } : scale !== 1 ? { w: scale } : {}),
        }]));
        try {
          const before = vertices(base);
          const after = vertices(changed);
          assert.ok(before.length > 0, `${dkind} has no ${editor ? "editor" : "play"} geometry`);
          assert.equal(after.length, before.length);
          for (let index = 0; index < before.length; index++) {
            const local = before[index].clone().sub(new THREE.Vector3(...p)).multiplyScalar(scale);
            const expected = new THREE.Vector3(local.z, local.y, -local.x).add(new THREE.Vector3(...p));
            assert.ok(after[index].distanceTo(expected) < 0.00002,
              `${dkind} ignored its authored rotation/size in ${editor ? "editor" : "play"} geometry`);
          }
        } finally { changed.dispose(); base.dispose(); }
      }
    }
    console.log("PASS editor runtime authoring: moving rails, map hubs, bonus returns, coast hazards, traffic, triangle surfaces, oceans and scenery transforms");
  } finally {
    window.location.search = search;
    setEditorBuild(false);
  }
}
