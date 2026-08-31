let animationStudioStylesInstalled = false;

/** Install the Animation Studio's deliberately self-contained overlay styles. */
export function installAnimationStudioStyles(): void {
  if (animationStudioStylesInstalled) return;
  animationStudioStylesInstalled = true;

  const style = document.createElement('style');
  style.dataset.animationStudio = 'styles';
  style.textContent = `
    :root {
      --ast-top: 48px;
      --ast-left: 264px;
      --ast-right: 318px;
      --ast-bottom: 246px;
      --ast-bg: rgba(12, 15, 23, .965);
      --ast-bg-soft: rgba(22, 27, 39, .94);
      --ast-line: #343c50;
      --ast-line-soft: #252c3c;
      --ast-text: #d9e3ef;
      --ast-dim: #8290a8;
      --ast-accent: #ff75d1;
      --ast-accent-2: #61ddff;
      --ast-good: #69e5a4;
      --ast-warn: #ffd16a;
      --ast-danger: #ff7088;
    }

    body.animation-studio-open { overflow: hidden; }
    body.animation-studio-open .game-hud-layer,
    body.animation-studio-open .hud-tl, body.animation-studio-open .hud-tr,
    body.animation-studio-open .hud-trickplate, body.animation-studio-open .hud-msg,
    body.animation-studio-open .hud-boosts, body.animation-studio-open .hud-balance,
    body.animation-studio-open .hud-vbalance, body.animation-studio-open .side-wrap,
    body.animation-studio-open .hud-ttclock { display: none !important; }

    .ast-root, .ast-root * { box-sizing: border-box; }
    .ast-root {
      position: fixed; inset: 0; z-index: 1000; pointer-events: none;
      color: var(--ast-text); font: 12px/1.35 Inter, ui-sans-serif, system-ui, sans-serif;
      color-scheme: dark; user-select: none;
    }
    .ast-root button, .ast-root input, .ast-root select, .ast-root textarea,
    .ast-root .ast-panel, .ast-root .ast-timeline { pointer-events: auto; }
    .ast-root button, .ast-root input, .ast-root select, .ast-root textarea {
      font: inherit; color: inherit;
    }

    .ast-topbar {
      position: absolute; left: 0; top: 0; right: 0; height: var(--ast-top);
      display: flex; align-items: center; gap: 7px; padding: 7px 10px;
      background: var(--ast-bg); border-bottom: 1px solid var(--ast-line);
      box-shadow: 0 7px 22px rgba(0,0,0,.24); pointer-events: auto;
    }
    .ast-brand {
      color: var(--ast-accent); font-weight: 800; letter-spacing: .16em;
      white-space: nowrap; margin-right: 5px;
    }
    .ast-spacer { flex: 1 1 auto; }
    .ast-divider { width: 1px; height: 25px; background: var(--ast-line); margin: 0 2px; }

    .ast-panel {
      position: absolute; top: var(--ast-top); bottom: var(--ast-bottom);
      background: var(--ast-bg); overflow: auto; scrollbar-color: #485269 transparent;
    }
    .ast-left { left: 0; width: var(--ast-left); border-right: 1px solid var(--ast-line); }
    .ast-right { right: 0; width: var(--ast-right); border-left: 1px solid var(--ast-line); }
    .ast-section { padding: 10px; border-bottom: 1px solid var(--ast-line-soft); }
    .ast-section-title {
      display: flex; align-items: center; gap: 7px; min-height: 21px; margin-bottom: 7px;
      color: var(--ast-dim); font-size: 10px; font-weight: 750; letter-spacing: .14em;
      text-transform: uppercase;
    }
    .ast-section-title > span:first-child { flex: 1; }

    .ast-button {
      min-height: 28px; padding: 4px 8px; border: 1px solid #3c465c; border-radius: 4px;
      background: #1b2230; cursor: pointer; white-space: nowrap;
    }
    .ast-button:hover:not(:disabled) { background: #29344a; border-color: #56637e; }
    .ast-button:focus-visible, .ast-input:focus-visible, .ast-select:focus-visible {
      outline: 2px solid var(--ast-accent-2); outline-offset: 1px;
    }
    .ast-button:disabled { opacity: .4; cursor: default; }
    .ast-button.ast-active { background: #482b49; border-color: var(--ast-accent); color: #ffe3f6; }
    .ast-button.ast-danger { color: #ffc0ca; }
    .ast-button.ast-icon { width: 30px; padding: 3px; font-size: 14px; }
    .ast-button.ast-primary { background: #2e4c43; border-color: #4d856f; color: #c9ffdf; }
    .ast-button-row { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }

    .ast-input, .ast-select, .ast-textarea {
      min-width: 0; border: 1px solid #3a4357; border-radius: 3px; background: #111621;
      padding: 5px 6px;
    }
    .ast-select { height: 30px; }
    .ast-input[type=number] { width: 68px; text-align: right; font-variant-numeric: tabular-nums; }
    .ast-input[type=range] { padding: 0; border: 0; background: transparent; accent-color: var(--ast-accent); }
    .ast-grow { flex: 1 1 auto; }
    .ast-field { display: flex; align-items: center; gap: 6px; margin: 5px 0; }
    .ast-field > label { width: 76px; flex: 0 0 76px; color: #a6b1c3; }
    .ast-field .ast-input[type=range] { flex: 1 1 auto; min-width: 30px; }
    .ast-check { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
    .ast-check input { accent-color: var(--ast-accent); }
    .ast-hint { margin: 5px 0; color: var(--ast-dim); font-size: 10px; }
    .ast-status { color: var(--ast-warn); font-variant-numeric: tabular-nums; }
    .ast-ik-status { margin: 7px 0; padding: 6px 7px; border-left: 2px solid var(--ast-accent-2);
      background: rgba(97,221,255,.07); color: #bfefff; }
    .ast-ik-status.ast-warn { border-color: var(--ast-warn); color: #ffe4a4; background: rgba(255,209,106,.07); }

    .ast-joint-filter { width: 100%; margin-bottom: 6px; }
    .ast-tree { list-style: none; margin: 0; padding: 0 0 4px; }
    .ast-tree ul { list-style: none; margin: 0; padding: 0; }
    .ast-tree-button {
      width: 100%; height: 24px; display: flex; align-items: center; gap: 5px;
      padding: 2px 5px; border: 0; border-radius: 3px; color: #bcc8d8;
      background: transparent; text-align: left; cursor: pointer;
    }
    .ast-tree-button:hover { background: #222a3a; }
    .ast-tree-button.ast-selected { background: #3d2945; color: #ffe4f7; }
    .ast-tree-twist { width: 12px; color: var(--ast-dim); text-align: center; }
    .ast-tree-keyed { width: 6px; height: 6px; border-radius: 50%; background: var(--ast-accent); }
    .ast-tree-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .ast-vector { display: grid; grid-template-columns: 20px repeat(3, minmax(0, 1fr)); gap: 4px; align-items: center; margin: 4px 0; }
    .ast-vector > span { color: var(--ast-dim); font-weight: 700; }
    .ast-vector .ast-input { width: 100%; padding: 4px; }
    .ast-axis-x { border-bottom-color: #e85f72; }
    .ast-axis-y { border-bottom-color: #6ad98c; }
    .ast-axis-z { border-bottom-color: #63a8ff; }

    .ast-curve-wrap { position: relative; height: 178px; border: 1px solid var(--ast-line); background: #0d1119; overflow: hidden; }
    .ast-curve { display: block; width: 100%; height: 100%; touch-action: none; }
    .ast-curve-grid { stroke: #252c3b; stroke-width: 1; vector-effect: non-scaling-stroke; }
    .ast-curve-zero { stroke: #485269; stroke-width: 1; vector-effect: non-scaling-stroke; }
    .ast-curve-path { fill: none; stroke: var(--ast-accent-2); stroke-width: 2; vector-effect: non-scaling-stroke; }
    .ast-curve-point { fill: #111621; stroke: var(--ast-accent-2); stroke-width: 2; vector-effect: non-scaling-stroke; cursor: move; }
    .ast-curve-point.ast-selected { fill: var(--ast-accent); stroke: #fff; }

    .ast-timeline {
      position: absolute; left: 0; right: 0; bottom: 0; height: var(--ast-bottom);
      display: grid; grid-template-rows: 42px minmax(0, 1fr); background: var(--ast-bg);
      border-top: 1px solid var(--ast-line); box-shadow: 0 -7px 24px rgba(0,0,0,.25);
    }
    .ast-timebar { display: flex; align-items: center; gap: 7px; padding: 6px 10px; border-bottom: 1px solid var(--ast-line); }
    .ast-timecode { width: 76px !important; }
    .ast-scrub { flex: 1 1 auto; min-width: 80px; accent-color: var(--ast-accent); }
    .ast-sheet-wrap { position: relative; overflow: auto; scrollbar-color: #485269 #161b27; }
    .ast-sheet { position: relative; min-height: 100%; min-width: 720px; touch-action: none; }
    .ast-sheet-labels {
      position: sticky; left: 0; z-index: 4; width: var(--ast-left); min-height: 100%;
      background: rgba(15,19,28,.96); border-right: 1px solid var(--ast-line);
    }
    .ast-lane-label {
      height: 25px; padding: 5px 9px; border-bottom: 1px solid #202736; color: #9ca9bc;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .ast-lane-label.ast-selected { color: #ffe0f4; background: #39283e; }
    .ast-sheet-canvas { position: absolute; left: var(--ast-left); top: 0; height: 100%; min-width: 456px; cursor: crosshair; }
    .ast-tick { position: absolute; top: 0; bottom: 0; border-left: 1px solid #242b3a; color: #78869b; font-size: 9px; padding: 2px 0 0 3px; }
    .ast-tick.ast-major { border-color: #364057; color: #a6b1c2; }
    .ast-lane { position: absolute; left: 0; right: 0; height: 25px; border-bottom: 1px solid #202736; }
    .ast-lane:nth-child(even) { background: rgba(255,255,255,.012); }
    .ast-driver-wave { position: absolute; inset: 2px 0; width: 100%; height: 21px; opacity: .72; pointer-events: none; }
    .ast-driver-wave path { fill: none; stroke: var(--ast-good); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
    .ast-key {
      position: absolute; width: 10px; height: 10px; margin: 7px 0 0 -5px; border: 1px solid #ffd9f2;
      background: var(--ast-accent); transform: rotate(45deg); cursor: ew-resize; z-index: 3;
    }
    .ast-key:hover, .ast-key.ast-selected { background: white; border-color: var(--ast-accent); }
    .ast-key.ast-marker { border-radius: 5px 5px 1px 1px; transform: none; background: var(--ast-warn); border-color: #fff0b9; }
    .ast-key.ast-contact { border-radius: 50%; transform: none; background: var(--ast-good); border-color: #d3ffe5; }
    .ast-key.ast-event { clip-path: polygon(50% 0,100% 100%,0 100%); transform: none; background: #bf91ff; border: 0; }
    .ast-playhead { position: absolute; top: 0; bottom: 0; width: 1px; background: #ff4f76; z-index: 5; pointer-events: none; }
    .ast-playhead::before { content: ''; position: absolute; left: -4px; width: 9px; height: 8px; background: #ff4f76; clip-path: polygon(0 0,100% 0,50% 100%); }
    .ast-loop-range { position: absolute; top: 0; bottom: 0; background: rgba(97,221,255,.07); border-left: 1px solid rgba(97,221,255,.65); border-right: 1px solid rgba(97,221,255,.65); pointer-events: none; }

    .ast-modal-backdrop {
      position: absolute; inset: 0; display: grid; place-items: center; pointer-events: auto;
      background: rgba(2,4,8,.72); z-index: 20;
    }
    .ast-modal { width: min(680px, calc(100vw - 30px)); max-height: calc(100vh - 40px); padding: 14px; overflow: auto;
      background: #111722; border: 1px solid #4a566f; border-radius: 7px; box-shadow: 0 18px 60px #000; }
    .ast-textarea { width: 100%; height: min(52vh, 440px); resize: vertical; font: 11px/1.45 ui-monospace, Menlo, monospace; user-select: text; }
    .ast-toast { position: absolute; left: 50%; bottom: calc(var(--ast-bottom) + 16px); transform: translateX(-50%);
      padding: 7px 12px; border: 1px solid #55617b; border-radius: 5px; background: #151c29; box-shadow: 0 7px 30px #0008;
      opacity: 0; transition: opacity .18s; pointer-events: none; }
    .ast-toast.ast-show { opacity: 1; }

    @media (max-width: 920px) {
      :root { --ast-left: 215px; --ast-right: 270px; --ast-bottom: 220px; }
      .ast-brand { max-width: 24px; overflow: hidden; }
      .ast-topbar .ast-button.ast-wide { padding-left: 5px; padding-right: 5px; font-size: 0; }
      .ast-topbar .ast-button.ast-wide::first-letter { font-size: 12px; }
    }
    @media (max-width: 680px) {
      :root { --ast-top: 86px; --ast-left: 48%; --ast-right: 52%; --ast-bottom: 210px; }
      .ast-topbar { flex-wrap: wrap; align-content: center; }
      .ast-brand { max-width: none; width: 100%; height: 16px; }
      .ast-panel { bottom: var(--ast-bottom); }
      .ast-section { padding: 8px; }
      .ast-field > label { width: 60px; flex-basis: 60px; }
      .ast-sheet-labels { width: 128px; }
      .ast-sheet-canvas { left: 128px; }
      .ast-lane-label { padding-left: 5px; }
    }
  `;
  document.head.appendChild(style);
}
