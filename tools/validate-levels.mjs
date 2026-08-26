import { readFile } from "node:fs/promises";

const file = new URL("../public/levels.json", import.meta.url);
const payload = JSON.parse(await readFile(file, "utf8"));
const errors = [];
const rows = [];

const finiteTuple = (value, length) =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((part) => Number.isFinite(part));

if (payload?.v !== 2) errors.push("root.v must be 2");
if (!Array.isArray(payload?.levels)) errors.push("root.levels must be an array");

const ids = new Set();
for (const [levelIndex, level] of (payload.levels ?? []).entries()) {
  const label = `levels[${levelIndex}]`;
  if (!level || typeof level !== "object") {
    errors.push(`${label} must be an object`);
    continue;
  }
  if (typeof level.id !== "string" || !/^[a-z0-9-]+$/.test(level.id))
    errors.push(`${label}.id must be a lowercase slug`);
  else if (ids.has(level.id)) errors.push(`${label}.id duplicates ${level.id}`);
  else ids.add(level.id);
  if (typeof level.name !== "string" || !level.name.trim())
    errors.push(`${label}.name must be a non-empty string`);

  const data = level.data;
  if (!data || typeof data !== "object") {
    errors.push(`${label}.data must be an object`);
    continue;
  }
  if (data.v !== 1) errors.push(`${label}.data.v must be 1`);
  if (!finiteTuple(data.spawn, 3)) errors.push(`${label}.data.spawn must be three finite numbers`);
  if (!Number.isFinite(data.killY)) errors.push(`${label}.data.killY must be finite`);
  if (!Array.isArray(data.components)) {
    errors.push(`${label}.data.components must be an array`);
    continue;
  }

  let gates = 0;
  let minX = data.spawn?.[0] ?? 0;
  let maxX = minX;
  let minZ = data.spawn?.[2] ?? 0;
  let maxZ = minZ;
  for (const [componentIndex, component] of data.components.entries()) {
    const path = `${label}.data.components[${componentIndex}]`;
    if (!component || typeof component !== "object") {
      errors.push(`${path} must be an object`);
      continue;
    }
    if (typeof component.t !== "string" || !component.t)
      errors.push(`${path}.t must be a non-empty string`);
    if (!finiteTuple(component.p, 3)) errors.push(`${path}.p must be three finite numbers`);
    else {
      minX = Math.min(minX, component.p[0]);
      maxX = Math.max(maxX, component.p[0]);
      minZ = Math.min(minZ, component.p[2]);
      maxZ = Math.max(maxZ, component.p[2]);
    }
    if (component.s !== undefined && !finiteTuple(component.s, 3))
      errors.push(`${path}.s must be three finite numbers when present`);
    if (
      component.pts !== undefined &&
      (!Array.isArray(component.pts) ||
        component.pts.some(
          (point) =>
            !Array.isArray(point) ||
            point.length < 2 ||
            point.length > 5 ||
            point.some((part) => !Number.isFinite(part)),
        ))
    )
      errors.push(`${path}.pts must contain finite 2–5 number points when present`);
    if (component.t === "gate") gates += 1;
  }
  if (gates !== 1) errors.push(`${label} must contain exactly one finish gate (found ${gates})`);
  rows.push({
    id: level.id,
    components: data.components.length,
    span: `${(maxX - minX).toFixed(1)} × ${(maxZ - minZ).toFixed(1)}`,
  });
}

if (errors.length) {
  console.error(`Level validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${rows.length} published level(s).`);
  console.table(rows);
}
