"""Check the phone course's visible pixels across real WebGL context resets."""

import io
import os
import shutil
from pathlib import Path

from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright


URL = os.getenv("CRYSTAL_PHONE_URL", "http://127.0.0.1:5173/challenge-playtest.html?touch")
ENGINE = os.getenv("CRYSTAL_RENDER_BROWSER", "chromium")
OUTPUT = os.getenv("CRYSTAL_PHONE_OUT")
RECOVERY = "[data-graphics-recovery]"
STEPS = "window.__game.frameStats.totalFixedSteps"

# Lose the context while Three is drawing shadows into an offscreen target.
# A reset between frames misses the stale-target bug.
INTERRUPT_SHADOW = """
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (...args) {
  const gl = originalGetContext.apply(this, args);
  if (this.id !== 'challenge-world' || args[0] !== 'webgl2' || !gl || window.courseLoss) return gl;
  window.courseLoss = gl.getExtension('WEBGL_lose_context');
  if (!window.courseLoss) throw Error('WEBGL_lose_context is required');
  const draw = gl.drawElements;
  gl.drawElements = function (...drawArgs) {
    if (gl.getParameter(gl.FRAMEBUFFER_BINDING)) {
      gl.drawElements = draw;
      window.courseLoss.loseContext();
    }
    return draw.apply(this, drawArgs);
  };
  return gl;
};
"""


def check_world(page, label):
    assert page.locator("#challenge-menu").is_hidden()
    assert page.locator("#challenge-hud").is_visible()
    png = page.screenshot()
    if OUTPUT:
        directory = Path(OUTPUT)
        directory.mkdir(parents=True, exist_ok=True)
        (directory / f"{ENGINE}-{label}.png").write_bytes(png)
    image = Image.open(io.BytesIO(png)).convert("RGB")
    width, height = image.size
    # The HUD and touch controls sit outside this part of the playfield.
    world = image.crop((width * .18, height * .22, width * .82, height * .62)).resize((96, 64))
    colors = len(world.getcolors(world.width * world.height))
    spread = max(ImageStat.Stat(world).stddev)
    assert colors > 48 and spread > 8, f"{label}: blank playfield ({colors} colors, deviation {spread:.1f})"
    assert page.evaluate("""() => {
      const r = window.__game.renderer, gl = r.getContext(), c = r.domElement;
      return !gl.isContextLost() && r.getRenderTarget() === null &&
        gl.drawingBufferWidth === c.clientWidth * devicePixelRatio &&
        gl.drawingBufferHeight === c.clientHeight * devicePixelRatio;
    }"""), f"{label}: course was not drawn to the native screen buffer"
    print(f"{ENGINE} {label}: {width} × {height}, {colors} playfield colors", flush=True)


def wait_for_course(page, level_id):
    page.wait_for_function("""id => {
      const g = window.__game;
      return g?.getCurrentLevel()?.id === id && !g.paused &&
        document.getElementById('challenge-menu').hidden;
    }""", arg=level_id)


def run(browser):
    errors = []
    page = browser.new_page(viewport={"width": 393, "height": 852}, device_scale_factor=3,
                            has_touch=True, is_mobile=True, service_workers="block")
    page.set_default_timeout(120_000)
    page.on("pageerror", lambda error: errors.append(str(error)))
    def record_console(msg):
        if msg.type == "error" or "GL_INVALID" in msg.text or "feedback loop" in msg.text.lower():
            errors.append(msg.text)

    page.on("console", record_console)
    page.add_init_script(INTERRUPT_SHADOW)
    page.goto(URL, wait_until="domcontentloaded")
    page.locator("#challenge-play").tap()
    page.locator(RECOVERY).wait_for()
    assert page.locator("#challenge-menu").is_visible() and page.locator("#challenge-hud").is_hidden()
    assert page.evaluate(STEPS) == 0
    page.evaluate("window.courseLoss.restoreContext()")
    wait_for_course(page, "phone-challenge-0")
    check_world(page, "launch")

    start = page.evaluate("window.__game.player.pos.z")
    page.keyboard.down("ArrowUp")
    try:
        page.wait_for_function("z => window.__game.player.pos.z < z - 2", arg=start)
        page.evaluate("""() => {
          const g = window.__game;
          window.interruptedLevel = g.getLevel();
          window.courseLoss = g.renderer.getContext().getExtension('WEBGL_lose_context');
          window.courseLoss.loseContext();
        }""")
        page.locator(RECOVERY).wait_for()
        snapshot = "[window.__game.frameStats.totalFixedSteps, ...window.__game.player.pos.toArray()]"
        stopped = page.evaluate(snapshot)
        page.wait_for_timeout(300)
        assert page.evaluate(snapshot) == stopped, "The ride advanced while the screen was lost"
        page.evaluate("window.courseLoss.restoreContext()")
        page.locator(RECOVERY).wait_for(state="detached")
        assert page.evaluate("window.__game.getLevel() === window.interruptedLevel")
        page.wait_for_function("z => window.__game.player.pos.z < z - 1", arg=stopped[-1])
    finally:
        page.keyboard.up("ArrowUp")
    check_world(page, "resumed")

    page.locator(".tc-pause").tap()
    page.set_viewport_size({"width": 844, "height": 390})
    page.locator("#challenge-course").tap()
    wait_for_course(page, "phone-challenge-all")
    check_world(page, "whole-course")
    assert not errors, errors


if __name__ == "__main__":
    with sync_playwright() as pw:
        if ENGINE == "chromium":
            browser = pw.chromium.launch(executable_path=shutil.which("chromium"), args=[
                "--disable-dev-shm-usage", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
            ])
        elif ENGINE == "webkit":
            browser = pw.webkit.launch()
        else:
            raise ValueError(f"Unsupported browser {ENGINE}")
        try:
            run(browser)
        finally:
            browser.close()
