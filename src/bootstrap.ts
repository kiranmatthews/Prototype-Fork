import { failStartup } from "./startupScreen";

// Keep heavy course construction out of the initial module graph. Two frame
// boundaries let the static status paint before evaluation occupies the thread.
async function start(): Promise<void> {
  if (!document.hidden) {
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  }
  await import("./main");
}

void start().catch(error => {
  failStartup();
  console.error("Game startup failed.", error);
});
