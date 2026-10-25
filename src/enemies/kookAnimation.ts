import {gunzipSync} from 'three/examples/jsm/libs/fflate.module.js';
import type {AnimationClip} from 'three';

/** Decode the original JSON bytes; no key reduction, rounding or retiming. */
export function decodeKookAnimation(data: ArrayBuffer): Parameters<typeof AnimationClip.parse>[0][] {
  return JSON.parse(new TextDecoder().decode(gunzipSync(new Uint8Array(data))));
}
