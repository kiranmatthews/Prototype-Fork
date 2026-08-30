import { readFile } from "node:fs/promises";

const file = new URL("../public/levels.json", import.meta.url);
const payload = JSON.parse(await readFile(file, "utf8"));
const errors = [];
const rows = [];
const componentTypes = new Set([
  "platform", "ramp", "wall", "wallpath", "rail", "pipe", "vertramp", "crumble",
  "pit", "crate", "metal", "rock", "camnode", "outline", "checkpoint",
  "enemy", "crusher", "mover", "torch", "phasepad", "stone", "pendulum",
  "ropeswing", "gate", "clock", "comboorb", "zone", "rope", "terrain",
  "woodpath", "trampoline", "speedpad", "trickgate", "trickrail",
  "returnportal", "grindosaurus", "angryball", "decor", "wumpa", "crystal",
]);
const deckTricks = new Set(["kick", "heel", "shove", "imposs", "varial"]);

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
    else if (!componentTypes.has(component.t))
      errors.push(`${path}.t has unsupported component type ${component.t}`);
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
    if (
      (component.t === "trickgate" || component.t === "trickrail") &&
      component.trick !== undefined &&
      !deckTricks.has(component.trick)
    )
      errors.push(`${path}.trick must be kick, heel, shove, imposs, or varial`);
    if (
      component.t === "returnportal" &&
      component.to !== undefined &&
      !finiteTuple(component.to, 3)
    )
      errors.push(`${path}.to must be three finite destination numbers when present`);
    if (
      (component.t === "woodpath" || component.t === "wallpath") &&
      component.pts !== undefined &&
      component.pts.length < 2
    )
      errors.push(`${path}.pts must contain at least two path nodes`);
    if (
      component.t === "wallpath" &&
      ((!component.pts && component.len !== undefined && component.len < 1) ||
        (component.w !== undefined && component.w < 0.1) ||
        (component.rise !== undefined && component.rise < 0.2) ||
        (component.collisionHeight !== undefined && component.collisionHeight < 0.2))
    )
      errors.push(`${path} wallpath thickness/height fields must be positive`);
    if (
      component.widths !== undefined &&
      (!Array.isArray(component.widths) ||
        component.widths.some((value) => !Number.isFinite(value) || value <= 0) ||
        (component.pts && component.widths.length !== component.pts.length))
    )
      errors.push(`${path}.widths must be positive finite values matching pts`);
    if (
      (component.t === "trampoline" || component.t === "speedpad") &&
      component.speed !== undefined &&
      (!Number.isFinite(component.speed) || component.speed <= 0)
    )
      errors.push(`${path}.speed must be a positive finite launch/boost speed`);
    if (
      component.t === "trickgate" &&
      component.radius !== undefined &&
      (!Number.isFinite(component.radius) || component.radius <= 0)
    )
      errors.push(`${path}.radius must be positive when present`);
    for (const key of ["spacing", "baySpacing", "supportDepth"]) {
      if (
        component[key] !== undefined &&
        (!Number.isFinite(component[key]) || component[key] <= 0)
      )
        errors.push(`${path}.${key} must be positive and finite when present`);
    }
    for (const key of ["yaw", "exitYaw", "amp", "cycle", "range", "rise", "w", "coverage", "radius", "collisionHeight"]) {
      if (component[key] !== undefined && !Number.isFinite(component[key]))
        errors.push(`${path}.${key} must be finite when present`);
    }
    if (
      component.t === "trampoline" &&
      component.amp !== undefined &&
      component.amp < 1
    )
      errors.push(`${path}.amp must be at least 1 when present`);
    if (
      component.t === "speedpad" &&
      component.cycle !== undefined &&
      component.cycle <= 0
    )
      errors.push(`${path}.cycle must be positive when present`);
    if (
      component.t === "grindosaurus" &&
      ((component.range !== undefined && component.range < 0) ||
        (component.speed !== undefined && component.speed < 0) ||
        (component.coverage !== undefined &&
          (component.coverage < 0.1 || component.coverage > 1)))
    )
      errors.push(`${path} Grindosaurus range/speed/coverage are out of range`);
    if (
      component.t === "angryball" &&
      ((component.w !== undefined && component.w < 0) ||
        (component.rise !== undefined && component.rise < 0.5) ||
        (component.radius !== undefined && component.radius < 0.25) ||
        (component.range !== undefined && component.range < 1) ||
        (component.speed !== undefined && component.speed < 0))
    )
      errors.push(`${path} Angry Ball profile fields are out of range`);
    for (const key of ["scaffold", "supports", "rails", "terrainSupports", "airOnly", "solid"]) {
      if (component[key] !== undefined && typeof component[key] !== "boolean")
        errors.push(`${path}.${key} must be boolean when present`);
    }
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
