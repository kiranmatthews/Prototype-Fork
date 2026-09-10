/** Shared contour wave from the wormhole's independently deforming rings. */
export function swirlContourWave(angle: number, time: number, amplitude: number,
  frequency: number, phase: number, rate: number): number {
  return amplitude * Math.sin(angle * frequency + phase + time * rate);
}

/** Wormhole annular-strip offsets: soft outer edges around a narrow centre. */
export function swirlBandOffset(row: number, coreWidth: number, softWidth: number): number {
  return row === 0 ? -softWidth : row === 1 ? -coreWidth : row === 2 ? 0 : row === 3 ? coreWidth : softWidth;
}
