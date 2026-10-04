// Local-only input harness, excluded from Vite's production entry points.
// Uses the actual merged Input and controls; no WebGL or gameplay simulation.
import { Input } from '../src/input';
import { GameInterfaceSurface } from '../src/gameInterfaceSurface';
const input = new Input();
const presentation = new GameInterfaceSurface();
const samples: Record<string, unknown>[] = [];
let frames = 0;
const review = {
  input, samples,
  get frames() { return frames; },
  clear() { samples.length = 0; },
  setComposited(on: boolean) { presentation.setComposited(on); },
};
(window as unknown as Record<string, unknown>).__touchReview = review;
const step = (): void => {
  input.update(); frames++;
  samples.push({move:[input.moveX,input.moveY],jumpPressed:input.jumpPressed,jumpReleased:input.jumpReleased,
    jumpHeld:input.jumpHeld,transferPressed:input.transferPressed,transferHeld:input.transferHeld,inventoryHeld:input.inventoryHeld});
  if (samples.length > 240) samples.shift();
  input.consumeEdges(); requestAnimationFrame(step);
};
requestAnimationFrame(step);
