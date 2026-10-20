/** The dependency-free page status only owns the screen before game presentation. */
const screen = document.getElementById("game-startup");
const status = document.getElementById("game-startup-status");
const reload = document.getElementById("game-startup-reload");
let phase: "loading" | "presented" | "ready" | "failed" = "loading";
export let startupFailed = false;

// Native link keys must not reach partially initialized game/menu handlers.
screen?.addEventListener("keydown", event => event.stopPropagation());

// A real navigation remains available even if this module never downloads.
// With JavaScript, reload also preserves fragment/query and avoids partial retries.
reload?.addEventListener("click", event => {
  event.preventDefault();
  window.location.reload();
});

export function presentStartupFrame(): void {
  if (phase !== "loading") return;
  phase = "presented";
  if (screen) screen.hidden = true;
}

export function finishStartup(): void {
  if (phase === "failed") return;
  phase = "ready";
  screen?.remove();
}

export function failStartup(): void {
  // Later gameplay/context recovery has its own owner. A fatal startup failure
  // stays visible even if another preparation promise subsequently resolves.
  if (phase === "ready" || phase === "failed") return;
  phase = "failed";
  startupFailed = true;
  if (!screen || !status) return;
  screen.hidden = false;
  screen.inert = false;
  screen.removeAttribute("aria-hidden");
  screen.setAttribute("role", "alertdialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-labelledby", "game-startup-status");
  for (const child of document.body.children) {
    if (child instanceof HTMLElement && child !== screen) child.inert = true;
  }
  screen.setAttribute("data-failed", "");
  status.setAttribute("role", "alert");
  status.textContent = "The game couldn’t start. Reload to try again.";
  reload?.focus({ preventScroll: true });
}
