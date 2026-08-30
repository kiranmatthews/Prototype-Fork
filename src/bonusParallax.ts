import * as THREE from "three";

export type BonusParallaxAnchorKey = string | number;

export interface BonusParallaxOptions {
  /** Defaults to `${BASE_URL}bonus-parallax/`. */
  assetBaseUrl?: string;
  visible?: boolean;
  masterParallax?: number;
  onTextureError?: (url: string, error: unknown) => void;
}

export const BONUS_PARALLAX_LAYER_FILES = {
  sky: "BonusParallax_Sky.png",
  mountains: "BonusParallax_Mountains.png",
  backgroundHouses: "BonusParallax_BackgroundHouses.png",
  foregroundHouses: "BonusParallax_ForegroundHouses.png",
} as const;

const SOURCE_ASPECT = 1672 / 941;
const MOTION_SMOOTH_SECONDS = 0.55;
const MOTION_SPAN_X = 120;
const MOTION_SPAN_Y = 14;
const CAMERA_DEPTH_RATIO = 0.98;

const vertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uSky;
  uniform sampler2D uMountains;
  uniform sampler2D uBackgroundHouses;
  uniform sampler2D uForegroundHouses;
  uniform float uSourceAspect;
  uniform float uViewportAspect;
  uniform vec2 uDriver;
  uniform float uTime;
  uniform float uMasterParallax;

  varying vec2 vUv;

  vec2 aspectCoverUv(vec2 uv) {
    vec2 covered = uv - 0.5;
    if (uViewportAspect > uSourceAspect) {
      covered.y *= uSourceAspect / max(uViewportAspect, 0.0001);
    } else {
      covered.x *= uViewportAspect / max(uSourceAspect, 0.0001);
    }
    return covered + 0.5;
  }

  vec2 ambientDrift(float phase, float amplitude) {
    return amplitude * vec2(
      sin(uTime * 0.37 + phase),
      cos(uTime * 0.29 + phase * 1.37)
    );
  }

  vec2 layerUv(vec2 coveredUv, vec4 motion, float phase) {
    vec2 offset = uDriver * motion.xy * uMasterParallax;
    offset += ambientDrift(phase, motion.w);
    float largestOffset = max(abs(motion.x), abs(motion.y)) * 2.0
      + abs(motion.w) + 0.003;
    float safeDenominator = max(0.08, 1.0 - 2.0 * largestOffset);
    float overscan = max(max(1.0, motion.z), 1.0 / safeDenominator);
    return clamp(0.5 + (coveredUv - 0.5) / overscan + offset, 0.001, 0.999);
  }

  vec3 alphaOver(vec3 underColor, vec4 layer) {
    return mix(underColor, layer.rgb, clamp(layer.a, 0.0, 1.0));
  }

  vec4 depthTint(vec4 layer, float strength, vec3 fogColor) {
    layer.rgb = mix(layer.rgb, fogColor, clamp(strength, 0.0, 1.0));
    return layer;
  }

  float warmHighlight(vec3 color) {
    float hot = smoothstep(0.42, 0.82, max(color.r, color.g));
    float redWarmth = smoothstep(0.07, 0.34, color.r - color.b);
    float greenSupport = smoothstep(-0.03, 0.24, color.g - color.b);
    return clamp(hot * redWarmth * greenSupport, 0.0, 1.0);
  }

  float flicker(float phase, float amount, vec2 uv) {
    float spatialPhase = sin(dot(floor(uv * vec2(11.0, 7.0)), vec2(1.37, 2.17)));
    phase += spatialPhase * 3.14159265;
    float wave = sin(uTime * 5.1 + phase) * 0.45
      + sin(uTime * 9.7 + phase * 1.73) * 0.25
      + sin(uTime * 1.1 + phase * 0.61) * 0.30;
    return 1.0 + wave * amount;
  }

  float bloomPulse() {
    float phase = uTime * 0.22 * 6.2831853;
    float pulse = clamp(
      0.5 + sin(phase) * 0.34 + sin(phase * 0.47 + 1.13) * 0.16,
      0.0,
      1.0
    );
    return 1.0 + 0.86 * mix(0.18, 0.82, pulse);
  }

  void main() {
    vec2 covered = aspectCoverUv(vUv);
    vec2 skyUv = layerUv(covered, vec4(0.006, 0.004, 1.035, 0.0005), 0.3);
    vec2 mountainsUv = layerUv(covered, vec4(0.024, 0.015, 1.09, 0.0012), 2.1);
    vec2 backgroundUv = layerUv(covered, vec4(0.058, 0.034, 1.20, 0.0021), 4.7);
    vec2 foregroundUv = layerUv(covered, vec4(0.108, 0.064, 1.38, 0.0032), 7.3);

    vec4 sky = texture2D(uSky, skyUv);
    vec4 rawMountains = texture2D(uMountains, mountainsUv);
    vec4 rawBackground = texture2D(uBackgroundHouses, backgroundUv);
    vec4 rawForeground = texture2D(uForegroundHouses, foregroundUv);

    const vec3 fogColor = vec3(0.025, 0.30, 0.64);
    vec4 mountains = depthTint(rawMountains, 0.31 * 2.0, fogColor);
    vec4 background = depthTint(rawBackground, 0.21 * 2.0, fogColor);
    vec4 foreground = depthTint(rawForeground, 0.09 * 2.0, fogColor);

    vec3 color = sky.rgb;
    color = alphaOver(color, mountains);
    color = alphaOver(color, background);
    color = alphaOver(color, foreground);

    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    float shadowMask = 1.0 - clamp(luminance * 1.85, 0.0, 1.0);
    color *= mix(vec3(1.0), vec3(0.58, 0.88, 1.20), 0.74) * 1.14;
    color += fogColor * (0.055 + 2.0 * 0.022) * shadowMask;
    vec3 blueGrade = color * vec3(0.78, 0.98, 1.15) + fogColor * 0.055 * shadowMask;
    color = mix(color, blueGrade, 0.48);

    float pulse = bloomPulse();
    float backgroundGlow = warmHighlight(rawBackground.rgb) * rawBackground.a
      * flicker(1.9, 0.11, backgroundUv);
    float foregroundGlow = warmHighlight(rawForeground.rgb) * rawForeground.a
      * flicker(5.4, 0.15, foregroundUv);
    vec3 emission = rawBackground.rgb * backgroundGlow * 2.8;
    emission += rawForeground.rgb * foregroundGlow * 3.6;
    emission *= 2.0 * pulse;

    gl_FragColor = vec4(color + emission, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const clampSigned = (value: number): number => Math.max(-1, Math.min(1, value));

function smoothDampAxis(
  current: number,
  target: number,
  velocity: number,
  deltaSeconds: number,
): readonly [value: number, velocity: number] {
  if (deltaSeconds <= 0) return [current, velocity];
  const omega = 2 / MOTION_SMOOTH_SECONDS;
  const x = omega * deltaSeconds;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * deltaSeconds;
  return [target + (change + temp) * decay, (velocity - omega * temp) * decay];
}

function assetUrl(baseUrl: string, fileName: string): string {
  return `${baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`}${fileName}`;
}

/**
 * Camera-owned Bonus backdrop. Call `update` once per rendered frame with the
 * presentation delta (zero while paused) and a respawn sequence/key. A changed
 * key snaps parallax to the new player position without redefining the original
 * level anchor, matching Unity's checkpoint behavior.
 */
export class BonusParallax {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly material: THREE.ShaderMaterial;
  readonly textures: readonly THREE.Texture[];

  private readonly camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private readonly cameraPosition = new THREE.Vector3();
  private readonly cameraDirection = new THREE.Vector3();
  private readonly cameraQuaternion = new THREE.Quaternion();
  private readonly origin = new THREE.Vector3();
  private readonly driver = new THREE.Vector2();
  private readonly driverVelocity = new THREE.Vector2();
  private hasOrigin = false;
  private anchorKey: BonusParallaxAnchorKey | undefined;
  private presentationTime = 0;
  private disposed = false;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    options: BonusParallaxOptions = {},
  ) {
    this.camera = camera;
    const baseUrl =
      options.assetBaseUrl ?? `${import.meta.env.BASE_URL}bonus-parallax/`;
    const loader = new THREE.TextureLoader();
    const load = (fileName: string): THREE.Texture => {
      const url = assetUrl(baseUrl, fileName);
      const texture = loader.load(
        url,
        undefined,
        undefined,
        (error) => options.onTextureError?.(url, error),
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      return texture;
    };

    const sky = load(BONUS_PARALLAX_LAYER_FILES.sky);
    const mountains = load(BONUS_PARALLAX_LAYER_FILES.mountains);
    const background = load(BONUS_PARALLAX_LAYER_FILES.backgroundHouses);
    const foreground = load(BONUS_PARALLAX_LAYER_FILES.foregroundHouses);
    this.textures = [sky, mountains, background, foreground];
    this.material = new THREE.ShaderMaterial({
      name: "BonusParallax_Compositor",
      uniforms: {
        uSky: { value: sky },
        uMountains: { value: mountains },
        uBackgroundHouses: { value: background },
        uForegroundHouses: { value: foreground },
        uSourceAspect: { value: SOURCE_ASPECT },
        uViewportAspect: { value: 16 / 9 },
        uDriver: { value: this.driver },
        uTime: { value: 0 },
        uMasterParallax: {
          value: THREE.MathUtils.clamp(options.masterParallax ?? 2, 0, 2),
        },
      },
      vertexShader,
      fragmentShader,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.name = "BonusParallax_CameraQuad";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10_000;
    this.mesh.userData.noShadow = true;
    this.mesh.visible = options.visible ?? true;
    scene.add(this.mesh);
    this.updateCameraQuad();
  }

  get visible(): boolean {
    return this.mesh.visible;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  setMasterParallax(value: number): void {
    this.material.uniforms.uMasterParallax.value = THREE.MathUtils.clamp(value, 0, 2);
  }

  /** Establish a new level origin and restart presentation time. */
  reset(playerPosition: THREE.Vector3, anchorKey?: BonusParallaxAnchorKey): void {
    this.origin.copy(playerPosition);
    this.driver.set(0, 0);
    this.driverVelocity.set(0, 0);
    this.presentationTime = 0;
    this.anchorKey = anchorKey;
    this.hasOrigin = true;
    this.material.uniforms.uTime.value = 0;
  }

  update(
    playerPosition: THREE.Vector3,
    deltaSeconds: number,
    anchorKey?: BonusParallaxAnchorKey,
  ): void {
    if (this.disposed) return;
    if (!this.hasOrigin) this.reset(playerPosition, anchorKey);

    const targetX = clampSigned((playerPosition.x - this.origin.x) / MOTION_SPAN_X);
    const targetY = clampSigned((playerPosition.y - this.origin.y) / MOTION_SPAN_Y);
    if (anchorKey !== this.anchorKey) {
      this.anchorKey = anchorKey;
      this.driver.set(targetX, targetY);
      this.driverVelocity.set(0, 0);
    } else {
      const dt = Math.max(0, Math.min(deltaSeconds, 0.1));
      const x = smoothDampAxis(this.driver.x, targetX, this.driverVelocity.x, dt);
      const y = smoothDampAxis(this.driver.y, targetY, this.driverVelocity.y, dt);
      this.driver.set(x[0], y[0]);
      this.driverVelocity.set(x[1], y[1]);
      this.presentationTime += dt;
      this.material.uniforms.uTime.value = this.presentationTime;
    }
    this.updateCameraQuad();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.textures.forEach((texture) => texture.dispose());
  }

  private updateCameraQuad(): void {
    const near = Math.max(0.001, this.camera.near);
    const far = Math.max(near + 1, this.camera.far);
    const depth = Math.max(near + 0.1, far * CAMERA_DEPTH_RATIO);
    let width: number;
    let height: number;
    if (this.camera instanceof THREE.OrthographicCamera) {
      width = Math.max(0.01, this.camera.right - this.camera.left);
      height = Math.max(0.01, this.camera.top - this.camera.bottom);
    } else {
      height = 2 * depth * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5));
      width = height * Math.max(0.01, this.camera.aspect);
    }
    this.camera.getWorldPosition(this.cameraPosition);
    this.camera.getWorldDirection(this.cameraDirection);
    this.camera.getWorldQuaternion(this.cameraQuaternion);
    this.mesh.position
      .copy(this.cameraPosition)
      .addScaledVector(this.cameraDirection, depth);
    this.mesh.quaternion.copy(this.cameraQuaternion);
    this.mesh.scale.set(width, height, 1);
    this.material.uniforms.uViewportAspect.value = width / height;
  }
}

export function createBonusParallax(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  options?: BonusParallaxOptions,
): BonusParallax {
  return new BonusParallax(scene, camera, options);
}
