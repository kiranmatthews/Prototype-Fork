import * as THREE from 'three';

/** Banana Bay's added sun must not change the established shader in any other
 * level. When disabled, both shader source and program key are the original. */
export function installBananaBaySkySun(material: THREE.MeshBasicMaterial, direction: THREE.Vector3): (enabled: boolean) => void {
  const originalCompile = material.onBeforeCompile;
  const originalKey = material.customProgramCacheKey;
  const sun = { value: direction.clone().normalize() };
  let enabled = false;
  material.onBeforeCompile = function (shader, renderer) {
    originalCompile.call(this, shader, renderer);
    if (!enabled) return;
    shader.uniforms.uBananaBaySun = sun;
    shader.fragmentShader = 'uniform vec3 uBananaBaySun;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', `
      float bananaSunDistance = length(skyRay - uBananaBaySun);
      float bananaSunDisk = 1.0 - smoothstep(.014, .018, bananaSunDistance);
      vec3 bananaSunBloom = vec3(1.1,.86,.52) * exp(-bananaSunDistance * bananaSunDistance * 530.0)
        + vec3(.22,.19,.14) * exp(-bananaSunDistance * bananaSunDistance * 45.0);
      diffuseColor.rgb += bananaSunBloom + vec3(9.0,7.8,5.8) * bananaSunDisk;
      #include <alphamap_fragment>
    `);
  };
  material.customProgramCacheKey = () => originalKey.call(material) + (enabled ? '-banana-bay-sun-v1' : '');
  return active => {
    if (enabled === active) return;
    enabled = active;
    material.needsUpdate = true;
  };
}
