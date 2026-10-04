declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three';
  export const SceneRevealMode: { Instant: number };
  export class DropInViewer extends THREE.Group {
    constructor(options: Record<string, unknown>);
    callbackMesh: THREE.Mesh;
    splatMesh: THREE.Mesh & { getSplatCount(): number };
    viewer: {
      renderer?: THREE.WebGLRenderer;
      devicePixelRatio: number;
      getRenderDimensions: (out: THREE.Vector2) => void;
    };
    addSplatScene(path: string, options: Record<string, unknown>): Promise<void>;
    dispose(): Promise<void>;
  }
}
