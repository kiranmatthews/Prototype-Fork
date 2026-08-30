import * as THREE from "three";

export interface ProceduralThornOptions {
  size?: readonly [number, number, number];
  color?: string;
  seed?: number;
}

export interface ProceduralThornCluster {
  readonly group: THREE.Group;
  readonly pulseMaterials: readonly THREE.MeshStandardMaterial[];
  readonly light: THREE.PointLight;
  update(timeSeconds: number): void;
}

const TAU = Math.PI * 2;

function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function orientY(object: THREE.Object3D, direction: THREE.Vector3): void {
  object.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize(),
  );
}

/**
 * Code-native replacement for the Meshy ThorncoilCluster. Geometry owns no
 * gameplay collision: a small, separate `pit` component defines the fair
 * lethal core while the luminous tips remain readable warning artwork.
 */
export function createProceduralThornCluster(
  options: ProceduralThornOptions = {},
): ProceduralThornCluster {
  const size = options.size ?? [2.14, 1.01, 2.26];
  const random = seeded(options.seed ?? 0x7a0b_2026);
  const group = new THREE.Group();
  group.name = "procedural glowing thorn cluster";
  group.userData.noShadow = true;

  const glowColor = new THREE.Color(options.color ?? "#62ff29");
  const darkColor = glowColor.clone().multiplyScalar(0.12);
  const core = new THREE.MeshStandardMaterial({
    color: darkColor,
    emissive: glowColor,
    emissiveIntensity: 1,
    roughness: 0.62,
    metalness: 0.08,
  });
  const tips = new THREE.MeshStandardMaterial({
    color: glowColor.clone().multiplyScalar(0.36),
    emissive: glowColor,
    emissiveIntensity: 1.45,
    roughness: 0.45,
    metalness: 0.04,
  });
  const pulseMaterials = [core, tips] as const;

  const tendrilCount = 13;
  for (let index = 0; index < tendrilCount; index++) {
    const theta = (index / tendrilCount) * TAU + (random() - 0.5) * 0.34;
    const reach = 0.68 + random() * 0.28;
    const lift = 0.46 + random() * 0.47;
    const curl = (random() < 0.5 ? -1 : 1) * (0.35 + random() * 0.48);
    const points: THREE.Vector3[] = [];
    for (let step = 0; step <= 5; step++) {
      const t = step / 5;
      const angle = theta + curl * t * t;
      const radius = reach * (0.08 + 0.92 * t);
      points.push(
        new THREE.Vector3(
          Math.cos(angle) * radius,
          0.02 + lift * Math.sin(t * Math.PI * 0.78),
          Math.sin(angle) * radius,
        ),
      );
    }
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 20, 0.035 + random() * 0.018, 5, false),
      core,
    );
    group.add(stem);

    const end = points[points.length - 1];
    const before = points[points.length - 2];
    const direction = end.clone().sub(before);
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.075 + random() * 0.025, 0.3, 5),
      tips,
    );
    orientY(tip, direction);
    tip.position.copy(end).addScaledVector(direction.clone().normalize(), 0.13);
    group.add(tip);

    for (const t of [0.38, 0.62]) {
      const at = curve.getPoint(t);
      const tangent = curve.getTangent(t);
      const radial = new THREE.Vector3(at.x, 0.15, at.z).normalize();
      radial.addScaledVector(tangent, (random() - 0.5) * 0.5).normalize();
      const barb = new THREE.Mesh(
        new THREE.ConeGeometry(0.032, 0.16 + random() * 0.08, 4),
        tips,
      );
      orientY(barb, radial);
      barb.position.copy(at).addScaledVector(radial, 0.07);
      group.add(barb);
    }
  }

  const knot = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.24, 1),
    core,
  );
  knot.scale.set(1.25, 0.58, 1.2);
  knot.position.y = 0.12;
  group.add(knot);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 12, 7),
    new THREE.MeshBasicMaterial({
      color: glowColor,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  halo.position.y = 0.27;
  halo.scale.y = 0.5;
  group.add(halo);

  group.scale.set(size[0] / 2, size[1], size[2] / 2);
  const light = new THREE.PointLight(glowColor, 0.7, 7.2, 2);
  light.position.y = 0.38;
  light.userData.noShadow = true;
  group.add(light);

  const phase = random() * TAU;
  return {
    group,
    pulseMaterials,
    light,
    update(timeSeconds: number): void {
      // Unity source: a smooth 1 -> 2 -> 1 emission cycle over 2.4 seconds.
      const wave = 0.5 - 0.5 * Math.cos((TAU * timeSeconds) / 2.4 + phase);
      core.emissiveIntensity = 1 + wave;
      tips.emissiveIntensity = 1.4 + wave * 1.35;
      light.intensity = 0.55 + wave * 0.75;
      (halo.material as THREE.MeshBasicMaterial).opacity = 0.04 + wave * 0.055;
    },
  };
}
