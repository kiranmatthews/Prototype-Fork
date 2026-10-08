import * as THREE from "three";

const PROFILES = {
  // The painted coast sheet contains roughly four blocks by seven courses.
  "coast-stone": { tile: 2.8, relief: .024, low: .055, high: .18 },
  stone: { tile: 1.6, relief: .018, low: .34, high: .64 },
} as const;

const treatedMaterials = new WeakSet<THREE.Material>();

export function isMasonryTexture(kind: string | undefined): kind is keyof typeof PROFILES {
  return kind === "coast-stone" || kind === "stone";
}

/** Repeatable toolkit masonry only; model atlases keep their authored UVs/maps.
 * Box projection measures object-space positions in metres, so scaling a slab
 * cannot stretch its side faces. Coordinates follow moving/rotating platforms.
 * Relief comes from the existing painted joints, with no extra texture or pass.
 */
export function addMasonryLook(material: THREE.MeshPhongMaterial, kind: string): void {
  if (!isMasonryTexture(kind) || treatedMaterials.has(material) || !material.map) return;
  const profile = PROFILES[kind];
  treatedMaterials.add(material);
  material.userData.masonry = { version: 1, metresPerTile: profile.tile, reliefMetres: profile.relief };
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    shader.uniforms.masonryTileSize = { value: profile.tile };
    shader.uniforms.masonryRelief = { value: profile.relief };
    shader.uniforms.masonryThresholds = { value: new THREE.Vector2(profile.low, profile.high) };
    shader.vertexShader = `varying vec3 vMasonryPosition;
varying vec3 vMasonryNormal;
` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      vec3 masonryScale = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
      #ifdef USE_INSTANCING
        masonryScale *= vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
      #endif
      masonryScale = max(masonryScale, vec3(.0001));
      vMasonryPosition = transformed * masonryScale;
      vMasonryNormal = normal / masonryScale;
    `);
    shader.fragmentShader = `varying vec3 vMasonryPosition;
varying vec3 vMasonryNormal;
uniform float masonryTileSize;
uniform float masonryRelief;
uniform vec2 masonryThresholds;
` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", `
      vec3 masonryWeights = pow(abs(normalize(vMasonryNormal)), vec3(8.0));
      masonryWeights /= max(dot(masonryWeights, vec3(1.0)), .0001);
      vec3 masonryP = vMasonryPosition / masonryTileSize;
      vec4 masonryTexel = texture2D(map, masonryP.zy) * masonryWeights.x
        + texture2D(map, masonryP.xz) * masonryWeights.y
        + texture2D(map, masonryP.xy) * masonryWeights.z;
      diffuseColor *= masonryTexel;
      // Samples are linear-light: low painted mortar is recessed; the broad
      // stone faces remain nearly level instead of turning every brushmark into noise.
      float masonryLuma = dot(masonryTexel.rgb, vec3(.2126, .7152, .0722));
      float masonryFace = smoothstep(masonryThresholds.x, masonryThresholds.y, masonryLuma);
      float masonryHeight = masonryRelief * masonryFace;
      vec2 masonryHeightSlope = vec2(dFdx(masonryHeight), dFdy(masonryHeight));
      float masonryFootprint = max(length(dFdx(vMasonryPosition)), length(dFdy(vMasonryPosition)));
      float masonryDetail = 1.0 - smoothstep(.035, .16, masonryFootprint);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
      // Surface-gradient bump mapping, in view space like Three's light normals.
      vec3 masonryDx = dFdx(-vViewPosition), masonryDy = dFdy(-vViewPosition);
      vec3 masonryRx = cross(masonryDy, normal), masonryRy = cross(normal, masonryDx);
      float masonryDet = dot(masonryDx, masonryRx) * faceDirection;
      vec3 masonryGradient = sign(masonryDet) * (masonryHeightSlope.x * masonryRx + masonryHeightSlope.y * masonryRy);
      masonryGradient /= max(abs(masonryDet), 1e-10);
      // Painted speckles must not produce grazing, almost-black normals.
      masonryGradient *= min(1.0, .7 / max(length(masonryGradient), .0001));
      normal = normalize(normal - masonryDetail * masonryGradient);
      specularStrength *= mix(.25, 1.0, masonryFace);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
      reflectedLight.indirectDiffuse *= mix(.82, 1.0, masonryFace);
    `);
  };
  material.customProgramCacheKey = () => previousKey + "|metric-masonry-relief-v1";
  material.needsUpdate = true;
}
