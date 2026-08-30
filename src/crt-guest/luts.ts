import * as THREE from "three";

export interface CrtGuestLuts {
  trinitron: THREE.Texture;
  inverseTrinitron: THREE.Texture;
  nec: THREE.Texture;
  ntsc: THREE.Texture;
}

export const CRT_GUEST_LUT_FILES = Object.freeze({
  trinitron: "trinitron-lut.png",
  inverseTrinitron: "inv-trinitron-lut.png",
  nec: "nec-lut.png",
  ntsc: "ntsc-lut.png",
} as const);

export async function loadCrtGuestLuts(
  baseUrl = "./crt-guest/lut/",
  loader = new THREE.TextureLoader(),
): Promise<CrtGuestLuts> {
  const root = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const entries = Object.entries(CRT_GUEST_LUT_FILES) as Array<
    [keyof CrtGuestLuts, string]
  >;
  const loaded = await Promise.allSettled(
    entries.map(async ([key, file]) => {
      const texture = await loader.loadAsync(`${root}${file}`);
      configureLut(texture, `CRT Guest ${key} LUT`);
      return [key, texture] as const;
    }),
  );

  const failure = loaded.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (failure) {
    for (const result of loaded) {
      if (result.status === "fulfilled") result.value[1].dispose();
    }
    const detail =
      failure.reason instanceof Error
        ? failure.reason.message
        : String(failure.reason);
    throw new Error(`Unable to load CRT Guest LUTs: ${detail}`);
  }

  const textures = Object.fromEntries(
    loaded.map((result) => {
      if (result.status !== "fulfilled") {
        throw new Error("CRT Guest LUT load did not settle successfully");
      }
      return result.value;
    }),
  ) as unknown as CrtGuestLuts;
  return textures;
}

export function disposeCrtGuestLuts(luts: CrtGuestLuts): void {
  const unique = new Set<THREE.Texture>([
    luts.trinitron,
    luts.inverseTrinitron,
    luts.nec,
    luts.ntsc,
  ]);
  for (const texture of unique) texture.dispose();
}

function configureLut(texture: THREE.Texture, name: string): void {
  texture.name = name;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
}
