import * as THREE from 'three';

/** Viewport-only framing over the final authored shot. Keep the short-edge
 * pixel scale when a phone rotates, and put 85% of the extra vertical view
 * below the landscape composition for the thumb controls. Never move or
 * rotate the camera, or feed this wider lens back into camera damping. */
export class CameraPortraitFraming {
  private applied = false;
  private fov = 0;
  private view: THREE.PerspectiveCamera['view'] = null;
  private readonly portraitView = {
    enabled: true, fullWidth: 1, fullHeight: 1,
    offsetX: 0, offsetY: 0, width: 1, height: 1,
  };

  apply(camera: THREE.PerspectiveCamera, enabled: boolean): void {
    this.restore(camera);
    const aspect = camera.aspect;
    if (!enabled || !Number.isFinite(aspect) || aspect <= 0 || aspect >= 1) return;
    this.fov = camera.fov;
    this.view = camera.view;
    this.applied = true;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(
      Math.tan(THREE.MathUtils.degToRad(this.fov) / 2) / aspect,
    ));
    const view = this.portraitView;
    if (this.view?.enabled) Object.assign(view, this.view);
    else Object.assign(view, {
      enabled: true, fullWidth: aspect, fullHeight: 1,
      offsetX: 0, offsetY: 0, width: aspect, height: 1,
    });
    view.offsetY += (1 - aspect) * .35 * view.height;
    camera.view = view;
    camera.updateProjectionMatrix();
  }

  restore(camera: THREE.PerspectiveCamera): void {
    if (!this.applied) return;
    camera.fov = this.fov;
    camera.view = this.view;
    camera.updateProjectionMatrix();
    this.applied = false;
  }
}
