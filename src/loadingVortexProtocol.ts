/** Only presentation settings cross this boundary; never game state or assets. */
export interface LoadingVortexConfig {
  context: 'menu' | 'warp';
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;
  outputHeight: number;
  antialias: boolean;
  post: boolean;
  crt: string;
  lutBaseUrl: string;
  reducedMotion: boolean;
  hidden: boolean;
}

export type LoadingVortexRequest =
  | { type: 'start'; canvas: OffscreenCanvas; config: LoadingVortexConfig }
  | { type: 'resize'; config: LoadingVortexConfig }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'dispose' };

export type LoadingVortexResponse =
  | { type: 'ready' }
  | { type: 'failed'; reason: string }
  | { type: 'disposed' }
  | { type: 'stats'; at: number; frames: number; maxFrameMs: number; width: number; height: number };
