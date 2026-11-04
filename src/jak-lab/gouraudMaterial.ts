import * as THREE from 'three';

/** Keep Three's skin/morph/normal pipeline and scene light uniforms, but compute
 * the light at vertices. MeshLambertMaterial alone is per-fragment in r166. */
export function gouraudMaterial(source: THREE.MeshStandardMaterial): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    name: `${source.name} · Gouraud`, color: source.color, vertexColors: true,
    emissive: source.emissive ?? 0, emissiveIntensity: source.emissiveIntensity ?? 1,
    side: source.side, transparent: source.transparent, opacity: source.opacity,
    alphaTest: source.alphaTest, depthWrite: source.depthWrite, depthTest: source.depthTest,
    blending: source.blending, blendSrc: source.blendSrc, blendDst: source.blendDst,
    blendEquation: source.blendEquation, premultipliedAlpha: source.premultipliedAlpha,
    polygonOffset: source.polygonOffset, polygonOffsetFactor: source.polygonOffsetFactor,
    polygonOffsetUnits: source.polygonOffsetUnits,
  });
  material.userData.gouraud = true;
  material.customProgramCacheKey = () => 'jak-lab-gouraud-vertex-light-v1';
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
      #include <lights_pars_begin>
      varying vec3 vLabFrontLight;
      varying vec3 vLabBackLight;
      vec3 labVertexIrradiance(vec3 n, vec3 viewPosition) {
        vec3 light = getAmbientLightIrradiance(ambientLightColor);
        #if defined(USE_LIGHT_PROBES)
          light += getLightProbeIrradiance(lightProbe, n);
        #endif
        #if NUM_HEMI_LIGHTS > 0
          for (int i = 0; i < NUM_HEMI_LIGHTS; i++)
            light += getHemisphereLightIrradiance(hemisphereLights[i], n);
        #endif
        #if NUM_DIR_LIGHTS > 0
          for (int i = 0; i < NUM_DIR_LIGHTS; i++)
            light += directionalLights[i].color * max(dot(n, directionalLights[i].direction), 0.0);
        #endif
        #if NUM_POINT_LIGHTS > 0
          for (int i = 0; i < NUM_POINT_LIGHTS; i++) {
            IncidentLight incident; getPointLightInfo(pointLights[i], viewPosition, incident);
            light += incident.color * max(dot(n, incident.direction), 0.0);
          }
        #endif
        #if NUM_SPOT_LIGHTS > 0
          for (int i = 0; i < NUM_SPOT_LIGHTS; i++) {
            IncidentLight incident; getSpotLightInfo(spotLights[i], viewPosition, incident);
            light += incident.color * max(dot(n, incident.direction), 0.0);
          }
        #endif
        return light * RECIPROCAL_PI;
      }
    `).replace('#include <project_vertex>', `#include <project_vertex>
      vec3 labNormal = normalize(transformedNormal);
      vec3 labAlbedo = vec3(1.0);
      #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
        labAlbedo = vColor.rgb;
      #endif
      vLabFrontLight = labVertexIrradiance(labNormal, mvPosition.xyz) * labAlbedo;
      vLabBackLight = labVertexIrradiance(-labNormal, mvPosition.xyz) * labAlbedo;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      varying vec3 vLabFrontLight;
      varying vec3 vLabBackLight;
    `).replace('#include <color_fragment>', `
      #if defined(USE_COLOR_ALPHA)
        diffuseColor.a *= vColor.a;
      #endif
    `);
    for (const chunk of ['lights_pars_begin', 'lights_lambert_pars_fragment', 'lights_lambert_fragment',
      'lights_fragment_begin', 'lights_fragment_maps', 'lights_fragment_end', 'normal_fragment_begin',
      'normal_fragment_maps', 'aomap_fragment']) {
      shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, '');
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
      'vec3 outgoingLight = diffuseColor.rgb * (gl_FrontFacing ? vLabFrontLight : vLabBackLight) + totalEmissiveRadiance;');
  };
  return material;
}
