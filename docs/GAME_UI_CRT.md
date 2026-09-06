# Game UI and CRT ownership

When the post chain is active, game-owned UI is inserted before CRT:

- `GameHudSurface`: existing gameplay HUD, messages and results, plus the
  existing flying-fruit and 3D counter-icon renderers. Touch is no longer
  excluded; it retains the native-resolution post path.
- `GameFlowSurface`: launch, pause, options, save/load, progress and results
  menus, retaining its existing semantic-DOM ownership handoff.
- `GameInterfaceSurface`: map card/text/actions, touch buttons and pause icon,
  custom menu cursor and transition curtain. It uses the same Canvas-to-WebGL
  overlay infrastructure, with explicit painters rather than DOM screenshots.

DOM layouts and hit targets remain live. Only their ink is suppressed while
the corresponding pre-CRT image is rendered. The cursor requests frozen-menu
frames as its existing position/opacity changes. Direct/lite/split paths with
no active post pass restore DOM presentation. Empty desktop gameplay frames
skip the auxiliary interface texture upload.

Map silver text uses the existing secondary-text settings for both SVG and
Canvas rendering. No gameplay glyph sizing, alignment, or typography changes
are part of this integration.

Debug/editor/tuning surfaces remain outside CRT. Text Tuning is map-only and
obeys `game-debug-hidden` / M, using the same input-editing guard as other debug
controls. `getInterfaceSurfaceDiagnostics()` exposes composition and cursor
draw status for browser checks.
