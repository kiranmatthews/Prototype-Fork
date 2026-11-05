import * as THREE from 'three';
import { createCrateArt } from './crateArt';
import { prepareCrateSculpt } from './crateSculpt';

/** The complete authored crate, with private illustrated HUD materials.
 * World crates retain their original PBR materials and shared texture assets.
 */
export function illustratedCrateHud(): THREE.Group {
  const art = createCrateArt('wood', 1);
  const group = art.root;
  group.name = 'Illustrated live 3D crate HUD';
  // A wood counter has no label. Exclude the empty label planes from its bounds.
  group.remove(art.marks);
  let outline: THREE.Mesh | undefined;

  const apply = (): void => {
    const source = art.shell.material as THREE.MeshStandardMaterial;
    if (source.userData.illustratedCrateHud) return;
    source.map?.updateMatrix();
    const material = new THREE.ShaderMaterial({
      name: 'Crate HUD / illustrated carved timber',
      toneMapped: false,
      defines: art.shell.geometry.hasAttribute('color') ? { HUD_VERTEX_COLOR: 1 } : {},
      uniforms: {
        opacity: { value: 1 },
        map: { value: source.map },
        mapTransform: { value: source.map?.matrix.clone() ?? new THREE.Matrix3() },
        tint: { value: source.color.clone() },
      },
      vertexShader: /* glsl */ `
        uniform mat3 mapTransform;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vColor;
        #ifdef HUD_VERTEX_COLOR
          attribute vec3 color;
        #endif
        void main() {
          vUv = (mapTransform * vec3(uv, 1.0)).xy;
          vNormal = normalize(normalMatrix * normal);
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          vView = -view.xyz;
          vColor = vec3(1.0);
          #ifdef HUD_VERTEX_COLOR
            vColor = color;
          #endif
          gl_Position = projectionMatrix * view;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        uniform vec3 tint;
        uniform float opacity;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vView;
        varying vec3 vColor;
        void main() {
          vec3 n = normalize(vNormal);
          vec3 base = texture2D(map, vUv).rgb * tint * vColor;
          float d = dot(n, normalize(vec3(-.58, .78, 1.1)));
          // Broad warm planes, with soft transitions that stay calm in motion.
          float light = .40 + .26 * smoothstep(-.35, .08, d)
            + .25 * smoothstep(.18, .50, d) + .24 * smoothstep(.60, .92, d);
          vec3 shadow = vec3(.67, .43, .40);
          vec3 sun = vec3(1.14, 1.02, .79);
          vec3 paint = base * mix(shadow, sun, smoothstep(-.38, .85, d)) * light;
          // Preserve the source grain and carved recesses, lift only the lit
          // bevels toward the ivory edge highlights of the Bone Head portrait.
          float value = dot(base, vec3(.2126, .7152, .0722));
          float bevel = smoothstep(.72, .97, d) * smoothstep(.09, .44, value);
          paint += vec3(.19, .12, .045) * bevel;
          float rim = 1.0 - smoothstep(.025, .19, abs(dot(n, normalize(vView))));
          paint = mix(paint, vec3(.055, .018, .009), rim * .55);
          gl_FragColor = vec4(paint, opacity);
          #include <colorspace_fragment>
        }
      `,
    });
    material.userData.illustratedCrateHud = true;
    art.shell.material = material;
    art.shell.name = 'Illustrated crate / complete carved surface';
    art.shell.onBeforeRender = (_renderer, _scene, _camera, _geometry, active) => {
      (active as THREE.ShaderMaterial).uniforms.opacity.value = active.opacity;
    };

    if (outline) {
      group.remove(outline);
      outline.geometry.dispose();
      (outline.material as THREE.Material).dispose();
    }
    const geometry = art.shell.geometry.clone();
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    // Average only the outline normals at split vertices. The visible sculpt's
    // hard edges, vertex count, UVs and every source triangle remain untouched.
    const sums = new Map<string, THREE.Vector3>();
    const keys: string[] = [];
    for (let i = 0; i < p.count; i++) {
      const key = `${Math.round(p.getX(i) * 100000)},${Math.round(p.getY(i) * 100000)},${Math.round(p.getZ(i) * 100000)}`;
      keys.push(key);
      const sum = sums.get(key) ?? new THREE.Vector3();
      sum.x += n.getX(i); sum.y += n.getY(i); sum.z += n.getZ(i);
      sums.set(key, sum);
    }
    for (const sum of sums.values()) sum.normalize();
    for (let i = 0; i < p.count; i++) {
      const normal = sums.get(keys[i])!;
      p.setXYZ(i, p.getX(i) + normal.x * .006, p.getY(i) + normal.y * .006, p.getZ(i) + normal.z * .006);
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    outline = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      name: 'Crate HUD / brown ink silhouette', color: 0x3e1e0e,
      side: THREE.BackSide, toneMapped: false,
    }));
    outline.name = 'Illustrated crate / ink contour';
    outline.renderOrder = 1;
    group.add(outline);
  };
  apply();
  // The sculpt replaces the procedural fallback asynchronously. Reapply before
  // the next frame, then cover the remaining crate-art readiness work as well.
  void prepareCrateSculpt().then(apply).catch(() => {});
  void art.ready.then(apply);
  return group;
}
