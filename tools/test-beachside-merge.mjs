import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const compilerOptions = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2020,
};

const transpile = (relativeFile) => {
  const file = path.join(root, relativeFile);
  return {
    file,
    output: ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions,
      fileName: file,
    }).outputText,
  };
};

const asDataUrl = (file, output) =>
  `data:text/javascript;base64,${Buffer.from(
    `${output}\n//# sourceURL=${pathToFileURL(file).href}`,
  ).toString("base64")}`;

const courseSource = transpile("src/beachfrontCourse.ts");
const courseUrl = asDataUrl(courseSource.file, courseSource.output);
const course = await import(courseUrl);

const levelSource = transpile("src/levels/beachfront-run.ts");
levelSource.output = levelSource.output.replace(
  'from "../beachfrontCourse"',
  `from "${courseUrl}"`,
);
const { BEACHFRONT_RUN_LEVEL: level } = await import(
  asDataUrl(levelSource.file, levelSource.output)
);

const near = (actual, expected, epsilon = 1e-9, label = "value") =>
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `${label}: expected ${expected}, received ${actual}`,
  );
const r2 = (value) => Math.round(value * 100) / 100;

assert.equal(course.BEACHFRONT_COURSE_LENGTH, 740);
assert.equal(course.BEACHFRONT_SEA_LEVEL, -0.36);
assert.equal(course.BEACHFRONT_SAND_TEXTURE_TILE_SIZE, 5.4);
const openingFrame = course.beachfrontFrameAtDistance(0);
near(openingFrame.x, 0, 1e-12, "opening x");
near(openingFrame.z, 20, 1e-12, "opening z");
near(openingFrame.fx, 0.22345458444593702, 1e-15, "opening forward x");
near(openingFrame.fz, -0.9747143420972596, 1e-15, "opening forward z");
near(
  course.beachfrontSandHeight(41, -1.5),
  0.3465093136335003,
  1e-15,
  "first access exact sand height",
);
near(
  course.beachfrontSandHeight(126, -1.5),
  0.3755744522055337,
  1e-15,
  "first exit exact sand height",
);

const definitions = [
  [50, -1.5, 5.5],
  [138, 1.4, 5.8],
  [228, -3, 5.2],
  [318, 0.5, 6],
  [414, -2, 5.5],
  [505, 2, 5.8],
  [604, -1, 6],
];

const sequences = definitions.map(([sequenceStart, lateral, width], sequence) => {
  const spans = [];
  let cursor = sequenceStart;
  for (let island = 0; island < 4; island++) {
    const length = 10 + ((sequence * 5 + island * 7) % 9);
    const start = cursor;
    const end = start + length;
    spans.push({ start, end });
    cursor = end + (island < 3 ? 3 + ((sequence + island) % 3) : 0);
  }
  return {
    sequence,
    lateral,
    width,
    spans,
    accessStart: spans[0].start - 9,
    accessEnd: spans.at(-1).end + 9,
    deckY:
      Math.max(
        ...spans.map(({ start, end }) => {
          const middle = (start + end) * 0.5;
          return Math.max(
            course.beachfrontSandHeight(middle, lateral) + 0.28,
            course.beachfrontFootprintMaximumHeight(
              start,
              end,
              lateral,
              width,
              13,
              13,
            ) + 0.04,
          );
        }),
      ) + 4,
  };
});

const paths = level.components.filter((component) => component.t === "woodpath");
assert.equal(paths.length, 7, "Beachside must have one path per sequence");
for (const type of ["terrain", "platform", "pit", "rock"]) {
  assert.equal(
    level.components.filter((component) => component.t === type).length,
    0,
    `overlay must not retain approximate ${type} components`,
  );
}

const worldNode = (component, index) => {
  const node = component.pts[index];
  return [
    component.p[0] + node[0],
    component.p[1] + node[3],
    component.p[2] + node[1],
  ];
};

for (const sequence of sequences) {
  const sequencePaths = paths.filter(
    (component) => component.grp === 10 + sequence.sequence,
  );
  assert.equal(sequencePaths.length, 1, `sequence ${sequence.sequence + 1}`);
  const component = sequencePaths[0];
  assert.equal(component.pts.length, 16);
  assert.equal(component.widths.length, 16);
  assert.equal(component.w, sequence.width);
  assert.equal(component.structureStyle, "beach");
  assert.equal(component.scaffold, true);
  assert.equal(component.supports, true);
  assert.equal(component.rails, true);
  assert.equal(component.spacing, 0.72);
  assert.equal(component.baySpacing, 4.2);
  assert.equal(component.terrainSupports, true);
  near(
    component.supportBaseY,
    r2(sequence.deckY - 4),
    1e-12,
    `sequence ${sequence.sequence + 1} island support base`,
  );
  const first = sequence.spans[0];
  const last = sequence.spans.at(-1);
  const sourceWidth = (span, distance, secondary = false) => {
    const t = (distance - span.start) / (span.end - span.start);
    const sign = (sequence.sequence + sequence.spans.indexOf(span)) % 2 === 0 ? 1 : -1;
    return (
      0.96 +
      0.06 * Math.sin(Math.PI * t) +
      (secondary ? 0.015 * sign * Math.sin(Math.PI * 2 * t) : 0)
    );
  };
  const firstDistances = [
    sequence.accessStart,
    first.start,
    (first.start + first.end) * 0.5,
    ((first.start + first.end) * 0.5 + first.end) * 0.5,
    first.end,
  ];
  const expectedWidths = firstDistances.map((distance) => {
    const t = (distance - sequence.accessStart) / (first.end - sequence.accessStart);
    return 0.84 + (sourceWidth(first, distance) - 0.84) * t;
  });
  for (const span of sequence.spans.slice(1, -1))
    for (const distance of [span.start, (span.start + span.end) * 0.5, span.end])
      expectedWidths.push(sourceWidth(span, distance, true));
  const lastDistances = [
    last.start,
    (last.start + (last.start + last.end) * 0.5) * 0.5,
    (last.start + last.end) * 0.5,
    last.end,
    sequence.accessEnd,
  ];
  for (const distance of lastDistances) {
    const t = (distance - last.start) / (sequence.accessEnd - last.start);
    const source = sourceWidth(last, distance);
    expectedWidths.push(source + (0.84 - source) * t);
  }
  assert.deepEqual(
    component.widths.map((width) => r2(width / sequence.width)),
    expectedWidths.map((width) => r2(r2(width * sequence.width) / sequence.width)),
    `sequence ${sequence.sequence + 1} source width profile`,
  );

  const expectedEntry = course.beachfrontPointAtDistance(
    sequence.accessStart,
    sequence.lateral,
    course.beachfrontSandHeight(sequence.accessStart, sequence.lateral) + 0.18,
  );
  const expectedExit = course.beachfrontPointAtDistance(
    sequence.accessEnd,
    sequence.lateral,
    course.beachfrontSandHeight(sequence.accessEnd, sequence.lateral) + 0.18,
  );
  const entry = worldNode(component, 0);
  const exit = worldNode(component, 15);
  for (let axis = 0; axis < 3; axis++) {
    near(entry[axis], expectedEntry[axis], 0.011, `sequence ${sequence.sequence + 1} entry`);
    near(exit[axis], expectedExit[axis], 0.011, `sequence ${sequence.sequence + 1} exit`);
  }
  near(
    entry[1] - course.beachfrontSandHeight(sequence.accessStart, sequence.lateral),
    0.18,
    0.011,
    `sequence ${sequence.sequence + 1} entry clearance`,
  );
  near(
    exit[1] - course.beachfrontSandHeight(sequence.accessEnd, sequence.lateral),
    0.18,
    0.011,
    `sequence ${sequence.sequence + 1} exit clearance`,
  );

  // Former 3/4/5m holes remain as source control spans, but now live inside
  // the same swept path and therefore receive continuous collision/scaffold.
  for (const [spanIndex, [beforeIndex, afterIndex]] of [
    [0, [4, 5]],
    [1, [7, 8]],
    [2, [10, 11]],
  ]) {
    const before = worldNode(component, beforeIndex);
    const after = worldNode(component, afterIndex);
    const authoredBefore = sequence.spans[spanIndex].end;
    const authoredAfter = sequence.spans[spanIndex + 1].start;
    const expectedBefore = course.beachfrontPointAtDistance(
      authoredBefore,
      sequence.lateral,
      sequence.deckY,
    );
    const expectedAfter = course.beachfrontPointAtDistance(
      authoredAfter,
      sequence.lateral,
      sequence.deckY,
    );
    for (let axis = 0; axis < 3; axis++) {
      near(before[axis], expectedBefore[axis], 0.011, "internal bridge start");
      near(after[axis], expectedAfter[axis], 0.011, "internal bridge end");
    }
    near(before[1], r2(sequence.deckY), 0.011, "internal bridge deck y");
    near(after[1], r2(sequence.deckY), 0.011, "internal bridge deck y");
  }
}

assert.equal(level.components.filter((component) => component.t === "crate").length, 16);
assert.equal(level.components.filter((component) => component.t === "wumpa").length, 84);
assert.equal(level.components.filter((component) => component.t === "checkpoint").length, 4);
assert.equal(level.components.filter((component) => component.t === "gate").length, 1);

const crates = level.components.filter((component) => component.t === "crate");
for (const [crateIndex, sequenceIndex] of [
  [8, 3],
  [11, 5],
]) {
  near(
    crates[crateIndex].p[1],
    r2(sequences[sequenceIndex].deckY),
    1e-12,
    `former-gap crate ${crateIndex + 1} deck seat`,
  );
}

const gate = level.components.find((component) => component.t === "gate");
const expectedGate = course.beachfrontPointAtDistance(720, 2);
near(gate.p[0], expectedGate[0], 0.011, "finish lateral +2 x");
near(gate.p[1], expectedGate[1], 0.011, "finish lateral +2 y");
near(gate.p[2], expectedGate[2], 0.011, "finish lateral +2 z");

const fruit = level.components.filter((component) => component.t === "wumpa");
for (const [fruitIndex, sequenceIndex] of [
  [8, 0],
  [17, 1],
  [19, 1],
  [31, 2],
  [65, 5],
]) {
  near(
    fruit[fruitIndex].p[1],
    r2(r2(sequences[sequenceIndex].deckY) + 0.92),
    1e-12,
    `former-gap fruit ${fruitIndex + 1} deck seat`,
  );
}

const runtimeSource = readFileSync(path.join(root, "src/level.ts"), "utf8");
assert.match(runtimeSource, /\{ id: "beachfront", name: "Beachside Run" \}/);
assert.doesNotMatch(runtimeSource, /name: "Unity Beachfront Run"/);
assert.match(runtimeSource, /buildBeachsideGameplayOverlay\(\)/);
assert.match(runtimeSource, /buildBeachsideCoastContainment\(reference\.shore\)/);
assert.match(
  runtimeSource,
  /mesh !== deck && !mesh\.userData\.woodPathComp/,
  "terrain-seeking supports must ignore earlier boardwalk collision decks",
);
const presentationSource = readFileSync(
  path.join(root, "src/beachfront.ts"),
  "utf8",
);
assert.match(presentationSource, /from "\.\/beachfrontCourse"/);
assert.match(presentationSource, /createBeachfrontCliffVisual\(\)/);
assert.match(presentationSource, /cliff\.visible = false/);

console.log(
  "Validated exact shared Beachfront course sampling and seven continuous sand-to-sand Beachside boardwalk sequences.",
);
