import { readFile, readdir } from "node:fs/promises";
import { join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const provenanceRoot = join(repoRoot, "public/crt-guest/provenance");
const sourceRoot = join(provenanceRoot, "UpstreamSource");
const manifestPath = join(provenanceRoot, "ParameterManifest.json");
const releaseDeltaPath = join(provenanceRoot, "AuthorReleaseParameterDelta.json");
const generatedRoot = join(repoRoot, "src/crt-guest/generated");

const variants = [
  {
    id: "advanced",
    preset: "crt-guest-advanced.slangp",
    shaderPrefix: "shaders/guest/advanced/",
  },
  {
    id: "hd",
    preset: "crt-guest-advanced-hd.slangp",
    shaderPrefix: "shaders/guest/hd/",
  },
];

const ignoredParameter = (id) => id === "info02" || id.startsWith("bogus_");
// These are shader ABI fields, not user-facing #pragma controls. Keeping the
// allowlist explicit makes any newly generated non-control uniform an audit
// failure instead of silently treating every uParams_/uGlobal_ name as valid.
const generatedNonControlUniforms = {
  common: {
    FrameCount: "frame-varying shader input",
    LinearizePassSize: "intermediate texture dimensions",
    LUTBR: "upstream LUT compile-time override retains its ABI field",
    LUTLOW: "upstream LUT compile-time override retains its ABI field",
    MVP: "fullscreen vertex transform",
    OriginalSize: "original input dimensions",
    OutputSize: "pass output dimensions",
    SourceSize: "current pass input dimensions",
    deconr: "legacy upstream deconvergence ABI field without a #pragma control",
    prescalex: "legacy upstream prescale ABI field without a #pragma control",
  },
  advanced: {},
  hd: {
    GLOW_MAX: "HD bloom-pass ABI field without a #pragma control",
    inters: "HD main-pass ABI field without a #pragma control",
  },
};
const numberPattern = "[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?";
const pragmaPattern = new RegExp(
  `^\\s*#pragma\\s+parameter\\s+([A-Za-z_][A-Za-z0-9_]*)\\s+"([^"]*)"\\s+(${numberPattern})\\s+(${numberPattern})\\s+(${numberPattern})\\s+(${numberPattern})(?:\\s*//.*)?\\s*$`,
);

const errors = [];
const addError = (category, message) => errors.push({ category, message });

function sourceLocation(declaration) {
  return `${declaration.file}:${declaration.line}`;
}

function normalizedShape(shape) {
  return {
    label: shape.label.trim(),
    default: Number(shape.default),
    min: Number(shape.min),
    max: Number(shape.max),
    step: Number(shape.step),
  };
}

function shapeKey(shape) {
  return JSON.stringify(normalizedShape(shape));
}

function shapeText(shape) {
  const value = normalizedShape(shape);
  return `${JSON.stringify(value.label)} default=${value.default} min=${value.min} max=${value.max} step=${value.step}`;
}

function sortedSetDifference(left, right) {
  return [...left].filter((value) => !right.has(value)).sort();
}

async function selectedShaderFiles(variant) {
  const presetPath = join(sourceRoot, variant.preset);
  const preset = await readFile(presetPath, "utf8");
  const selected = [];

  for (const [index, line] of preset.split(/\r?\n/u).entries()) {
    const match = line.match(/^\s*shader\d+\s*=\s*(\S+)\s*$/u);
    if (!match) continue;

    const upstreamPath = match[1];
    if (!upstreamPath.startsWith(variant.shaderPrefix)) {
      addError(
        "preset",
        `${variant.preset}:${index + 1} selects ${upstreamPath}, outside ${variant.shaderPrefix}`,
      );
      continue;
    }

    const localRelativePath = `${variant.id}/${upstreamPath.slice(variant.shaderPrefix.length)}`;
    const absolutePath = resolve(sourceRoot, localRelativePath);
    const relativeToRoot = relative(sourceRoot, absolutePath);
    if (
      relativeToRoot === ".." ||
      relativeToRoot.startsWith(`..${sep}`) ||
      normalize(relativeToRoot) !== normalize(localRelativePath)
    ) {
      addError("preset", `${variant.preset}:${index + 1} has an unsafe shader path`);
      continue;
    }

    selected.push({
      absolutePath,
      relativePath: localRelativePath,
    });
  }

  if (selected.length === 0) {
    addError("preset", `${variant.preset} selects no shader stages`);
  }

  return [...new Map(selected.map((file) => [file.relativePath, file])).values()];
}

async function parseVariant(variant) {
  const files = await selectedShaderFiles(variant);
  const declarations = [];
  let rawPragmas = 0;
  let ignoredPragmas = 0;

  for (const file of files) {
    let source;
    try {
      source = await readFile(file.absolutePath, "utf8");
    } catch (error) {
      addError("source", `${file.relativePath}: ${error.message}`);
      continue;
    }

    for (const [index, line] of source.split(/\r?\n/u).entries()) {
      if (!/^\s*#pragma\s+parameter\b/u.test(line)) continue;
      rawPragmas += 1;

      const match = line.match(pragmaPattern);
      if (!match) {
        addError("parse", `${file.relativePath}:${index + 1} has an unsupported parameter declaration`);
        continue;
      }

      const [, id, label, defaultValue, min, max, step] = match;
      if (ignoredParameter(id)) {
        ignoredPragmas += 1;
        continue;
      }

      declarations.push({
        id,
        label: label.trim(),
        default: Number(defaultValue),
        min: Number(min),
        max: Number(max),
        step: Number(step),
        file: file.relativePath,
        line: index + 1,
      });
    }
  }

  const byId = new Map();
  for (const declaration of declarations) {
    const existing = byId.get(declaration.id) ?? [];
    existing.push(declaration);
    byId.set(declaration.id, existing);
  }

  return {
    ...variant,
    files,
    declarations,
    byId,
    rawPragmas,
    ignoredPragmas,
  };
}

async function parseGeneratedUniforms(variant) {
  const directory = join(generatedRoot, variant.id);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".glsl"))
    .map((entry) => entry.name)
    .sort();
  const byId = new Map();
  const declarationPattern =
    /^\s*uniform\s+[^;\r\n]*\bu(Params|Global)_([A-Za-z_][A-Za-z0-9_]*)\s*;\s*$/u;

  for (const file of files) {
    const source = await readFile(join(directory, file), "utf8");
    for (const [index, line] of source.split(/\r?\n/u).entries()) {
      const match = line.match(declarationPattern);
      if (!match) continue;
      const [, namespace, id] = match;
      const declarations = byId.get(id) ?? [];
      declarations.push({
        namespace,
        file: `${variant.id}/${file}`,
        line: index + 1,
      });
      byId.set(id, declarations);
    }
  }

  return { files, byId };
}

function manifestParameters(manifest) {
  const parameters = new Map();

  for (const group of manifest.groups ?? []) {
    for (const parameter of group.parameters ?? []) {
      if (parameters.has(parameter.id)) {
        addError("manifest", `duplicate manifest parameter ${parameter.id}`);
        continue;
      }
      parameters.set(parameter.id, { group: group.id, ...parameter });
    }
  }

  return parameters;
}

function compareVariant(actual, manifestById) {
  const expected = new Map(
    [...manifestById.values()]
      .filter((parameter) => parameter.variants?.includes(actual.id))
      .map((parameter) => [parameter.id, parameter]),
  );
  const actualIds = new Set(actual.byId.keys());
  const expectedIds = new Set(expected.keys());

  for (const id of sortedSetDifference(expectedIds, actualIds)) {
    addError("missing-control", `${actual.id}: ${id}`);
  }
  for (const id of sortedSetDifference(actualIds, expectedIds)) {
    const locations = actual.byId.get(id).map(sourceLocation).join(", ");
    addError("extra-control", `${actual.id}: ${id} at ${locations}`);
  }

  for (const [id, declarations] of actual.byId) {
    const signatures = new Map();
    for (const declaration of declarations) {
      const signature = shapeKey(declaration);
      const locations = signatures.get(signature) ?? [];
      locations.push(sourceLocation(declaration));
      signatures.set(signature, locations);
    }
    if (signatures.size > 1) {
      const detail = [...signatures.entries()]
        .map(([signature, locations]) => `${signature} at ${locations.join(", ")}`)
        .join("; ");
      addError("conflict", `${actual.id}: ${id}: ${detail}`);
    }

    const parameter = expected.get(id);
    if (!parameter) continue;
    const expectedShape = parameter.canonical ?? parameter[actual.id];
    if (!expectedShape) {
      addError("manifest", `${actual.id}: ${id} has no range metadata`);
      continue;
    }

    for (const declaration of declarations) {
      if (shapeKey(declaration) !== shapeKey(expectedShape)) {
        addError(
          "metadata",
          `${actual.id}: ${id} at ${sourceLocation(declaration)} is ${shapeText(declaration)}; manifest is ${shapeText(expectedShape)}`,
        );
      }
    }

    const expectedLocations = new Set(
      (parameter.declarations?.[actual.id] ?? []).map(({ file, line }) => `${file}:${line}`),
    );
    const actualLocations = new Set(declarations.map(sourceLocation));
    for (const location of sortedSetDifference(expectedLocations, actualLocations)) {
      addError("missing-declaration", `${actual.id}: ${id} expected at ${location}`);
    }
    for (const location of sortedSetDifference(actualLocations, expectedLocations)) {
      addError("extra-declaration", `${actual.id}: ${id} found at ${location}`);
    }
  }

  return expected;
}

function compareGeneratedUniforms(variant, generated, expected) {
  const expectedIds = new Set(expected.keys());
  const generatedIds = new Set(generated.byId.keys());
  const allowlist = {
    ...generatedNonControlUniforms.common,
    ...generatedNonControlUniforms[variant.id],
  };
  const allowlistedIds = new Set(Object.keys(allowlist));

  for (const id of sortedSetDifference(expectedIds, generatedIds)) {
    addError("missing-generated-uniform", `${variant.id}: ${id}`);
  }

  for (const id of sortedSetDifference(generatedIds, expectedIds)) {
    if (allowlistedIds.has(id)) continue;
    const locations = generated.byId
      .get(id)
      .map(({ namespace, file, line }) => `${file}:${line} (u${namespace}_${id})`)
      .join(", ");
    addError("extra-generated-uniform", `${variant.id}: ${id} at ${locations}`);
  }

  for (const id of sortedSetDifference(allowlistedIds, generatedIds)) {
    addError(
      "stale-generated-allowlist",
      `${variant.id}: ${id} (${allowlist[id]}) is allowlisted but not generated`,
    );
  }

  return {
    controlCount: [...generatedIds].filter((id) => expectedIds.has(id)).length,
    nonControlCount: [...generatedIds].filter((id) => allowlistedIds.has(id)).length,
    totalCount: generatedIds.size,
    fileCount: generated.files.length,
  };
}

function validateRangeShape(shape, context) {
  if (!shape || typeof shape !== "object" || Array.isArray(shape)) {
    addError("release-delta", `${context} is not an object`);
    return false;
  }
  if (typeof shape.label !== "string" || shape.label.trim() === "") {
    addError("release-delta", `${context}.label must be a non-empty string`);
  }
  for (const key of ["default", "min", "max", "step"]) {
    if (typeof shape[key] !== "number" || !Number.isFinite(shape[key])) {
      addError("release-delta", `${context}.${key} must be a finite number`);
      return false;
    }
  }
  if (shape.min > shape.max) {
    addError("release-delta", `${context} has min greater than max`);
  }
  if (shape.default < shape.min || shape.default > shape.max) {
    addError("release-delta", `${context} has a default outside its range`);
  }
  if (shape.step <= 0) {
    addError("release-delta", `${context}.step must be positive`);
  }
  return true;
}

function validateReleaseDelta(delta, manifest, manifestById, expectedVariants) {
  const variantNames = new Set(variants.map(({ id }) => id));
  const targetSets = new Map(
    [...expectedVariants].map(([variant, parameters]) => [variant, new Set(parameters.keys())]),
  );
  const changedPairs = new Set();

  if (delta.schemaVersion !== 1) {
    addError("release-delta", `unsupported schemaVersion ${delta.schemaVersion}`);
  }
  if (delta.base?.repository !== manifest.source.repository) {
    addError("release-delta", "base repository does not match ParameterManifest.json");
  }
  if (delta.base?.commit !== manifest.source.commit) {
    addError("release-delta", "base commit does not match ParameterManifest.json");
  }
  for (const [name, count] of Object.entries(manifest.counts ?? {})) {
    if (delta.base?.counts?.[name] !== count) {
      addError("release-delta", `base count ${name} does not match the manifest`);
    }
  }
  if (
    typeof delta.target?.repository !== "string" ||
    !/^https:\/\/github\.com\//u.test(delta.target.repository) ||
    !/^[0-9a-f]{40}$/u.test(delta.target?.commit ?? "") ||
    typeof delta.target?.release !== "string" ||
    delta.target.release === ""
  ) {
    addError("release-delta", "target repository, commit, or release is invalid");
  }

  function checkedVariants(entry, context) {
    if (!Array.isArray(entry.variants) || entry.variants.length === 0) {
      addError("release-delta", `${context}.variants must be a non-empty array`);
      return [];
    }
    const unique = new Set(entry.variants);
    if (unique.size !== entry.variants.length) {
      addError("release-delta", `${context}.variants contains duplicates`);
    }
    for (const variant of unique) {
      if (!variantNames.has(variant)) {
        addError("release-delta", `${context} has unknown variant ${variant}`);
      }
    }
    return [...unique].filter((variant) => variantNames.has(variant));
  }

  for (const [index, addition] of (delta.additions ?? []).entries()) {
    const context = `additions[${index}]`;
    validateRangeShape(addition.value, `${context}.value`);
    for (const variant of checkedVariants(addition, context)) {
      const pair = `${variant}:${addition.id}`;
      if (changedPairs.has(pair)) addError("release-delta", `duplicate change for ${pair}`);
      changedPairs.add(pair);
      if (targetSets.get(variant).has(addition.id)) {
        addError("release-delta", `${pair} is already present in the base`);
      }
      targetSets.get(variant).add(addition.id);
    }
  }

  for (const [index, removal] of (delta.removals ?? []).entries()) {
    const context = `removals[${index}]`;
    validateRangeShape(removal.before, `${context}.before`);
    for (const variant of checkedVariants(removal, context)) {
      const pair = `${variant}:${removal.id}`;
      if (changedPairs.has(pair)) addError("release-delta", `duplicate change for ${pair}`);
      changedPairs.add(pair);
      const parameter = manifestById.get(removal.id);
      const baseShape = parameter?.canonical ?? parameter?.[variant];
      if (!targetSets.get(variant).has(removal.id) || !baseShape) {
        addError("release-delta", `${pair} is not present in the base`);
      } else if (shapeKey(removal.before) !== shapeKey(baseShape)) {
        addError("release-delta", `${pair} removal metadata does not match the base`);
      }
      targetSets.get(variant).delete(removal.id);
    }
  }

  for (const [index, change] of (delta.metadataChanges ?? []).entries()) {
    const context = `metadataChanges[${index}]`;
    validateRangeShape(change.before, `${context}.before`);
    validateRangeShape(change.after, `${context}.after`);
    if (shapeKey(change.before) === shapeKey(change.after)) {
      addError("release-delta", `${context} does not change metadata`);
    }
    for (const variant of checkedVariants(change, context)) {
      const pair = `${variant}:${change.id}`;
      if (changedPairs.has(pair)) addError("release-delta", `duplicate change for ${pair}`);
      changedPairs.add(pair);
      const parameter = manifestById.get(change.id);
      const baseShape = parameter?.canonical ?? parameter?.[variant];
      if (!targetSets.get(variant).has(change.id) || !baseShape) {
        addError("release-delta", `${pair} is not a retained base control`);
      } else if (shapeKey(change.before) !== shapeKey(baseShape)) {
        addError("release-delta", `${pair} before metadata does not match the base`);
      }
    }
  }

  const advanced = targetSets.get("advanced");
  const hd = targetSets.get("hd");
  const calculatedTargetCounts = {
    advanced: advanced.size,
    hd: hd.size,
    shared: [...advanced].filter((id) => hd.has(id)).length,
    union: new Set([...advanced, ...hd]).size,
  };
  for (const [name, count] of Object.entries(calculatedTargetCounts)) {
    if (delta.target?.counts?.[name] !== count) {
      addError(
        "release-delta",
        `target count ${name} says ${delta.target?.counts?.[name] ?? "missing"}; arithmetic gives ${count}`,
      );
    }
  }

  return calculatedTargetCounts;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const releaseDelta = JSON.parse(await readFile(releaseDeltaPath, "utf8"));
const manifestById = manifestParameters(manifest);
const actualVariants = [];
const expectedVariants = new Map();
const generatedSummaries = new Map();

for (const variant of variants) {
  const actual = await parseVariant(variant);
  actualVariants.push(actual);
  const expected = compareVariant(actual, manifestById);
  expectedVariants.set(variant.id, expected);
  const generated = await parseGeneratedUniforms(variant);
  generatedSummaries.set(
    variant.id,
    compareGeneratedUniforms(variant, generated, expected),
  );
}

const advancedIds = new Set(expectedVariants.get("advanced").keys());
const hdIds = new Set(expectedVariants.get("hd").keys());
const sharedIds = new Set([...advancedIds].filter((id) => hdIds.has(id)));
const unionIds = new Set([...advancedIds, ...hdIds]);
const calculatedCounts = {
  advanced: advancedIds.size,
  hd: hdIds.size,
  shared: sharedIds.size,
  union: unionIds.size,
};

for (const [name, count] of Object.entries(calculatedCounts)) {
  if (manifest.counts?.[name] !== count) {
    addError(
      "count",
      `${name}: manifest says ${manifest.counts?.[name] ?? "missing"}; calculated ${count}`,
    );
  }
}
const calculatedTargetCounts = validateReleaseDelta(
  releaseDelta,
  manifest,
  manifestById,
  expectedVariants,
);

console.log("CRT Guest parameter audit");
console.log(`Pinned source: ${manifest.source.repository}@${manifest.source.commit}`);
for (const actual of actualVariants) {
  const generated = generatedSummaries.get(actual.id);
  console.log(
    `${actual.id}: ${actual.byId.size} controls, ${actual.declarations.length} control declarations, ` +
      `${actual.ignoredPragmas} ignored UI/info rows, ${actual.files.length} selected shader files`,
  );
  console.log(
    `${actual.id} generated: ${generated.controlCount}/${actual.byId.size} controls, ` +
      `${generated.nonControlCount} explicit ABI fields, ${generated.fileCount} shader files`,
  );
}
console.log(
  `catalog: ${calculatedCounts.union} union, ${calculatedCounts.shared} shared ` +
    `(${calculatedCounts.advanced} Advanced / ${calculatedCounts.hd} HD)`,
);
console.log(
  `author release delta: ${releaseDelta.additions.length} additions, ` +
    `${releaseDelta.removals.length} removal, ${releaseDelta.metadataChanges.length} metadata rows; ` +
    `${calculatedTargetCounts.union} target union`,
);

if (errors.length > 0) {
  const categories = new Map();
  for (const error of errors) {
    const category = categories.get(error.category) ?? [];
    category.push(error.message);
    categories.set(error.category, category);
  }
  console.error(`FAIL: ${errors.length} mismatch${errors.length === 1 ? "" : "es"}`);
  for (const [category, messages] of categories) {
    console.error(`\n[${category}]`);
    for (const message of messages) console.error(`- ${message}`);
  }
  process.exitCode = 1;
} else {
  console.log("PASS: 0 missing, extra, conflicting, metadata, provenance, or count mismatches.");
}
