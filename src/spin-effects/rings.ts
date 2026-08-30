import * as THREE from "three";
import {
  DEFAULT_SPIN_RING_SETTINGS,
  SPIN_PRESENTATION_HZ,
  clampSpinRingSettings,
  createPostSpinRingSettings,
  type SpinRingSettingsValue,
} from "./settings";

const TAU = Math.PI * 2;
const RING_ROWS = 5;

export interface SpinRingBounds {
  readonly center: THREE.Vector3;
  readonly size: THREE.Vector3;
}

export interface SpinRingGeometryStats {
  readonly rings: number;
  readonly segments: number;
  readonly vertices: number;
  readonly triangles: number;
  readonly uploads: number;
}

export const DEFAULT_SPIN_PREVIEW_BOUNDS: Readonly<SpinRingBounds> = {
  center: new THREE.Vector3(0, 1.5, 0),
  size: new THREE.Vector3(2.35, 3, 2.35),
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function spinRingHash(seed: number, ring: number, channel: number): number {
  let hash = (
    Math.imul(seed >>> 0, 374761393) +
    Math.imul(ring >>> 0, 668265263) +
    Math.imul(channel >>> 0, 2246822519)
  ) >>> 0;
  hash = (hash ^ (hash >>> 13)) >>> 0;
  hash = Math.imul(hash, 1274126177) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return hash / 4294967296;
}

export const roundLikeJavascript = (value: number): number =>
  Math.floor(value + 0.5);

const variation = (
  seed: number,
  ring: number,
  channel: number,
  amount: number,
): number => (spinRingHash(seed, ring, channel) - 0.5) * 2 * amount;

function colorFromHex(hex: number): THREE.Color {
  return new THREE.Color().setHex(hex & 0xffffff, THREE.SRGBColorSpace);
}

function lerpColor(
  from: THREE.Color,
  to: THREE.Color,
  amount: number,
  target: THREE.Color,
): THREE.Color {
  return target.setRGB(
    from.r + (to.r - from.r) * amount,
    from.g + (to.g - from.g) * amount,
    from.b + (to.b - from.b) * amount,
  );
}

function currentBrightness(
  value: Readonly<SpinRingSettingsValue>,
  time: number,
  radiusFraction: number,
): number {
  if (value.current === 0) return 1;
  return Math.max(
    0,
    1 + value.current * Math.sin(radiusFraction * TAU * 2 + time * value.currentRate),
  );
}

/**
 * Exact browser evaluator for Unity's five-row SourceSwirl-style orbital
 * ribbons. Only the dynamic position/color buffers are uploaded each tick.
 */
export class SpinOrbitalRings extends THREE.Group {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private settings = clampSpinRingSettings(DEFAULT_SPIN_RING_SETTINGS);
  private postSpinSettings = createPostSpinRingSettings(this.settings);
  private sourceCenter = DEFAULT_SPIN_PREVIEW_BOUNDS.center.clone();
  private sourceSize = DEFAULT_SPIN_PREVIEW_BOUNDS.size.clone();
  private positions = new Float32Array(0);
  private colors = new Float32Array(0);
  private sharedBulges = new Float64Array(0);
  private activeRingCount = 0;
  private segmentCount = 0;
  private lastStep = Number.MIN_SAFE_INTEGER;
  private lastPostSpin = false;
  private geometryDirty = true;
  private uploads = 0;

  constructor(
    settings: Readonly<SpinRingSettingsValue> = DEFAULT_SPIN_RING_SETTINGS,
    bounds: Readonly<SpinRingBounds> = DEFAULT_SPIN_PREVIEW_BOUNDS,
  ) {
    super();
    this.name = "SpinOrbitalRings_Additive";
    const material = new THREE.MeshBasicMaterial({
      name: "SpinOrbitalRings_Additive_Web",
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    this.mesh.name = "SpinOrbitalRings_RuntimeMesh_Web";
    this.mesh.renderOrder = 3;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.mesh.userData.noShadow = true;
    this.add(this.mesh);
    this.setSourceBounds(bounds);
    this.applySettings(settings);
  }

  get geometryStats(): SpinRingGeometryStats {
    return {
      rings: this.activeRingCount,
      segments: this.segmentCount,
      vertices: this.positions.length / 3,
      triangles: (this.mesh.geometry.index?.count ?? 0) / 3,
      uploads: this.uploads,
    };
  }

  get value(): Readonly<SpinRingSettingsValue> {
    return this.settings;
  }

  setSourceBounds(bounds: Readonly<SpinRingBounds>): void {
    this.sourceCenter.copy(bounds.center);
    this.sourceSize.copy(bounds.size);
    this.geometryDirty = true;
    this.updateBounds();
  }

  applySettings(value: Readonly<SpinRingSettingsValue>): void {
    this.settings = clampSpinRingSettings(value);
    this.postSpinSettings = createPostSpinRingSettings(this.settings);
    this.ensureGeometry(this.settings.segmentCount, this.settings.ringCount);
    this.geometryDirty = true;
    this.updateBounds();
    this.applyStep(this.lastStep === Number.MIN_SAFE_INTEGER ? 0 : this.lastStep);
  }

  applyStep(step: number, postSpinSample = false): void {
    const presentationStep = Math.floor(Number.isFinite(step) ? step : 0);
    if (
      !this.geometryDirty &&
      presentationStep === this.lastStep &&
      postSpinSample === this.lastPostSpin
    ) return;
    this.renderGeometry(
      presentationStep / SPIN_PRESENTATION_HZ,
      postSpinSample ? this.postSpinSettings : this.settings,
    );
    this.lastStep = presentationStep;
    this.lastPostSpin = postSpinSample;
    this.geometryDirty = false;
  }

  resetPresentationState(): void {
    this.lastStep = Number.MIN_SAFE_INTEGER;
    this.lastPostSpin = false;
    this.geometryDirty = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.removeFromParent();
  }

  private ensureGeometry(segments: number, rings: number): void {
    if (
      segments === this.segmentCount &&
      rings === this.activeRingCount &&
      this.positions.length > 0
    ) return;
    this.segmentCount = segments;
    this.activeRingCount = rings;
    const vertexCount = rings * RING_ROWS * segments;
    this.positions = new Float32Array(vertexCount * 3);
    this.colors = new Float32Array(vertexCount * 4);
    this.sharedBulges = new Float64Array(segments);
    const indices = new Uint16Array(rings * (RING_ROWS - 1) * segments * 6);
    let write = 0;
    for (let ring = 0; ring < rings; ring++) {
      const baseVertex = ring * RING_ROWS * segments;
      for (let row = 0; row < RING_ROWS - 1; row++) {
        for (let j = 0; j < segments; j++) {
          const nearA = baseVertex + row * segments + j;
          const nearB = baseVertex + row * segments + ((j + 1) % segments);
          const farA = nearA + segments;
          const farB = nearB + segments;
          indices[write++] = nearA;
          indices[write++] = farA;
          indices[write++] = nearB;
          indices[write++] = nearB;
          indices[write++] = farA;
          indices[write++] = farB;
        }
      }
    }
    const geometry = this.mesh.geometry;
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 4).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    this.geometryDirty = true;
    this.updateBounds();
  }

  private renderGeometry(
    time: number,
    value: Readonly<SpinRingSettingsValue>,
  ): void {
    const radius =
      Math.max(this.sourceSize.x * 0.5, this.sourceSize.z * 0.5) *
      value.radiusScale;
    const alpha = value.alpha;
    const breatheAmount = Math.min(0.02, value.breathe);
    const breath = 1 + breatheAmount * Math.sin(time * value.breatheRate);
    const pulseBrightness = 1 + value.pulse * 0.4 * Math.sin(time * value.pulseRate);

    for (let j = 0; j < this.segmentCount; j++) {
      const theta = (j / this.segmentCount) * TAU;
      this.sharedBulges[j] =
        value.sharedLow * Math.sin(theta * 2 + time * value.sharedLowRate) +
        value.sharedMid * Math.sin(theta * 3 - time * value.sharedMidRate);
    }

    const laneStart = Math.max(0.03, value.ringInner);
    const laneEnd = Math.max(laneStart, value.ringOuter);
    const laneSpan = Math.max(0.02, laneEnd - laneStart);
    const laneStep = laneSpan / this.activeRingCount;
    const depth = Math.max(0.2, value.depth);
    const selfSpinAngle = time * value.selfSpinRadiansPerSecond;
    const white = new THREE.Color(1, 1, 1);
    const from = new THREE.Color();
    const to = new THREE.Color();
    const line = new THREE.Color();
    const glow = new THREE.Color();
    const qAzimuth = new THREE.Quaternion();
    const qTilt = new THREE.Quaternion();
    const plane = new THREE.Quaternion();
    const axisU = new THREE.Vector3();
    const axisV = new THREE.Vector3();
    const radial = new THREE.Vector3();
    const center = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);

    for (let ring = 0; ring < this.activeRingCount; ring++) {
      const baseVertex = ring * RING_ROWS * this.segmentCount;
      const override = value.ringOverrides[ring];
      const paletteMix =
        0.5 + 0.5 * Math.sin(value.cycleRate * time + override.colorPulsePhase * TAU);
      lerpColor(
        from.copy(colorFromHex(override.lineColorA)),
        to.copy(colorFromHex(override.lineColorB)),
        paletteMix,
        line,
      );
      lerpColor(
        from.copy(colorFromHex(override.glowColorA)),
        to.copy(colorFromHex(override.glowColorB)),
        paletteMix,
        glow,
      );
      lerpColor(line.clone(), white, value.whiteMix, line);
      lerpColor(glow.clone(), white, value.whiteMix, glow);
      const variation12 = variation(value.seed, ring, 12, value.vary);
      const slot =
        this.activeRingCount === 1
          ? (laneStart + laneEnd) * 0.5
          : laneStart + (ring + 0.5) * laneStep + variation12 * 0.25 * laneStep;
      const frequencyA = Math.max(
        1,
        roundLikeJavascript(
          value.wavyFreq * (1 + 0.4 * variation(value.seed, ring, 1, value.vary)),
        ),
      );
      const frequencyB = Math.max(
        2,
        roundLikeJavascript(
          value.jagFreq * (1 + 0.35 * variation(value.seed, ring, 2, value.vary)),
        ),
      );
      const phaseA = spinRingHash(value.seed, ring, 3) * TAU;
      const phaseB = spinRingHash(value.seed, ring, 4) * TAU;
      const amplitudeA =
        value.wavyAmp * (1 + 0.7 * variation(value.seed, ring, 5, value.vary));
      const amplitudeB =
        value.jagAmp * (1 + 0.7 * variation(value.seed, ring, 6, value.vary));
      const rateA =
        value.wavyRate * (0.75 + 0.5 * spinRingHash(value.seed, ring, 7));
      const rateB =
        value.jagRate * (0.75 + 0.5 * spinRingHash(value.seed, ring, 8));
      const lineWidth =
        value.ringLine * (1 + 0.5 * variation(value.seed, ring, 9, value.vary));
      const glowWidth =
        value.ringGlow * (1 + 0.5 * variation(value.seed, ring, 10, value.vary));

      let laneRadius = slot;
      let envelope = 1;
      if (value.swallow !== 0) {
        const swallowTo = Math.max(0.01, value.swallowTo);
        const swallowFrom = Math.max(
          laneEnd + 0.1,
          Math.min(1.1, value.swallowFrom),
        );
        const travelSpan = swallowFrom - swallowTo;
        const travelStep = travelSpan / this.activeRingCount;
        const travelSlot =
          swallowTo + (ring + 0.5) * travelStep + variation12 * 0.25 * travelStep;
        let wrapped = (travelSlot - swallowTo - time * value.swallow) % travelSpan;
        if (wrapped < 0) wrapped += travelSpan;
        laneRadius = swallowTo + wrapped;
        const birth = clamp01((travelSpan - wrapped) / (travelStep * 0.35));
        const death = clamp01(wrapped / (travelStep * 0.4));
        envelope = Math.min(birth, death);
      }

      const displayedRadius = depth === 1 ? laneRadius : Math.pow(laneRadius, depth);
      const widthScale =
        depth === 1
          ? 1
          : Math.min(1.8, Math.max(0.25, depth * Math.pow(laneRadius, depth - 1)));
      const brightness =
        value.ringBright *
        (1 + 0.4 * variation(value.seed, ring, 11, value.vary)) *
        envelope *
        currentBrightness(value, time, displayedRadius) *
        pulseBrightness;
      const spinAngle = time * (value.spin + value.spinDiff * (1 - displayedRadius));
      const offsets = [
        -glowWidth * widthScale * radius,
        -lineWidth * widthScale * radius,
        0,
        lineWidth * widthScale * radius,
        glowWidth * widthScale * radius,
      ];

      const azimuth = THREE.MathUtils.degToRad(
        spinRingHash(value.seed, ring, 14) * 360,
      );
      let tilt = THREE.MathUtils.degToRad(
        THREE.MathUtils.lerp(
          value.minimumTiltDegrees,
          value.maximumTiltDegrees,
          spinRingHash(value.seed, ring, 13),
        ),
      );
      if ((ring & 1) !== 0) tilt = -tilt;
      qAzimuth.setFromAxisAngle(yAxis, azimuth);
      qTilt.setFromAxisAngle(xAxis, tilt);
      plane.copy(qAzimuth).multiply(qTilt);
      axisU.set(1, 0, 0).applyQuaternion(plane);
      axisV.set(0, 0, 1).applyQuaternion(plane);
      const verticalSlot =
        this.activeRingCount === 1
          ? 0
          : ring / (this.activeRingCount - 1) - 0.5;
      center.copy(this.sourceCenter);
      center.y +=
        verticalSlot * value.verticalSpread * this.sourceSize.y + override.heightOffset;

      for (let j = 0; j < this.segmentCount; j++) {
        const theta = (j / this.segmentCount) * TAU + spinAngle;
        const local =
          amplitudeA * Math.sin(theta * frequencyA + phaseA + time * rateA) +
          amplitudeB * Math.sin(theta * frequencyB + phaseB - time * rateB);
        const middle =
          (displayedRadius * override.radiusScale * breath +
            this.sharedBulges[j] +
            local) *
          radius;
        const radialAngle = theta + selfSpinAngle;
        radial
          .copy(axisU)
          .multiplyScalar(Math.cos(radialAngle))
          .addScaledVector(axisV, Math.sin(radialAngle));
        for (let row = 0; row < RING_ROWS; row++) {
          const vertex = baseVertex + row * this.segmentCount + j;
          const rowRadius = Math.max(0, middle + offsets[row]);
          const p = vertex * 3;
          this.positions[p] = center.x + radial.x * rowRadius;
          this.positions[p + 1] = center.y + radial.y * rowRadius;
          this.positions[p + 2] = center.z + radial.z * rowRadius;
          const c = vertex * 4;
          if (row === 2) {
            this.colors[c] = line.r * brightness;
            this.colors[c + 1] = line.g * brightness;
            this.colors[c + 2] = line.b * brightness;
            this.colors[c + 3] = alpha;
          } else if (row === 1 || row === 3) {
            this.colors[c] = glow.r * brightness * 0.85;
            this.colors[c + 1] = glow.g * brightness * 0.85;
            this.colors[c + 2] = glow.b * brightness * 0.85;
            this.colors[c + 3] = alpha * 0.85;
          } else {
            this.colors[c] = 0;
            this.colors[c + 1] = 0;
            this.colors[c + 2] = 0;
            this.colors[c + 3] = 0;
          }
        }
      }
    }
    this.mesh.geometry.getAttribute("position").needsUpdate = true;
    this.mesh.geometry.getAttribute("color").needsUpdate = true;
    this.uploads++;
  }

  private updateBounds(): void {
    if (!this.mesh?.geometry || !this.settings) return;
    const radius =
      Math.max(this.sourceSize.x * 0.5, this.sourceSize.z * 0.5) *
      this.settings.radiusScale;
    let laneMaximum = Math.max(this.settings.ringOuter, this.settings.ringInner);
    if (this.settings.swallow !== 0) {
      laneMaximum = Math.max(
        laneMaximum,
        Math.max(Math.min(1.1, this.settings.swallowFrom), this.settings.ringOuter + 0.1),
      );
    }
    const depth = Math.max(0.2, this.settings.depth);
    const displayedMaximum =
      depth === 1 ? laneMaximum : Math.pow(laneMaximum, depth);
    const widthScale =
      depth === 1
        ? 1
        : Math.min(1.8, Math.max(0.25, depth * Math.pow(laneMaximum, depth - 1)));
    const contour =
      this.settings.sharedLow +
      this.settings.sharedMid +
      (this.settings.wavyAmp + this.settings.jagAmp) * (1 + 0.7 * this.settings.vary);
    let maximumRadiusScale = 1;
    let maximumHeightOffset = 0;
    for (let ring = 0; ring < this.activeRingCount; ring++) {
      maximumRadiusScale = Math.max(
        maximumRadiusScale,
        this.settings.ringOverrides[ring].radiusScale,
      );
      maximumHeightOffset = Math.max(
        maximumHeightOffset,
        Math.abs(this.settings.ringOverrides[ring].heightOffset),
      );
    }
    const middle =
      displayedMaximum * maximumRadiusScale * (1 + Math.min(0.02, this.settings.breathe)) +
      contour;
    const glow =
      this.settings.ringGlow * (1 + 0.5 * this.settings.vary) * widthScale;
    const vertical = this.settings.verticalSpread * this.sourceSize.y * 0.5 + maximumHeightOffset;
    const extent = (middle + glow) * radius + vertical + 0.01;
    this.mesh.geometry.boundingSphere = new THREE.Sphere(
      this.sourceCenter.clone(),
      Math.max(0.01, extent),
    );
    this.mesh.geometry.boundingBox = new THREE.Box3(
      this.sourceCenter.clone().addScalar(-extent),
      this.sourceCenter.clone().addScalar(extent),
    );
  }
}
