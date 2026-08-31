import {
  ANIMATION_SUITE_SCHEMA,
  ANIMATION_SUITE_SCHEMA_VERSION,
  HUMANOID_JOINT_ROLES,
  RIG_SCHEMA,
  RIG_SCHEMA_VERSION,
  PROCEDURAL_DRIVER_SCHEMA,
  PROCEDURAL_DRIVER_SCHEMA_VERSION,
  type AnimationSuiteDocument,
  type RigDefinition,
  type ValidationIssue,
  type ValidationResult,
} from './types';
import { migrateAnimationSuite, migrateRigDefinition } from './migration';
import { normalizeAnimationSuite } from './normalize';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(
  issues: ValidationIssue[],
  path: string,
  code: string,
  message: string,
  severity: ValidationIssue['severity'] = 'error',
): void {
  issues.push({ path, code, message, severity });
}

function requireRecord(value: unknown, path: string, issues: ValidationIssue[]): UnknownRecord | null {
  if (isRecord(value)) return value;
  issue(issues, path, 'type.object', 'must be an object');
  return null;
}

function requireString(value: unknown, path: string, issues: ValidationIssue[]): value is string {
  if (typeof value === 'string' && value.trim().length > 0) return true;
  issue(issues, path, 'type.nonempty-string', 'must be a non-empty string');
  return false;
}

function requireFinite(value: unknown, path: string, issues: ValidationIssue[]): value is number {
  if (typeof value === 'number' && Number.isFinite(value)) return true;
  issue(issues, path, 'type.finite-number', 'must be a finite number');
  return false;
}

function validateTuple(
  value: unknown,
  length: number,
  path: string,
  issues: ValidationIssue[],
): value is number[] {
  if (!Array.isArray(value) || value.length !== length) {
    issue(issues, path, `type.tuple${length}`, `must be an array of ${length} finite numbers`);
    return false;
  }
  let valid = true;
  for (let index = 0; index < length; index += 1) {
    if (!requireFinite(value[index], `${path}[${index}]`, issues)) valid = false;
  }
  return valid;
}

function validateJson(value: unknown, path: string, issues: ValidationIssue[], seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return true;
    issue(issues, path, 'json.nonfinite', 'JSON numeric values must be finite');
    return false;
  }
  if (typeof value !== 'object' || value === undefined) {
    issue(issues, path, 'json.unsupported', 'must contain only JSON values');
    return false;
  }
  if (seen.has(value)) {
    issue(issues, path, 'json.cycle', 'must not contain circular references');
    return false;
  }
  seen.add(value);
  let valid = true;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      if (!validateJson(entry, `${path}[${index}]`, issues, seen)) valid = false;
    });
  } else {
    for (const [key, entry] of Object.entries(value)) {
      if (!validateJson(entry, `${path}.${key}`, issues, seen)) valid = false;
    }
  }
  seen.delete(value);
  return valid;
}

function validateUniqueIds(
  values: unknown[],
  path: string,
  issues: ValidationIssue[],
): Map<string, UnknownRecord> {
  const result = new Map<string, UnknownRecord>();
  values.forEach((raw, index) => {
    if (!isRecord(raw) || !requireString(raw.id, `${path}[${index}].id`, issues)) return;
    if (result.has(raw.id)) issue(issues, `${path}[${index}].id`, 'id.duplicate', `duplicate ID "${raw.id}"`);
    else result.set(raw.id, raw);
  });
  return result;
}

interface RigValidationInfo {
  id?: string;
  canonicalJoints: Set<string>;
  joints: Set<string>;
  aliases: Map<string, string>;
  controls: Set<string>;
  sockets: Set<string>;
}

function validateLocalTransform(
  value: unknown,
  path: string,
  issues: ValidationIssue[],
): void {
  const transform = requireRecord(value, path, issues);
  if (!transform) return;
  validateTuple(transform.position, 3, `${path}.position`, issues);
  if (validateTuple(transform.quaternion, 4, `${path}.quaternion`, issues)) {
    const length = Math.hypot(...transform.quaternion);
    if (length < 1e-8) issue(issues, `${path}.quaternion`, 'quaternion.zero', 'must not be zero length');
    else if (Math.abs(length - 1) > 1e-4) {
      issue(issues, `${path}.quaternion`, 'quaternion.normalized', 'will be normalized on load', 'warning');
    }
  }
  if (validateTuple(transform.scale, 3, `${path}.scale`, issues)
    && transform.scale.some((component) => Math.abs(component) < 1e-8)) {
    issue(issues, `${path}.scale`, 'scale.zero', 'transform scale components must be non-zero');
  }
}

function resolvedJointId(
  id: unknown,
  joints: ReadonlyMap<string, UnknownRecord>,
  aliases: ReadonlyMap<string, string>,
): string | undefined {
  if (typeof id !== 'string') return undefined;
  return joints.has(id) ? id : aliases.get(id);
}

function definitionDescendsFrom(
  childId: string,
  ancestorId: string,
  joints: ReadonlyMap<string, UnknownRecord>,
  aliases: ReadonlyMap<string, string>,
): boolean {
  const visited = new Set<string>();
  let current: string | undefined = childId;
  while (current && !visited.has(current)) {
    if (current === ancestorId) return true;
    visited.add(current);
    current = resolvedJointId(joints.get(current)?.parentId, joints, aliases);
  }
  return false;
}

function validateHumanoidMap(
  value: unknown,
  path: string,
  rootJointId: unknown,
  joints: ReadonlyMap<string, UnknownRecord>,
  aliases: ReadonlyMap<string, string>,
  issues: ValidationIssue[],
): void {
  if (value === undefined) return;
  const humanoid = requireRecord(value, path, issues);
  if (!humanoid) return;
  const resolved = new Map<string, string>();
  const assigned = new Map<string, string>();
  for (const role of HUMANOID_JOINT_ROLES) {
    const rolePath = `${path}.${role}`;
    if (role === 'root' && humanoid[role] === undefined) continue;
    if (!requireString(humanoid[role], rolePath, issues)) continue;
    const id = resolvedJointId(humanoid[role], joints, aliases);
    if (!id) {
      issue(issues, rolePath, 'reference.humanoid-joint', `unknown humanoid joint "${String(humanoid[role])}"`);
      continue;
    }
    const previousRole = assigned.get(id);
    if (previousRole) {
      issue(issues, rolePath, 'humanoid.duplicate-joint', `joint "${id}" is already assigned to ${previousRole}`);
    } else assigned.set(id, role);
    resolved.set(role, id);
  }

  const canonicalRoot = resolvedJointId(rootJointId, joints, aliases);
  const semanticRoot = resolved.get('root');
  if (semanticRoot && canonicalRoot && semanticRoot !== canonicalRoot) {
    issue(issues, `${path}.root`, 'humanoid.root-mismatch', 'humanoid root must equal rootJointId');
  }
  const hierarchy = (parentRole: string, childRole: string): void => {
    const parent = resolved.get(parentRole);
    const child = resolved.get(childRole);
    if (!parent || !child) return;
    if (parent === child || !definitionDescendsFrom(child, parent, joints, aliases)) {
      issue(
        issues,
        `${path}.${childRole}`,
        'hierarchy.humanoid',
        `${childRole} must descend from ${parentRole}`,
      );
    }
  };
  const hips = resolved.get('hips');
  if (hips && canonicalRoot && hips !== canonicalRoot
    && !definitionDescendsFrom(hips, canonicalRoot, joints, aliases)) {
    issue(issues, `${path}.hips`, 'hierarchy.humanoid', 'hips/pelvis must descend from rootJointId');
  }
  hierarchy('hips', 'spine');
  hierarchy('spine', 'chest');
  hierarchy('chest', 'neck');
  hierarchy('neck', 'head');
  for (const side of ['Left', 'Right']) {
    hierarchy('chest', `clavicle${side}`);
    hierarchy(`clavicle${side}`, `upperArm${side}`);
    hierarchy(`upperArm${side}`, `lowerArm${side}`);
    hierarchy(`lowerArm${side}`, `hand${side}`);
    hierarchy('hips', `upperLeg${side}`);
    hierarchy(`upperLeg${side}`, `lowerLeg${side}`);
    hierarchy(`lowerLeg${side}`, `foot${side}`);
    hierarchy(`foot${side}`, `toes${side}`);
  }
}

function validateRigInto(value: unknown, path: string, issues: ValidationIssue[]): RigValidationInfo {
  const info: RigValidationInfo = {
    canonicalJoints: new Set(),
    joints: new Set(),
    aliases: new Map(),
    controls: new Set(),
    sockets: new Set(),
  };
  const rig = requireRecord(value, path, issues);
  if (!rig) return info;
  if (rig.schema !== RIG_SCHEMA) issue(issues, `${path}.schema`, 'schema.rig', `must equal "${RIG_SCHEMA}"`);
  if (rig.version !== RIG_SCHEMA_VERSION) {
    issue(issues, `${path}.version`, 'schema.version', `must equal ${RIG_SCHEMA_VERSION}`);
  }
  if (requireString(rig.id, `${path}.id`, issues)) info.id = rig.id;
  requireString(rig.name, `${path}.name`, issues);
  const coordinate = requireRecord(rig.coordinateSystem, `${path}.coordinateSystem`, issues);
  if (coordinate) {
    if (coordinate.handedness !== 'left' && coordinate.handedness !== 'right') {
      issue(issues, `${path}.coordinateSystem.handedness`, 'enum.handedness', 'must be "left" or "right"');
    }
    if (coordinate.up !== 'X' && coordinate.up !== 'Y' && coordinate.up !== 'Z') {
      issue(issues, `${path}.coordinateSystem.up`, 'enum.axis', 'must be X, Y, or Z');
    }
    requireString(coordinate.localForward, `${path}.coordinateSystem.localForward`, issues);
    requireString(coordinate.units, `${path}.coordinateSystem.units`, issues);
    if (coordinate.visualScale !== undefined) {
      validateTuple(coordinate.visualScale, 3, `${path}.coordinateSystem.visualScale`, issues);
    }
  }

  if (!Array.isArray(rig.joints)) {
    issue(issues, `${path}.joints`, 'type.array', 'must be an array');
  } else {
    const joints = validateUniqueIds(rig.joints, `${path}.joints`, issues);
    info.canonicalJoints = new Set(joints.keys());
    info.joints = new Set(joints.keys());
    rig.joints.forEach((raw, index) => {
      if (!isRecord(raw) || typeof raw.id !== 'string' || raw.aliases === undefined) return;
      const jointId = raw.id;
      const aliasesPath = `${path}.joints[${index}].aliases`;
      if (!Array.isArray(raw.aliases)) {
        issue(issues, aliasesPath, 'type.array', 'must be an array of historical joint IDs');
        return;
      }
      raw.aliases.forEach((alias, aliasIndex) => {
        const aliasPath = `${aliasesPath}[${aliasIndex}]`;
        if (!requireString(alias, aliasPath, issues)) return;
        if (joints.has(alias)) {
          issue(issues, aliasPath, 'alias.canonical-collision', `alias "${alias}" is already a canonical joint ID`);
          return;
        }
        const owner = info.aliases.get(alias);
        if (owner && owner !== jointId) {
          issue(issues, aliasPath, 'alias.duplicate', `alias "${alias}" is already owned by joint "${owner}"`);
          return;
        }
        info.aliases.set(alias, jointId);
        info.joints.add(alias);
      });
    });
    rig.joints.forEach((raw, index) => {
      const jointPath = `${path}.joints[${index}]`;
      const joint = requireRecord(raw, jointPath, issues);
      if (!joint) return;
      requireString(joint.nodeName, `${jointPath}.nodeName`, issues);
      if (joint.parentId !== null && typeof joint.parentId !== 'string') {
        issue(issues, `${jointPath}.parentId`, 'type.parent-id', 'must be a joint ID or null');
      } else if (typeof joint.parentId === 'string' && !joints.has(joint.parentId)) {
        issue(issues, `${jointPath}.parentId`, 'reference.joint', `unknown parent joint "${joint.parentId}"`);
      }
      if (joint.id === joint.parentId) issue(issues, `${jointPath}.parentId`, 'hierarchy.self-parent', 'joint cannot parent itself');
      validateLocalTransform(joint.rest, `${jointPath}.rest`, issues);
      if (joint.role !== undefined) requireString(joint.role, `${jointPath}.role`, issues);
      if (joint.type !== undefined) requireString(joint.type, `${jointPath}.type`, issues);
      if (joint.bind !== undefined) validateLocalTransform(joint.bind, `${jointPath}.bind`, issues);
      if (joint.retarget !== undefined) validateLocalTransform(joint.retarget, `${jointPath}.retarget`, issues);
      if (joint.mirrorId !== undefined && (!requireString(joint.mirrorId, `${jointPath}.mirrorId`, issues)
        || !joints.has(joint.mirrorId))) {
        issue(issues, `${jointPath}.mirrorId`, 'reference.mirror-joint', 'must reference a declared joint');
      }
      if (joint.stretch !== undefined) {
        const stretch = requireRecord(joint.stretch, `${jointPath}.stretch`, issues);
        if (stretch) {
          if (stretch.mode !== 'none' && stretch.mode !== 'scale' && stretch.mode !== 'translate-children') {
            issue(issues, `${jointPath}.stretch.mode`, 'enum.stretch-mode', 'has an unsupported stretch mode');
          }
          if (validateTuple(stretch.lengthAxis, 3, `${jointPath}.stretch.lengthAxis`, issues)
            && Math.hypot(...stretch.lengthAxis) < 1e-8) {
            issue(issues, `${jointPath}.stretch.lengthAxis`, 'axis.zero', 'length axis must be non-zero');
          }
          const hasMin = requireFinite(stretch.min, `${jointPath}.stretch.min`, issues);
          const hasMax = requireFinite(stretch.max, `${jointPath}.stretch.max`, issues);
          const stretchMin = hasMin ? stretch.min as number : undefined;
          const stretchMax = hasMax ? stretch.max as number : undefined;
          if (stretchMin !== undefined && stretchMax !== undefined && stretchMin > stretchMax) {
            issue(issues, `${jointPath}.stretch`, 'range.reversed', 'minimum cannot exceed maximum');
          }
          if (stretch.controlId !== undefined && typeof stretch.controlId !== 'string') {
            issue(issues, `${jointPath}.stretch.controlId`, 'type.control-id', 'must be a scalar control ID');
          }
          if (stretch.childIds !== undefined) {
            if (!Array.isArray(stretch.childIds)) {
              issue(issues, `${jointPath}.stretch.childIds`, 'type.array', 'must be an array of joint IDs');
            } else {
              stretch.childIds.forEach((childId, childIndex) => {
                if (typeof childId !== 'string' || !info.joints.has(childId)) {
                  issue(
                    issues,
                    `${jointPath}.stretch.childIds[${childIndex}]`,
                    'reference.joint',
                    'must reference a declared joint',
                  );
                }
              });
            }
          }
        }
      }
    });
    if (!requireString(rig.rootJointId, `${path}.rootJointId`, issues) || !joints.has(rig.rootJointId)) {
      issue(issues, `${path}.rootJointId`, 'reference.root-joint', 'must reference a declared joint');
    } else if (joints.get(rig.rootJointId)?.parentId !== null) {
      issue(issues, `${path}.rootJointId`, 'hierarchy.root-parent', 'root joint must have a null parent');
    }
    for (const id of joints.keys()) {
      const visited = new Set<string>();
      let current: string | null = id;
      while (current !== null) {
        if (visited.has(current)) {
          issue(issues, `${path}.joints`, 'hierarchy.cycle', `joint hierarchy contains a cycle at "${current}"`);
          break;
        }
        visited.add(current);
        const parent: unknown = joints.get(current)?.parentId;
        current = typeof parent === 'string' ? parent : null;
      }
    }
    validateHumanoidMap(rig.humanoid, `${path}.humanoid`, rig.rootJointId, joints, info.aliases, issues);
  }

  if (!Array.isArray(rig.sockets)) issue(issues, `${path}.sockets`, 'type.array', 'must be an array');
  else {
    const sockets = validateUniqueIds(rig.sockets, `${path}.sockets`, issues);
    info.sockets = new Set(sockets.keys());
    rig.sockets.forEach((raw, index) => {
      if (!isRecord(raw)) return;
      requireString(raw.nodeName, `${path}.sockets[${index}].nodeName`, issues);
      if (raw.parentJointId !== undefined
        && (typeof raw.parentJointId !== 'string' || !info.joints.has(raw.parentJointId))) {
        issue(issues, `${path}.sockets[${index}].parentJointId`, 'reference.joint', 'must reference a declared joint');
      }
      if (raw.mirrorId !== undefined
        && (typeof raw.mirrorId !== 'string' || !sockets.has(raw.mirrorId))) {
        issue(issues, `${path}.sockets[${index}].mirrorId`, 'reference.mirror-socket', 'must reference a declared socket');
      }
    });
  }

  if (!Array.isArray(rig.controls)) issue(issues, `${path}.controls`, 'type.array', 'must be an array');
  else {
    const controls = validateUniqueIds(rig.controls, `${path}.controls`, issues);
    info.controls = new Set(controls.keys());
    rig.controls.forEach((raw, index) => {
      if (!isRecord(raw)) return;
      const controlPath = `${path}.controls[${index}]`;
      const hasDefault = requireFinite(raw.defaultValue, `${controlPath}.defaultValue`, issues);
      const defaultValue = hasDefault ? raw.defaultValue as number : undefined;
      const hasMin = raw.min === undefined || requireFinite(raw.min, `${controlPath}.min`, issues);
      const hasMax = raw.max === undefined || requireFinite(raw.max, `${controlPath}.max`, issues);
      if (hasMin && hasMax && typeof raw.min === 'number' && typeof raw.max === 'number' && raw.min > raw.max) {
        issue(issues, controlPath, 'range.reversed', 'minimum cannot exceed maximum');
      }
      if (defaultValue !== undefined && typeof raw.min === 'number' && defaultValue < raw.min) {
        issue(issues, `${controlPath}.defaultValue`, 'range.below-min', 'default is below minimum');
      }
      if (defaultValue !== undefined && typeof raw.max === 'number' && defaultValue > raw.max) {
        issue(issues, `${controlPath}.defaultValue`, 'range.above-max', 'default is above maximum');
      }
      if (raw.mirrorId !== undefined
        && (typeof raw.mirrorId !== 'string' || !controls.has(raw.mirrorId))) {
        issue(issues, `${controlPath}.mirrorId`, 'reference.mirror-control', 'must reference a declared control');
      }
    });
  }
  if (Array.isArray(rig.joints)) {
    rig.joints.forEach((raw, index) => {
      if (!isRecord(raw) || !isRecord(raw.stretch) || raw.stretch.controlId === undefined) return;
      if (typeof raw.stretch.controlId !== 'string' || !info.controls.has(raw.stretch.controlId)) {
        issue(
          issues,
          `${path}.joints[${index}].stretch.controlId`,
          'reference.control',
          'must reference a declared scalar control',
        );
      }
    });
  }
  if (rig.mirror !== undefined) {
    const mirror = requireRecord(rig.mirror, `${path}.mirror`, issues);
    if (mirror) {
      if (mirror.axis !== 'x' && mirror.axis !== 'y' && mirror.axis !== 'z') {
        issue(issues, `${path}.mirror.axis`, 'enum.mirror-axis', 'must be x, y, or z');
      }
      const validatePairs = (
        value: unknown,
        pairPath: string,
        available: ReadonlySet<string>,
      ): void => {
        if (!Array.isArray(value)) {
          issue(issues, pairPath, 'type.array', 'must be an array of ID pairs');
          return;
        }
        const assigned = new Set<string>();
        value.forEach((rawPair, pairIndex) => {
          const currentPath = `${pairPath}[${pairIndex}]`;
          if (!Array.isArray(rawPair) || rawPair.length !== 2
            || typeof rawPair[0] !== 'string' || typeof rawPair[1] !== 'string') {
            issue(issues, currentPath, 'type.id-pair', 'must contain exactly two IDs');
            return;
          }
          for (const id of rawPair) {
            if (!available.has(id)) issue(issues, currentPath, 'reference.mirror-target', `unknown mirror target "${id}"`);
            if (assigned.has(id)) issue(issues, currentPath, 'mirror.duplicate-target', `"${id}" appears in more than one pair`);
            assigned.add(id);
          }
        });
      };
      validatePairs(mirror.jointPairs, `${path}.mirror.jointPairs`, info.joints);
      if (mirror.controlPairs !== undefined) {
        validatePairs(mirror.controlPairs, `${path}.mirror.controlPairs`, info.controls);
      }
    }
  }
  if (rig.metadata !== undefined) validateJson(rig.metadata, `${path}.metadata`, issues);
  return info;
}

function validateTimedItem(
  raw: unknown,
  path: string,
  duration: number | undefined,
  issues: ValidationIssue[],
): UnknownRecord | null {
  const value = requireRecord(raw, path, issues);
  if (!value) return null;
  requireString(value.id, `${path}.id`, issues);
  if (requireFinite(value.time, `${path}.time`, issues) && duration !== undefined
    && (value.time < 0 || value.time > duration)) {
    issue(issues, `${path}.time`, 'range.clip-time', `must be within 0..${duration}`);
  }
  return value;
}

function validateProceduralDriver(
  raw: unknown,
  path: string,
  rig: RigValidationInfo | undefined,
  issues: ValidationIssue[],
): void {
  const driver = requireRecord(raw, path, issues);
  if (!driver) return;
  if (driver.schema !== PROCEDURAL_DRIVER_SCHEMA) {
    issue(issues, `${path}.schema`, 'schema.procedural-driver', `must equal "${PROCEDURAL_DRIVER_SCHEMA}"`);
  }
  if (driver.version !== PROCEDURAL_DRIVER_SCHEMA_VERSION) {
    issue(issues, `${path}.version`, 'schema.version', `must equal ${PROCEDURAL_DRIVER_SCHEMA_VERSION}`);
  }
  requireString(driver.id, `${path}.id`, issues);
  requireFinite(driver.order, `${path}.order`, issues);
  if (driver.blend !== 'additive' && driver.blend !== 'override' && driver.blend !== 'multiply') {
    issue(issues, `${path}.blend`, 'enum.procedural-blend', 'must be additive, override, or multiply');
  }
  requireString(driver.source, `${path}.source`, issues);
  for (const field of ['amplitude', 'frequency', 'phase', 'bias', 'seed'] as const) {
    requireFinite(driver[field], `${path}.${field}`, issues);
  }
  if (typeof driver.seed === 'number' && !Number.isInteger(driver.seed)) {
    issue(issues, `${path}.seed`, 'number.integer', 'noise seeds should be integers', 'warning');
  }
  if (driver.clamp !== undefined && validateTuple(driver.clamp, 2, `${path}.clamp`, issues)
    && driver.clamp[0] > driver.clamp[1]) {
    issue(issues, `${path}.clamp`, 'range.reversed', 'clamp minimum cannot exceed maximum');
  }
  const target = requireRecord(driver.target, `${path}.target`, issues);
  if (target) {
    if (target.kind === 'scalar') {
      if (requireString(target.target, `${path}.target.target`, issues)
        && rig && !rig.controls.has(target.target)) {
        issue(issues, `${path}.target.target`, 'reference.control', `unknown scalar control "${target.target}"`);
      }
      if (target.baseValue !== undefined) requireFinite(target.baseValue, `${path}.target.baseValue`, issues);
    } else if (target.kind === 'position' || target.kind === 'scale') {
      if (requireString(target.target, `${path}.target.target`, issues)
        && rig && !rig.joints.has(target.target)) {
        issue(issues, `${path}.target.target`, 'reference.joint', `unknown joint "${target.target}"`);
      }
      if (target.component !== 'x' && target.component !== 'y' && target.component !== 'z') {
        issue(issues, `${path}.target.component`, 'enum.vector-component', 'must be x, y, or z');
      }
    } else if (target.kind === 'quaternion') {
      if (requireString(target.target, `${path}.target.target`, issues)
        && rig && !rig.joints.has(target.target)) {
        issue(issues, `${path}.target.target`, 'reference.joint', `unknown joint "${target.target}"`);
      }
      if (validateTuple(target.axis, 3, `${path}.target.axis`, issues)
        && Math.hypot(...target.axis) < 1e-8) {
        issue(issues, `${path}.target.axis`, 'axis.zero', 'quaternion driver axis must be non-zero');
      }
    } else {
      issue(issues, `${path}.target.kind`, 'enum.procedural-target', 'has an unsupported target kind');
    }
  }
  const type = driver.type;
  if (type === 'oscillator') {
    if (driver.waveform !== 'sine' && driver.waveform !== 'triangle' && driver.waveform !== 'saw') {
      issue(issues, `${path}.waveform`, 'enum.waveform', 'must be sine, triangle, or saw');
    }
  } else if (type === 'pulse') {
    if (requireFinite(driver.dutyCycle, `${path}.dutyCycle`, issues)
      && (driver.dutyCycle < 0 || driver.dutyCycle > 1)) {
      issue(issues, `${path}.dutyCycle`, 'range.unit', 'must be between zero and one');
    }
    if (driver.smoothing !== undefined && requireFinite(driver.smoothing, `${path}.smoothing`, issues)
      && (driver.smoothing < 0 || driver.smoothing > 0.5)) {
      issue(issues, `${path}.smoothing`, 'range.pulse-smoothing', 'must be between zero and 0.5');
    }
  } else if (type === 'envelope') {
    let total = 0;
    let valid = true;
    for (const field of ['attack', 'hold', 'release'] as const) {
      if (!requireFinite(driver[field], `${path}.${field}`, issues)) valid = false;
      else {
        const value = driver[field] as number;
        if (value < 0) issue(issues, `${path}.${field}`, 'range.nonnegative', 'cannot be negative');
        total += value;
      }
    }
    if (valid && total > 1 + 1e-8) {
      issue(issues, path, 'range.envelope', 'attack + hold + release cannot exceed one normalized cycle');
    }
    if (typeof driver.loop !== 'boolean') issue(issues, `${path}.loop`, 'type.boolean', 'must be boolean');
  } else if (type === 'noise') {
    if (driver.interpolation !== 'step' && driver.interpolation !== 'smooth') {
      issue(issues, `${path}.interpolation`, 'enum.noise-interpolation', 'must be step or smooth');
    }
  } else if (type === 'response') {
    if (validateTuple(driver.inputRange, 2, `${path}.inputRange`, issues)
      && Math.abs(driver.inputRange[1] - driver.inputRange[0]) < 1e-10) {
      issue(issues, `${path}.inputRange`, 'range.empty', 'response input range cannot be empty');
    }
    if (driver.curve !== 'step' && driver.curve !== 'linear'
      && driver.curve !== 'smoothstep' && driver.curve !== 'smootherstep') {
      issue(issues, `${path}.curve`, 'enum.response-curve', 'has an unsupported response curve');
    }
    if (driver.extrapolate !== undefined && typeof driver.extrapolate !== 'boolean') {
      issue(issues, `${path}.extrapolate`, 'type.boolean', 'must be boolean');
    }
  } else if (type === 'custom') {
    requireString(driver.evaluatorId, `${path}.evaluatorId`, issues);
    if (driver.params !== undefined) validateJson(driver.params, `${path}.params`, issues);
  } else {
    issue(issues, `${path}.type`, 'enum.procedural-driver', 'has an unsupported procedural driver type');
  }
}

function validateClip(
  value: unknown,
  path: string,
  rigById: ReadonlyMap<string, RigValidationInfo>,
  issues: ValidationIssue[],
): void {
  const clip = requireRecord(value, path, issues);
  if (!clip) return;
  requireString(clip.id, `${path}.id`, issues);
  requireString(clip.name, `${path}.name`, issues);
  const rigIdValid = requireString(clip.rigId, `${path}.rigId`, issues);
  const clipRigId = rigIdValid ? clip.rigId as string : undefined;
  const rig = clipRigId === undefined ? undefined : rigById.get(clipRigId);
  if (rigIdValid && !rig) issue(issues, `${path}.rigId`, 'reference.rig', `unknown rig "${clip.rigId}"`);
  const hasDuration = requireFinite(clip.duration, `${path}.duration`, issues);
  const duration: number | undefined = hasDuration ? clip.duration as number : undefined;
  if (duration !== undefined && duration <= 0) issue(issues, `${path}.duration`, 'range.positive', 'must be greater than zero');
  if (requireFinite(clip.playbackSpeed, `${path}.playbackSpeed`, issues) && clip.playbackSpeed <= 0) {
    issue(issues, `${path}.playbackSpeed`, 'range.positive', 'must be greater than zero');
  }
  if (clip.transformSpace !== 'rest-local-delta') {
    issue(issues, `${path}.transformSpace`, 'enum.transform-space', 'must be "rest-local-delta"');
  }
  const loop = requireRecord(clip.loop, `${path}.loop`, issues);
  if (loop) {
    if (loop.mode !== 'once' && loop.mode !== 'loop' && loop.mode !== 'ping-pong') {
      issue(issues, `${path}.loop.mode`, 'enum.loop-mode', 'must be once, loop, or ping-pong');
    }
    if (typeof loop.seamless !== 'boolean') issue(issues, `${path}.loop.seamless`, 'type.boolean', 'must be boolean');
  }
  const range = requireRecord(clip.range, `${path}.range`, issues);
  if (range) {
    const hasStart = requireFinite(range.start, `${path}.range.start`, issues);
    const hasEnd = requireFinite(range.end, `${path}.range.end`, issues);
    const rangeStart = hasStart ? range.start as number : undefined;
    const rangeEnd = hasEnd ? range.end as number : undefined;
    if (rangeStart !== undefined && rangeEnd !== undefined && rangeStart >= rangeEnd) {
      issue(issues, `${path}.range`, 'range.empty', 'range start must be before range end');
    }
    if (rangeStart !== undefined && rangeStart < 0) issue(issues, `${path}.range.start`, 'range.negative', 'cannot be negative');
    if (rangeEnd !== undefined && duration !== undefined && rangeEnd > duration) {
      issue(issues, `${path}.range.end`, 'range.duration', 'cannot exceed clip duration');
    }
  }
  const rootMotion = requireRecord(clip.rootMotion, `${path}.rootMotion`, issues);
  if (rootMotion) {
    if (rootMotion.mode !== 'in-place' && rootMotion.mode !== 'authored' && rootMotion.mode !== 'extract') {
      issue(issues, `${path}.rootMotion.mode`, 'enum.root-motion', 'has an unsupported root-motion mode');
    }
    if (rootMotion.jointId !== undefined
      && (typeof rootMotion.jointId !== 'string' || (rig && !rig.joints.has(rootMotion.jointId)))) {
      issue(issues, `${path}.rootMotion.jointId`, 'reference.joint', 'must reference a declared joint');
    }
  }

  if (!Array.isArray(clip.tracks)) issue(issues, `${path}.tracks`, 'type.array', 'must be an array');
  else {
    validateUniqueIds(clip.tracks, `${path}.tracks`, issues);
    const channels = new Set<string>();
    clip.tracks.forEach((rawTrack, trackIndex) => {
      const trackPath = `${path}.tracks[${trackIndex}]`;
      const track = requireRecord(rawTrack, trackPath, issues);
      if (!track) return;
      requireString(track.target, `${trackPath}.target`, issues);
      const kind = track.kind;
      if (kind !== 'position' && kind !== 'quaternion' && kind !== 'scale' && kind !== 'scalar') {
        issue(issues, `${trackPath}.kind`, 'enum.track-kind', 'has an unsupported track kind');
        return;
      }
      if (typeof track.target === 'string') {
        const channel = `${kind}:${track.target}`;
        if (channels.has(channel)) issue(issues, trackPath, 'track.duplicate-channel', `duplicate channel "${channel}"`);
        channels.add(channel);
        if (rig && kind === 'scalar' && !rig.controls.has(track.target)) {
          issue(issues, `${trackPath}.target`, 'reference.control', `unknown scalar control "${track.target}"`);
        }
        if (rig && kind !== 'scalar' && !rig.joints.has(track.target)) {
          issue(issues, `${trackPath}.target`, 'reference.joint', `unknown joint "${track.target}"`);
        }
      }
      if (!Array.isArray(track.keys)) {
        issue(issues, `${trackPath}.keys`, 'type.array', 'must be an array');
        return;
      }
      validateUniqueIds(track.keys, `${trackPath}.keys`, issues);
      let previousTime = -Infinity;
      const times = new Set<number>();
      track.keys.forEach((rawKey, keyIndex) => {
        const keyPath = `${trackPath}.keys[${keyIndex}]`;
        const key = validateTimedItem(rawKey, keyPath, duration, issues);
        if (!key) return;
        if (key.interpolation !== 'step' && key.interpolation !== 'linear' && key.interpolation !== 'cubic') {
          issue(issues, `${keyPath}.interpolation`, 'enum.interpolation', 'must be step, linear, or cubic');
        }
        if (typeof key.time === 'number') {
          if (key.time < previousTime) {
            issue(issues, `${trackPath}.keys`, 'keys.unsorted', 'keys will be sorted by time on load', 'warning');
          }
          if (times.has(key.time)) {
            issue(issues, `${keyPath}.time`, 'keys.duplicate-time', 'multiple keys at one time are ambiguous', 'warning');
          }
          times.add(key.time);
          previousTime = key.time;
        }
        if (kind === 'scalar') {
          requireFinite(key.value, `${keyPath}.value`, issues);
          if (key.inTangent !== undefined) requireFinite(key.inTangent, `${keyPath}.inTangent`, issues);
          if (key.outTangent !== undefined) requireFinite(key.outTangent, `${keyPath}.outTangent`, issues);
        } else if (kind === 'quaternion') {
          if (validateTuple(key.value, 4, `${keyPath}.value`, issues)
            && Math.hypot(...key.value) < 1e-8) {
            issue(issues, `${keyPath}.value`, 'quaternion.zero', 'must not be zero length');
          }
        } else {
          validateTuple(key.value, 3, `${keyPath}.value`, issues);
          if (key.inTangent !== undefined) validateTuple(key.inTangent, 3, `${keyPath}.inTangent`, issues);
          if (key.outTangent !== undefined) validateTuple(key.outTangent, 3, `${keyPath}.outTangent`, issues);
        }
      });
    });
  }

  if (clip.proceduralOrder !== 'procedural-then-keyed' && clip.proceduralOrder !== 'keyed-then-procedural') {
    issue(
      issues,
      `${path}.proceduralOrder`,
      'enum.procedural-order',
      'must be procedural-then-keyed or keyed-then-procedural',
    );
  }
  if (!Array.isArray(clip.proceduralDrivers)) {
    issue(issues, `${path}.proceduralDrivers`, 'type.array', 'must be an array');
  } else {
    validateUniqueIds(clip.proceduralDrivers, `${path}.proceduralDrivers`, issues);
    clip.proceduralDrivers.forEach((driver, index) =>
      validateProceduralDriver(driver, `${path}.proceduralDrivers[${index}]`, rig, issues));
  }

  if (!Array.isArray(clip.markers)) issue(issues, `${path}.markers`, 'type.array', 'must be an array');
  else {
    validateUniqueIds(clip.markers, `${path}.markers`, issues);
    clip.markers.forEach((raw, index) => {
      const marker = validateTimedItem(raw, `${path}.markers[${index}]`, duration, issues);
      if (marker) requireString(marker.name, `${path}.markers[${index}].name`, issues);
    });
  }
  if (!Array.isArray(clip.events)) issue(issues, `${path}.events`, 'type.array', 'must be an array');
  else {
    validateUniqueIds(clip.events, `${path}.events`, issues);
    clip.events.forEach((raw, index) => {
      const event = validateTimedItem(raw, `${path}.events[${index}]`, duration, issues);
      if (!event) return;
      requireString(event.name, `${path}.events[${index}].name`, issues);
      if (event.payload !== undefined) validateJson(event.payload, `${path}.events[${index}].payload`, issues);
    });
  }
  if (!Array.isArray(clip.contacts)) issue(issues, `${path}.contacts`, 'type.array', 'must be an array');
  else {
    validateUniqueIds(clip.contacts, `${path}.contacts`, issues);
    clip.contacts.forEach((raw, index) => {
      const contactPath = `${path}.contacts[${index}]`;
      const contact = requireRecord(raw, contactPath, issues);
      if (!contact) return;
      const hasStart = requireFinite(contact.start, `${contactPath}.start`, issues);
      const hasEnd = requireFinite(contact.end, `${contactPath}.end`, issues);
      const contactStart = hasStart ? contact.start as number : undefined;
      const contactEnd = hasEnd ? contact.end as number : undefined;
      if (contactStart !== undefined && contactEnd !== undefined && contactStart > contactEnd) {
        issue(issues, contactPath, 'range.reversed', 'contact start cannot exceed end');
      }
      if (contactStart !== undefined && (contactStart < 0 || (duration !== undefined && contactStart > duration))) {
        issue(issues, `${contactPath}.start`, 'range.clip-time', 'must fall within clip duration');
      }
      if (contactEnd !== undefined && (contactEnd < 0 || (duration !== undefined && contactEnd > duration))) {
        issue(issues, `${contactPath}.end`, 'range.clip-time', 'must fall within clip duration');
      }
      if (requireString(contact.effector, `${contactPath}.effector`, issues)
        && rig && rig.sockets.size > 0 && !rig.sockets.has(contact.effector)) {
        issue(issues, `${contactPath}.effector`, 'reference.socket', `unknown effector socket "${contact.effector}"`);
      }
      if (contact.mode !== 'plant' && contact.mode !== 'grip' && contact.mode !== 'custom') {
        issue(issues, `${contactPath}.mode`, 'enum.contact-mode', 'has an unsupported contact mode');
      }
      if (contact.weight !== undefined
        && requireFinite(contact.weight, `${contactPath}.weight`, issues)
        && (contact.weight < 0 || contact.weight > 1)) {
        issue(issues, `${contactPath}.weight`, 'range.unit', 'must be between zero and one');
      }
      if (contact.metadata !== undefined) validateJson(contact.metadata, `${contactPath}.metadata`, issues);
    });
  }
  if (clip.metadata !== undefined) validateJson(clip.metadata, `${path}.metadata`, issues);
}

export function validateRigDefinition(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  validateRigInto(value, '$', issues);
  return { valid: !issues.some((entry) => entry.severity === 'error'), issues };
}

export function validateAnimationSuite(value: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const document = requireRecord(value, '$', issues);
  if (!document) return { valid: false, issues };
  if (document.schema !== ANIMATION_SUITE_SCHEMA) {
    issue(issues, '$.schema', 'schema.document', `must equal "${ANIMATION_SUITE_SCHEMA}"`);
  }
  if (document.version !== ANIMATION_SUITE_SCHEMA_VERSION) {
    issue(issues, '$.version', 'schema.version', `must equal ${ANIMATION_SUITE_SCHEMA_VERSION}`);
  }
  requireString(document.id, '$.id', issues);
  requireString(document.name, '$.name', issues);
  const rigById = new Map<string, RigValidationInfo>();
  if (!Array.isArray(document.rigs)) issue(issues, '$.rigs', 'type.array', 'must be an array');
  else {
    validateUniqueIds(document.rigs, '$.rigs', issues);
    document.rigs.forEach((rig, index) => {
      const info = validateRigInto(rig, `$.rigs[${index}]`, issues);
      if (info.id) rigById.set(info.id, info);
    });
  }
  let clipsById = new Map<string, UnknownRecord>();
  if (!Array.isArray(document.clips)) issue(issues, '$.clips', 'type.array', 'must be an array');
  else {
    clipsById = validateUniqueIds(document.clips, '$.clips', issues);
    document.clips.forEach((clip, index) => validateClip(clip, `$.clips[${index}]`, rigById, issues));
  }
  if (document.activeClipId !== undefined
    && (typeof document.activeClipId !== 'string' || !clipsById.has(document.activeClipId))) {
    issue(issues, '$.activeClipId', 'reference.clip', 'must reference a declared clip');
  }
  if (document.metadata !== undefined) validateJson(document.metadata, '$.metadata', issues);
  return { valid: !issues.some((entry) => entry.severity === 'error'), issues };
}

export class AnimationSchemaError extends Error {
  readonly issues: ValidationIssue[];

  constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = 'AnimationSchemaError';
    this.issues = issues;
  }
}

export function parseAnimationSuite(input: unknown): AnimationSuiteDocument {
  let migrated: AnimationSuiteDocument;
  try {
    migrated = migrateAnimationSuite(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AnimationSchemaError(`Could not migrate animation suite: ${message}`, [
      { path: '$', code: 'migration.failed', message, severity: 'error' },
    ]);
  }
  const result = validateAnimationSuite(migrated);
  if (!result.valid) throw new AnimationSchemaError('Animation suite validation failed', result.issues);
  return normalizeAnimationSuite(migrated);
}

export function parseRigDefinition(input: unknown): RigDefinition {
  let migrated: RigDefinition;
  try {
    migrated = migrateRigDefinition(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AnimationSchemaError(`Could not migrate rig definition: ${message}`, [
      { path: '$', code: 'migration.failed', message, severity: 'error' },
    ]);
  }
  const result = validateRigDefinition(migrated);
  if (!result.valid) throw new AnimationSchemaError('Rig definition validation failed', result.issues);
  return migrated;
}
