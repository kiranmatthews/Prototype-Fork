import * as THREE from 'three';
import { buildFruitGeometry } from './fruitAssets';

/** Preserve the original HUD idle turn: one revolution in about 10.47 seconds. */
export const FRUIT_HUD_TURN_RATE = 0.6;

/** Complete authored fruit, shaded for the illustrated Bone Head HUD family.
 * Materials are private to this icon; world fruit and other HUD art keep theirs.
 */
export function illustratedFruitHud(): THREE.Group {
  const group = new THREE.Group();
  const geometry = buildFruitGeometry(0);
  const material = new THREE.ShaderMaterial({
    name: 'Fruit HUD / illustrated studio shading',
    toneMapped: false,
    uniforms: { opacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float fruitPart;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying float vPart;
      void main() {
        vColor = color;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        vUv = uv;
        vPart = fruitPart;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vPosition;
      varying vec2 vUv;
      varying float vPart;

      void main() {
        vec3 n = normalize(vNormal);
        vec3 light = normalize(vec3(-.55, .75, 1.0));
        float d = dot(n, light);
        float leaf = step(.5, vPart) * (1.0 - step(1.5, vPart));
        float stem = step(1.5, vPart);
        float skin = 1.0 - step(.5, vPart);

        // Smooth skin with broad, deliberate value groups. The warm red-violet
        // shade and ivory-gold light echo the portrait without texturing the peel.
        float shade = .30 + .23 * smoothstep(-.32, -.04, d)
          + .23 * smoothstep(.10, .42, d) + .27 * smoothstep(.54, .87, d);
        vec3 shadow = mix(vec3(.65, .38, .34), vec3(.40, .62, .30), leaf);
        vec3 lit = mix(vec3(1.10, 1.02, .84), vec3(1.03, 1.10, .75), leaf);
        vec3 paint = vColor * mix(shadow, lit, smoothstep(-.35, .86, d)) * shade;

        // Elongated, softly edged shoulder highlight instead of a round spot.
        // It moves continuously with the real surface; no stepping or frame atlas.
        vec3 highlightNormal = normalize(n * vec3(1.0, .72, 1.0));
        float h = max(0.0, dot(highlightNormal, normalize(vec3(-.42, .48, 1.65))));
        float shoulder = smoothstep(-.22, .10, vPosition.y);
        float broad = smoothstep(.86, .97, h);
        float core = smoothstep(.972, .996, h);
        paint += skin * shoulder * (vec3(1.0, .71, .32) * broad * .17
          + vec3(1.0, .88, .60) * core * .17);

        // A little warm reflected light keeps the lower green tip alive.
        float bounce = (1.0 - smoothstep(-.38, -.10, vPosition.y))
          * smoothstep(-.25, .65, n.z);
        paint += skin * vec3(.025, .036, .006) * bounce;
        float socket = exp(-dot(vPosition.xz, vPosition.xz) / .008)
          * smoothstep(.20, .32, vPosition.y);
        paint *= 1.0 - skin * socket * .24;

        // Leaf veins follow the authored folds. Derivative filtering keeps fine
        // marks quiet at HUD size and prevents crawling as the crown rotates.
        float across = vUv.y - .5;
        float uvAA = max(fwidth(vUv.y), .001);
        float ribShadow = 1.0 - smoothstep(.022, .022 + uvAA, abs(across));
        float ribLight = 1.0 - smoothstep(.010, .010 + uvAA, abs(across + .019));
        float phase = (vUv.x - pow(abs(across) * 2.0, .72)
          * (.12 + .13 * vUv.x)) * 6.2;
        float phaseAA = max(fwidth(phase), .001);
        float veins = 1.0 - smoothstep(.024, .024 + phaseAA, abs(fract(phase + .5) - .5));
        float veinFade = 1.0 - smoothstep(.10, .30, phaseAA);
        float leafEdge = smoothstep(.78, .99, abs(across) * 2.0);
        paint *= 1.0 - leaf * (ribShadow * .23 + veins * veinFade * .16 + leafEdge * .12);
        paint += leaf * ribLight * vec3(.14, .18, .028) * (.5 + .5 * max(d, 0.0));
        paint += leaf * pow(max(d, 0.0), 6.0) * vec3(.045, .055, .008);

        // Fine longitudinal bark ridges, subdued below pixel size.
        float barkPhase = vUv.y * 8.0 + sin(vUv.x * 16.0) * .10;
        float barkFade = 1.0 - smoothstep(.14, .40, fwidth(barkPhase));
        paint *= 1.0 + stem * cos(barkPhase * 6.2831853) * .12 * barkFade;
        paint += stem * pow(max(d, 0.0), 5.0) * vec3(.12, .075, .025);

        // The inner contour uses the real normal, leaving the smooth silhouette
        // intact. The separate hull supplies a crisp, warm-brown outer edge.
        float rim = 1.0 - smoothstep(.025, .17, abs(n.z));
        vec3 ink = mix(vec3(.065, .022, .011), vec3(.025, .044, .008), leaf);
        paint = mix(paint, ink, rim * mix(.64, .44, leaf));
        gl_FragColor = vec4(paint, opacity);
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Illustrated fruit / complete surface';
  // UI clones materials for the row/reward-flight fade. Read the active clone,
  // rather than retaining the original uniform after the first reveal.
  mesh.onBeforeRender = (_renderer, _scene, _camera, _geometry, activeMaterial) => {
    (activeMaterial as THREE.ShaderMaterial).uniforms.opacity.value = activeMaterial.opacity;
  };
  group.add(mesh);

  // Every source triangle is retained. Only the private back-face outline is
  // expanded; lighter strokes on the crown preserve thin leaves and the stalk.
  const outlineGeometry = geometry.clone();
  const positions = outlineGeometry.getAttribute('position');
  const normals = outlineGeometry.getAttribute('normal');
  const parts = outlineGeometry.getAttribute('fruitPart');
  for (let i = 0; i < positions.count; i++) {
    const width = parts.getX(i) < .5 ? .0085 : .0035;
    positions.setXYZ(i,
      positions.getX(i) + normals.getX(i) * width,
      positions.getY(i) + normals.getY(i) * width,
      positions.getZ(i) + normals.getZ(i) * width);
  }
  outlineGeometry.computeBoundingBox();
  outlineGeometry.computeBoundingSphere();
  const outline = new THREE.Mesh(outlineGeometry, new THREE.MeshBasicMaterial({
    name: 'Fruit HUD / brown ink silhouette',
    color: 0x3e1e0e,
    side: THREE.BackSide,
    toneMapped: false,
  }));
  outline.name = 'Illustrated fruit / ink contour';
  // Draw the surface first so its depth hides the hull's interior, including
  // during translucent HUD fades. Only the exposed ink edge blends over play.
  outline.renderOrder = 1;
  group.add(outline);
  group.name = 'Illustrated live 3D fruit HUD';
  return group;
}
