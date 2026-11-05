export class SimplexNoise {
  constructor(seed?: number);
  noise3D(x: number, y: number, z: number): number;
  fbm(x: number, y: number, z: number, octaves: number, lacunarity: number, persistence: number): number;
}
