import {RALLY_NOISE,RALLY_SUN} from './rallyMaterials';
import * as THREE from 'three';
import { createSeaSkyGeometry, seaBackdropRadius } from './seaBackdrop';

type Scalar = { value: number };

/** Sea views use a real upper dome whose cut stays on the world sea plane.
 * Other skies retain a directional background. Each pass uses its own camera,
 * including reflected, split-screen and orthographic views. */
export function installSkyProjection(
  sky: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
  hazeColor: THREE.IUniform<THREE.Color>,
  hazeStrength: Scalar,
  opaque: Scalar,
  sea: Scalar,
): { setSeaLevel: (height: number | null) => void;setHazeElevation:(elevation:number)=>void;setDustHaze:(amount:number)=>void;setStormGlow:(strength:number,azimuth:number)=>void } {
  const flatGeometry = sky.geometry;
  const seaGeometry = createSeaSkyGeometry();
  let seaLevel: number | null = null;
  const material = sky.material;
  material.fog = false;
  const cameraWorld = { value: new THREE.Matrix4() };
  const textureTransform = { value: new THREE.Matrix3() };
  const poleColor = { value: new THREE.Color() };
  const hazeElevation = { value: .26 };
  const dustHaze = { value: 0 };
  const rallySun={value:new THREE.Vector3(...RALLY_SUN).normalize()};
  const stormGlow = { value: new THREE.Vector4(0,.27,-1,0) };
  let lastMap: THREE.Texture | null = null;
  sky.name = 'Distant sky backdrop';
  // Transparent water must draw after the background, including the far fill.
  sky.renderOrder = -100;
  sky.frustumCulled = false;
  sky.onBeforeRender = (_renderer, _scene, camera) => {
    cameraWorld.value.copy(camera.matrixWorld);
    if (seaLevel !== null) {
      const e = camera.matrixWorld.elements;
      const radius = seaBackdropRadius(e[13], seaLevel, camera);
      // The renderer computes modelViewMatrix after this callback. Only X/Z
      // follow the active camera; the image cut remains at the real sea Y.
      sky.matrixWorld.makeScale(radius, radius, radius);
      sky.matrixWorld.setPosition(e[12], seaLevel, e[14]);
    }
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
      uSkyHazeElevation:hazeElevation,
      uSkyStorm:stormGlow,uSkyDust:dustHaze,uRallySun:rallySun,
    });
    shader.vertexShader = 'uniform mat4 uSkyCameraWorld; uniform float uSkySea; varying vec3 vSkyRay;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      // Only the X/Y projection terms determine the ray. This also works with
      // the ocean reflection's oblique near plane and off-centre viewports.
      vec4 mvPosition;
      if (uSkySea > 0.5) {
        // Actual world geometry, cropped at the sea plane. The far-depth
        // override affects culling only, never the projected position/height.
        vSkyRay = position;
        mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_Position.z = gl_Position.w;
      } else {
        vec3 eyeRay = isOrthographic ? vec3(0.0, 0.0, -1.0) : vec3(
          (position.x + projectionMatrix[2][0]) / projectionMatrix[0][0],
          (position.y + projectionMatrix[2][1]) / projectionMatrix[1][1], -1.0);
        vSkyRay = mat3(uSkyCameraWorld) * eyeRay;
        mvPosition = vec4(eyeRay, 1.0);
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `);
    shader.fragmentShader = `
      varying vec3 vSkyRay;
      uniform mat3 uSkyTextureTransform;
      uniform vec3 uSkyHazeColor, uSkyPoleColor;
      uniform float uSkyHazeStrength, uSkyOpaqueBackdrop, uSkySea,uSkyHazeElevation;
      uniform vec4 uSkyStorm;uniform float uSkyDust;uniform vec3 uRallySun;
      ${RALLY_NOISE}
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      vec3 skyRay = normalize(vSkyRay);
      if(uSkyDust<.5){
      #ifdef USE_MAP
        // Analytic longitude/latitude prevents a low-poly dome from bending
        // the waterline or pinching it at its triangle boundaries.
        vec2 skyUv;
        if (uSkySea > 0.5) {
          skyUv = vMapUv;
        } else {
          float longitude = dot(skyRay.xz, skyRay.xz) > 0.00000001
            ? atan(skyRay.z, -skyRay.x) / (2.0 * PI) : 0.0;
          skyUv = (uSkyTextureTransform * vec3(longitude,
            0.5 + asin(clamp(skyRay.y, -1.0, 1.0)) / PI, 1.0)).xy;
        }
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
      }else{
        // The rally uses a clean analytic atmosphere. Do not sample the island
        // panorama at all: recolouring it still leaves islands in the clouds.
        float altitude=max(0.0,skyRay.y);
        vec3 clearSky=mix(vec3(.72,.57,.36),vec3(.23,.37,.49),pow(altitude,.42));
        vec2 cloudUv=skyRay.xz/(.22+abs(skyRay.y))*.85;
        float cloud=rallyNoise(cloudUv*2.0)*.62+rallyNoise(cloudUv*5.4)*.27+rallyNoise(cloudUv*13.0)*.11;
        float wisps=smoothstep(.51,.71,cloud)*(1.0-smoothstep(.62,.97,altitude));
        clearSky=mix(clearSky,vec3(.84,.77,.62),wisps*.44);
        float sunDistance=length(skyRay-uRallySun);
        float disc=1.0-smoothstep(.008,.011,sunDistance);
        float corona=exp(-sunDistance*sunDistance*420.0);
        float hazeGlow=exp(-sunDistance*sunDistance*12.0);
        diffuseColor=vec4(clearSky+vec3(5.5,4.6,3.0)*disc+vec3(.7,.42,.17)*corona+vec3(.14,.075,.024)*hazeGlow,1.0);
      }
      float stormCone=pow(max(0.0,dot(skyRay,normalize(uSkyStorm.xyz))),10.0);
      float stormCloud=smoothstep(.035,.18,skyRay.y)*(1.0-smoothstep(.55,.9,skyRay.y));
      diffuseColor.rgb+=vec3(.22,.28,.36)*uSkyStorm.w*stormCone*stormCloud*(1.0-uSkySea);
      float horizonAir = smoothstep(0.01, uSkyHazeElevation, skyRay.y);
      diffuseColor.rgb = mix(diffuseColor.rgb, uSkyHazeColor,
        (1.0 - horizonAir) * uSkyHazeStrength * (1.0 - uSkySea));
      if (uSkyOpaqueBackdrop > 0.5 || uSkySea > 0.5) {
        diffuseColor.rgb = mix(uSkyHazeColor, diffuseColor.rgb, diffuseColor.a);
        diffuseColor.a = 1.0;
      }

    `);
  };
  material.customProgramCacheKey = () => 'sea-level-hemisphere-v7-rally';
  return {setDustHaze(amount){dustHaze.value=THREE.MathUtils.clamp(amount,0,1);},setStormGlow(strength,azimuth){stormGlow.value.set(Math.sin(azimuth),.27,Math.cos(azimuth),THREE.MathUtils.clamp(strength,0,1));},setHazeElevation(elevation){hazeElevation.value=THREE.MathUtils.clamp(elevation,.02,1);},setSeaLevel(height) {
    const enabled = height !== null;
    seaLevel = height; sea.value = enabled ? 1 : 0;
    sky.name = enabled ? 'Sea-level sky backdrop' : 'Distant sky backdrop';
    const geometry = enabled ? seaGeometry : flatGeometry;
    if (sky.geometry !== geometry) {
      sky.geometry = geometry;
      material.side = enabled ? THREE.BackSide : THREE.FrontSide;
      material.needsUpdate = true;
    }
  } };
}
