import * as THREE from 'three';

type Scalar = { value: number };

/** One background draw, evaluated from the camera actually rendering it.
 * Translation never enters the projection, including reflected/split cameras.
 * Painted shorelines stay visible; reflected rays meet them at the horizon. */
export function installSkyProjection(
  sky: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>,
  hazeColor: THREE.IUniform<THREE.Color>,
  hazeStrength: Scalar,
  opaque: Scalar,
  sea: Scalar,
): void {
  const material = sky.material;
  const cameraWorld = { value: new THREE.Matrix4() };
  const textureTransform = { value: new THREE.Matrix3() };
  const poleColor = { value: new THREE.Color() };
  let lastMap: THREE.Texture | null = null;
  sky.name = 'Infinite sky and sea backdrop';
  // Transparent water must draw after the background, including the far fill.
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  sky.onBeforeRender = (_renderer, _scene, camera) => {
    cameraWorld.value.copy(camera.matrixWorld);
    const map = material.map;
    if (!map) return;
    if (map.matrixAutoUpdate) map.updateMatrix();
    textureTransform.value.copy(map.matrix);
    if (map === lastMap) return;
    lastMap = map;
    poleColor.value.copy(hazeColor.value);
    // Resolve the zenith once per texture, never on the frame clock. The
    // original paintings are panoramas, not pole-safe spherical photographs.
    const canvas = map.source.data;
    if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement) {
      const row = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, 1).data;
      if (row) {
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < row.length; i += 4) { r += row[i]; g += row[i + 1]; b += row[i + 2]; }
        poleColor.value.setRGB(r / (canvas.width * 255), g / (canvas.width * 255),
          b / (canvas.width * 255), THREE.SRGBColorSpace);
      }
    }
  };
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {
      uSkyCameraWorld: cameraWorld, uSkyTextureTransform: textureTransform,
      uSkyHazeColor: hazeColor, uSkyHazeStrength: hazeStrength,
      uSkyOpaqueBackdrop: opaque, uSkySea: sea, uSkyPoleColor: poleColor,
    });
    shader.vertexShader = 'uniform mat4 uSkyCameraWorld; varying vec3 vSkyRay;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      // Only the X/Y projection terms determine the ray. This also works with
      // the ocean reflection's oblique near plane and off-centre viewports.
      vec3 eyeRay = isOrthographic ? vec3(0.0, 0.0, -1.0) : vec3(
        (position.x + projectionMatrix[2][0]) / projectionMatrix[0][0],
        (position.y + projectionMatrix[2][1]) / projectionMatrix[1][1], -1.0);
      vSkyRay = mat3(uSkyCameraWorld) * eyeRay;
      vec4 mvPosition = vec4(eyeRay, 1.0);
      gl_Position = vec4(position.xy, 1.0, 1.0);
    `);
    shader.fragmentShader = `
      varying vec3 vSkyRay;
      uniform mat3 uSkyTextureTransform;
      uniform vec3 uSkyHazeColor, uSkyPoleColor;
      uniform float uSkyHazeStrength, uSkyOpaqueBackdrop, uSkySea;
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 skyRay = normalize(vSkyRay);
      #ifdef USE_MAP
        // Analytic longitude/latitude prevents a low-poly dome from bending
        // the waterline or pinching it at its triangle boundaries.
        float longitude = dot(skyRay.xz, skyRay.xz) > 0.00000001
          ? atan(skyRay.z, -skyRay.x) / (2.0 * PI) : 0.0;
        vec2 skyUv = vec2(longitude,
          0.5 + asin(clamp(uSkySea > 0.5 ? abs(skyRay.y) : skyRay.y, -1.0, 1.0)) / PI);
        skyUv = (uSkyTextureTransform * vec3(skyUv, 1.0)).xy;
        // Explicit gradients remain continuous through the atan wrap. The
        // hardware's implicit derivative otherwise selects the coarsest mip.
        vec2 dx = dFdx(skyUv), dy = dFdy(skyUv);
        float wrap = max(abs(uSkyTextureTransform[0][0]), 1.0);
        dx.x -= round(dx.x / wrap) * wrap;
        dy.x -= round(dy.x / wrap) * wrap;
        diffuseColor *= textureGrad(map, skyUv, dx, dy);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSkyPoleColor,
          smoothstep(0.6, 0.96, skyRay.y));
      #endif
      float horizonAir = smoothstep(0.01, 0.26, skyRay.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, uSkyHazeColor,
        (1.0 - horizonAir) * uSkyHazeStrength * (1.0 - uSkySea));
      if (uSkyOpaqueBackdrop > 0.5 || uSkySea > 0.5) {
        diffuseColor.rgb = mix(uSkyHazeColor, diffuseColor.rgb, diffuseColor.a);
        diffuseColor.a = 1.0;
      }

    `);
  };
  material.customProgramCacheKey = () => 'infinite-sky-sea-v2';
}
