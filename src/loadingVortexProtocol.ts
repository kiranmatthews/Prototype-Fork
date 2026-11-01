import type { LoadingTitleDiagnostics } from './loadingTitle';

/** Only presentation settings and asset URLs cross this boundary; never game state. */
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
  titleAtlasUrl: string;
  reducedMotion: boolean;
  hidden: boolean;
}

export type LoadingVortexRequest =
  | { type: 'start'; canvas: OffscreenCanvas; config: LoadingVortexConfig }
  | { type: 'resize'; config: LoadingVortexConfig }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'dispose' };

export type LoadingVortexResponse =
  | { type: 'initializing' }
  | { type: 'ready' }
  | { type: 'failed'; reason: string }
  | { type: 'disposed' }
  | { type: 'stats'; at: number; frames: number; maxFrameMs: number; width: number; height: number; title: LoadingTitleDiagnostics | null };
