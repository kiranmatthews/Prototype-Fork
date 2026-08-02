// Types for the vendored roo-web renderer (src/roo-text.js), which ships as
// plain ES modules. Kept as a declaration file so the .js stays byte-identical
// to the drop and can be replaced wholesale when roo-web updates.

export type RooPaletteName = "bonus" | "counter";

export interface RooPalette {
  faceStops: Array<[number, string]>;
  rimStops: Array<[number, string]>;
  outline: string;
  extrusionNear: string;
  extrusionFar: string;
  bevelHighlight: string;
  bevelShadow: string;
  shadow: string;
  hardShadow: string;
}

export declare const PALETTES: Record<RooPaletteName, RooPalette>;

export interface RooTextOptions {
  text?: string;
  palette?: RooPaletteName;
  /** letter-spacing in SVG units (the source glyph is set at font-size 200) */
  tracking?: number;
  /** depth copies: 10-12 for small HUD labels, up to 18 for big titles */
  extrusionSteps?: number;
  /** extrusion offset per unit of measured glyph height */
  depthX?: number;
  depthY?: number;
}

export interface RooTextHandle {
  element: SVGSVGElement;
  setText(value: string): Promise<void>;
  destroy(): void;
}

export declare function createRooText(
  host: HTMLElement,
  options?: RooTextOptions,
): Promise<RooTextHandle>;
