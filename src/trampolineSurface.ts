/** The rope opening measured inside Carlisle's asymmetric metal housing.
 * Rendering and contact classification share these deck-local limits. */
export function marineNetBounds(width: number, length: number): [number, number, number, number] {
  return [-width * .307, width * .357, -length * .365, length * .363];
}
