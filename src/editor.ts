// LEVEL EDITOR: an in-game mode over source-owned level data. The editor keeps
// a transactional working copy and rebuilds the live preview from that exact
// copy. A hand-coded built-in is captured only into memory on open; it does not
// replace the shipped course: its first real edit forks an explicit user copy.
// Opening and closing without editing hands the original builder back intact.
//
//   orbit: right-drag rotate · wheel zoom · middle/space-drag pan
//   select: left-click a component · drag it to move
//   panel: add components, edit the selection's numbers, spawn/killY,
//          export/import .json, TEST to play on the spot
//
// Everything autosaves to this browser; EXPORT shares the level as a file.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TUNING } from "./tuning";
import {
  Level,
  CustomComponent,
  EnemyKind,
  CustomLevelData,
  CustomGroup,
  DECK_TRICKS,
  deckTrickInfo,
  LevelEntry,
  starterCustomLevel,
  migrateCustomLevel,
  normalizeCustomLevelData,
  groupChainOf,
  TEX_KINDS,
  DECOR_KINDS,
  DECOR_LABELS,
  DecorKind,
  DEFAULT_LEVEL_ID,
  SKY_PRESETS,
  asSkyPreset,
  isBuiltin,
  isOverridden,
  getEditData,
  persistEditData,
  userLevelStorageHealthy,
  saveUserLevel,
  renameUserLevel,
  deleteUserLevel,
  restoreBuiltin,
  findLevel,
  setEditorBuild,
} from "./level";
import {
  PROP_FAMILIES,
  PROP_TINTS,
  PropFamily,
  propModels,
  propRoll,
  propSize,
} from "./props";

interface Hooks {
  preflight: () => boolean;
  rebuild: (committed?: boolean) => void; // live preview, or committed play-source rebuild
  resetPreview: () => void; // canceled gesture: reveal exact retained level again
  exitToPlay: () => void; // leave the editor and hand control back to the game
  showMsg: (title: string, sub?: string) => void;
  // the level LIST changed (rename / duplicate / delete / import): refresh the
  // menu, and switch to `goTo` if this editor session should follow it there
  levelsChanged: (goTo?: string) => void;
  setView: (editing: boolean, changed?: boolean) => void; // toggle the fog-free, far-plane-extended editor view
}

// what the ADD palette spawns, at the camera's focus point — grouped, each
// with a little drawn icon so the crate language reads at a glance
type Draw = (x: CanvasRenderingContext2D) => void;
interface PalItem {
  label: string;
  icon: Draw;
  make?: (at: THREE.Vector3) => CustomComponent;
  penDraw?:
    | "platform"
    | "pit"
    | "wall"
    | "wallpath"
    | "rail"
    | "vertramp"
    | "terrain"
    | "woodpath"; // pen tool: click-to-draw a polygon (or open path) of this type
}

const box = (
  x: CanvasRenderingContext2D,
  fill: string,
  frame: string,
): void => {
  x.fillStyle = fill;
  x.fillRect(2, 2, 14, 14);
  x.strokeStyle = frame;
  x.lineWidth = 2;
  x.strokeRect(3, 3, 12, 12);
};
const glyph = (
  x: CanvasRenderingContext2D,
  ch: string,
  color: string,
): void => {
  x.fillStyle = color;
  x.font = "bold 11px monospace";
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(ch, 9, 10);
};

// ---- SCENERY -------------------------------------------------------------
// 18px palette thumbnails. Read as silhouettes, not portraits: at this size
// the shape and the two or three colours are the whole message.
const leafSpray = (
  x: CanvasRenderingContext2D,
  color: string,
  n: number,
  len: number,
  wide: number,
): void => {
  x.strokeStyle = color;
  x.lineWidth = wide;
  x.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    x.beginPath();
    x.moveTo(9, 16);
    x.quadraticCurveTo(
      9 + Math.cos(a) * len * 0.6,
      16 - len * 0.8,
      9 + Math.cos(a) * len,
      16 - len * 0.55,
    );
    x.stroke();
  }
};
const capMushroom = (
  x: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void => {
  x.fillStyle = "#f0e4c8";
  x.fillRect(cx - r * 0.22, cy, r * 0.44, r * 0.9);
  x.fillStyle = "#d2402f";
  x.beginPath();
  x.ellipse(cx, cy, r, r * 0.72, 0, Math.PI, 0);
  x.fill();
  x.fillStyle = "#fff4e2";
  x.beginPath();
  x.arc(cx - r * 0.35, cy - r * 0.28, r * 0.18, 0, 7);
  x.arc(cx + r * 0.38, cy - r * 0.18, r * 0.15, 0, 7);
  x.fill();
};
// The badge on a LIBRARY family: this button is a whole set of models, not
// one shape, and what you drop is rolled from the seed until you pick.
const manyDots = (x: CanvasRenderingContext2D): void => {
  x.fillStyle = "#ffc65a";
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    x.arc(11.5 + i * 2.5, 16.5, 0.85, 0, 7);
    x.fill();
  }
};
const DECOR_ICONS: Record<DecorKind, (x: CanvasRenderingContext2D) => void> = {
  fern: (x) => leafSpray(x, "#4a9a40", 6, 12, 1.6),
  broadleaf: (x) => leafSpray(x, "#3e8e46", 4, 13, 3.2),
  flowers: (x) => {
    x.strokeStyle = "#3e8e46";
    x.lineWidth = 1.2;
    x.beginPath();
    x.moveTo(9, 16);
    x.lineTo(9, 9);
    x.stroke();
    for (const [cx, cy, c] of [
      [6, 7, "#ff5a48"],
      [12, 8, "#ff9a2e"],
      [9, 4, "#f84a8e"],
    ] as const) {
      x.fillStyle = c;
      x.beginPath();
      x.arc(cx, cy, 2.4, 0, 7);
      x.fill();
    }
  },
  toadstool: (x) => capMushroom(x, 9, 10, 6),
  toadstools: (x) => {
    capMushroom(x, 5, 13, 3.4);
    capMushroom(x, 13, 12, 3);
    capMushroom(x, 9, 8, 5);
  },
  mossrock: (x) => {
    x.fillStyle = "#a8b090";
    x.beginPath();
    x.ellipse(9, 12, 7, 4.6, 0, 0, 7);
    x.fill();
    x.fillStyle = "#6f9a52";
    x.beginPath();
    x.ellipse(7, 9.5, 3.4, 1.6, -0.3, 0, 7);
    x.fill();
  },
  jungletree: (x) => {
    x.fillStyle = "#6b4a2f";
    x.fillRect(8, 7, 2.4, 10);
    x.fillStyle = "#2f7a38";
    x.beginPath();
    x.ellipse(9, 6, 8, 4.4, 0, 0, 7);
    x.fill();
  },
  palm: (x) => {
    x.strokeStyle = "#b08556";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(7, 17);
    x.quadraticCurveTo(9, 11, 11, 6);
    x.stroke();
    leafSpray(x, "#3fa04a", 5, 8, 1.8);
    x.save();
    x.translate(2, -10);
    x.restore();
  },
  vines: (x) => {
    x.strokeStyle = "#3d7a33";
    x.lineWidth = 1.6;
    for (const sx of [5, 9, 13]) {
      x.beginPath();
      x.moveTo(sx, 1);
      x.quadraticCurveTo(sx + (sx - 9) * 0.4, 8, sx + (sx - 9) * 0.2, 15);
      x.stroke();
    }
  },
  planter: (x) => {
    leafSpray(x, "#4a9a40", 5, 8, 1.5);
    x.fillStyle = "#c86a42";
    x.beginPath();
    x.moveTo(5, 11);
    x.lineTo(13, 11);
    x.lineTo(11.5, 17);
    x.lineTo(6.5, 17);
    x.closePath();
    x.fill();
  },
  idol: (x) => {
    x.fillStyle = "#9aa093";
    x.fillRect(4, 4, 10, 11);
    x.fillRect(3, 15, 12, 2.5);
    x.fillStyle = "#2b2f2c";
    x.fillRect(5.5, 7, 2.5, 2);
    x.fillRect(10, 7, 2.5, 2);
    x.fillRect(6, 11.5, 6, 2);
  },
  ruinblock: (x) => {
    x.fillStyle = "#8f9488";
    x.fillRect(2, 6, 14, 10);
    x.strokeStyle = "#6a6f66";
    x.lineWidth = 1;
    x.strokeRect(2, 6, 7, 5);
    x.strokeRect(9, 6, 7, 5);
    x.strokeRect(2, 11, 14, 5);
    x.fillStyle = "#4e7a3e";
    x.fillRect(2, 4.5, 14, 2);
  },
  block: (x) => {
    x.fillStyle = "#6b5232";
    x.fillRect(2, 4, 14, 12);
    x.fillStyle = "#7d6140";
    x.fillRect(2, 4, 14, 2.5);
    x.fillStyle = "#5a4429";
    for (const [bx, by] of [
      [4, 8],
      [10, 7],
      [7, 12],
      [12, 12],
    ] as const) {
      x.beginPath();
      x.arc(bx, by, 1.1, 0, 7);
      x.fill();
    }
  },
  meshycourtyard: (x) => {
    x.fillStyle = "#68756c";
    x.beginPath();
    x.moveTo(1, 15);
    x.lineTo(3, 5);
    x.lineTo(7, 2);
    x.lineTo(11, 2);
    x.lineTo(15, 5);
    x.lineTo(17, 15);
    x.lineTo(13, 15);
    x.lineTo(12, 9);
    x.quadraticCurveTo(9, 6, 6, 9);
    x.lineTo(5, 15);
    x.closePath();
    x.fill();
    x.strokeStyle = "#b3b99f";
    x.lineWidth = 1;
    x.stroke();
  },
  log: (x) => {
    x.fillStyle = "#96683c";
    x.fillRect(1, 7, 16, 5);
    x.fillStyle = "#7a5533";
    x.beginPath();
    x.ellipse(2, 9.5, 1.4, 2.5, 0, 0, 7);
    x.fill();
    x.strokeStyle = "#7a5533";
    x.lineWidth = 0.8;
    x.beginPath();
    x.moveTo(6, 7);
    x.lineTo(6.5, 12);
    x.stroke();
  },
  tree: (x) => {
    x.fillStyle = "#8a6b47";
    x.fillRect(8, 9, 2.4, 8);
    x.fillStyle = "#4e9c3a";
    x.beginPath();
    x.moveTo(9, 1);
    x.lineTo(16, 7.5);
    x.lineTo(12.5, 10.5);
    x.lineTo(5.5, 10.5);
    x.lineTo(2, 7.5);
    x.closePath();
    x.fill();
    manyDots(x);
  },
  plants: (x) => {
    leafSpray(x, "#5db63f", 5, 12, 2.6);
    x.strokeStyle = "#2f7a34";
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(9, 17);
    x.lineTo(9, 10);
    x.stroke();
    manyDots(x);
  },
  boulder: (x) => {
    x.fillStyle = "#9aa39c";
    x.beginPath();
    x.moveTo(1, 16);
    x.lineTo(3, 7);
    x.lineTo(8, 3);
    x.lineTo(15, 6);
    x.lineTo(17, 16);
    x.closePath();
    x.fill();
    x.fillStyle = "#548b3e"; // the moss cap the kit models carry
    x.beginPath();
    x.moveTo(3, 7);
    x.lineTo(8, 3);
    x.lineTo(15, 6);
    x.lineTo(13, 8);
    x.lineTo(6, 8);
    x.closePath();
    x.fill();
    manyDots(x);
  },
  rocks: (x) => {
    x.fillStyle = "#9aa39c";
    for (const [cx, cy, r] of [
      [5, 13, 3.6],
      [12, 14, 2.8],
      [9.5, 9, 2.2],
    ] as const) {
      x.beginPath();
      x.moveTo(cx - r, cy + r * 0.6);
      x.lineTo(cx - r * 0.5, cy - r * 0.7);
      x.lineTo(cx + r * 0.6, cy - r * 0.5);
      x.lineTo(cx + r, cy + r * 0.6);
      x.closePath();
      x.fill();
    }
    manyDots(x);
  },
  trunk: (x) => {
    x.save();
    x.translate(9, 9);
    x.rotate(-0.3);
    x.fillStyle = "#7a5c3c";
    x.fillRect(-8, -2.6, 16, 5.2);
    x.fillStyle = "#c7a074"; // sawn end
    x.beginPath();
    x.ellipse(-8, 0, 1.5, 2.6, 0, 0, 7);
    x.fill();
    x.restore();
    manyDots(x);
  },
  slab: (x) => {
    x.fillStyle = "#bdb9a8";
    x.fillRect(6, 4, 6, 11);
    x.fillRect(4, 14, 10, 3);
    x.fillStyle = "#8f8b7c"; // the broken-off top
    x.beginPath();
    x.moveTo(6, 4);
    x.lineTo(8, 2);
    x.lineTo(10, 5);
    x.lineTo(12, 3);
    x.lineTo(12, 5);
    x.lineTo(6, 5);
    x.closePath();
    x.fill();
    manyDots(x);
  },
};
// What a freshly dropped prop looks like: the same numbers the hand-coded
// levels plant with, so a new one matches the ones already standing there.
const DECOR_DEFAULTS: Record<DecorKind, Partial<CustomComponent>> = {
  fern: { w: 1.2 },
  broadleaf: { w: 1.2 },
  flowers: {},
  toadstool: { w: 1 },
  toadstools: { w: 1 },
  mossrock: { w: 1.6 },
  jungletree: { rise: 10, amp: 0 },
  palm: { rise: 4.8, amp: 0.12 },
  vines: { rise: 4, n: 3 },
  planter: {},
  idol: { w: 1.4, yaw: 0 },
  ruinblock: { s: [2.4, 1.6, 2.4], yaw: 0 },
  log: { len: 13 },
  block: { s: [10, 8, 10], yaw: 0, color: "#6b5232", tex: "dirt" },
  meshycourtyard: { w: 11.52, yaw: 90, amp: 6 },
  // The library families arrive with NOTHING chosen on purpose: leave vr/tn
  // off and every copy rolls its own model, colour, size, spin and lean from
  // where it stands, which is what makes a scattered handful look planted
  // rather than stamped. Pick one in the panel and it locks.
  tree: { w: 1 },
  plants: { w: 1 },
  boulder: { w: 1 },
  rocks: { w: 1 },
  trunk: { w: 1 },
  slab: { w: 1 },
};

const PALETTE_SECTIONS: { title: string; items: PalItem[] }[] = [
  {
    title: "TERRAIN",
    items: [
      {
        label: "platform",
        icon: (x) => {
          x.fillStyle = "#cfd4cf";
          x.fillRect(1, 7, 16, 5);
          x.fillStyle = "#aeb4ae";
          for (let i = 0; i < 4; i++)
            x.fillRect(1 + i * 4, 7 + (i % 2) * 2.5, 4, 2.5);
        },
        make: (at) => ({
          t: "platform",
          p: [at.x, at.y, at.z],
          s: [10, 1, 10],
        }),
      },
      {
        // The one component that is not a flat box. Six default nodes so a
        // dropped strip already rolls and bends a little — a dead-flat one
        // would just look like a wide platform and nobody would find the
        // node handles.
        label: "ground strip",
        icon: (x) => {
          x.fillStyle = "#4f9a42";
          x.beginPath();
          x.moveTo(1, 13);
          x.bezierCurveTo(5, 9, 8, 15, 12, 10);
          x.lineTo(17, 7);
          x.lineTo(17, 13);
          x.bezierCurveTo(12, 16, 6, 13, 1, 17);
          x.closePath();
          x.fill();
          x.strokeStyle = "#3d7a2c";
          x.lineWidth = 1.6;
          x.beginPath();
          x.moveTo(1, 12);
          x.bezierCurveTo(5, 8, 8, 14, 12, 9);
          x.lineTo(17, 6);
          x.stroke();
        },
        make: (at) => ({
          t: "terrain",
          p: [at.x, at.y, at.z],
          w: 12,
          amp: 0.45,
          berms: true,
          pts: [
            [0, 0],
            [2.5, -14],
            [1, -28],
            [-2, -42],
            [-2.5, -56],
            [0, -70],
          ] as [number, number][],
        }),
      },
      {
        label: "draw ground",
        icon: (x) => {
          x.strokeStyle = "#4f9a42";
          x.lineWidth = 3;
          x.lineCap = "round";
          x.beginPath();
          x.moveTo(2, 15);
          x.bezierCurveTo(7, 11, 9, 16, 16, 5);
          x.stroke();
          x.fillStyle = "#e8e8e8";
          for (const [px, py] of [
            [2, 15],
            [16, 5],
          ] as const) {
            x.beginPath();
            x.arc(px, py, 2, 0, 7);
            x.fill();
          }
        },
        penDraw: "terrain",
      },
      {
        label: "wood + bamboo path",
        icon: (x) => {
          x.strokeStyle = "#8b5a2b";
          x.lineWidth = 5;
          x.lineCap = "butt";
          x.beginPath();
          x.moveTo(2, 15);
          x.bezierCurveTo(5, 8, 11, 15, 16, 4);
          x.stroke();
          x.strokeStyle = "#d8bd70";
          x.lineWidth = 1.4;
          for (let i = 3; i < 16; i += 3) {
            x.beginPath();
            x.moveTo(i - 2, 14);
            x.lineTo(i + 1, 10);
            x.stroke();
          }
        },
        make: (at) => ({
          t: "woodpath",
          p: [at.x, at.y, at.z],
          w: 6,
          curve: "spline",
          scaffold: true,
          supports: true,
          rails: true,
          spacing: 0.55,
          baySpacing: 3.8,
          supportDepth: 3,
          pts: [
            [0, 0, 0, 0, 0],
            [2, -12, 0, 1, 3],
            [-1, -24, 0, 2.5, -3],
            [0, -36, 0, 3, 0],
          ],
          widths: [6, 6.5, 5.5, 6],
        }),
      },
      {
        label: "ramp",
        icon: (x) => {
          x.fillStyle = "#c8b088";
          x.beginPath();
          x.moveTo(1, 15);
          x.lineTo(17, 15);
          x.lineTo(17, 3);
          x.closePath();
          x.fill();
        },
        make: (at) => ({
          t: "ramp",
          p: [at.x, at.y, at.z],
          len: 10,
          rise: 4,
          w: 8,
        }),
      },
      {
        label: "wall",
        icon: (x) => {
          x.fillStyle = "#9a8a7a";
          x.fillRect(3, 3, 12, 12);
          x.strokeStyle = "#6a5d50";
          x.lineWidth = 1;
          for (let r = 0; r < 3; r++) {
            x.strokeRect(3, 3 + r * 4, 6, 4);
            x.strokeRect(9, 3 + r * 4, 6, 4);
          }
        },
        make: (at) => ({ t: "wall", p: [at.x, at.y, at.z], s: [8, 4, 1] }),
      },
      {
        label: "bendy wall",
        icon: (x) => {
          x.strokeStyle = "#6a5d50";
          x.lineWidth = 5;
          x.beginPath();
          x.moveTo(2, 15);
          x.bezierCurveTo(4, 7, 12, 13, 16, 3);
          x.stroke();
          x.strokeStyle = "#d0bda2";
          x.lineWidth = 2;
          x.stroke();
        },
        make: (at) => ({
          t: "wallpath",
          p: [at.x, at.y, at.z],
          pts: [[0, 6], [2, 2], [-2, -3], [0, -8]],
          w: 1.2,
          rise: 5,
          curve: "spline",
          color: "#9a8a7a",
          tex: "stone",
        }),
      },
      {
        label: "invis wall",
        icon: (x) => {
          x.strokeStyle = "#64d8ff";
          x.lineWidth = 1.5;
          x.setLineDash([3, 2]);
          x.strokeRect(3, 3, 12, 12);
          x.setLineDash([]);
        },
        make: (at) => ({
          t: "wall",
          p: [at.x, at.y, at.z],
          s: [8, 4, 1],
          invisible: true,
        }),
      },
      {
        label: "rail",
        icon: (x) => {
          x.strokeStyle = "#c8d4e2";
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(2, 6);
          x.lineTo(16, 6);
          x.stroke();
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(5, 6);
          x.lineTo(5, 14);
          x.moveTo(13, 6);
          x.lineTo(13, 14);
          x.stroke();
        },
        make: (at) => ({
          t: "rail",
          p: [at.x, at.y + 1, at.z],
          len: 12,
          yaw: 0,
        }),
      },
      {
        label: "halfpipe",
        icon: (x) => {
          x.strokeStyle = "#aab4ba";
          x.lineWidth = 2.5;
          x.beginPath();
          x.moveTo(2, 4);
          x.quadraticCurveTo(2, 15, 9, 15);
          x.quadraticCurveTo(16, 15, 16, 4);
          x.stroke();
        },
        make: (at) => ({
          t: "vertramp",
          p: [at.x, at.y, at.z],
          len: 36,
          rise: 6,
          w: 3,
          vkind: "half",
        }),
      },
      {
        label: "quarter vert",
        icon: (x) => {
          x.strokeStyle = "#7fd4e8";
          x.lineWidth = 2.5;
          x.beginPath();
          x.moveTo(2, 15);
          x.lineTo(8, 15);
          x.quadraticCurveTo(16, 15, 16, 4);
          x.stroke();
        },
        make: (at) => ({
          t: "vertramp",
          p: [at.x, at.y, at.z],
          len: 30,
          rise: 6,
          w: 3,
          vkind: "quarter",
        }),
      },
      {
        label: "half vert",
        icon: (x) => {
          x.strokeStyle = "#7fd4e8";
          x.lineWidth = 2.5;
          x.beginPath();
          x.moveTo(2, 4);
          x.quadraticCurveTo(2, 15, 9, 15);
          x.quadraticCurveTo(16, 15, 16, 4);
          x.stroke();
        },
        make: (at) => ({
          t: "vertramp",
          p: [at.x, at.y, at.z],
          len: 30,
          rise: 6,
          w: 3,
          vkind: "half",
        }),
      },
      // bowl parts: a quarter swept round a filleted corner, and a whole pool.
      // Both stop short of vertical (arc 60) and carry a deck — pool rules.
      {
        label: "bowl corner",
        icon: (x) => {
          x.strokeStyle = "#7fd4e8";
          x.lineWidth = 2.5;
          x.beginPath();
          x.arc(3, 3, 12, 0, Math.PI / 2);
          x.stroke();
          x.strokeStyle = "#3d6b78";
          x.lineWidth = 1.5;
          x.beginPath();
          x.arc(3, 3, 6, 0, Math.PI / 2);
          x.stroke();
        },
        make: (at) => ({
          t: "vertramp",
          p: [at.x, at.y, at.z],
          pts: [
            [-12, -12, 0, 0],
            [12, -12, 10, 0],
            [12, 12, 0, 0],
          ],
          rise: 6,
          w: 2,
          vkind: "quarter",
          arc: 60,
          deck: 2.3,
        }),
      },
      {
        label: "bowl",
        icon: (x) => {
          x.strokeStyle = "#7fd4e8";
          x.lineWidth = 2.5;
          x.beginPath();
          x.ellipse(9, 9, 7, 5.5, 0, 0, 7);
          x.stroke();
          x.strokeStyle = "#3d6b78";
          x.lineWidth = 1.5;
          x.beginPath();
          x.ellipse(9, 9, 3.4, 2.6, 0, 0, 7);
          x.stroke();
        },
        make: (at) => ({
          t: "vertramp",
          p: [at.x, at.y, at.z],
          pts: [
            [-13, -8, 5, 0],
            [13, -8, 5, 0],
            [13, 8, 5, 0],
            [-13, 8, 5, 0],
          ],
          rise: 6,
          w: 2,
          vkind: "quarter",
          arc: 60,
          deck: 2.3,
          closed: true,
        }),
      },
      {
        label: "crumble",
        icon: (x) => {
          x.fillStyle = "#cf6a48";
          x.fillRect(2, 7, 14, 5);
          x.strokeStyle = "#7a3520";
          x.lineWidth = 1;
          x.beginPath();
          x.moveTo(6, 7);
          x.lineTo(8, 12);
          x.moveTo(11, 7);
          x.lineTo(10, 12);
          x.stroke();
        },
        make: (at) => ({
          t: "crumble",
          p: [at.x, at.y + 1, at.z],
          s: [3, 1, 3],
          shake: 0.7,
        }),
      },
      {
        label: "death pit",
        icon: (x) => {
          x.fillStyle = "#b0402a";
          x.fillRect(2, 6, 14, 7);
          x.fillStyle = "#0a0a10";
          x.fillRect(3.5, 7.5, 11, 4);
        },
        make: (at) => ({ t: "pit", p: [at.x, at.y, at.z], s: [6, 1, 6] }),
      },
      {
        label: "rock",
        icon: (x) => {
          x.fillStyle = "#8d8678";
          x.beginPath();
          x.moveTo(4, 14);
          x.lineTo(2, 9);
          x.lineTo(7, 4);
          x.lineTo(13, 5);
          x.lineTo(16, 10);
          x.lineTo(13, 14);
          x.closePath();
          x.fill();
          x.fillStyle = "#a49c8c";
          x.beginPath();
          x.moveTo(7, 4);
          x.lineTo(13, 5);
          x.lineTo(10, 9);
          x.closePath();
          x.fill();
        },
        make: (at) => ({
          t: "rock",
          p: [at.x, at.y + 1, at.z],
          s: [3, 2, 3],
          seed: Math.floor(Math.random() * 1e6),
        }),
      },
      {
        label: "boulder",
        icon: (x) => {
          x.fillStyle = "#8d8678";
          x.beginPath();
          x.arc(9, 10, 7, 0, 7);
          x.fill();
          x.fillStyle = "#a49c8c";
          x.beginPath();
          x.moveTo(5, 6);
          x.lineTo(12, 4);
          x.lineTo(13, 9);
          x.lineTo(6, 10);
          x.closePath();
          x.fill();
        },
        make: (at) => ({
          t: "rock",
          p: [at.x, at.y + 2, at.z],
          s: [5.5, 4, 5.5],
          seed: Math.floor(Math.random() * 1e6),
        }),
      },
      {
        label: "spire",
        icon: (x) => {
          x.fillStyle = "#8d8678";
          x.beginPath();
          x.moveTo(9, 2);
          x.lineTo(13, 12);
          x.lineTo(12, 16);
          x.lineTo(6, 16);
          x.lineTo(5, 11);
          x.closePath();
          x.fill();
          x.fillStyle = "#6e685c";
          x.beginPath();
          x.moveTo(9, 2);
          x.lineTo(13, 12);
          x.lineTo(10, 14);
          x.closePath();
          x.fill();
        },
        make: (at) => ({
          t: "rock",
          p: [at.x, at.y + 3, at.z],
          s: [2.5, 6, 2.5],
          seed: Math.floor(Math.random() * 1e6),
        }),
      },
    ],
  },
  {
    title: "CRATES",
    items: [
      {
        label: "wood",
        icon: (x) => {
          box(x, "#b5762f", "#7a4a18");
          glyph(x, "▦", "#8a5a22");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "wood",
        }),
      },
      {
        label: "arrow",
        icon: (x) => {
          box(x, "#b5762f", "#7a4a18");
          glyph(x, "↑", "#3a9a4a");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "bouncy",
        }),
      },
      {
        label: "arrow metal",
        icon: (x) => {
          box(x, "#9aa2ac", "#666e78");
          glyph(x, "↑", "#3a9a4a");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "metalbounce",
        }),
      },
      {
        label: "metal crate",
        icon: (x) => {
          box(x, "#9aa2ac", "#666e78");
          glyph(x, "M", "#e8eef4");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "metal",
        }),
      },
      {
        label: "TNT",
        icon: (x) => {
          box(x, "#c03a2a", "#6a180e");
          glyph(x, "T", "#ffe9d8");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "tnt",
        }),
      },
      {
        label: "nitro",
        icon: (x) => {
          box(x, "#2fae44", "#0e4a18");
          glyph(x, "N", "#eafff0");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "nitro",
        }),
      },
      {
        label: "mask",
        icon: (x) => {
          box(x, "#b5762f", "#7a4a18");
          glyph(x, "☻", "#e89040");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "mask",
        }),
      },
      {
        label: "? crate",
        icon: (x) => {
          box(x, "#b5762f", "#7a4a18");
          glyph(x, "?", "#ff8c1a");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "mystery",
        }),
      },
      {
        label: "! crate",
        icon: (x) => {
          box(x, "#b5762f", "#7a4a18");
          glyph(x, "!", "#ffd934");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "bang",
        }),
      },
      {
        label: "nitro !",
        icon: (x) => {
          box(x, "#2fae44", "#0e4a18");
          glyph(x, "!", "#eafff0");
        },
        make: (at) => ({
          t: "crate",
          p: [at.x, at.y + 0.5, at.z],
          kind: "nitrobang",
        }),
      },
      {
        label: "metal block",
        icon: (x) => {
          box(x, "#9aa2ac", "#666e78");
          x.fillStyle = "#666e78";
          for (const [rx, ry] of [
            [5, 5],
            [12, 5],
            [5, 12],
            [12, 12],
          ])
            x.fillRect(rx, ry, 2, 2);
        },
        make: (at) => ({ t: "metal", p: [at.x, at.y, at.z] }),
      },
      {
        label: "checkpoint",
        icon: (x) => {
          box(x, "#2a5a8a", "#123049");
          glyph(x, "C", "#cfe8ff");
        },
        make: (at) => ({ t: "checkpoint", p: [at.x, at.y + 0.5, at.z] }),
      },
    ],
  },
  {
    title: "DRAW (pen tool)",
    items: [
      {
        label: "platform",
        icon: (x) => {
          x.strokeStyle = "#cfd4cf";
          x.fillStyle = "rgba(207,212,207,0.35)";
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(3, 12);
          x.lineTo(7, 3);
          x.lineTo(15, 5);
          x.lineTo(13, 14);
          x.closePath();
          x.fill();
          x.stroke();
          x.fillStyle = "#58e08a";
          for (const [px, py] of [
            [3, 12],
            [7, 3],
            [15, 5],
            [13, 14],
          ])
            x.fillRect(px - 1.5, py - 1.5, 3, 3);
        },
        penDraw: "platform",
      },
      {
        label: "death pit",
        icon: (x) => {
          x.strokeStyle = "#b0402a";
          x.fillStyle = "#0a0a10";
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(3, 11);
          x.lineTo(8, 3);
          x.lineTo(16, 7);
          x.lineTo(12, 15);
          x.closePath();
          x.fill();
          x.stroke();
          x.fillStyle = "#ff8a5e";
          for (const [px, py] of [
            [3, 11],
            [8, 3],
            [16, 7],
            [12, 15],
          ])
            x.fillRect(px - 1.5, py - 1.5, 3, 3);
        },
        penDraw: "pit",
      },
      {
        label: "wall",
        icon: (x) => {
          x.strokeStyle = "#9a8a7a";
          x.fillStyle = "rgba(154,138,122,0.4)";
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(3, 13);
          x.lineTo(6, 4);
          x.lineTo(14, 3);
          x.lineTo(15, 12);
          x.closePath();
          x.fill();
          x.stroke();
          x.fillStyle = "#ffd75e";
          for (const [px, py] of [
            [3, 13],
            [6, 4],
            [14, 3],
            [15, 12],
          ])
            x.fillRect(px - 1.5, py - 1.5, 3, 3);
        },
        penDraw: "wall",
      },
      {
        label: "bendy wall path",
        icon: (x) => {
          x.strokeStyle = "#d0bda2";
          x.lineWidth = 4;
          x.beginPath();
          x.moveTo(2, 14);
          x.bezierCurveTo(5, 5, 12, 14, 16, 4);
          x.stroke();
          x.fillStyle = "#ffd75e";
          for (const [px, py] of [[2, 14], [9, 9], [16, 4]] as const) {
            x.beginPath();
            x.arc(px, py, 1.5, 0, Math.PI * 2);
            x.fill();
          }
        },
        penDraw: "wallpath",
      },
      {
        label: "rail path",
        icon: (x) => {
          x.strokeStyle = "#b8a2ff";
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(2, 14);
          x.lineTo(7, 12);
          x.lineTo(11, 6);
          x.lineTo(16, 4);
          x.stroke();
          x.fillStyle = "#d7c8ff";
          for (const [px, py] of [
            [2, 14],
            [7, 12],
            [11, 6],
            [16, 4],
          ])
            x.fillRect(px - 1.5, py - 1.5, 3, 3);
        },
        penDraw: "rail",
      },
      {
        label: "vert spine",
        icon: (x) => {
          x.strokeStyle = "#7fd4e8";
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(2, 13);
          x.quadraticCurveTo(8, 12, 11, 7);
          x.quadraticCurveTo(13, 3, 16, 3);
          x.stroke();
          x.fillStyle = "#cdf1fa";
          for (const [px, py] of [
            [2, 13],
            [11, 7],
            [16, 3],
          ])
            x.fillRect(px - 1.5, py - 1.5, 3, 3);
        },
        penDraw: "vertramp",
      },
      {
        label: "wood path",
        icon: (x) => {
          x.strokeStyle = "#b98243";
          x.lineWidth = 4;
          x.beginPath();
          x.moveTo(2, 14);
          x.bezierCurveTo(6, 8, 11, 15, 16, 4);
          x.stroke();
          x.fillStyle = "#ead49a";
          for (const [px, py] of [
            [2, 14],
            [9, 10],
            [16, 4],
          ] as const) {
            x.beginPath();
            x.arc(px, py, 1.8, 0, 7);
            x.fill();
          }
        },
        penDraw: "woodpath",
      },
      {
        label: "rope",
        icon: (x) => {
          x.strokeStyle = "#c2a878";
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(2, 5);
          x.quadraticCurveTo(9, 13, 16, 5);
          x.stroke();
          x.fillStyle = "#6b4a2a";
          x.fillRect(1, 4, 2, 8);
          x.fillRect(15, 4, 2, 8);
        },
        make: (at) => ({
          t: "rope",
          p: [at.x, at.y + 2.5, at.z],
          len: 12,
          amp: 1.2,
          shake: 3,
        }),
      },
    ],
  },
  {
    // everything that moves on a cycle or carries fire, in one place — the
    // language The Nightworks is written in, near the top where you can
    // find it
    title: "MOVING & FIRE",
    items: [
      {
        label: "mover",
        icon: (x) => {
          x.fillStyle = "#8a96c8";
          x.fillRect(3, 8, 12, 3);
          x.strokeStyle = "#c8d4ff";
          x.lineWidth = 1.2;
          x.beginPath();
          x.moveTo(2, 5);
          x.lineTo(16, 5);
          x.stroke();
          glyph(x, "↔", "#c8d4ff");
        },
        make: (at) => ({
          t: "mover",
          p: [at.x, at.y, at.z],
          s: [6, 0.8, 6],
          axis: "x",
          amp: 4,
          speed: 0.6,
          phase: 0,
        }),
      },
      {
        label: "fire ferry",
        icon: (x) => {
          x.fillStyle = "#5a4632"; // warm iron deck
          x.fillRect(3, 10, 12, 3);
          x.fillStyle = "#ff9a2c"; // the brazier riding it
          x.beginPath();
          x.moveTo(9, 2);
          x.lineTo(11.8, 9);
          x.lineTo(6.2, 9);
          x.closePath();
          x.fill();
          glyph(x, "↔", "#ffd08a");
        },
        make: (at) => ({
          t: "mover",
          p: [at.x, at.y, at.z],
          s: [5, 0.8, 5],
          axis: "x",
          amp: 5.5,
          speed: 0.5,
          phase: 0,
          lit: true,
        }),
      },
      {
        label: "fire lift",
        icon: (x) => {
          x.fillStyle = "#5a4632";
          x.fillRect(3, 12, 12, 3);
          x.fillStyle = "#ff9a2c";
          x.beginPath();
          x.moveTo(9, 4);
          x.lineTo(11.8, 11);
          x.lineTo(6.2, 11);
          x.closePath();
          x.fill();
          glyph(x, "↕", "#ffd08a");
        },
        make: (at) => ({
          t: "mover",
          p: [at.x, at.y, at.z],
          s: [4.5, 0.8, 4.5],
          axis: "y",
          amp: 3,
          speed: 0.7,
          phase: 0,
          lit: true,
        }),
      },
      {
        label: "moving rail",
        icon: (x) => {
          x.strokeStyle = "#c8d4e2";
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(2, 6);
          x.lineTo(16, 6);
          x.stroke();
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(5, 6);
          x.lineTo(5, 12);
          x.moveTo(13, 6);
          x.lineTo(13, 12);
          x.stroke();
          glyph(x, "↔", "#8ac8ff");
        },
        make: (at) => ({
          t: "rail",
          p: [at.x, at.y + 1.7, at.z],
          len: 14,
          yaw: 0,
          axis: "x",
          amp: 5,
          speed: 0.55,
          phase: 0,
        }),
      },
      {
        label: "torch",
        icon: (x) => {
          x.fillStyle = "#3a3330"; // post
          x.fillRect(8, 8, 2, 8);
          x.fillStyle = "#ff9a2c"; // flame
          x.beginPath();
          x.moveTo(9, 1);
          x.lineTo(12.5, 8);
          x.lineTo(5.5, 8);
          x.closePath();
          x.fill();
          x.fillStyle = "#fff0b0";
          x.beginPath();
          x.moveTo(9, 3.5);
          x.lineTo(10.8, 8);
          x.lineTo(7.2, 8);
          x.closePath();
          x.fill();
        },
        make: (at) => ({
          t: "torch",
          p: [at.x, at.y, at.z],
          rise: 2.2,
          w: 1,
        }),
      },
      {
        label: "phase pad",
        icon: (x) => {
          x.fillStyle = "#9a7f5c"; // the solid half
          x.fillRect(1, 8, 8, 4);
          x.strokeStyle = "#4a6a8c"; // the ghost half
          x.lineWidth = 1;
          x.strokeRect(9.5, 8.5, 7, 3);
          glyph(x, "◐", "#ffd08a");
        },
        make: (at) => ({
          t: "phasepad",
          p: [at.x, at.y, at.z],
          s: [5, 0.6, 5],
          cycle: 4,
          phase: 0,
          amp: 0.5,
        }),
      },
      {
        label: "rope swing",
        icon: (x) => {
          x.strokeStyle = "#a8845a";
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(8, 2);
          x.quadraticCurveTo(9, 8, 12, 13);
          x.stroke();
          x.fillStyle = "#7a5c3a";
          x.fillRect(11, 6, 2.4, 1.6);
          x.beginPath();
          x.arc(12.2, 13.5, 1.8, 0, 7);
          x.fill();
        },
        make: (at) => ({
          t: "ropeswing",
          p: [at.x, at.y + 8, at.z],
          len: 6,
          amp: 0.85,
          speed: 0,
          phase: 0,
        }),
      },
      {
        label: "ferry rope",
        icon: (x) => {
          x.strokeStyle = "#6a7078"; // the travelling anchor track
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(2, 3);
          x.lineTo(16, 3);
          x.stroke();
          x.strokeStyle = "#a8845a";
          x.beginPath();
          x.moveTo(9, 3);
          x.quadraticCurveTo(10, 8, 12, 13);
          x.stroke();
          x.fillStyle = "#7a5c3a";
          x.beginPath();
          x.arc(12.2, 13.5, 1.8, 0, 7);
          x.fill();
          glyph(x, "↔", "#c8d4ff");
        },
        make: (at) => ({
          t: "ropeswing",
          p: [at.x, at.y + 8, at.z],
          len: 7,
          amp: 0.7,
          speed: 0,
          phase: 0,
          range: 5.5,
          axis: "x",
          cycle: 0.45,
        }),
      },
    ],
  },
  {
    title: "CAMERA",
    items: [
      {
        label: "cam node",
        icon: (x) => {
          x.fillStyle = "#ff5ad2";
          x.beginPath();
          x.moveTo(9, 2);
          x.lineTo(15, 9);
          x.lineTo(9, 16);
          x.lineTo(3, 9);
          x.closePath();
          x.fill();
          x.strokeStyle = "#ff8ae0";
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(9, 9);
          x.lineTo(17, 9);
          x.stroke();
        },
        make: (at) => ({ t: "camnode", p: [at.x, at.y + 1.5, at.z] }),
      },
      {
        label: "travel zone",
        icon: (x) => {
          x.strokeStyle = "#9a6cff";
          x.fillStyle = "rgba(154,108,255,0.25)";
          x.lineWidth = 1.5;
          x.fillRect(2, 5, 14, 9);
          x.strokeRect(2, 5, 14, 9);
          glyph(x, "→", "#c9b2ff");
        },
        make: (at) => ({
          t: "zone",
          p: [at.x, at.y, at.z],
          s: [14, 1, 10],
          dir: "E",
        }),
      },
    ],
  },
  {
    title: "FOES",
    items: [
      {
        label: "grunt",
        icon: (x) => {
          x.fillStyle = "#c03a2a";
          x.fillRect(4, 7, 10, 8);
          x.fillStyle = "#fff";
          x.fillRect(6, 9, 2, 2);
          x.fillRect(10, 9, 2, 2);
        },
        make: (at) => ({
          t: "enemy",
          p: [at.x, at.y + 0.5, at.z],
          range: 5,
          speed: 3,
          foe: "grunt",
        }),
      },
      {
        label: "spiker (spin)",
        icon: (x) => {
          x.fillStyle = "#7a3a8a";
          x.fillRect(4, 9, 10, 6);
          x.fillStyle = "#e8e0f0";
          for (let i = 0; i < 4; i++) {
            x.beginPath();
            x.moveTo(4 + i * 3, 9);
            x.lineTo(5.5 + i * 3, 3);
            x.lineTo(7 + i * 3, 9);
            x.fill();
          }
        },
        make: (at) => ({
          t: "enemy",
          p: [at.x, at.y + 0.5, at.z],
          range: 5,
          speed: 3,
          foe: "spiker",
        }),
      },
      {
        label: "turtle (jump)",
        icon: (x) => {
          x.fillStyle = "#2f7a44";
          x.beginPath();
          x.arc(9, 12, 6, Math.PI, 0);
          x.fill();
          x.fillStyle = "#8a6a2a";
          x.fillRect(2, 11, 2, 3);
          x.fillRect(14, 11, 2, 3);
          x.fillStyle = "#6cae5a";
          x.fillRect(12, 8, 4, 3);
        },
        make: (at) => ({
          t: "enemy",
          p: [at.x, at.y + 0.5, at.z],
          range: 4,
          speed: 2.4,
          foe: "turtle",
        }),
      },
      {
        label: "charger",
        icon: (x) => {
          x.fillStyle = "#8a4a26";
          x.fillRect(3, 7, 11, 8);
          x.fillStyle = "#f0e6d0";
          x.beginPath();
          x.moveTo(14, 8);
          x.lineTo(18, 6);
          x.lineTo(15, 10);
          x.fill();
          x.beginPath();
          x.moveTo(14, 12);
          x.lineTo(18, 13);
          x.lineTo(15, 14);
          x.fill();
        },
        make: (at) => ({
          t: "enemy",
          p: [at.x, at.y + 0.5, at.z],
          range: 9,
          speed: 4.5,
          foe: "charger",
        }),
      },
      {
        label: "hopper",
        icon: (x) => {
          x.fillStyle = "#46a83a";
          x.beginPath();
          x.arc(9, 11, 5, 0, 7);
          x.fill();
          x.fillStyle = "#fff";
          x.beginPath();
          x.arc(6.5, 7, 2, 0, 7);
          x.arc(11.5, 7, 2, 0, 7);
          x.fill();
          x.fillStyle = "#101010";
          x.fillRect(6, 6.5, 1.4, 1.4);
          x.fillRect(11, 6.5, 1.4, 1.4);
        },
        make: (at) => ({
          t: "enemy",
          p: [at.x, at.y + 0.5, at.z],
          range: 5,
          speed: 3.4,
          foe: "hopper",
        }),
      },
      {
        label: "floater (spin)",
        icon: (x) => {
          x.strokeStyle = "#6c4ad0";
          x.lineWidth = 1.5;
          x.beginPath();
          x.ellipse(9, 9, 7, 3, 0, 0, 7);
          x.stroke();
          x.fillStyle = "#9a6cff";
          x.beginPath();
          x.moveTo(9, 5);
          x.lineTo(12, 9);
          x.lineTo(9, 13);
          x.lineTo(6, 9);
          x.fill();
          x.fillStyle = "#ffe27a";
          x.fillRect(8, 8, 2, 2);
        },
        make: (at) => ({
          t: "enemy",
          p: [at.x, at.y + 0.5, at.z],
          range: 5,
          speed: 3,
          foe: "floater",
        }),
      },
      {
        label: "sentry",
        icon: (x) => {
          x.fillStyle = "#4c525e";
          x.fillRect(5, 12, 8, 4);
          x.fillStyle = "#8a3a3a";
          x.fillRect(6, 6, 6, 6);
          x.fillStyle = "#33373f";
          x.fillRect(11, 8, 5, 2);
          x.fillStyle = "#ff6a3a";
          x.fillRect(8, 8, 2, 2);
        },
        make: (at) => ({
          t: "enemy",
          p: [at.x, at.y + 0.5, at.z],
          range: 0,
          speed: 0,
          foe: "sentry",
        }),
      },
      {
        label: "spinner",
        icon: (x) => {
          x.strokeStyle = "#d8dde2";
          x.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2 + 0.4;
            x.beginPath();
            x.moveTo(9, 9);
            x.lineTo(9 + Math.cos(a) * 7, 9 + Math.sin(a) * 7);
            x.stroke();
          }
          x.fillStyle = "#b08a2a";
          x.beginPath();
          x.arc(9, 9, 2.5, 0, 7);
          x.fill();
        },
        make: (at) => ({
          t: "enemy",
          p: [at.x, at.y + 0.5, at.z],
          range: 0,
          speed: 0,
          foe: "spinner",
        }),
      },
      {
        label: "Grindosaurus",
        icon: (x) => {
          x.fillStyle = "#4f9a56";
          x.fillRect(2, 6, 14, 8);
          x.strokeStyle = "#d8dde2";
          x.lineWidth = 2;
          x.beginPath();
          x.moveTo(2, 5);
          x.lineTo(16, 5);
          x.stroke();
        },
        make: (at) => ({
          t: "grindosaurus",
          p: [at.x, at.y, at.z],
          range: 4,
          speed: 1.5,
          coverage: 0.65,
          yaw: 0,
        }),
      },
      {
        label: "Angry Ball",
        icon: (x) => {
          x.fillStyle = "#d83d2a";
          x.beginPath();
          x.arc(9, 9, 6, 0, 7);
          x.fill();
          glyph(x, "•", "#fff099");
        },
        make: (at) => ({
          t: "angryball",
          p: [at.x, at.y, at.z],
          w: 3,
          rise: 4.6,
          radius: 0.8,
          range: 12,
          speed: 7,
          yaw: 0,
        }),
      },
    ],
  },
  {
    title: "HAZARDS & THINGS",
    items: [
      {
        label: "crusher",
        icon: (x) => {
          x.fillStyle = "#8f8f98";
          x.fillRect(3, 2, 12, 7);
          glyph(x, "↓", "#2a2a30");
        },
        make: (at) => ({
          t: "crusher",
          p: [at.x, at.y, at.z],
          s: [4, 3, 3],
          cycle: 3.2,
          phase: 0,
        }),
      },
      {
        label: "boulder",
        icon: (x) => {
          x.fillStyle = "#a08a70";
          x.beginPath();
          x.arc(9, 8, 5, 0, Math.PI * 2);
          x.fill();
          glyph(x, "↕", "#3a2f26");
        },
        make: (at) => ({
          t: "stone",
          p: [at.x, at.y, at.z],
          range: 20,
          speed: 6,
          radius: 0.9,
        }),
      },
      {
        label: "pendulum",
        icon: (x) => {
          x.strokeStyle = "#6a7078";
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(9, 2);
          x.lineTo(13, 11);
          x.stroke();
          x.fillStyle = "#565c66";
          x.beginPath();
          x.arc(13.5, 13, 3, 0, 7);
          x.fill();
        },
        make: (at) => ({
          t: "pendulum",
          p: [at.x, at.y + 7, at.z],
          len: 5,
          amp: 1.0,
          speed: 1.6,
          phase: 0,
        }),
      },
      {
        label: "trampoline pad",
        icon: (x) => {
          box(x, "#ff8a2b", "#7b2e00");
          glyph(x, "↑", "#fff2c7");
        },
        make: (at) => ({
          t: "trampoline",
          p: [at.x, at.y + 0.45, at.z],
          s: [5, 0.45, 5],
          speed: 16,
          amp: 1.25,
        }),
      },
      {
        label: "speed pad",
        icon: (x) => {
          box(x, "#2bdfff", "#07546a");
          glyph(x, "»", "#ffffff");
        },
        make: (at) => ({
          t: "speedpad",
          p: [at.x, at.y + 0.3, at.z],
          s: [4, 0.3, 5],
          speed: 48,
          cycle: 3.9,
        }),
      },
      {
        label: "trick gate",
        icon: (x) => {
          x.strokeStyle = "#54dfff";
          x.lineWidth = 3;
          x.beginPath();
          x.arc(9, 9, 6, 0, 7);
          x.stroke();
          glyph(x, "F", "#ff75a6");
        },
        make: (at) => ({
          t: "trickgate",
          p: [at.x, at.y + 3, at.z],
          s: [12, 8, 0.6],
          trick: "kick",
          radius: 2.2,
        }),
      },
      {
        label: "trick rail",
        icon: (x) => {
          x.strokeStyle = "rgba(84,223,255,0.45)";
          x.lineWidth = 2.5;
          x.beginPath();
          x.moveTo(2, 7);
          x.lineTo(16, 7);
          x.stroke();
          glyph(x, "F", "#ff75a6");
        },
        make: (at) => ({
          t: "trickrail",
          p: [at.x, at.y + 1, at.z],
          len: 12,
          yaw: 0,
          trick: "kick",
        }),
      },
      {
        label: "return portal",
        icon: (x) => {
          x.strokeStyle = "#9f72ff";
          x.lineWidth = 3;
          x.beginPath();
          x.ellipse(9, 9, 5.5, 7, 0, 0, 7);
          x.stroke();
          glyph(x, "↪", "#efe8ff");
        },
        make: (at) => ({
          t: "returnportal",
          p: [at.x, at.y, at.z],
          s: [3, 4, 1.2],
          to: [at.x, at.y, at.z + 12],
          exitYaw: 180,
          airOnly: false,
        }),
      },
      {
        label: "wumpa",
        icon: (x) => {
          x.fillStyle = "#ff9028";
          x.beginPath();
          x.arc(9, 10, 5, 0, 7);
          x.fill();
          x.fillStyle = "#3a9a4a";
          x.fillRect(8, 3, 2, 3);
        },
        make: (at) => ({ t: "wumpa", p: [at.x, at.y + 1.2, at.z] }),
      },
      {
        label: "crystal",
        icon: (x) => {
          x.fillStyle = "#c83af0";
          x.beginPath();
          x.moveTo(9, 2);
          x.lineTo(14, 9);
          x.lineTo(9, 16);
          x.lineTo(4, 9);
          x.closePath();
          x.fill();
        },
        make: (at) => ({ t: "crystal", p: [at.x, at.y + 0.5, at.z] }),
      },
      {
        label: "finish gate",
        icon: (x) => {
          x.fillStyle = "#d8d8d8";
          x.fillRect(3, 4, 2, 12);
          x.fillRect(13, 4, 2, 12);
          for (let i = 0; i < 4; i++) {
            x.fillStyle = i % 2 === 0 ? "#e8e8e8" : "#20242c";
            x.fillRect(5 + i * 2, 4, 2, 3);
          }
        },
        make: (at) => ({ t: "gate", p: [at.x, at.y, at.z] }),
      },
      {
        label: "tt clock",
        icon: (x) => {
          x.fillStyle = "#e8b53a";
          x.fillRect(8, 2, 2, 3);
          x.beginPath();
          x.arc(9, 10, 6, 0, 7);
          x.fill();
          x.fillStyle = "#f4efdf";
          x.beginPath();
          x.arc(9, 10, 4.2, 0, 7);
          x.fill();
          x.strokeStyle = "#3a3020";
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(9, 10);
          x.lineTo(9, 7);
          x.moveTo(9, 10);
          x.lineTo(12, 10);
          x.stroke();
        },
        make: (at) => ({ t: "clock", p: [at.x, at.y, at.z] }),
      },
      {
        label: "combo orb",
        icon: (x) => {
          x.fillStyle = "rgba(70,232,130,0.4)";
          x.fillRect(6, 2, 6, 15);
          x.fillRect(2, 7, 15, 6);
          x.fillStyle = "#46e882";
          x.fillRect(7, 3, 4, 13);
          x.fillRect(3, 8, 13, 4);
        },
        make: (at) => ({ t: "comboorb", p: [at.x, at.y, at.z] }),
      },
    ],
  },
  {
    title: "SCENERY",
    // Built straight off DECOR_KINDS, so a prop added to the game shows up in
    // the add panel the same day. Defaults match what the hand-coded levels
    // plant, so dropping one in looks like the ones already there.
    items: DECOR_KINDS.map((k) => ({
      label: DECOR_LABELS[k],
      icon: DECOR_ICONS[k],
      make: (at: { x: number; y: number; z: number }) => ({
        t: "decor" as const,
        dkind: k,
        p: [at.x, at.y, at.z] as [number, number, number],
        ...DECOR_DEFAULTS[k],
      }),
    })),
  },
];

const CRATE_KINDS = [
  "wood",
  "bouncy",
  "metalbounce",
  "metal",
  "nitro",
  "tnt",
  "mask",
  "mystery",
  "bang",
  "nitrobang",
] as const;

// enemy variants + a one-line hint on how each is beaten, shown in the dropdown
const FOE_KINDS: { k: EnemyKind; label: string }[] = [
  { k: "grunt", label: "grunt — any attack" },
  { k: "spiker", label: "spiker — SPIN only (spikes)" },
  { k: "turtle", label: "turtle — STOMP only (shell)" },
  { k: "charger", label: "charger — bull, invincible mid-dash" },
  { k: "hopper", label: "hopper — leaps; stomp when grounded" },
  { k: "floater", label: "floater — flies; SPIN it down" },
  { k: "sentry", label: "sentry — turret, fires orbs" },
  { k: "spinner", label: "spinner — hit it when blades retract" },
];

// components that grow draggable resize handles on double-click
const RESIZABLE = new Set([
  "platform",
  "rock",
  "wall",
  "wallpath",
  "pit",
  "crumble",
  "crusher",
  "mover",
  "phasepad",
  "ramp",
  "rail",
  "trickrail",
  "rope",
  "zone",
  "vertramp",
  "enemy",
  "pendulum",
  "ropeswing",
  "trampoline",
  "speedpad",
  "trickgate",
  "returnportal",
  "woodpath",
]);

// A resize handle: lives at `pos`, drags along `dir` (world space, outward),
// and `apply` rewrites the component from its grab-time snapshot given the
// travel distance — pure from `orig`, so re-applying while dragging is stable.
interface HandleDef {
  pos: THREE.Vector3;
  dir: THREE.Vector3;
  apply?: (orig: CustomComponent, c: CustomComponent, d: number) => void;
  vtx?: number; // polygon vertex index: drags on the ground plane instead of an axis
}
// A group-scale gizmo handle: sits at a normalized spot on the selection's
// bounding box (0=min, 0.5=center, 1=max per axis) and scales the axes in `ax`
// about the OPPOSITE side. Corners scale X+Z (proportional by default, Shift =
// free); edges scale one ground axis; the top handle scales Y off the floor.
interface GizmoHandle {
  nx: number;
  ny: number;
  nz: number;
  ax: ("x" | "y" | "z")[];
  corner: boolean;
}
const GIZMO_HANDLES: GizmoHandle[] = [
  // ground corners (scale width + depth)
  { nx: 0, ny: 0, nz: 0, ax: ["x", "z"], corner: true },
  { nx: 1, ny: 0, nz: 0, ax: ["x", "z"], corner: true },
  { nx: 0, ny: 0, nz: 1, ax: ["x", "z"], corner: true },
  { nx: 1, ny: 0, nz: 1, ax: ["x", "z"], corner: true },
  // ground edges (single axis)
  { nx: 0.5, ny: 0, nz: 0, ax: ["z"], corner: false },
  { nx: 0.5, ny: 0, nz: 1, ax: ["z"], corner: false },
  { nx: 0, ny: 0, nz: 0.5, ax: ["x"], corner: false },
  { nx: 1, ny: 0, nz: 0.5, ax: ["x"], corner: false },
  // top (height)
  { nx: 0.5, ny: 1, nz: 0.5, ax: ["y"], corner: false },
];
const HANDLE_GEO = new THREE.BoxGeometry(0.55, 0.55, 0.55);
// invisible fat hit-sphere around every handle: click targets stay forgiving
// even when the visible box is a few pixels at distance
const HANDLE_HIT_GEO = new THREE.SphereGeometry(1.0, 8, 6);
const NODE_COLOR = 0xffd75e; // resting node
const NODE_SEL_COLOR = 0x4da6ff; // selected node (Figma blue)

// MOVE GIZMO (Maya-style translate manipulator): one arrow per world axis plus
// a centre box for free movement. Drag an arrow and the piece travels on that
// axis and nothing else, which is the only way to nudge depth in a 3D view
// without the camera fighting you. Held Shift snaps to whole units.
const MOVE_AXES = [
  { ax: "x" as const, dir: new THREE.Vector3(1, 0, 0), color: 0xff5566 },
  { ax: "y" as const, dir: new THREE.Vector3(0, 1, 0), color: 0x62dd62 },
  { ax: "z" as const, dir: new THREE.Vector3(0, 0, 1), color: 0x4d95ff },
];
const MOVE_SHAFT_GEO = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
MOVE_SHAFT_GEO.translate(0, 0.5, 0); // grow from the origin, not about it
const MOVE_TIP_GEO = new THREE.ConeGeometry(0.11, 0.3, 12);
MOVE_TIP_GEO.translate(0, 1.15, 0);
const MOVE_HIT_GEO = new THREE.CylinderGeometry(0.19, 0.19, 1.3, 6);
MOVE_HIT_GEO.translate(0, 0.65, 0);
const MOVE_CENTRE_GEO = new THREE.BoxGeometry(0.17, 0.17, 0.17);
const MOVE_CENTRE_HIT_GEO = new THREE.BoxGeometry(0.34, 0.34, 0.34);
const MOVE_GIZMO_PX = 96; // on-screen length of an arrow, held constant with distance

// grid rounding + structural copies, used all over the editor
const snapHalf = (v: number): number => Math.round(v * 2) / 2;
const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * Horizontal affine-scale metrics for a path authored as relative X/Z knots.
 *
 * A wood path rebuilds every cross-section perpendicular to its transformed
 * centreline. Under a non-uniform world scale, simply scaling that width by
 * `(sx + sz) / 2` is wrong: a diagonal path would grow too wide because the
 * transformed old normal also contains a component along the new tangent.
 * Projecting it onto the new normal gives, on a smooth unbanked segment,
 *
 *     widthScale = det(scale) / |scale * unitTangent|.
 *
 * Linear knots use the outgoing segment (the last knot uses the incoming one),
 * exactly like buildWoodPath's segment selection. Spline knots use the same
 * centripetal Catmull-Rom and parameter-space tangents as the runtime. Arc
 * length is measured from the same runtime-density samples in either mode.
 */
function pathScaleMetrics(
  pts: NonNullable<CustomComponent["pts"]>,
  curve: CustomComponent["curve"],
  sx: number,
  sy: number,
  sz: number,
  closed = false,
): { normalAt: number[]; lengthScale: number } {
  const EPS = 1e-8;
  const knotsAt = (
    scaleX: number,
    scaleY: number,
    scaleZ: number,
  ): THREE.Vector3[] =>
    pts.map(
      (point) =>
        new THREE.Vector3(
          point[0] * scaleX,
          (point[3] ?? 0) * scaleY,
          point[1] * scaleZ,
        ),
    );
  const fallbackTangent = (
    knots: THREE.Vector3[],
    index: number,
  ): THREE.Vector3 => {
    if (closed && knots.length > 2) {
      for (let offset = 1; offset < knots.length; offset++) {
        const before = knots[(index - offset + knots.length) % knots.length];
        const after = knots[(index + offset) % knots.length];
        const tangent = after.clone().sub(before);
        if (tangent.lengthSq() > EPS * EPS) return tangent.normalize();
      }
    }
    // Linear runtime frames choose the outgoing segment at every knot except
    // the last. Skip zero-length duplicates without changing that direction.
    for (let after = index + 1; after < knots.length; after++) {
      const tangent = knots[after].clone().sub(knots[index]);
      if (tangent.lengthSq() > EPS * EPS) return tangent.normalize();
    }
    for (let before = index - 1; before >= 0; before--) {
      const tangent = knots[index].clone().sub(knots[before]);
      if (tangent.lengthSq() > EPS * EPS) return tangent.normalize();
    }
    return new THREE.Vector3(0, 0, -1);
  };
  const splineFor = (knots: THREE.Vector3[]): THREE.CatmullRomCurve3 | null =>
    curve === "spline" && knots.length >= 3
      ? new THREE.CatmullRomCurve3(knots, closed, "centripetal", 0.35)
      : null;
  const tangentsAt = (knots: THREE.Vector3[]): THREE.Vector3[] => {
    const spline = splineFor(knots);
    if (!spline) return knots.map((_, index) => fallbackTangent(knots, index));
    return knots.map((_, index) => {
      const tangent = spline.getTangent(index / (closed ? knots.length : knots.length - 1));
      return tangent.lengthSq() > EPS * EPS
        ? tangent.normalize()
        : fallbackTangent(knots, index);
    });
  };
  const sampledArc = (knots: THREE.Vector3[]): number => {
    let polyLength = 0;
    for (let index = 1; index < knots.length; index++)
      polyLength += knots[index].distanceTo(knots[index - 1]);
    if (closed && knots.length > 2)
      polyLength += knots[0].distanceTo(knots[knots.length - 1]);
    if (polyLength <= EPS) return 0;
    const sampleCount = THREE.MathUtils.clamp(
      Math.ceil(polyLength / 0.65),
      2,
      8192,
    );
    const spline = splineFor(knots);
    let previous: THREE.Vector3 | null = null;
    let arc = 0;
    for (let index = 0; index <= sampleCount; index++) {
      const t = index / sampleCount;
      let center: THREE.Vector3;
      if (spline) center = spline.getPoint(t);
      else {
        const segmentCount = closed ? knots.length : knots.length - 1;
        const knotF = t * segmentCount;
        const segment = Math.min(segmentCount - 1, Math.floor(knotF));
        const local = Math.min(1, knotF - segment);
        center = knots[segment].clone().lerp(knots[(segment + 1) % knots.length], local);
      }
      if (previous) arc += center.distanceTo(previous);
      previous = center;
    }
    return arc;
  };

  const rightAt = (forward: THREE.Vector3, bank: number): THREE.Vector3 => {
    const stableForward = forward.clone();
    // Match buildWoodPath's near-vertical guard so the editor and runtime pick
    // the same stable horizontal side axis.
    if (Math.abs(stableForward.y) > 0.98) stableForward.z += 0.02;
    stableForward.normalize();
    const flatRight = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), stableForward)
      .normalize();
    const flatUp = new THREE.Vector3()
      .crossVectors(stableForward, flatRight)
      .normalize();
    return flatRight
      .multiplyScalar(Math.cos(bank))
      .addScaledVector(flatUp, Math.sin(bank))
      .normalize();
  };

  const sourceKnots = knotsAt(1, 1, 1);
  const transformedKnots = knotsAt(sx, sy, sz);
  const sourceTangents = tangentsAt(sourceKnots);
  const transformedTangents = tangentsAt(transformedKnots);
  const normalAt = pts.map((_, index) => {
    const bank = THREE.MathUtils.degToRad(pts[index][4] ?? 0);
    const sourceRight = rightAt(sourceTangents[index], bank);
    const rebuiltRight = rightAt(transformedTangents[index], bank);
    // Project the affine transform of the original banked right vector onto
    // the right vector the transformed procedural path will actually rebuild;
    // discard tangent/up shear that a scalar per-knot width cannot represent.
    const scaledRight = sourceRight.multiply(
      new THREE.Vector3(sx, sy, sz),
    );
    return Math.abs(scaledRight.dot(rebuiltRight));
  });

  const sourceLength = sampledArc(sourceKnots);
  const transformedLength = sampledArc(transformedKnots);
  return {
    normalAt,
    lengthScale:
      sourceLength > EPS
        ? transformedLength / sourceLength
        : (Math.abs(sx) + Math.abs(sz)) / 2,
  };
}

export class Editor {
  active = false;
  targetId = DEFAULT_LEVEL_ID; // the user level this session edits
  private targetName = ""; // its menu name — what the rename field shows
  private initialTargetId = DEFAULT_LEVEL_ID;
  private initialJson = "";
  private pristineBuiltin = false;
  private registryChanged = false;
  private forkOnFirstCommit = false;
  private forkedLevelId: string | null = null;
  private nameInput: HTMLInputElement | null = null;
  private skySelect: HTMLSelectElement | null = null;
  private resetBtn: HTMLButtonElement | null = null;
  private delBtn: HTMLButtonElement | null = null;
  data: CustomLevelData;
  // SELECTION is an ordered set of component indices; the LAST one is the
  // primary (it drives the props panel, snapping, and align actions).
  private sel: number[] = [];
  private camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;
  private scene: THREE.Scene;
  private getLevel: () => Level;
  private hooks: Hooks;
  private controls: OrbitControls | null = null;
  private playCamera: {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    fov: number;
    zoom: number;
    near: number;
    far: number;
    aspect: number;
  } | null = null;
  // double-click a layer row -> glide the camera to that piece (see focusOnBox)
  private focusAnim: {
    fromP: THREE.Vector3;
    toP: THREE.Vector3;
    fromT: THREE.Vector3;
    toT: THREE.Vector3;
    start: number;
  } | null = null;
  private panel!: HTMLElement;
  private propsEl!: HTMLElement;
  // right-panel tabs: selection vs project (level/file/help)
  private selPane: HTMLElement | null = null;
  private projPane: HTMLElement | null = null;
  private tabSelBtn: HTMLButtonElement | null = null;
  private tabProjBtn: HTMLButtonElement | null = null;
  private panelTab: "sel" | "proj" = "sel";
  private raycaster = new THREE.Raycaster();
  // 2D work views: X/Y/Z lock the camera flat down an axis (pan/zoom only)
  // and drags move in the two visible axes; '3d' is the free orbit view.
  private viewMode: "3d" | "x" | "y" | "z" = "3d";
  private saved3D: { p: THREE.Vector3; t: THREE.Vector3; fov: number } | null =
    null;
  private viewBtns: Partial<Record<"x" | "y" | "z" | "3d", HTMLButtonElement>> =
    {};
  private pointer = new THREE.Vector2();
  private selBoxes: THREE.Box3Helper[] = [];
  private spawnMarker: THREE.Group | null = null;
  private snap = true;
  // drag state — a grab on any selected component moves the WHOLE selection
  private dragging = false;
  private dragPlane = new THREE.Plane();
  private dragStart = new THREE.Vector3(); // plane hit at drag start
  private dragOrig: [number, number, number] = [0, 0, 0]; // grabbed comp at drag start
  private dragSel: { idx: number; p: [number, number, number] }[] = [];
  private dragAddedFrom: number | null = null;
  private dragGroupsBefore: CustomGroup[] | null = null;
  private dragSourceJson: string | null = null;
  private dragSelectionBefore: number[] | null = null;
  private downAt: { x: number; y: number } | null = null;
  // marquee (shift-drag on empty space): screen-space rubber band
  private marquee: { x0: number; y0: number; x1: number; y1: number } | null =
    null;
  private marqueeEl: HTMLDivElement | null = null;
  // copy/paste — survives entering/leaving the editor within a session
  private clipboard: CustomComponent[] = [];
  private pasteBump = 0;
  private lastPasteKey = "";
  private hoverAt = 0;
  // nudge coalescing: a burst of arrow taps is ONE undo step
  private lastCoalesce = "";
  private lastCommitT = 0;
  // outliner (the layers pop-out): every component is a row, groups are
  // expandable nodes. Locks live per component (lk) — locked = untouchable.
  private layersEl: HTMLElement | null = null;
  private closedGroups = new Set<number>(); // collapsed outliner nodes
  private renaming: { kind: "group" | "item"; id: number } | null = null;
  private marqueeAdd = false; // shift-marquee adds; plain marquee replaces
  private marqueeNodes = false; // node mode: the sweep selects NODES of the edited shape
  private camSaveAt = 0;
  private cameraDirty = false;
  private cancelScrub: (() => void) | null = null;
  // PEN TOOL: click-to-draw polygon platforms / pits / walls
  private drawing: {
    t:
      | "platform"
      | "pit"
      | "wall"
      | "wallpath"
      | "rail"
      | "vertramp"
      | "terrain"
      | "woodpath";
    y: number;
    pts: THREE.Vector3[];
  } | null = null;
  private selVtxs = new Set<number>(); // nodes picked in resize mode (shift/cmd adds, marquee sweeps) — props batch-edit their shared values
  private drawVis: THREE.Group | null = null;
  // pop-out side panels (item picker / layers) + view cluster + space-pan
  private popWrap: HTMLElement | null = null;
  private popAdd: HTMLElement | null = null;
  private popLayers: HTMLElement | null = null;
  private tabAdd: HTMLButtonElement | null = null;
  private tabLayers: HTMLButtonElement | null = null;
  private spaceHeld = false;
  // resize-handle state (enter by double-clicking a component)
  private resizeIdx = -1;
  private hdlDefs: HandleDef[] = [];
  private handleGroup: THREE.Group | null = null;
  private handleMeshes: THREE.Mesh[] = []; // visible boxes, one per handle def
  private handleHits: THREE.Mesh[] = []; // invisible fat twins: the forgiving click targets
  private hdlDrag: {
    i: number;
    lineO: THREE.Vector3;
    lineD: THREE.Vector3;
    t0: number;
    orig: CustomComponent;
    source?: CustomComponent; // sparse pre-drag form, used when a gesture cancels
    vtx?: number; // polygon vertex drag: uses `plane` instead of the axis line
    plane?: THREE.Plane;
  } | null = null;
  private lastLiveRebuild = 0;
  private resizeHintShown = false;
  private scaleProp = false; // group-size fields link all axes when ON
  private gizmoHintShown = false;
  // SURFACE SNAP: plain drags rest the grabbed piece on the real geometry
  // under the cursor (raycast), resolving the 2D→3D depth ambiguity. Off =
  // the old fixed-Y ground-plane drag. Persisted per browser.
  private surfaceSnap = localStorage.getItem("solProtoEdSurfaceSnap") !== "0";
  private dragBottomOffset = 0; // grab-time distance from the grabbed piece's origin down to its base
  // group-scale gizmo (multi-selection bounding-box handles)
  // ---- move gizmo ----
  private moveGroup: THREE.Group | null = null;
  private moveParts: { hit: THREE.Mesh; ax: "x" | "y" | "z" | "c" }[] = [];
  private moveDrag: {
    ax: "x" | "y" | "z" | "c";
    plane: THREE.Plane;
    grab: THREE.Vector3;
    dir: THREE.Vector3;
    orig: { idx: number; p: [number, number, number] }[];
  } | null = null;
  private gizmoGroup: THREE.Group | null = null;
  private gizmoHandles: {
    mesh: THREE.Mesh;
    hit: THREE.Mesh;
    def: GizmoHandle;
  }[] = [];
  private gizmoDrag: {
    def: GizmoHandle;
    anchor: THREE.Vector3;
    ext0: THREE.Vector3; // grab-time box extents (max - min)
    orig: Map<number, CustomComponent>; // snapshot of the selected components
    plane: THREE.Plane;
    grab: THREE.Vector3; // pointer position on the plane at grab
    min0: THREE.Vector3; // grab-time box min
  } | null = null;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    dom: HTMLElement,
    getLevel: () => Level,
    hooks: Hooks,
  ) {
    this.scene = scene;
    this.camera = camera;
    this.dom = dom;
    this.getLevel = getLevel;
    this.hooks = hooks;
    this.data = starterCustomLevel(); // placeholder; enter() loads the real one
    this.buildPanel();
    dom.addEventListener("pointerdown", this.onDown);
    dom.addEventListener("pointermove", this.onMove);
    dom.addEventListener("pointerup", this.onUp);
    dom.addEventListener("pointercancel", this.onPointerCancel);
    dom.addEventListener("lostpointercapture", this.onPointerCancel);
    dom.addEventListener("dblclick", this.onDbl);
    // any manual camera move (orbit/pan on any button, or wheel zoom) cancels a
    // running layer-focus glide so the user is never fighting it
    dom.addEventListener("pointerdown", (event) => {
      this.focusAnim = null;
      if (this.active && (event.button !== 0 || this.spaceHeld))
        this.cameraDirty = true;
    });
    dom.addEventListener("wheel", () => {
      this.focusAnim = null;
      if (this.active) this.cameraDirty = true;
    }, {
      passive: true,
    });
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onPointerCancel);
  }

  enter(target: LevelEntry, initialData?: CustomLevelData): void {
    if (this.active) return;
    this.active = true;
    this.targetId = target.id;
    this.targetName = target.name;
    if (this.nameInput) this.nameInput.value = target.name;
    localStorage.setItem("solProtoEditorTarget", target.id); // refresh lands on the same level
    this.data = migrateCustomLevel(
      deepClone(initialData ?? getEditData(target.id)),
    );
    this.initialTargetId = target.id;
    this.initialJson = JSON.stringify(this.data);
    this.pristineBuiltin = isBuiltin(target.id) && !isOverridden(target.id);
    this.registryChanged = false;
    this.forkOnFirstCommit = isBuiltin(target.id) && target.data === undefined;
    this.forkedLevelId = null;
    this.closedGroups.clear();
    this.syncSkySelect();
    this.syncFileButtons();
    // fresh history per target: switching levels must not undo across them
    this.lastCommitted = JSON.stringify(this.data);
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.lastCoalesce = "";
    this.lastCommitT = 0;
    this.playCamera = {
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      fov: this.camera.fov,
      zoom: this.camera.zoom,
      near: this.camera.near,
      far: this.camera.far,
      aspect: this.camera.aspect,
    };
    const width = Math.max(1, this.dom.clientWidth);
    const height = Math.max(1, this.dom.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.controls = new OrbitControls(this.camera, this.dom);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    // FIGMA pointer rules: LEFT is for selecting and moving things (marquee
    // on empty space) — never the camera. Orbit = right-drag, pan = middle
    // or space-drag, zoom = wheel.
    this.controls.mouseButtons.LEFT = -1 as unknown as THREE.MOUSE;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    // refresh-proof: come back exactly where you were looking
    let restored = false;
    try {
      const cam = JSON.parse(
        localStorage.getItem(`solProtoEditorCam:${target.id}`) ??
          localStorage.getItem("solProtoEditorCam") ??
          "null",
      ) as {
        p: number[];
        t: number[];
      } | null;
      if (cam && cam.p?.length === 3 && cam.t?.length === 3) {
        this.camera.position.set(cam.p[0], cam.p[1], cam.p[2]);
        this.controls.target.set(cam.t[0], cam.t[1], cam.t[2]);
        restored = true;
      }
    } catch {
      /* fresh view below */
    }
    if (!restored) {
      this.controls.target.set(
        this.data.spawn[0],
        this.data.spawn[1],
        this.data.spawn[2] - 6,
      );
      this.camera.position.set(
        this.data.spawn[0] + 16,
        this.data.spawn[1] + 26,
        this.data.spawn[2] + 26,
      );
    }
    this.cameraDirty = false;
    localStorage.setItem("solProtoEditorOpen", "1"); // refresh lands back in the editor
    document.body.classList.add("ed-active"); // hides the play HUD under the tools
    this.panel.style.display = "block";
    if (this.popWrap) this.popWrap.style.display = "block";
    this.setPop(
      (localStorage.getItem(`solProtoEditorPop:${target.id}`) as
        | "add"
        | "layers"
        | "") ??
        "add",
      false,
    );
    this.select(-1);
    this.renderLayers();
    this.refreshSpawnMarker();
    this.setGhostsVisible(true);
    this.hooks.setView(true); // no fog, far plane pushed out — see the whole level
    this.hooks.showMsg(
      `EDITING: ${target.name.toUpperCase()}`,
      "drag = select & move · RIGHT-drag = orbit · space = pan",
    );
  }

  /** Exact in-memory source for editor rebuilds, including uncommitted drags. */
  workingEntry(): LevelEntry | null {
    if (!this.active) return null;
    return {
      id: this.targetId,
      name: this.targetName,
      data: this.data,
    };
  }

  /** Keep the play-camera snapshot current when the viewport changes mid-edit. */
  syncPlayAspect(aspect: number): void {
    if (
      this.active &&
      this.playCamera &&
      Number.isFinite(aspect) &&
      aspect > 0
    )
      this.playCamera.aspect = aspect;
  }

  get changedThisSession(): boolean {
    return (
      this.registryChanged ||
      this.targetId !== this.initialTargetId ||
      this.lastCommitted !== this.initialJson
    );
  }

  private forkHandBuiltDraft(): boolean {
    const originalName = findLevel(this.initialTargetId)?.name ?? this.targetName;
    const forkName =
      this.data.name && this.data.name !== originalName
        ? this.data.name
        : `${originalName} edit`;
    this.data.name = forkName;
    const id = saveUserLevel({ id: "", name: forkName, data: this.data });
    this.targetId = id;
    this.targetName = findLevel(id)?.name ?? forkName;
    this.forkedLevelId = id;
    this.forkOnFirstCommit = false;
    this.registryChanged = true;
    localStorage.setItem("solProtoEditorTarget", id);
    if (this.nameInput) this.nameInput.value = this.targetName;
    this.syncFileButtons();
    this.hooks.levelsChanged(id);
    this.hooks.showMsg(
      "EDITABLE COPY CREATED",
      `${originalName} stays untouched · now editing ${this.targetName}`,
    );
    return userLevelStorageHealthy();
  }

  private rollbackActiveGesture(rebuildPreview = false): boolean {
    const before = JSON.stringify(this.data);
    const hadGesture =
      this.moveDrag !== null ||
      this.gizmoDrag !== null ||
      this.hdlDrag !== null ||
      this.dragging;
    for (const original of this.moveDrag?.orig ?? []) {
      const component = this.data.components[original.idx];
      if (component) component.p = [...original.p];
    }
    if (this.gizmoDrag)
      for (const [idx, original] of this.gizmoDrag.orig)
        this.data.components[idx] = deepClone(original);
    if (this.hdlDrag && this.resizeIdx >= 0)
      this.data.components[this.resizeIdx] = deepClone(
        this.hdlDrag.source ?? this.hdlDrag.orig,
      );
    if (this.dragging)
      for (const original of this.dragSel) {
        const component = this.data.components[original.idx];
        if (component) component.p = [...original.p];
      }
    if (this.dragAddedFrom !== null) {
      this.data.components.splice(this.dragAddedFrom);
      if (this.dragGroupsBefore)
        this.data.groups = deepClone(this.dragGroupsBefore);
    }
    if (this.dragSourceJson)
      this.data = migrateCustomLevel(
        JSON.parse(this.dragSourceJson) as CustomLevelData,
      );
    if (this.dragSelectionBefore)
      this.sel = this.dragSelectionBefore.filter(
        (index) => index >= 0 && index < this.data.components.length,
      );
    this.moveDrag = null;
    this.gizmoDrag = null;
    this.hdlDrag = null;
    this.dragging = false;
    this.dragSel = [];
    this.dragAddedFrom = null;
    this.dragGroupsBefore = null;
    this.dragSourceJson = null;
    this.dragSelectionBefore = null;
    this.downAt = null;
    this.marquee = null;
    this.hideMarquee();
    this.spaceHeld = false;
    if (this.controls) {
      this.controls.enabled = true;
      this.controls.mouseButtons.LEFT = -1 as unknown as THREE.MOUSE;
    }
    if (hadGesture) {
      this.refreshSelectionBox();
      this.refreshHandles();
      this.renderProps();
    }
    if (rebuildPreview && before !== JSON.stringify(this.data))
      this.hooks.resetPreview();
    return hadGesture;
  }

  private onPointerCancel = (): void => {
    if (!this.active) return;
    this.cancelScrub?.();
    this.rollbackActiveGesture(true);
  };

  exit(): void {
    if (!this.active) return;
    this.cancelScrub?.();
    const focused = document.activeElement as HTMLElement | null;
    if (focused && this.panel.contains(focused)) focused.blur();
    // Never leave the build mode stuck on: whoever closes the editor, the
    // next level built goes back to baked scenery. The paths that stay on
    // THIS level rebuild it themselves (see main.ts).
    setEditorBuild(false);
    this.to3D(); // a 2D work view must not leak its long-lens camera into play
    if (this.cameraDirty) this.saveCam(); // only user camera work is persistent
    // A lost pointerup/tab switch is cancellation, not a partial hidden edit.
    this.rollbackActiveGesture(false);
    if (this.playCamera) {
      const saved = this.playCamera;
      this.camera.position.copy(saved.position);
      this.camera.quaternion.copy(saved.quaternion);
      this.camera.fov = saved.fov;
      this.camera.zoom = saved.zoom;
      this.camera.near = saved.near;
      this.camera.far = saved.far;
      this.camera.aspect = saved.aspect;
      this.camera.updateProjectionMatrix();
      this.playCamera = null;
    }
    this.active = false;
    this.hooks.setView(false, this.changedThisSession); // exact restore on no-op; apply committed atmosphere changes
    localStorage.removeItem("solProtoEditorOpen");
    localStorage.removeItem("solProtoEditorTarget");
    this.controls?.dispose();
    this.controls = null;
    document.body.classList.remove("ed-active");
    this.panel.style.display = "none";
    if (this.popWrap) this.popWrap.style.display = "none";
    this.select(-1);
    this.cancelDraw();
    this.marquee = null;
    this.hideMarquee();
    this.dragging = false;
    this.dragSel = [];
    this.moveDrag = null;
    this.hdlDrag = null;
    this.downAt = null;
    this.focusAnim = null;
    this.spaceHeld = false;
    this.dom.style.cursor = "";
    this.gizmoDrag = null;
    this.teardownGizmo();
    this.setGhostsVisible(false);
    if (this.spawnMarker) {
      this.removeHelper(this.spawnMarker);
      this.spawnMarker = null;
    }
  }

  update(): void {
    // layer-focus glide: ease the camera + orbit target toward the framed piece.
    // Set both before controls.update() so OrbitControls keeps the new pose.
    if (this.focusAnim && this.controls) {
      const a = this.focusAnim;
      const t = Math.min(1, (performance.now() - a.start) / 340);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2; // easeInOutQuad
      this.camera.position.lerpVectors(a.fromP, a.toP, e);
      this.controls.target.lerpVectors(a.fromT, a.toT, e);
      if (t >= 1) this.focusAnim = null;
    }
    this.controls?.update();
    this.scaleMoveGizmo(); // arrows hold their on-screen size at any zoom
    // keep resize handles a steady on-screen size at any zoom; selected
    // nodes read a step bigger, and the invisible hit targets track along
    this.handleMeshes.forEach((m, i) => {
      const base = THREE.MathUtils.clamp(
        this.camera.position.distanceTo(m.position) * 0.022,
        0.7,
        3,
      );
      const def = this.hdlDefs[i];
      const selected = def?.vtx !== undefined && this.selVtxs.has(def.vtx);
      m.scale.setScalar(base * (selected ? 1.35 : 1));
      const hit = this.handleHits[i];
      if (hit) hit.scale.setScalar(base);
    });
    // group-scale gizmo handles: steady on-screen size too
    for (const h of this.gizmoHandles) {
      const base = THREE.MathUtils.clamp(
        this.camera.position.distanceTo(h.mesh.position) * 0.024,
        0.8,
        3.4,
      );
      h.mesh.scale.setScalar(base);
      h.hit.scale.setScalar(base * 1.6);
    }
    // periodic camera save: a refresh mid-edit comes back to this exact view
    const now = performance.now();
    if (this.active && this.cameraDirty && now - this.camSaveAt > 1500) {
      this.camSaveAt = now;
      this.saveCam();
    }
  }

  private saveCam(): void {
    if (!this.controls) return;
    try {
      localStorage.setItem(
        `solProtoEditorCam:${this.targetId}`,
        JSON.stringify({
          // while a 2D view is up, persist the saved FREE view — a refresh
          // reopens in normal 3D, never stranded on the long 2D lens
          p: (this.viewMode === "3d"
            ? this.camera.position
            : (this.saved3D?.p ?? this.camera.position)
          )
            .toArray()
            .map((v) => +v.toFixed(2)),
          t: (this.viewMode === "3d"
            ? this.controls.target
            : (this.saved3D?.t ?? this.controls.target)
          )
            .toArray()
            .map((v) => +v.toFixed(2)),
        }),
      );
    } catch {
      /* storage full: skip */
    }
  }

  // the primary selection (last picked) — or -1
  private get selected(): number {
    return this.sel.length ? this.sel[this.sel.length - 1] : -1;
  }

  get selectedIndex(): number {
    return this.selected;
  }

  get selection(): number[] {
    return [...this.sel];
  }

  // test/debug hook: what would a click at these client coords select?
  pickAt(clientX: number, clientY: number): number {
    return this.pick({ clientX, clientY } as PointerEvent);
  }

  // Adopt a level file as a NEW level in the menu, then edit it. Never
  // overwrites the level that happens to be open.
  importLevel(d: CustomLevelData, name?: string): void {
    const data = normalizeCustomLevelData(d);
    if (!data) {
      this.hooks.showMsg("BAD LEVEL FILE", "invalid component data");
      return;
    }
    let probe: Level | null = null;
    try {
      probe = new Level(new THREE.Scene(), {
        id: "__editor_import_probe",
        name: name ?? data.name,
        data,
      });
    } catch {
      this.hooks.showMsg("BAD LEVEL FILE", "the level could not be built safely");
      return;
    } finally {
      probe?.dispose(this.getLevel());
    }
    const id = saveUserLevel({ id: "", name: name ?? data.name, data });
    if (!userLevelStorageHealthy())
      this.hooks.showMsg(
        "SAVE FAILED",
        "import is session-only · export before reloading",
      );
    this.retarget(id);
    this.hooks.levelsChanged(id);
    this.hooks.showMsg("LEVEL IMPORTED", findLevel(id)?.name ?? "");
  }

  /** Point the time-of-day dropdown at whatever this.data now says. */
  private syncSkySelect(): void {
    if (this.skySelect) this.skySelect.value = asSkyPreset(this.data.sky);
  }

  /** Reset/delete read differently on a built-in than on a level you made. */
  private syncFileButtons(): void {
    const builtin = isBuiltin(this.targetId);
    if (this.resetBtn) {
      this.resetBtn.dataset.label = builtin ? "restore original" : "start over";
      this.resetBtn.textContent = this.resetBtn.dataset.label;
      this.resetBtn.style.color = "";
      this.resetBtn.title = builtin
        ? "drop your edits and hand back the design the game shipped with"
        : "wipe this level back to a blank slate";
    }
    if (this.delBtn) {
      // a built-in is part of the game — it can't be removed from the menu
      this.delBtn.style.display = builtin ? "none" : "";
      this.delBtn.dataset.label = "delete level";
      this.delBtn.textContent = "delete level";
      this.delBtn.style.color = "";
    }
  }

  // Re-bind this editor session to another user level (import / duplicate).
  private retarget(id: string): void {
    const e = findLevel(id);
    if (!e) return;
    this.targetId = e.id;
    this.targetName = e.name;
    this.registryChanged = true;
    this.closedGroups.clear();
    if (this.nameInput) this.nameInput.value = e.name;
    localStorage.setItem("solProtoEditorTarget", e.id);
    this.data = migrateCustomLevel(getEditData(e.id));
    this.syncSkySelect();
    this.syncFileButtons();
    this.lastCommitted = JSON.stringify(this.data);
    this.undoStack.length = 0; // history belongs to the level, not the session
    this.redoStack.length = 0;
    this.lastCoalesce = "";
    this.lastCommitT = 0;
    this.select(-1);
    this.renderLayers();
    this.refreshSpawnMarker();
  }

  // main calls this after every rebuild so the highlight tracks fresh meshes
  onLevelRebuilt(): void {
    const kept = this.sel.filter((i) => i < this.data.components.length);
    if (kept.length !== this.sel.length) this.setSelection(kept);
    else this.refreshSelectionBox();
    if (this.resizeIdx >= this.data.components.length) this.resizeIdx = -1;
    this.refreshHandles();
    this.refreshSpawnMarker();
    this.setGhostsVisible(this.active);
  }

  // invisible walls (and future collider-only pieces) render as ghosts while
  // editing, vanish in play
  private setGhostsVisible(on: boolean): void {
    this.getLevel().pickRoot.traverse((o) => {
      if (o.userData.editorGhost) o.visible = on;
    });
  }

  // ---- data mutation + history ----

  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private lastCommitted = "";

  // `coalesce`: edits sharing a key within a second merge into ONE undo step
  // (arrow-key nudge bursts, held number spinners)
  private commit(rebuild = true, coalesce = ""): boolean {
    // Selection, a handle click with zero travel, panel rendering, and focus
    // changes are not edits. Never normalize, autosave, rebuild, or create a
    // built-in override unless the working JSON actually changed.
    const beforePrune = JSON.stringify(this.data);
    if (beforePrune === this.lastCommitted) return true;
    if (!this.hooks.preflight()) {
      this.data = migrateCustomLevel(
        JSON.parse(this.lastCommitted) as CustomLevelData,
      );
      this.sel = this.sel.filter(
        (index) => index >= 0 && index < this.data.components.length,
      );
      this.hooks.resetPreview();
      this.renderLayers();
      this.renderProps();
      return false;
    }
    this.pruneGroups();
    let forkPersisted: boolean | null = null;
    if (
      this.forkOnFirstCommit &&
      this.targetId === this.initialTargetId &&
      JSON.stringify(this.data) !== this.initialJson
    )
      forkPersisted = this.forkHandBuiltDraft();
    const now = JSON.stringify(this.data);
    if (now === this.lastCommitted) return true;
    const t = performance.now();
    const chained =
      coalesce !== "" &&
      coalesce === this.lastCoalesce &&
      t - this.lastCommitT < 1000;
    if (this.lastCommitted && now !== this.lastCommitted && !chained) {
      this.undoStack.push(this.lastCommitted);
      if (this.undoStack.length > 100) this.undoStack.shift();
    }
    this.redoStack.length = 0; // every real edit forks history, coalesced or not
    this.lastCoalesce = coalesce;
    this.lastCommitT = t;
    this.lastCommitted = now;
    this.renderLayers();
    let persisted = forkPersisted ?? true;
    if (forkPersisted === null &&
      this.pristineBuiltin &&
      this.targetId === this.initialTargetId &&
      now === this.initialJson
    )
      restoreBuiltin(this.targetId);
    else if (forkPersisted === null)
      persisted = persistEditData(this.targetId, now); // autosave straight into the level list
    if (!persisted || !userLevelStorageHealthy())
      this.hooks.showMsg(
        "SAVE FAILED",
        "browser storage is full · this session is live, export before reloading",
      );
    if (rebuild) this.hooks.rebuild(true);
    // keep the selection outline + scale gizmo on the new geometry (field
    // scaling changes the bounds without any pointer drag). Skipped mid-drag,
    // where the live handlers own the visuals.
    if (
      rebuild &&
      this.sel.length > 0 &&
      !this.gizmoDrag &&
      !this.hdlDrag &&
      !this.dragging
    ) {
      this.refreshSelectionBox();
    }
    return persisted && userLevelStorageHealthy();
  }

  // swap in a history state WITHOUT recording it as a new edit
  private applyState(json: string): void {
    this.data = migrateCustomLevel(JSON.parse(json) as CustomLevelData);
    this.syncSkySelect(); // undo/redo can change the time of day
    let canonical = JSON.stringify(this.data);
    let persisted = true;
    if (this.forkedLevelId && canonical === this.initialJson) {
      deleteUserLevel(this.forkedLevelId);
      this.targetId = this.initialTargetId;
      this.targetName = findLevel(this.initialTargetId)?.name ?? this.data.name;
      this.forkedLevelId = null;
      this.forkOnFirstCommit = true;
      this.registryChanged = false;
      localStorage.setItem("solProtoEditorTarget", this.targetId);
      this.syncFileButtons();
      persisted = userLevelStorageHealthy();
    } else if (
      this.forkOnFirstCommit &&
      this.targetId === this.initialTargetId &&
      canonical !== this.initialJson
    ) {
      persisted = this.forkHandBuiltDraft();
      canonical = JSON.stringify(this.data);
    } else if (
      this.pristineBuiltin &&
      this.targetId === this.initialTargetId &&
      canonical === this.initialJson
    )
      restoreBuiltin(this.targetId);
    else persisted = persistEditData(this.targetId, canonical);
    this.lastCommitted = canonical;
    this.lastCoalesce = "";
    this.lastCommitT = 0;
    if (!persisted || !userLevelStorageHealthy())
      this.hooks.showMsg(
        "SAVE FAILED",
        "browser storage is full · export before reloading",
      );
    const wantedName = this.data.name?.trim();
    if (wantedName && findLevel(this.targetId)?.data)
      renameUserLevel(this.targetId, wantedName);
    this.targetName = findLevel(this.targetId)?.name ?? wantedName ?? this.targetName;
    if (this.nameInput) this.nameInput.value = this.targetName;
    this.hooks.levelsChanged();
    this.select(-1);
    this.hooks.rebuild(true);
  }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(JSON.stringify(this.data));
    this.applyState(prev);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(JSON.stringify(this.data));
    this.applyState(next);
  }

  private addComponent(c: CustomComponent): void {
    // ONE crystal / gate / clock / combo orb per level: a new one replaces the old
    if (
      c.t === "crystal" ||
      c.t === "gate" ||
      c.t === "clock" ||
      c.t === "comboorb"
    ) {
      this.data.components = this.data.components.filter((o) => o.t !== c.t);
    }
    this.data.components.push(c);
    this.commit();
    this.select(this.data.components.length - 1);
  }

  // append a batch (duplicate/paste) as ONE undo step and select the copies.
  // The one-crystal / one-gate rules hold: one in the batch replaces the level's.
  private addBatch(batch: CustomComponent[], commit = true): void {
    if (batch.length === 0) return;
    let clean = batch;
    for (const t of ["crystal", "gate", "clock", "comboorb"] as const) {
      const last = clean.map((c) => c.t).lastIndexOf(t);
      if (last >= 0) {
        clean = clean.filter((c, i) => c.t !== t || i === last);
        this.data.components = this.data.components.filter((o) => o.t !== t);
      }
    }
    if (clean.length === 0) return;
    if (this.data.components.length + clean.length > 10_000) {
      this.hooks.showMsg(
        "LEVEL LIMIT REACHED",
        "10,000 components is the safe editor maximum",
      );
      return;
    }
    const start = this.data.components.length;
    this.data.components.push(...clean);
    if (commit) this.commit();
    this.setSelection(clean.map((_, i) => start + i));
  }

  private deleteSelected(): void {
    if (this.sel.length === 0) return;
    // the gate + run-mode activators are level furniture like the spawn
    // point — move them, never delete them (a load would regrow them anyway)
    const KEEP = new Set(["gate", "clock", "comboorb"]);
    const dying = [...this.sel]
      .filter((i) => !KEEP.has(this.data.components[i].t))
      .sort((a, b) => b - a);
    if (dying.length < this.sel.length)
      this.hooks.showMsg(
        "GATE & ACTIVATORS STAY",
        "every level keeps its gate, stopwatch and combo orb — move them instead",
      );
    if (dying.length === 0) return;
    for (const i of dying) this.data.components.splice(i, 1);
    this.select(-1);
    this.commit();
  }

  private duplicateSelected(): void {
    if (this.sel.length === 0) return;
    const copies = this.sel.map((i) => {
      const copy = deepClone(this.data.components[i]);
      copy.p = [copy.p[0] + 3, copy.p[1], copy.p[2] + 3];
      return copy;
    });
    this.remapGroups(copies); // fresh group wiring for the copies
    this.addBatch(copies);
  }

  // ---- clipboard ----

  copySelected(): void {
    if (this.sel.length === 0) return;
    this.clipboard = this.sel.map((i) => deepClone(this.data.components[i]));
    this.pasteBump = 0;
    this.lastPasteKey = "";
    this.hooks.showMsg(
      `COPIED ${this.clipboard.length}`,
      "paste with ⌘V — lands at the camera focus",
    );
  }

  cutSelected(): void {
    if (this.sel.length === 0) return;
    this.copySelected();
    this.deleteSelected();
  }

  // paste keeps the group's exact layout and heights; its X/Z centroid moves
  // to the camera focus. Pasting again at the same focus stacks with a bump
  // so repeats never land invisibly on top of each other.
  paste(): void {
    if (this.clipboard.length === 0) return;
    const t = this.controls ? this.controls.target : new THREE.Vector3();
    let cx = 0;
    let cz = 0;
    for (const c of this.clipboard) {
      cx += c.p[0];
      cz += c.p[2];
    }
    cx /= this.clipboard.length;
    cz /= this.clipboard.length;
    const key = `${Math.round(t.x)},${Math.round(t.z)}`;
    if (key === this.lastPasteKey) this.pasteBump += 2;
    else {
      this.pasteBump = 0;
      this.lastPasteKey = key;
    }
    let dx = t.x - cx + this.pasteBump;
    let dz = t.z - cz + this.pasteBump;
    if (this.snap) {
      dx = snapHalf(dx);
      dz = snapHalf(dz);
    }
    const copies = this.clipboard.map((c) => {
      const copy = deepClone(c);
      copy.p = [copy.p[0] + dx, copy.p[1], copy.p[2] + dz];
      return copy;
    });
    this.remapGroups(copies); // fresh group wiring for the batch
    this.addBatch(copies);
  }

  // ---- locks (per component; the outliner toggles them) ----

  private isLockedIdx(idx: number): boolean {
    return !!this.data.components[idx]?.lk;
  }

  // ---- groups (nesting: a group's parent is another group) ----

  private chainOf(idx: number): number[] {
    const c = this.data.components[idx];
    return c ? groupChainOf(c, this.data) : [];
  }

  private rootGroupOf(idx: number): number | undefined {
    const chain = this.chainOf(idx);
    return chain.length ? chain[chain.length - 1] : undefined;
  }

  private groupMembers(gid: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.data.components.length; i++) {
      if (this.chainOf(i).includes(gid)) out.push(i);
    }
    return out;
  }

  // a click on a grouped component means the whole (outermost) group —
  // minus anything on a locked layer
  private expandToGroup(idx: number): number[] {
    if (idx < 0) return [];
    const root = this.rootGroupOf(idx);
    const all = root === undefined ? [idx] : this.groupMembers(root);
    return all.filter((i) => !this.isLockedIdx(i));
  }

  private nextGroupId(): number {
    return (this.data.groups ?? []).reduce((m, g) => Math.max(m, g.id), -1) + 1;
  }

  // ⌘G: bundle the selection. Fully-selected existing groups nest INTO the
  // new group; loose components join it directly (a component that's only
  // partially group-selected is pulled out of its old group — Figma rules).
  groupSelection(): void {
    if (this.sel.length < 2) return;
    if (!this.data.groups) this.data.groups = [];
    const G = this.nextGroupId();
    const selSet = new Set(this.sel);
    // read the WHOLE plan before mutating: reparenting mid-loop would send
    // later chain walks through the half-built new group
    const rootOf = new Map<number, number | undefined>();
    for (const idx of this.sel) rootOf.set(idx, this.rootGroupOf(idx));
    const fullRoots = new Set<number>();
    for (const idx of this.sel) {
      const r = rootOf.get(idx);
      if (
        r !== undefined &&
        !fullRoots.has(r) &&
        this.groupMembers(r).every((m) => selSet.has(m) || this.isLockedIdx(m))
      ) {
        fullRoots.add(r);
      }
    }
    // fully-selected groups nest whole; everything else joins directly
    for (const idx of this.sel) {
      const r = rootOf.get(idx);
      if (r === undefined || !fullRoots.has(r))
        this.data.components[idx].grp = G;
    }
    for (const r of fullRoots) {
      const g = this.data.groups.find((x) => x.id === r);
      if (g) g.parent = G;
    }
    this.data.groups.push({ id: G });
    this.commit();
    this.hooks.showMsg(
      `GROUPED ${this.sel.length}`,
      'a "!" crate in a group wires its outline crates',
    );
  }

  // ⌘⇧G: dissolve the selection's outermost group(s) one level
  ungroupSelection(): void {
    if (!this.data.groups) return;
    const roots = new Set<number>();
    for (const idx of this.sel) {
      const r = this.rootGroupOf(idx);
      if (r !== undefined) roots.add(r);
    }
    if (roots.size === 0) return;
    for (const r of roots) {
      for (const c of this.data.components) if (c.grp === r) c.grp = undefined;
      for (const g of this.data.groups)
        if (g.parent === r) g.parent = undefined;
      this.data.groups = this.data.groups.filter((g) => g.id !== r);
    }
    this.commit();
    this.hooks.showMsg("UNGROUPED");
  }

  // drop group entries no component chain references (post delete/ungroup)
  private pruneGroups(): void {
    if (!this.data.groups || this.data.groups.length === 0) return;
    const used = new Set<number>();
    for (const c of this.data.components) {
      for (const id of groupChainOf(c, this.data)) used.add(id);
    }
    for (const group of this.data.groups)
      if (group.editorOnly || group.nm) {
        used.add(group.id);
        let parent = group.parent;
        while (parent !== undefined && !used.has(parent)) {
          used.add(parent);
          parent = this.data.groups.find((item) => item.id === parent)?.parent;
        }
      }
    this.data.groups = this.data.groups.filter((g) => used.has(g.id));
  }

  // pasted/duplicated components get a FRESH copy of their group structure
  // (same wiring within the batch, no leash back to the originals)
  private remapGroups(copies: CustomComponent[]): void {
    if (!this.data.groups) return;
    const referenced = new Set<number>();
    for (const c of copies)
      for (const id of groupChainOf(c, this.data)) referenced.add(id);
    if (referenced.size === 0) return;
    const map = new Map<number, number>();
    let next = this.nextGroupId();
    for (const id of referenced) map.set(id, next++);
    for (const id of referenced) {
      const src = this.data.groups.find((g) => g.id === id);
      const parent =
        src?.parent !== undefined && map.has(src.parent)
          ? map.get(src.parent)
          : undefined;
      this.data.groups.push(
        parent !== undefined
          ? {
              id: map.get(id)!,
              parent,
              nm: src?.nm,
              editorOnly: src?.editorOnly,
            }
          : {
              id: map.get(id)!,
              nm: src?.nm,
              editorOnly: src?.editorOnly,
            },
      );
    }
    for (const c of copies) {
      if (c.grp !== undefined && map.has(c.grp)) c.grp = map.get(c.grp);
    }
  }

  // ---- selection + picking ----

  private select(idx: number): void {
    this.setSelection(idx < 0 ? [] : [idx]);
  }

  private setSelection(list: number[]): void {
    this.selVtxs.clear(); // node picks don't survive a selection change
    const seen = new Set<number>();
    const valid: number[] = [];
    for (const i of list) {
      if (i >= 0 && i < this.data.components.length && !seen.has(i)) {
        seen.add(i);
        valid.push(i);
      }
    }
    if (
      valid.length !== this.sel.length ||
      valid.some((value, index) => value !== this.sel[index])
    ) {
      this.lastCoalesce = "";
      this.lastCommitT = 0;
    }
    // resize handles only make sense on a lone component
    if (valid.length !== 1 || valid[0] !== this.resizeIdx) this.setResize(-1);
    this.sel = valid;
    this.refreshSelectionBox();
    this.renderProps();
    this.renderLayers(); // outliner rows highlight the live selection
    if (valid.length > 0 && this.panelTab !== "sel") this.setPanelTab("sel"); // jump to the fields you just picked
  }

  private objectsFor(idx: number): THREE.Object3D[] {
    const out: THREE.Object3D[] = [];
    for (const child of this.getLevel().pickRoot.children) {
      if (child.userData.editorIdx === idx) out.push(child);
    }
    return out;
  }

  private removeHelper(object: THREE.Object3D, disposeGeometry = true): void {
    this.scene.remove(object);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (disposeGeometry && mesh.geometry) geometries.add(mesh.geometry);
      const list = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : [];
      for (const material of list) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
  }

  private boxFor(idx: number): THREE.Box3 | null {
    const objs = this.objectsFor(idx);
    if (objs.length === 0) return null;
    const box = new THREE.Box3();
    for (const o of objs) box.expandByObject(o);
    return box;
  }

  // Cast the pointer into the real level geometry and return the nearest
  // surface point — skipping the pieces being dragged (so it can't snap onto
  // itself) and editor-only ghosts. This is how a 2D pointer resolves to a
  // sensible 3D depth: land on the thing under the cursor.
  private surfaceHitFor(e: PointerEvent): THREE.Vector3 | null {
    this.setRay(e);
    const hits = this.raycaster.intersectObject(this.getLevel().pickRoot, true);
    const sel = new Set(this.sel);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      let idx: number | undefined;
      let ghost = false;
      while (o) {
        if (o.userData.editorGhost) ghost = true;
        if (idx === undefined && o.userData.editorIdx !== undefined)
          idx = o.userData.editorIdx as number;
        o = o.parent;
      }
      if (ghost) continue; // zone slabs, arrows, other non-solid editor visuals
      if (idx !== undefined && sel.has(idx)) continue; // never snap to what you're holding
      return h.point.clone();
    }
    return null;
  }

  private refreshSelectionBox(): void {
    for (const b of this.selBoxes) this.removeHelper(b);
    this.selBoxes = [];
    for (const idx of this.sel) {
      const box = this.boxFor(idx);
      if (!box) continue;
      box.expandByScalar(0.15);
      // primary pops bright green; the rest of the selection reads softer
      const primary = idx === this.selected;
      const helper = new THREE.Box3Helper(
        box,
        new THREE.Color(primary ? 0x58e08a : 0x2f9a86),
      );
      this.scene.add(helper);
      this.selBoxes.push(helper);
    }
    // one blue hull per fully-selected group: the "this moves as a unit" read
    const roots = new Set<number>();
    for (const idx of this.sel) {
      const r = this.rootGroupOf(idx);
      if (r !== undefined) roots.add(r);
    }
    for (const r of roots) {
      const members = this.groupMembers(r);
      if (!members.every((m) => this.sel.includes(m) || this.isLockedIdx(m)))
        continue;
      const hull = new THREE.Box3();
      let any = false;
      for (const m of members) {
        const b = this.boxFor(m);
        if (b) {
          hull.union(b);
          any = true;
        }
      }
      if (!any) continue;
      hull.expandByScalar(0.32);
      const helper = new THREE.Box3Helper(hull, new THREE.Color(0x5aa9ff));
      this.scene.add(helper);
      this.selBoxes.push(helper);
    }
    if (!this.gizmoDrag) this.refreshGizmo(); // scale handles follow the selection
    if (!this.moveDrag) this.refreshMoveGizmo(); // ...and so does the move gizmo
  }

  // F: frame the selection (or the whole level) in the orbit view
  private frameSelection(): void {
    if (!this.controls) return;
    const box = new THREE.Box3();
    let any = false;
    const idxs = this.sel.length
      ? this.sel
      : this.data.components.map((_, i) => i);
    for (const idx of idxs) {
      const b = this.boxFor(idx);
      if (b) {
        box.union(b);
        any = true;
      }
    }
    if (!any) return;
    const cen = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dist = THREE.MathUtils.clamp(size * 1.1 + 6, 10, 120);
    const dir = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();
    if (dir.lengthSq() < 0.5) dir.set(0.45, 0.7, 0.55).normalize();
    this.controls.target.copy(cen);
    this.camera.position.copy(cen).addScaledVector(dir, dist);
  }

  // Glide the camera to look at a world box, reasonably close. Keeps the current
  // view angle (just travels in), and eases over ~0.34s (driven in update()).
  private focusOnBox(box: THREE.Box3): void {
    if (!this.controls) return;
    this.cameraDirty = true;
    const cen = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dist = THREE.MathUtils.clamp(size * 0.85 + 4, 6, 60); // close-up, but never inside a big piece
    const dir = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();
    if (dir.lengthSq() < 0.5) dir.set(0.45, 0.6, 0.55).normalize();
    this.focusAnim = {
      fromP: this.camera.position.clone(),
      toP: cen.clone().addScaledVector(dir, dist),
      fromT: this.controls.target.clone(),
      toT: cen,
      start: performance.now(),
    };
  }

  // Double-click a layer row: fly the camera to that piece (or whole group).
  private focusOnItem(idx: number): void {
    const b = this.boxFor(idx);
    if (b) this.focusOnBox(b);
  }

  private focusOnGroup(gid: number): void {
    const box = new THREE.Box3();
    let any = false;
    for (const m of this.groupMembers(gid)) {
      const b = this.boxFor(m);
      if (b) {
        box.union(b);
        any = true;
      }
    }
    if (any) this.focusOnBox(box);
  }

  // ---- GROUP SCALE (Figma-style) ------------------------------------------
  // Scale a multi-selection about an anchor. Pieces that own a size resize
  // proportionately; fixed-size pieces (crates, pickups, the gate...) keep
  // their size but their POSITION scales, so the whole layout grows/shrinks
  // as one and everything stays in rational proportion.

  // world AABB of the current selection (unioned component footprints)
  private selectionBounds(): THREE.Box3 | null {
    this.getLevel().pickRoot.updateMatrixWorld(true); // footprints read world matrices
    const box = new THREE.Box3();
    let any = false;
    for (const idx of this.sel) {
      const b = this.boxFor(idx);
      if (b) {
        box.union(b);
        any = true;
      }
    }
    return any ? box : null;
  }

  // scale ONE component's intrinsic size fields (yaw-aware: a 90°/270° piece
  // has its local X/Z swapped relative to the world scale axes). No-op for
  // fixed-size types — they carry no size field.
  private scaleComponentSize(
    c: CustomComponent,
    sx: number,
    sy: number,
    sz: number,
  ): void {
    const yaw = (((c.yaw ?? 0) % 360) + 360) % 360;
    const yawRad = THREE.MathUtils.degToRad(yaw);
    const cs = Math.cos(yawRad);
    const sn = Math.sin(yawRad);
    // Project each local basis vector through the requested world-axis scale.
    // This is exact at quarter turns and continuous for freely yawed pieces;
    // unlike the old 45° binary swap it never jumps or scales a diagonal by
    // an unrelated single axis.
    const sLocX = Math.hypot(cs * sx, sn * sz);
    const sLocZ = Math.hypot(sn * sx, cs * sz);
    const horizontal = (sLocX + sLocZ) / 2;
    // Widths must be derived from the ORIGINAL path, before the knots below are
    // rewritten by the affine scale.
    const pathMetrics =
      (c.t === "woodpath" || c.t === "wallpath") &&
      c.pts &&
      c.pts.length >= 2
        ? pathScaleMetrics(
            c.pts,
            c.curve,
            sx,
            sy,
            sz,
            c.t === "wallpath" && c.closed === true,
          )
        : null;
    if (c.pts) {
      // drawn nodes are authored in world XZ around p; radius + per-node height ride along
      c.pts = c.pts.map((pt) => {
        const q = [...pt] as number[];
        if (c.t === "vertramp" && yaw !== 0) {
          const a = THREE.MathUtils.degToRad(yaw);
          const cs = Math.cos(a);
          const sn = Math.sin(a);
          const wx = pt[0] * cs + pt[1] * sn;
          const wz = -pt[0] * sn + pt[1] * cs;
          const swx = wx * sx;
          const swz = wz * sz;
          q[0] = swx * cs - swz * sn;
          q[1] = swx * sn + swz * cs;
        } else {
          q[0] = pt[0] * sx;
          q[1] = pt[1] * sz;
        }
        if (q.length >= 3 && c.t !== "woodpath")
          q[2] = (pt as number[])[2] * horizontal;
        if (q.length >= 4) q[3] = (pt as number[])[3] * sy;
        return q as typeof pt;
      });
    }
    if (c.s)
      c.s = [
        Math.max(0.2, c.s[0] * sLocX),
        Math.max(0.2, c.s[1] * sy),
        Math.max(0.2, c.s[2] * sLocZ),
      ];
    switch (c.t) {
      case "wall":
        if (c.collisionHeight != null)
          c.collisionHeight = Math.max(0.2, c.collisionHeight * sy);
        break;
      case "ramp":
        if (c.len != null) c.len = Math.max(1, c.len * sLocZ);
        if (c.rise != null) c.rise *= sy;
        if (c.w != null) c.w = Math.max(1, c.w * sLocX);
        break;
      case "vertramp":
        if (!c.pts && c.len != null) c.len = Math.max(4, c.len * sLocZ);
        if (c.w != null) c.w = Math.max(0, c.w * sLocX);
        if (c.rise != null) c.rise = Math.max(0.5, c.rise * sy);
        if (c.deck != null)
          c.deck = Math.max(0, c.deck * ((sLocX + sLocZ) / 2));
        break;
      case "rail":
      case "trickrail":
        if (!c.pts && c.len != null) c.len = Math.max(1, c.len * sLocZ);
        if (c.t === "rail" && c.amp != null) {
          const travelScale =
            c.axis === "y" ? sy : c.axis === "z" ? sz : sx;
          c.amp = Math.max(0, c.amp * travelScale);
        }
        break;
      case "rope":
        if (c.len != null) c.len = Math.max(2, c.len * sLocZ);
        if (c.amp != null) c.amp *= sy;
        break;
      case "enemy":
        if (c.range != null) c.range *= sLocX; // patrol span scales with the ground
        break;
      case "pendulum":
        if (c.len != null) c.len = Math.max(1, c.len * sy); // arm length is vertical
        break;
      case "ropeswing":
        if (c.len != null) c.len = Math.max(2, c.len * sy); // rope length is vertical
        if (c.range != null) {
          const travelScale =
            c.axis === "y" ? sy : c.axis === "z" ? sz : sx;
          c.range = Math.max(0, c.range * travelScale);
        }
        break;
      case "camnode":
        if (c.radius != null) c.radius *= (sx + sz) / 2;
        break;
      case "terrain":
        // Terrain's displaced strip is parameterized by world Z and its rows
        // always span world X (see Level.jungle), so X is its exact cross-axis.
        if (c.w != null) c.w = Math.max(1, c.w * Math.abs(sx));
        if (c.amp != null) c.amp *= sy;
        break;
      case "wallpath": {
        const normalMean = pathMetrics
          ? pathMetrics.normalAt.reduce((sum, factor) => sum + factor, 0) /
            pathMetrics.normalAt.length
          : sLocX;
        if (c.w != null) c.w = Math.max(0.1, c.w * normalMean);
        if (!c.pts && c.len != null) c.len = Math.max(1, c.len * sLocZ);
        if (c.rise != null) c.rise = Math.max(0.2, c.rise * sy);
        if (c.collisionHeight != null)
          c.collisionHeight = Math.max(0.2, c.collisionHeight * sy);
        break;
      }
      case "woodpath": {
        const fallbackWidth = c.w ?? 6;
        if (pathMetrics && c.pts) {
          const sourceWidths = c.pts.map(
            (_, index) => c.widths?.[index] ?? fallbackWidth,
          );
          c.widths = sourceWidths.map((width, index) =>
            Math.max(0.8, width * pathMetrics.normalAt[index]),
          );
          // Every current knot is explicit now; keep `w` useful as the default
          // for a subsequently-added knot by applying a representative normal
          // factor instead of leaving stale pre-scale authoring state behind.
          const normalMean =
            pathMetrics.normalAt.reduce((sum, factor) => sum + factor, 0) /
            pathMetrics.normalAt.length;
          c.w = Math.max(0.8, fallbackWidth * normalMean);
        } else {
          // The runtime fallback path runs along Z, whose cross-axis is X.
          c.w = Math.max(0.8, fallbackWidth * Math.abs(sx));
          if (c.widths)
            c.widths = c.widths.map((width) =>
              Math.max(0.8, width * Math.abs(sx)),
            );
        }
        const longitudinal = pathMetrics?.lengthScale ?? Math.abs(sz);
        if (c.spacing != null)
          c.spacing = Math.max(0.18, c.spacing * longitudinal);
        if (c.baySpacing != null)
          c.baySpacing = Math.max(1.5, c.baySpacing * longitudinal);
        if (c.supportDepth != null)
          c.supportDepth = Math.max(0.8, c.supportDepth * sy);
        if (c.rise != null) c.rise = Math.max(0.8, c.rise * sy);
        break;
      }
      case "trickgate":
        if (c.radius != null)
          c.radius = Math.max(0.8, c.radius * ((sLocX + sy) / 2));
        break;
      case "grindosaurus":
        if (c.range != null) c.range = Math.max(0, c.range * sLocX);
        break;
      case "angryball": {
        const profile = (sLocX + sy) / 2;
        if (c.w != null) c.w = Math.max(0, c.w * sLocX);
        if (c.rise != null) c.rise = Math.max(0.5, c.rise * profile);
        if (c.radius != null)
          c.radius = Math.max(0.25, c.radius * ((sLocX + sy + sLocZ) / 3));
        if (c.range != null) c.range = Math.max(1, c.range * horizontal);
        if (c.amp != null) c.amp *= profile;
        break;
      }
      case "mover":
        if (c.amp != null) {
          const travelScale =
            c.axis === "y" ? sy : c.axis === "z" ? sz : sx;
          c.amp = Math.max(0, c.amp * travelScale);
        }
        break;
      case "stone":
        if (c.range != null)
          c.range = Math.max(0, c.range * (c.axis === "x" ? sx : sz));
        if (c.radius != null)
          c.radius = Math.max(0.25, c.radius * ((sx + sy + sz) / 3));
        break;
      case "decor": {
        const uniform = (sx + sy + sz) / 3;
        if (c.w != null) c.w = Math.max(0.05, c.w * uniform);
        if (c.rise != null) c.rise = Math.max(0.05, c.rise * sy);
        if (c.len != null) c.len = Math.max(0.1, c.len * sLocX);
        break;
      }
    }
  }

  // mutate the selection in place (no undo step) — the live-drag path
  private applyScaleNoCommit(
    sx: number,
    sy: number,
    sz: number,
    anchor: THREE.Vector3,
  ): void {
    const cl = (v: number): number => Math.min(40, Math.max(0.02, v));
    sx = cl(sx);
    sy = cl(sy);
    sz = cl(sz);
    for (const idx of this.sel) {
      const c = this.data.components[idx];
      if (!c) continue;
      this.materializeDims(c);
      if (c.t === "returnportal" && c.to)
        c.to = [
          anchor.x + (c.to[0] - anchor.x) * sx,
          anchor.y + (c.to[1] - anchor.y) * sy,
          anchor.z + (c.to[2] - anchor.z) * sz,
        ];
      c.p = [
        anchor.x + (c.p[0] - anchor.x) * sx,
        anchor.y + (c.p[1] - anchor.y) * sy,
        anchor.z + (c.p[2] - anchor.z) * sz,
      ];
      this.scaleComponentSize(c, sx, sy, sz);
    }
  }

  // scale + commit (fields, one-shot). coalesce merges a spinner burst.
  private scaleSelection(
    sx: number,
    sy: number,
    sz: number,
    anchor: THREE.Vector3,
    coalesce = "",
  ): void {
    this.applyScaleNoCommit(sx, sy, sz, anchor);
    this.commit(true, coalesce);
  }

  // ---- move gizmo (Maya-style translate manipulator) ----
  // Shown for any selection: three axis arrows and a centre box, parked at the
  // selection's middle. Free dragging the body still works — this is the
  // precision path, and in a 3D view it is the ONLY way to move along the axis
  // pointing into the screen, which a ground-plane drag cannot express at all.
  private refreshMoveGizmo(): void {
    this.teardownMoveGizmo();
    if (!this.active || this.sel.length === 0 || this.selVtxs.size > 0) return;
    const box = this.selectionBounds();
    if (!box) return;
    const g = new THREE.Group();
    g.position.copy(box.getCenter(new THREE.Vector3()));
    for (const a of MOVE_AXES) {
      const mat = new THREE.MeshBasicMaterial({
        color: a.color,
        depthTest: false,
        transparent: true,
      });
      const shaft = new THREE.Mesh(MOVE_SHAFT_GEO, mat);
      const tip = new THREE.Mesh(MOVE_TIP_GEO, mat);
      const hit = new THREE.Mesh(
        MOVE_HIT_GEO,
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      // the geometry is built up +Y; aim it down this axis
      for (const m of [shaft, tip, hit]) {
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), a.dir);
        m.renderOrder = 1000;
        g.add(m);
      }
      this.moveParts.push({ hit, ax: a.ax });
    }
    const cMat = new THREE.MeshBasicMaterial({
      color: 0xffe36e,
      depthTest: false,
      transparent: true,
    });
    const centre = new THREE.Mesh(MOVE_CENTRE_GEO, cMat);
    centre.renderOrder = 1000;
    g.add(centre);
    const cHit = new THREE.Mesh(
      MOVE_CENTRE_HIT_GEO,
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    g.add(cHit);
    this.moveParts.push({ hit: cHit, ax: "c" });
    this.scene.add(g);
    this.moveGroup = g;
    this.scaleMoveGizmo();
  }

  private teardownMoveGizmo(): void {
    if (this.moveGroup) {
      this.removeHelper(this.moveGroup, false);
      this.moveGroup = null;
    }
    this.moveParts = [];
  }

  // Constant on-screen size: without this an arrow is a speck across the level
  // and a wall up close. Distance x the camera's vertical FOV per pixel.
  private scaleMoveGizmo(): void {
    const g = this.moveGroup;
    if (!g) return;
    const dist = this.camera.position.distanceTo(g.position);
    const perPx =
      (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)) /
      Math.max(1, this.dom.clientHeight);
    g.scale.setScalar(Math.max(0.05, dist * perPx * MOVE_GIZMO_PX));
  }

  // Grab an arrow. Returns true if one was hit (the body drag then stands down).
  private moveGrab(e: PointerEvent): boolean {
    if (this.moveParts.length === 0) return false;
    this.setRay(e);
    this.moveGroup?.updateMatrixWorld(true);
    const hits = this.raycaster.intersectObjects(
      this.moveParts.map((p) => p.hit),
      false,
    );
    if (hits.length === 0) return false;
    const part = this.moveParts.find((p) => p.hit === hits[0].object);
    if (!part || !this.moveGroup) return false;
    const origin = this.moveGroup.position.clone();
    const dir =
      part.ax === "c"
        ? new THREE.Vector3(0, 1, 0)
        : (MOVE_AXES.find(
            (a) => a.ax === part.ax,
          )!.dir.clone() as THREE.Vector3);
    // Drag plane: contains the axis and faces the camera as squarely as it can,
    // so pointer travel maps to axis travel without blowing up at grazing
    // angles. The centre handle and the Y arrow use the classic pair instead.
    let plane: THREE.Plane;
    if (part.ax === "c") {
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -origin.y);
    } else {
      const toCam = new THREE.Vector3()
        .subVectors(this.camera.position, origin)
        .normalize();
      const n = new THREE.Vector3()
        .crossVectors(dir, new THREE.Vector3().crossVectors(toCam, dir))
        .normalize();
      if (n.lengthSq() < 1e-6) n.copy(toCam);
      plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, origin);
    }
    const grab = new THREE.Vector3();
    if (!this.groundPoint(e, plane, grab)) return false;
    this.moveDrag = {
      ax: part.ax,
      plane,
      grab,
      dir,
      orig: this.sel.map((idx) => ({
        idx,
        p: [...this.data.components[idx].p] as [number, number, number],
      })),
    };
    if (this.controls) this.controls.enabled = false;
    try {
      this.dom.setPointerCapture(e.pointerId);
    } catch {
      /* capture optional */
    }
    this.downAt = null;
    return true;
  }

  // Live axis drag. Shift snaps the moving coordinate to WHOLE units.
  private moveGizmoMove(e: PointerEvent, shift: boolean): void {
    const d = this.moveDrag;
    if (!d) return;
    const hit = new THREE.Vector3();
    if (!this.groundPoint(e, d.plane, hit)) return;
    const delta = new THREE.Vector3().subVectors(hit, d.grab);
    let mv: THREE.Vector3;
    if (d.ax === "c") {
      mv = new THREE.Vector3(delta.x, 0, delta.z); // centre box: the ground plane
    } else {
      mv = d.dir.clone().multiplyScalar(delta.dot(d.dir)); // project onto the axis
    }
    const lead = d.orig[d.orig.length - 1] ?? d.orig[0];
    if (lead) {
      // snap the LEAD piece's destination, then everything keeps its offset —
      // so a snapped group lands on the grid without warping its own spacing
      const round = shift
        ? (v: number): number => Math.round(v)
        : this.snap
          ? snapHalf
          : (v: number): number => v;
      if (d.ax === "x" || d.ax === "c")
        mv.x = round(lead.p[0] + mv.x) - lead.p[0];
      if (d.ax === "y") mv.y = round(lead.p[1] + mv.y) - lead.p[1];
      if (d.ax === "z" || d.ax === "c")
        mv.z = round(lead.p[2] + mv.z) - lead.p[2];
    }
    for (const o of d.orig) {
      const c = this.data.components[o.idx];
      if (!c) continue;
      const t: [number, number, number] = [
        o.p[0] + mv.x,
        o.p[1] + mv.y,
        o.p[2] + mv.z,
      ];
      const dx = t[0] - c.p[0];
      const dy = t[1] - c.p[1];
      const dz = t[2] - c.p[2];
      if (!dx && !dy && !dz) continue;
      for (const ob of this.objectsFor(o.idx))
        ob.position.add(new THREE.Vector3(dx, dy, dz));
      c.p = t;
    }
    this.separateCrates(d.orig.map((o) => o.idx));
    this.refreshSelectionBox();
    this.renderProps();
    if (this.moveGroup) {
      const box = this.selectionBounds();
      if (box) this.moveGroup.position.copy(box.getCenter(new THREE.Vector3()));
    }
  }

  // ---- crates are solid to each other ----
  // Two boxes in the same space read as one broken box in play, so a move that
  // would bury a crate in another is pushed back out along whichever axis it
  // entered by least — it stacks or butts up against its neighbour instead of
  // sinking in. The whole moved set shares one correction so a dragged group
  // keeps its own spacing. With grid snap on the push rounds UP to the next
  // grid step, so separated crates still land on the grid.
  private separateCrates(moved: number[]): void {
    const movers = moved.filter(
      (i) => this.data.components[i]?.t === "crate" && this.boxFor(i),
    );
    if (movers.length === 0) return;
    const others: THREE.Box3[] = [];
    this.data.components.forEach((c, i) => {
      if (c.t !== "crate" || moved.includes(i)) return;
      const b = this.boxFor(i);
      if (b) others.push(b);
    });
    if (others.length === 0) return;
    const push = new THREE.Vector3();
    for (let pass = 0; pass < 3; pass++) {
      let best: THREE.Vector3 | null = null;
      let bestLen = Infinity;
      for (const i of movers) {
        const a = this.boxFor(i);
        if (!a) continue;
        a.translate(push);
        for (const b of others) {
          if (!a.intersectsBox(b)) continue;
          // shortest way out of b, per axis, signed
          const cand: [number, number, number][] = [
            [b.max.x - a.min.x, 0, 0],
            [b.min.x - a.max.x, 0, 0],
            [0, b.max.y - a.min.y, 0],
            [0, b.min.y - a.max.y, 0],
            [0, 0, b.max.z - a.min.z],
            [0, 0, b.min.z - a.max.z],
          ];
          for (const [cx, cy, cz] of cand) {
            const len = Math.abs(cx) + Math.abs(cy) + Math.abs(cz);
            if (len < bestLen) {
              bestLen = len;
              best = new THREE.Vector3(cx, cy, cz);
            }
          }
        }
      }
      if (!best || bestLen < 1e-4) break;
      if (this.snap) {
        // round the push AWAY from the neighbour to the next grid step
        const up = (v: number): number =>
          v === 0 ? 0 : Math.sign(v) * Math.ceil(Math.abs(v) / 0.5) * 0.5;
        best.set(up(best.x), up(best.y), up(best.z));
      }
      push.add(best);
      bestLen = Infinity;
    }
    if (push.lengthSq() < 1e-8) return;
    for (const i of moved) {
      const c = this.data.components[i];
      if (!c) continue;
      c.p = [c.p[0] + push.x, c.p[1] + push.y, c.p[2] + push.z];
      for (const ob of this.objectsFor(i)) ob.position.add(push);
    }
  }

  // ---- group-scale gizmo (bounding-box handles) ----
  // (re)build the gizmo: shown for a 2+ piece selection when not in
  // single-resize or node mode. Handles ride the selection's bounding box.
  private refreshGizmo(): void {
    this.teardownGizmo();
    if (
      !this.active ||
      this.sel.length < 2 ||
      this.resizeIdx >= 0 ||
      this.selVtxs.size > 0
    )
      return;
    const box = this.selectionBounds();
    if (!box) return;
    const g = new THREE.Group();
    for (const def of GIZMO_HANDLES) {
      const pos = this.gizmoPos(def, box);
      const mesh = new THREE.Mesh(
        HANDLE_GEO,
        new THREE.MeshBasicMaterial({
          color: def.corner ? 0x8fd4ff : 0x5aa9ff,
          depthTest: false,
          transparent: true,
        }),
      );
      mesh.position.copy(pos);
      mesh.renderOrder = 999;
      g.add(mesh);
      const hit = new THREE.Mesh(
        HANDLE_HIT_GEO,
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hit.position.copy(pos);
      g.add(hit);
      this.gizmoHandles.push({ mesh, hit, def });
    }
    this.scene.add(g);
    this.gizmoGroup = g;
    if (!this.gizmoHintShown) {
      this.gizmoHintShown = true;
      this.hooks.showMsg(
        "GROUP SCALE",
        "drag the blue box handles · or type group W/H/D · corner = proportional, Shift = free",
      );
    }
  }

  private teardownGizmo(): void {
    if (this.gizmoGroup) {
      this.removeHelper(this.gizmoGroup, false);
      this.gizmoGroup = null;
    }
    this.gizmoHandles = [];
  }

  private gizmoPos(def: GizmoHandle, box: THREE.Box3): THREE.Vector3 {
    return new THREE.Vector3(
      THREE.MathUtils.lerp(box.min.x, box.max.x, def.nx),
      THREE.MathUtils.lerp(box.min.y, box.max.y, def.ny),
      THREE.MathUtils.lerp(box.min.z, box.max.z, def.nz),
    );
  }

  // the fixed anchor while dragging a handle: the OPPOSITE side per scaled
  // axis (a +X handle scales about the −X face), box.min for the rest.
  private gizmoAnchor(def: GizmoHandle, box: THREE.Box3): THREE.Vector3 {
    const a = box.min.clone();
    for (const ax of def.ax) {
      if (ax === "x") a.x = def.nx >= 0.5 ? box.min.x : box.max.x;
      else if (ax === "z") a.z = def.nz >= 0.5 ? box.min.z : box.max.z;
      else a.y = def.ny >= 0.5 ? box.min.y : box.max.y;
    }
    return a;
  }

  // begin a gizmo drag from a raycast hit; returns true if a handle was grabbed
  private gizmoGrab(e: PointerEvent): boolean {
    if (this.gizmoHandles.length === 0) return false;
    this.setRay(e);
    this.gizmoGroup?.updateMatrixWorld(true);
    const targets = this.gizmoHandles.flatMap((h) => [h.mesh, h.hit]);
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return false;
    const obj = hits[0].object;
    const entry = this.gizmoHandles.find(
      (h) => h.mesh === obj || h.hit === obj,
    );
    if (!entry) return false;
    const box = this.selectionBounds();
    if (!box) return false;
    const def = entry.def;
    const anchor = this.gizmoAnchor(def, box);
    const handlePos = this.gizmoPos(def, box);
    // ground handles drag on a horizontal plane at the handle height; the top
    // (Y) handle drags on a camera-facing vertical plane through it.
    const plane = def.ax.includes("y")
      ? new THREE.Plane().setFromNormalAndCoplanarPoint(
          new THREE.Vector3()
            .subVectors(this.camera.position, handlePos)
            .setY(0)
            .normalize(),
          handlePos,
        )
      : new THREE.Plane(new THREE.Vector3(0, 1, 0), -handlePos.y);
    const grab = new THREE.Vector3();
    if (!this.groundPoint(e, plane, grab)) return false;
    this.gizmoDrag = {
      def,
      anchor,
      ext0: box.getSize(new THREE.Vector3()),
      orig: new Map(
        this.sel.map((idx) => [idx, deepClone(this.data.components[idx])]),
      ),
      plane,
      grab,
      min0: box.min.clone(),
    };
    if (this.controls) this.controls.enabled = false;
    try {
      this.dom.setPointerCapture(e.pointerId);
    } catch {
      /* capture optional */
    }
    this.downAt = null;
    return true;
  }

  // apply a live gizmo drag: derive scale factors from the pointer, restore the
  // grab snapshot, and scale about the anchor (no commit — that lands on up).
  private gizmoMove(e: PointerEvent, shift: boolean): void {
    const d = this.gizmoDrag;
    if (!d) return;
    const hit = new THREE.Vector3();
    if (!this.groundPoint(e, d.plane, hit)) return;
    const clampF = (v: number): number => Math.max(0.05, v);
    let sx = 1;
    let sy = 1;
    let sz = 1;
    const ax = d.def.ax;
    if (ax.includes("y")) {
      sy = clampF(Math.abs(hit.y - d.anchor.y) / Math.max(0.01, d.ext0.y));
    } else if (d.def.corner) {
      // corner: proportional (uniform X+Z) by default, Shift = free per-axis
      if (shift) {
        sx = clampF(Math.abs(hit.x - d.anchor.x) / Math.max(0.01, d.ext0.x));
        sz = clampF(Math.abs(hit.z - d.anchor.z) / Math.max(0.01, d.ext0.z));
      } else {
        const d0 = Math.hypot(d.grab.x - d.anchor.x, d.grab.z - d.anchor.z);
        const dn = Math.hypot(hit.x - d.anchor.x, hit.z - d.anchor.z);
        const f = clampF(dn / Math.max(0.01, d0));
        sx = f;
        sz = f;
      }
    } else if (ax.includes("x")) {
      sx = clampF(Math.abs(hit.x - d.anchor.x) / Math.max(0.01, d.ext0.x));
    } else if (ax.includes("z")) {
      sz = clampF(Math.abs(hit.z - d.anchor.z) / Math.max(0.01, d.ext0.z));
    }
    if (this.snap) {
      sx = Math.max(0.05, Math.round(sx * 20) / 20);
      sy = Math.max(0.05, Math.round(sy * 20) / 20);
      sz = Math.max(0.05, Math.round(sz * 20) / 20);
    }
    // restore the grab snapshot, then scale about the fixed anchor
    for (const [idx, orig] of d.orig)
      this.data.components[idx] = deepClone(orig);
    this.applyScaleNoCommit(sx, sy, sz, d.anchor);
    this.renderProps();
    const now = performance.now();
    if (now - this.lastLiveRebuild > 90) {
      this.lastLiveRebuild = now;
      this.hooks.rebuild();
    }
  }

  // arrow keys: nudge the selection one grid step, mapped to the camera view
  // (up = away from you). A burst of taps coalesces into one undo step.
  private nudge(fwd: number, right: number, up: number): void {
    if (this.sel.length === 0 || !this.controls) return;
    const step = this.snap ? 0.5 : 0.25;
    const f = new THREE.Vector3().subVectors(
      this.controls.target,
      this.camera.position,
    );
    f.y = 0;
    if (f.lengthSq() < 1e-6) f.set(0, 0, -1);
    f.normalize();
    // snap "forward" to the dominant world axis so nudges stay on-grid
    if (Math.abs(f.x) > Math.abs(f.z)) f.set(Math.sign(f.x), 0, 0);
    else f.set(0, 0, Math.sign(f.z));
    const r = new THREE.Vector3(-f.z, 0, f.x); // forward rotated to screen-right
    const d = new THREE.Vector3()
      .addScaledVector(f, fwd * step)
      .addScaledVector(r, right * step)
      .setY(up * step);
    for (const idx of this.sel) {
      const c = this.data.components[idx];
      c.p = [c.p[0] + d.x, c.p[1] + d.y, c.p[2] + d.z];
    }
    this.commit(true, "nudge");
  }

  private pick(e: PointerEvent): number {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    // A commit rebuilds the level synchronously; a click landing before the
    // next render (the 2nd half of a double-click) would raycast fresh meshes
    // with identity matrices — everything "at the origin" — and mis-pick.
    const root = this.getLevel().pickRoot;
    root.updateMatrixWorld(true);
    const hits = this.raycaster.intersectObjects(root.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.editorIdx !== undefined) {
          const idx = o.userData.editorIdx as number;
          // locked layers are click-through: keep walking the deeper hits
          if (this.isLockedIdx(idx)) break;
          return idx;
        }
        o = o.parent;
      }
    }
    return -1;
  }

  private groundPoint(
    e: PointerEvent,
    plane: THREE.Plane,
    out: THREE.Vector3,
  ): boolean {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(plane, out) !== null;
  }

  // ---- resize handles (double-click a component) ----

  private setResize(idx: number): void {
    this.resizeIdx = idx;
    this.refreshHandles();
  }

  // Runtime-authored defaults, in one place. Property rendering and handle
  // display read these without writing them into sparse source data.
  private defaultSizeFor(c: CustomComponent): [number, number, number] | null {
    if (c.t === "platform") return [8, 1, 8];
    if (c.t === "decor") {
      if (c.dkind === "block") return [6, 6, 6];
      if (c.dkind === "ruinblock") return [2.4, 1.6, 2.4];
      return null;
    }
    if (c.t === "rock") return [3, 2, 3];
    if (c.t === "wall") return [8, 4, 1];
    if (c.t === "pit") return [6, 1, 6];
    if (c.t === "crumble") return [3, 1, 3];
    if (c.t === "crusher") return [4, 3, 3];
    if (c.t === "mover") return [6, 0.8, 6];
    if (c.t === "phasepad") return [5, 0.6, 5];
    if (c.t === "trampoline" || c.t === "speedpad") return [5, 0.45, 5];
    if (c.t === "returnportal") return [3, 4, 1.2];
    if (c.t === "trickgate") return [12, 8, 0.6];
    if (c.t === "zone") return [14, 1, 10];
    return null;
  }

  // Fill defaults only in an explicit mutation snapshot (handle drag/group
  // scale), never merely because a component was selected or inspected.
  private materializeDims(c: CustomComponent): void {
    const size = this.defaultSizeFor(c);
    if (size && !c.s) c.s = [...size];
    if (c.t === "ramp") {
      c.len = c.len ?? 10;
      c.rise = c.rise ?? 4;
      c.w = c.w ?? 8;
    } else if (c.t === "vertramp") {
      c.rise = c.rise ?? 6;
      c.w = c.w ?? 3;
      if (!c.pts) c.len = c.len ?? 30;
    } else if (c.t === "rail" || c.t === "trickrail" || c.t === "rope")
      c.len = c.len ?? 12;
    else if (c.t === "enemy") c.range = c.range ?? 5;
    else if (c.t === "pendulum") c.len = c.len ?? 5;
    else if (c.t === "ropeswing") c.len = c.len ?? 6;
    else if (c.t === "terrain") {
      c.w = c.w ?? 12;
      c.amp = c.amp ?? 0.45;
    } else if (c.t === "wallpath") {
      c.w = c.w ?? 1.2;
      c.rise = c.rise ?? 5;
      if (!c.pts) c.len = c.len ?? 30;
    } else if (c.t === "woodpath") {
      c.w = c.w ?? 6;
      c.s = c.s ?? [1, 0.32, 1];
      c.spacing = c.spacing ?? 0.55;
      c.baySpacing = c.baySpacing ?? 3.8;
      if (c.supports ?? c.scaffold)
        c.supportDepth = c.supportDepth ?? c.rise ?? 3;
    } else if (c.t === "trickgate") c.radius = c.radius ?? 2.2;
    else if (c.t === "grindosaurus") c.range = c.range ?? 4;
    else if (c.t === "angryball") {
      c.w = c.w ?? 3;
      c.rise = c.rise ?? 4.6;
      c.radius = c.radius ?? 0.8;
      c.range = c.range ?? 12;
    } else if (c.t === "stone") {
      c.range = c.range ?? 20;
      c.radius = c.radius ?? 0.9;
    } else if (c.t === "mover") c.amp = c.amp ?? 4;
    else if (c.t === "torch") {
      c.rise = c.rise ?? 2.2;
      c.w = c.w ?? 1;
    } else if (c.t === "decor") {
      const kind = c.dkind ?? "fern";
      if (
        [
          "fern", "broadleaf", "toadstool", "toadstools", "idol", "tree",
          "plants", "boulder", "rocks", "trunk", "slab",
        ].includes(kind)
      )
        c.w = c.w ?? 1;
      else if (kind === "mossrock") c.w = c.w ?? 1.6;
      else if (kind === "jungletree") c.rise = c.rise ?? 9;
      else if (kind === "palm") c.rise = c.rise ?? 4.8;
      else if (kind === "vines") c.rise = c.rise ?? 4;
      else if (kind === "log") c.len = c.len ?? 13;
      else if (kind === "meshycourtyard") {
        c.w = c.w ?? 11.52;
        c.yaw = c.yaw ?? 90;
        c.amp = c.amp ?? 6;
      }
    }
  }

  private concreteClone(c: CustomComponent): CustomComponent {
    const copy = deepClone(c);
    this.materializeDims(copy);
    return copy;
  }

  private handleDefsFor(c: CustomComponent): HandleDef[] {
    // drawn shapes: every node is a handle, dragged freely on the ground
    // plane (the axis machinery below is for box faces). Rails are open
    // 2+ node paths; polygons need 3+.
    const isPoly =
      c.pts &&
      c.pts.length >= 3 &&
      (c.t === "platform" || c.t === "wall" || c.t === "pit");
    const isPath =
      c.pts &&
      c.pts.length >= 2 &&
      (c.t === "rail" ||
        c.t === "trickrail" ||
        c.t === "terrain" ||
        c.t === "woodpath" ||
        c.t === "wallpath");
    if (c.pts && (isPoly || isPath)) {
      const y =
        c.t === "wall"
          ? c.p[1] + (c.s?.[1] ?? 4)
          : c.t === "platform"
            ? c.p[1] + (c.s?.[1] ?? 1) / 2
            : c.p[1] + 0.15;
      // rail nodes ride their own height offsets (climbing grind lines)
      return c.pts.map((pt, i) => ({
        pos: new THREE.Vector3(
          c.p[0] + pt[0],
          c.t === "rail" ||
          c.t === "trickrail" ||
          c.t === "terrain" ||
          c.t === "woodpath" ||
          c.t === "wallpath"
            ? c.p[1] + (pt[3] ?? 0) + (c.t === "wallpath" ? c.rise ?? 5 : 0.1)
            : y,
          c.p[2] + pt[1],
        ),
        dir: new THREE.Vector3(0, 1, 0),
        vtx: i,
      }));
    }
    const defs: HandleDef[] = [];
    const P = new THREE.Vector3(c.p[0], c.p[1], c.p[2]);
    const UP = new THREE.Vector3(0, 1, 0);
    const yaw = THREE.MathUtils.degToRad(c.yaw ?? 0);
    const loc = (x: number, y: number, z: number): THREE.Vector3 =>
      new THREE.Vector3(x, y, z).applyAxisAngle(UP, yaw);
    // drag a box face outward: s[idx] grows and (if anchored) the component
    // center shifts by half, so the OPPOSITE face stays where it was
    const face = (
      u: THREE.Vector3,
      at: THREE.Vector3,
      idx: number,
      min: number,
      anchor = true,
    ): void => {
      defs.push({
        pos: at,
        dir: u,
        apply: (orig, cc, d) => {
          const os = orig.s!;
          const v = Math.max(min, os[idx] + d);
          const ns: [number, number, number] = [os[0], os[1], os[2]];
          ns[idx] = v;
          cc.s = ns;
          const g = anchor ? (v - os[idx]) / 2 : 0;
          cc.p = [
            orig.p[0] + u.x * g,
            orig.p[1] + u.y * g,
            orig.p[2] + u.z * g,
          ];
        },
      });
    };
    // length-ish scalar (rail/pipe len, ramp w, enemy range); recenter keeps
    // the far end planted while this end follows the handle
    const span = (
      u: THREE.Vector3,
      at: THREE.Vector3,
      key: "len" | "w" | "range",
      min: number,
      recenter: boolean,
    ): void => {
      defs.push({
        pos: at,
        dir: u,
        apply: (orig, cc, d) => {
          const v = Math.max(min, (orig[key] as number) + d);
          cc[key] = v;
          const g = recenter ? (v - (orig[key] as number)) / 2 : 0;
          cc.p = [
            orig.p[0] + u.x * g,
            orig.p[1] + u.y * g,
            orig.p[2] + u.z * g,
          ];
        },
      });
    };
    if (c.t === "platform" || c.t === "rock") {
      const s = c.s ?? this.defaultSizeFor(c)!;
      face(
        loc(1, 0, 0),
        P.clone().addScaledVector(loc(1, 0, 0), s[0] / 2),
        0,
        0.5,
      );
      face(
        loc(-1, 0, 0),
        P.clone().addScaledVector(loc(-1, 0, 0), s[0] / 2),
        0,
        0.5,
      );
      face(
        loc(0, 0, 1),
        P.clone().addScaledVector(loc(0, 0, 1), s[2] / 2),
        2,
        0.5,
      );
      face(
        loc(0, 0, -1),
        P.clone().addScaledVector(loc(0, 0, -1), s[2] / 2),
        2,
        0.5,
      );
      face(new THREE.Vector3(0, 1, 0), P.clone().setY(P.y + s[1] / 2), 1, 0.5);
      face(new THREE.Vector3(0, -1, 0), P.clone().setY(P.y - s[1] / 2), 1, 0.5);
    } else if (c.t === "wall") {
      const s = c.s ?? this.defaultSizeFor(c)!;
      const mid = P.clone().setY(P.y + s[1] / 2); // p is the BASE center
      const ux = loc(1, 0, 0); // handles ride the SPUN faces
      const uz = loc(0, 0, 1);
      face(ux, mid.clone().addScaledVector(ux, s[0] / 2), 0, 0.5);
      face(
        ux.clone().negate(),
        mid.clone().addScaledVector(ux, -s[0] / 2),
        0,
        0.5,
      );
      face(uz, mid.clone().addScaledVector(uz, s[2] / 2), 2, 0.5);
      face(
        uz.clone().negate(),
        mid.clone().addScaledVector(uz, -s[2] / 2),
        2,
        0.5,
      );
      face(
        new THREE.Vector3(0, 1, 0),
        P.clone().setY(P.y + s[1]),
        1,
        0.5,
        false,
      ); // grows up from the base
    } else if (
      c.t === "pit" ||
      c.t === "crumble" ||
      c.t === "crusher" ||
      c.t === "mover" ||
      c.t === "phasepad" ||
      c.t === "trampoline" ||
      c.t === "speedpad" ||
      c.t === "returnportal" ||
      c.t === "trickgate" ||
      c.t === "zone"
    ) {
      const s = c.s ?? this.defaultSizeFor(c) ?? [8, 1, 8];
      const y =
        c.t === "crusher" ? P.y + 1.2 : c.t === "zone" ? P.y + 0.5 : P.y;
      const mid = P.clone().setY(y);
      const ux = loc(1, 0, 0); // spun pits/crumbles keep handles on their faces (crusher/zone yaw = 0)
      const uz = loc(0, 0, 1);
      face(ux, mid.clone().addScaledVector(ux, s[0] / 2), 0, 1);
      face(
        ux.clone().negate(),
        mid.clone().addScaledVector(ux, -s[0] / 2),
        0,
        1,
      );
      face(uz, mid.clone().addScaledVector(uz, s[2] / 2), 2, 1);
      face(
        uz.clone().negate(),
        mid.clone().addScaledVector(uz, -s[2] / 2),
        2,
        1,
      );
    } else if (c.t === "ramp") {
      const len = c.len ?? 10;
      const rise = c.rise ?? 4;
      const w = c.w ?? 8;
      const zl = loc(0, 0, 1); // toward the LOW end
      const xl = loc(1, 0, 0);
      span(
        zl,
        P.clone()
          .addScaledVector(zl, len / 2)
          .setY(P.y + 0.2),
        "len",
        1,
        true,
      );
      span(
        zl.clone().negate(),
        P.clone()
          .addScaledVector(zl, -len / 2)
          .setY(P.y + rise),
        "len",
        1,
        true,
      );
      span(
        xl,
        P.clone()
          .addScaledVector(xl, w / 2)
          .setY(P.y + rise / 2),
        "w",
        1,
        true,
      );
      span(
        xl.clone().negate(),
        P.clone()
          .addScaledVector(xl, -w / 2)
          .setY(P.y + rise / 2),
        "w",
        1,
        true,
      );
      defs.push({
        pos: P.clone()
          .addScaledVector(zl, -len / 2)
          .setY(P.y + rise + 0.4),
        dir: new THREE.Vector3(0, 1, 0),
        apply: (orig, cc, d) => {
          cc.rise = orig.rise! + d;
        },
      });
    } else if (c.t === "rail" || c.t === "trickrail" || c.t === "rope") {
      const u = loc(0, 0, 1); // (sin yaw, 0, cos yaw): the run of the line
      const len = c.len ?? 12;
      span(u, P.clone().addScaledVector(u, len / 2), "len", 1, true);
      span(
        u.clone().negate(),
        P.clone().addScaledVector(u, -len / 2),
        "len",
        1,
        true,
      );
    } else if (c.t === "vertramp") {
      // A drawn spine is sized by its nodes; a straight part gets a length
      // handle each end. Both get the two that matter everywhere: how wide
      // the flat is, and how big the transition is.
      const R = c.rise ?? 6;
      const F = c.w ?? 3;
      const lipLat = F + R * Math.sin(THREE.MathUtils.degToRad(c.arc ?? 90));
      const lipY = R * (1 - Math.cos(THREE.MathUtils.degToRad(c.arc ?? 90)));
      const xl = loc(1, 0, 0);
      if (!c.pts) {
        const zl = loc(0, 0, 1);
        const len = c.len ?? 30;
        span(
          zl,
          P.clone()
            .addScaledVector(zl, len / 2)
            .setY(P.y + 0.2),
          "len",
          2,
          true,
        );
        span(
          zl.clone().negate(),
          P.clone()
            .addScaledVector(zl, -len / 2)
            .setY(P.y + 0.2),
          "len",
          2,
          true,
        );
        span(
          xl,
          P.clone()
            .addScaledVector(xl, F)
            .setY(P.y + 0.2),
          "w",
          1,
          true,
        );
        if ((c.vkind ?? "quarter") === "half") {
          span(
            xl.clone().negate(),
            P.clone()
              .addScaledVector(xl, -F)
              .setY(P.y + 0.2),
            "w",
            1,
            true,
          );
        }
      }
      // the coping itself: drag it out and up, and the transition grows
      defs.push({
        pos: P.clone()
          .addScaledVector(xl, lipLat)
          .setY(P.y + lipY),
        dir: new THREE.Vector3(0, 1, 0),
        apply: (orig, cc, d) => {
          cc.rise = Math.max(0.5, orig.rise! + d);
        },
      });
    } else if (c.t === "enemy") {
      const r = c.range ?? 5;
      const enemyYaw = (((c.yaw ?? 0) % 180) + 180) % 180;
      const patrol =
        enemyYaw >= 45 && enemyYaw < 135
          ? new THREE.Vector3(0, 0, 1)
          : new THREE.Vector3(1, 0, 0);
      span(
        patrol,
        P.clone().addScaledVector(patrol, r).setY(P.y + 0.4),
        "range",
        0,
        false,
      );
      span(
        patrol.clone().negate(),
        P.clone().addScaledVector(patrol, -r).setY(P.y + 0.4),
        "range",
        0,
        false,
      );
    } else if (c.t === "pendulum" || c.t === "ropeswing") {
      const len = c.len ?? (c.t === "ropeswing" ? 6 : 5);
      defs.push({
        pos: P.clone().setY(P.y - len),
        dir: new THREE.Vector3(0, -1, 0),
        apply: (orig, cc, d) => {
          cc.len = Math.max(c.t === "ropeswing" ? 2 : 1, orig.len! + d);
        },
      });
    }
    return defs;
  }

  private refreshHandles(): void {
    if (this.handleGroup) {
      this.removeHelper(this.handleGroup, false);
      this.handleGroup = null;
    }
    this.handleMeshes = [];
    this.handleHits = [];
    this.hdlDefs = [];
    if (!this.active || this.resizeIdx < 0) return;
    const c = this.data.components[this.resizeIdx];
    if (!c) {
      this.resizeIdx = -1;
      return;
    }
    this.hdlDefs = this.handleDefsFor(c);
    if (this.hdlDefs.length === 0) {
      this.resizeIdx = -1;
      return;
    }
    const g = new THREE.Group();
    this.hdlDefs.forEach((def, i) => {
      const m = new THREE.Mesh(
        HANDLE_GEO,
        new THREE.MeshBasicMaterial({
          color: NODE_COLOR,
          depthTest: false,
          transparent: true,
          opacity: 0.92,
        }),
      );
      m.renderOrder = 999; // draw on top: grabbable even inside geometry
      m.position.copy(def.pos);
      m.userData.hdl = i;
      g.add(m);
      this.handleMeshes.push(m);
      // fat invisible twin: the actual click target (forgiving at any zoom)
      const hit = new THREE.Mesh(
        HANDLE_HIT_GEO,
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthTest: false,
          depthWrite: false,
        }),
      );
      hit.position.copy(def.pos);
      hit.userData.hdl = i;
      g.add(hit);
      this.handleHits.push(hit);
    });
    this.scene.add(g);
    this.handleGroup = g;
    this.tintHandles();
  }

  // selected nodes read Figma-blue (their size bump lives in update(), which
  // owns handle scale for constant screen size)
  private tintHandles(): void {
    this.handleMeshes.forEach((m, i) => {
      const isNode = this.hdlDefs[i]?.vtx !== undefined;
      const selected = isNode && this.selVtxs.has(this.hdlDefs[i].vtx!);
      (m.material as THREE.MeshBasicMaterial).color.setHex(
        selected ? NODE_SEL_COLOR : NODE_COLOR,
      );
    });
  }

  private setRay(e: { clientX: number; clientY: number }): void {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  // travel along the handle's axis line to the point nearest the pointer ray
  private axisT(lineO: THREE.Vector3, lineD: THREE.Vector3): number | null {
    const ray = this.raycaster.ray;
    const w0 = new THREE.Vector3().subVectors(lineO, ray.origin);
    const b = lineD.dot(ray.direction);
    const denom = 1 - b * b;
    if (Math.abs(denom) < 1e-4) return null; // axis points straight at the camera
    return (b * ray.direction.dot(w0) - lineD.dot(w0)) / denom;
  }

  private onDbl = (e: MouseEvent): void => {
    if (!this.active || this.spaceHeld) return;
    if (this.drawing) {
      // double-click closes the shape (the extra click's duplicate point is
      // deduped in finishDraw)
      this.finishDraw();
      return;
    }
    const hit = this.pick(e as PointerEvent);
    if (hit >= 0 && RESIZABLE.has(this.data.components[hit].t)) {
      this.select(hit);
      this.setResize(hit);
      if (!this.resizeHintShown) {
        this.resizeHintShown = true;
        this.hooks.showMsg(
          "RESIZE MODE",
          "drag the gold handles · esc or click away = done",
        );
      }
    } else {
      this.setResize(-1);
      if (hit >= 0)
        this.hooks.showMsg(
          "FIXED SIZE",
          `a ${this.data.components[hit].t} can't be resized`,
        );
    }
  };

  // ---- pointer handlers ----

  private onDown = (e: PointerEvent): void => {
    if (!this.active || e.button !== 0) return;
    // space-hand: the pointer belongs to the pan — no picking, no marquee
    if (this.spaceHeld) {
      this.downAt = null;
      this.dom.style.cursor = "grabbing";
      return;
    }
    // PEN TOOL: every click drops a vertex; clicking the first point closes
    // (rails are OPEN paths — they finish on Enter/double-click instead)
    if (this.drawing) {
      this.downAt = null;
      const pt = this.drawPlanePoint(e);
      if (!pt) return;
      const openPath = [
        "rail",
        "vertramp",
        "terrain",
        "woodpath",
        "wallpath",
      ].includes(this.drawing.t);
      if (
        !openPath &&
        this.drawing.pts.length >= 3 &&
        pt.distanceTo(this.drawing.pts[0]) < 1.0
      ) {
        this.finishDraw();
        return;
      }
      this.drawing.pts.push(pt);
      this.updateDrawVis();
      return;
    }
    // group-scale gizmo handles grab first when a multi-selection is up
    // the move gizmo is asked FIRST: its arrows sit over the piece, and a grab
    // on one must never fall through to the free body drag underneath
    if (this.moveParts.length > 0 && this.moveGrab(e)) return;
    if (this.gizmoHandles.length > 0 && this.gizmoGrab(e)) return;
    // resize handles grab first — they float over everything else
    if (this.resizeIdx >= 0 && this.handleMeshes.length > 0) {
      this.setRay(e);
      this.handleGroup?.updateMatrixWorld(true); // may not have rendered yet
      const hits = this.raycaster.intersectObjects(
        [...this.handleMeshes, ...this.handleHits],
        false,
      );
      if (hits.length > 0) {
        const i = hits[0].object.userData.hdl as number;
        const def = this.hdlDefs[i];
        const lineO = def.pos.clone();
        const lineD = def.dir.clone();
        // shape node — Figma rules: shift/cmd-click toggles it in the node
        // selection (no drag), plain click on an unselected node selects
        // just it, and dragging any selected node moves them all. The props
        // panel batch-edits whatever's selected.
        if (def.vtx !== undefined) {
          if (e.shiftKey || e.metaKey || e.ctrlKey) {
            if (this.selVtxs.has(def.vtx)) this.selVtxs.delete(def.vtx);
            else this.selVtxs.add(def.vtx);
            this.tintHandles();
            this.renderProps();
            this.downAt = null;
            return;
          }
          if (!this.selVtxs.has(def.vtx)) this.selVtxs = new Set([def.vtx]);
          this.tintHandles();
          this.renderProps();
          this.hdlDrag = {
            i,
            lineO,
            lineD,
            t0: 0,
            orig: deepClone(this.data.components[this.resizeIdx]),
            source: deepClone(this.data.components[this.resizeIdx]),
            vtx: def.vtx,
            plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -def.pos.y),
          };
          if (this.controls) this.controls.enabled = false;
          try {
            this.dom.setPointerCapture(e.pointerId);
          } catch {
            /* capture optional */
          }
          this.downAt = null;
          return;
        }
        const t0 = this.axisT(lineO, lineD);
        if (t0 !== null) {
          this.hdlDrag = {
            i,
            lineO,
            lineD,
            t0,
            orig: this.concreteClone(this.data.components[this.resizeIdx]),
            source: deepClone(this.data.components[this.resizeIdx]),
          };
          if (this.controls) this.controls.enabled = false;
          try {
            this.dom.setPointerCapture(e.pointerId);
          } catch {
            /* capture optional */
          }
          this.downAt = null;
          return;
        }
      }
    }
    this.downAt = { x: e.clientX, y: e.clientY };
    const hit = this.pick(e);
    // FIGMA rules — drag on EMPTY space is the marquee box-select: plain
    // replaces the selection, shift adds to it. (The camera lives on the
    // right/middle buttons and space-drag now.) In NODE mode the marquee
    // sweeps the shape's nodes instead of components.
    if (hit < 0) {
      this.marquee = {
        x0: e.clientX,
        y0: e.clientY,
        x1: e.clientX,
        y1: e.clientY,
      };
      this.marqueeAdd = e.shiftKey;
      this.marqueeNodes =
        this.resizeIdx >= 0 && !!this.data.components[this.resizeIdx]?.pts;
      this.showMarquee();
      if (this.controls) this.controls.enabled = false;
      return;
    }
    // ctrl/cmd-grab is a toggle-click, never a move
    const plainGrab = !e.ctrlKey && !e.metaKey;
    // shift-grab on something OUTSIDE the selection = additive toggle on up
    if (hit >= 0 && plainGrab && !(e.shiftKey && !this.sel.includes(hit))) {
      // grab-to-move, no select-first needed: grabbing an unselected piece
      // selects it (with its group) and the drag starts immediately
      if (!this.sel.includes(hit)) this.setSelection(this.expandToGroup(hit));
      if (!this.sel.includes(hit)) return; // locked (or filtered): no drag
      let grabbed = hit;
      this.dragAddedFrom = null;
      this.dragGroupsBefore = null;
      this.dragSourceJson = null;
      this.dragSelectionBefore = null;
      // alt-drag clones: the copies come along, the originals stay put
      if (e.altKey) {
        const order = [...this.sel];
        const start = this.data.components.length;
        const copies = order.map((i) => deepClone(this.data.components[i]));
        this.dragAddedFrom = start;
        this.dragGroupsBefore = deepClone(this.data.groups ?? []);
        this.dragSourceJson = JSON.stringify(this.data);
        this.dragSelectionBefore = [...this.sel];
        this.remapGroups(copies); // clones get their own group wiring
        grabbed = start + order.indexOf(hit);
        this.addBatch(copies, false); // commit only if the drag lands
        if (grabbed >= this.data.components.length) grabbed = this.selected; // crystal filtered
      }
      const c = this.data.components[grabbed];
      this.dragPlane =
        this.viewMode !== "3d"
          ? new THREE.Plane().setFromNormalAndCoplanarPoint(
              // 2D view: drag ON the view plane through the piece — movement
              // stays in the two visible axes, depth can't change
              {
                x: new THREE.Vector3(1, 0, 0),
                y: new THREE.Vector3(0, 1, 0),
                z: new THREE.Vector3(0, 0, 1),
              }[this.viewMode],
              new THREE.Vector3(...c.p),
            )
          : new THREE.Plane(new THREE.Vector3(0, 1, 0), -c.p[1]);
      if (this.groundPoint(e, this.dragPlane, this.dragStart)) {
        this.dragging = true;
        this.dragOrig = [...c.p] as [number, number, number];
        // how far the grabbed piece's origin sits above its own base, so a
        // surface-snap can rest it ON the target rather than half-buried
        const gb = this.boxFor(grabbed);
        this.dragBottomOffset = gb ? c.p[1] - gb.min.y : 0;
        // the grabbed one leads; every selected component keeps its offset
        this.dragSel = this.sel.map((idx) => ({
          idx,
          p: [...this.data.components[idx].p] as [number, number, number],
        }));
        // move the grabbed item to the selection tail so snapping tracks IT
        if (grabbed !== this.selected) {
          this.sel = [...this.sel.filter((i) => i !== grabbed), grabbed];
          this.refreshSelectionBox();
        }
        if (this.controls) this.controls.enabled = false;
        try {
          this.dom.setPointerCapture(e.pointerId);
        } catch {
          /* capture optional */
        }
      } else if (this.dragAddedFrom !== null) {
        this.rollbackActiveGesture(true);
      }
    }
  };

  // ---- pen tool (draw polygon platforms / pits / walls) ----

  startDraw(
    t:
      | "platform"
      | "pit"
      | "wall"
      | "wallpath"
      | "rail"
      | "vertramp"
      | "terrain"
      | "woodpath",
  ): void {
    this.cancelDraw();
    this.select(-1);
    const y = this.controls ? snapHalf(this.controls.target.y) : 0;
    this.drawing = { t, y, pts: [] };
    this.dom.style.cursor = "crosshair";
    this.hooks.showMsg(
      `DRAW ${t.toUpperCase()}`,
      t === "rail" || t === "terrain" || t === "woodpath" || t === "wallpath"
        ? "click to drop nodes · Enter or double-click to finish · esc = cancel"
        : "click to drop points · click the FIRST point (or Enter) to close · esc = cancel",
    );
  }

  private cancelDraw(): void {
    this.drawing = null;
    if (this.drawVis) {
      this.removeHelper(this.drawVis);
      this.drawVis = null;
    }
    if (this.active) this.dom.style.cursor = "";
  }

  // preview: the outline so far, vertex dots, a rubber segment to the cursor,
  // and a green "close here" marker on the first point
  private updateDrawVis(cursor?: THREE.Vector3): void {
    if (this.drawVis) {
      this.removeHelper(this.drawVis);
      this.drawVis = null;
    }
    const d = this.drawing;
    if (!d || (d.pts.length === 0 && !cursor)) return;
    const g = new THREE.Group();
    const color =
      d.t === "pit"
        ? 0xff6a3a
        : d.t === "wall" || d.t === "wallpath"
          ? 0xffd75e
          : 0x58e08a;
    const linePts = [...d.pts];
    if (cursor) linePts.push(cursor);
    if (linePts.length >= 2) {
      g.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(linePts),
          new THREE.LineBasicMaterial({ color }),
        ),
      );
    }
    d.pts.forEach((pt, i) => {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(i === 0 ? 0.42 : 0.28, 8, 6),
        new THREE.MeshBasicMaterial({
          color: i === 0 ? 0x58e08a : color,
          depthTest: false,
        }),
      );
      dot.renderOrder = 998;
      dot.position.copy(pt);
      g.add(dot);
    });
    this.scene.add(g);
    this.drawVis = g;
  }

  private drawPlanePoint(e: PointerEvent): THREE.Vector3 | null {
    const d = this.drawing!;
    // Where you CLICK is where it goes: the surface under the cursor supplies
    // the point, and until the first node is dropped it also sets the draw
    // plane's height — so drawing on real ground lands ON that ground, never
    // on a stale orbit-target-height plane hundreds of units below and beyond
    // the click. Only sky/void clicks fall back to the flat draw plane.
    const surf = this.surfaceSnap ? this.surfaceHitFor(e) : null;
    if (surf && d.pts.length === 0) d.y = snapHalf(surf.y);
    const out = new THREE.Vector3();
    if (surf) {
      out.copy(surf);
    } else {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -d.y);
      if (!this.groundPoint(e, plane, out)) return null;
    }
    if (this.snap) {
      out.x = snapHalf(out.x);
      out.z = snapHalf(out.z);
    }
    out.y = d.y;
    return out;
  }

  private finishDraw(): void {
    const d = this.drawing;
    if (!d) return;
    // drop consecutive duplicates (a double-click leaves one behind)
    const pts = d.pts.filter(
      (pt, i) => i === 0 || pt.distanceToSquared(d.pts[i - 1]) > 0.01,
    );
    const openPath =
      d.t === "rail" ||
      d.t === "vertramp" ||
      d.t === "terrain" ||
      d.t === "woodpath" ||
      d.t === "wallpath";
    const minPts = openPath ? 2 : 3;
    if (pts.length < minPts) {
      this.hooks.showMsg(`NEED ${minPts}+ POINTS`, "shape cancelled");
      this.cancelDraw();
      return;
    }
    let cx = 0;
    let cz = 0;
    for (const pt of pts) {
      cx += pt.x;
      cz += pt.z;
    }
    cx = snapHalf(cx / pts.length);
    cz = snapHalf(cz / pts.length);
    const rel = pts.map(
      (pt) => [snapHalf(pt.x - cx), snapHalf(pt.z - cz)] as [number, number],
    );
    if (d.t === "rail") {
      // open path — no closing, no box dims; grind height is the draw plane
      this.addComponent({ t: "rail", p: [cx, d.y + 1, cz], pts: rel });
    } else if (d.t === "wallpath") {
      this.addComponent({
        t: "wallpath",
        p: [cx, d.y, cz],
        pts: rel,
        w: 1.2,
        rise: 5,
        curve: "spline",
        color: "#9a8a7a",
        tex: "stone",
      });
    } else if (d.t === "terrain") {
      // a drawn floor: the nodes are its centreline, the draw plane its base
      this.addComponent({
        t: "terrain",
        p: [cx, d.y, cz],
        pts: rel,
        w: 12,
        amp: 0.45,
        berms: true,
      });
    } else if (d.t === "woodpath") {
      this.addComponent({
        t: "woodpath",
        p: [cx, d.y, cz],
        pts: rel,
        widths: rel.map(() => 6),
        w: 6,
        curve: "spline",
        scaffold: true,
        supports: true,
        rails: true,
        spacing: 0.55,
        baySpacing: 3.8,
        supportDepth: 3,
      });
    } else if (d.t === "vertramp") {
      // the transition sweeps along the drawn spine; the draw plane is the
      // FLAT it rises from, so the wall climbs out of the floor you drew on
      this.addComponent({
        t: "vertramp",
        p: [cx, d.y, cz],
        pts: rel,
        rise: 6,
        w: 3,
        vkind: "quarter",
      });
    } else {
      const s: [number, number, number] = [1, d.t === "wall" ? 4 : 1, 1];
      this.addComponent({ t: d.t, p: [cx, d.y, cz], s, pts: rel });
    }
    this.cancelDraw();
  }

  // ---- marquee (screen-space rubber band) ----

  private showMarquee(): void {
    if (!this.marqueeEl) {
      const el = document.createElement("div");
      el.className = "ed-marquee";
      document.body.appendChild(el);
      this.marqueeEl = el;
    }
    const m = this.marquee;
    if (!m) return;
    const x = Math.min(m.x0, m.x1);
    const y = Math.min(m.y0, m.y1);
    this.marqueeEl.style.display = "block";
    this.marqueeEl.style.left = `${x}px`;
    this.marqueeEl.style.top = `${y}px`;
    this.marqueeEl.style.width = `${Math.abs(m.x1 - m.x0)}px`;
    this.marqueeEl.style.height = `${Math.abs(m.y1 - m.y0)}px`;
  }

  private hideMarquee(): void {
    if (this.marqueeEl) this.marqueeEl.style.display = "none";
  }

  // every component whose screen-projected bounds touch the marquee rect
  private marqueePick(m: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }): number[] {
    const rx0 = Math.min(m.x0, m.x1);
    const ry0 = Math.min(m.y0, m.y1);
    const rx1 = Math.max(m.x0, m.x1);
    const ry1 = Math.max(m.y0, m.y1);
    const r = this.dom.getBoundingClientRect();
    const camDir = this.camera.getWorldDirection(new THREE.Vector3());
    const out: number[] = [];
    const v = new THREE.Vector3();
    for (let idx = 0; idx < this.data.components.length; idx++) {
      if (this.isLockedIdx(idx)) continue; // locked layers ignore the marquee
      const box = this.boxFor(idx);
      if (!box) continue;
      // skip anything behind the camera — projection would mirror it
      if (
        v
          .copy(box.getCenter(new THREE.Vector3()))
          .sub(this.camera.position)
          .dot(camDir) < 0
      )
        continue;
      let sx0 = Infinity;
      let sy0 = Infinity;
      let sx1 = -Infinity;
      let sy1 = -Infinity;
      for (let corner = 0; corner < 8; corner++) {
        v.set(
          corner & 1 ? box.max.x : box.min.x,
          corner & 2 ? box.max.y : box.min.y,
          corner & 4 ? box.max.z : box.min.z,
        ).project(this.camera);
        const px = r.left + ((v.x + 1) / 2) * r.width;
        const py = r.top + ((1 - v.y) / 2) * r.height;
        sx0 = Math.min(sx0, px);
        sy0 = Math.min(sy0, py);
        sx1 = Math.max(sx1, px);
        sy1 = Math.max(sy1, py);
      }
      const touches = sx1 >= rx0 && sx0 <= rx1 && sy1 >= ry0 && sy0 <= ry1;
      // a component whose projection CONTAINS the whole rect wasn't lassoed —
      // you swept a box on top of it (else any sweep grabs the floor too)
      const swallows = sx0 <= rx0 && sy0 <= ry0 && sx1 >= rx1 && sy1 >= ry1;
      if (touches && !swallows) out.push(idx);
    }
    return out;
  }

  private onMove = (e: PointerEvent): void => {
    if (!this.active) return;
    if (this.spaceHeld) return; // panning: OrbitControls owns the pointer
    // pen tool: rubber-band the next segment to the cursor
    if (this.drawing) {
      const now = performance.now();
      if (now - this.hoverAt > 33) {
        this.hoverAt = now;
        const pt = this.drawPlanePoint(e);
        this.updateDrawVis(pt ?? undefined);
      }
      return;
    }
    // move-gizmo drag: travel on the grabbed axis only
    if (this.moveDrag) {
      this.moveGizmoMove(e, e.shiftKey);
      return;
    }
    // group-scale gizmo drag: scale the whole selection from the grab snapshot
    if (this.gizmoDrag) {
      this.gizmoMove(e, e.shiftKey);
      return;
    }
    // resize-handle drag: re-apply from the grab snapshot at the new travel
    if (this.hdlDrag && this.resizeIdx >= 0) {
      // shape node: chase the pointer on the ground plane. Dragging a node
      // that's part of a multi-node selection carries the whole selection
      // along by the same delta (Figma).
      if (this.hdlDrag.vtx !== undefined && this.hdlDrag.plane) {
        const hit = new THREE.Vector3();
        if (!this.groundPoint(e, this.hdlDrag.plane, hit)) return;
        const c = this.data.components[this.resizeIdx];
        const orig = this.hdlDrag.orig;
        if (!c.pts || !orig.pts) return;
        const o = orig.pts[this.hdlDrag.vtx];
        const dx = hit.x - c.p[0] - o[0];
        const dz = hit.z - c.p[2] - o[1];
        const targets =
          this.selVtxs.has(this.hdlDrag.vtx) && this.selVtxs.size > 1
            ? [...this.selVtxs]
            : [this.hdlDrag.vtx];
        for (const vi of targets) {
          const op = orig.pts[vi];
          if (!op) continue;
          const nt = [...op] as [number, number, number, number]; // radius + height ride along
          nt[0] = this.snap ? snapHalf(op[0] + dx) : op[0] + dx;
          nt[1] = this.snap ? snapHalf(op[1] + dz) : op[1] + dz;
          c.pts[vi] = nt;
        }
        const defs2 = this.handleDefsFor(c);
        defs2.forEach((df, j) => {
          this.handleMeshes[j]?.position.copy(df.pos);
          this.handleHits[j]?.position.copy(df.pos);
        });
        this.hdlDefs = defs2;
        this.renderProps();
        const now2 = performance.now();
        if (now2 - this.lastLiveRebuild > 90) {
          this.lastLiveRebuild = now2;
          this.hooks.rebuild();
        }
        return;
      }
      this.setRay(e);
      const t = this.axisT(this.hdlDrag.lineO, this.hdlDrag.lineD);
      if (t === null) return;
      let d = t - this.hdlDrag.t0;
      if (this.snap) d = snapHalf(d);
      const c = this.data.components[this.resizeIdx];
      this.hdlDefs[this.hdlDrag.i].apply!(this.hdlDrag.orig, c, d);
      // handles + panel track live; geometry rebuilds on a light throttle
      const defs = this.handleDefsFor(c);
      defs.forEach((df, j) => {
        this.handleMeshes[j]?.position.copy(df.pos);
        this.handleHits[j]?.position.copy(df.pos);
      });
      this.hdlDefs = defs;
      this.renderProps();
      const now = performance.now();
      if (now - this.lastLiveRebuild > 90) {
        this.lastLiveRebuild = now;
        this.hooks.rebuild();
      }
      return;
    }
    // marquee: track the corner
    if (this.marquee) {
      this.marquee.x1 = e.clientX;
      this.marquee.y1 = e.clientY;
      this.showMarquee();
      return;
    }
    // hovering a handle: show it's grabbable
    if (this.resizeIdx >= 0 && !this.dragging && this.handleMeshes.length > 0) {
      this.setRay(e);
      const over =
        this.raycaster.intersectObjects(
          [...this.handleMeshes, ...this.handleHits],
          false,
        ).length > 0;
      if (over) {
        this.dom.style.cursor = "grab";
        return;
      }
    }
    // idle hover: a pointer cursor says "this is selectable" (throttled)
    if (!this.dragging && !this.downAt) {
      const now = performance.now();
      if (now - this.hoverAt > 80) {
        this.hoverAt = now;
        const over = this.pick(e);
        this.dom.style.cursor =
          over >= 0 ? (this.sel.includes(over) ? "move" : "pointer") : "";
      }
    }
    if (!this.dragging || this.sel.length === 0) return;
    // the grabbed component's target; the rest of the selection follows by the
    // SAME delta so the group's layout never warps
    let nx = this.dragOrig[0];
    let ny = this.dragOrig[1];
    let nz = this.dragOrig[2];
    // SHIFT = whole units, on every axis this drag can move. (It used to mean
    // "drag vertically"; the move gizmo's green arrow does that properly now,
    // on its own axis, so the modifier is free to be the coarse grid — which
    // is what it is everywhere else people edit.)
    const grid = e.shiftKey
      ? (v: number): number => Math.round(v)
      : this.snap
        ? snapHalf
        : null;
    {
      // SURFACE SNAP: rest the grabbed piece on the real geometry under the
      // cursor — this resolves the 2D→3D depth so it lands where it looks,
      // not hundreds of units away on a shallow-angle plane. Over empty space
      // (or snap off), fall back to the fixed-Y ground plane.
      const surf =
        this.surfaceSnap && this.viewMode === "3d"
          ? this.surfaceHitFor(e)
          : null;
      if (this.viewMode !== "3d") {
        // 2D view: per-axis delta on the view plane, the depth axis pinned
        const hit = new THREE.Vector3();
        if (!this.groundPoint(e, this.dragPlane, hit)) return;
        nx = this.dragOrig[0] + (hit.x - this.dragStart.x);
        ny = this.dragOrig[1] + (hit.y - this.dragStart.y);
        nz = this.dragOrig[2] + (hit.z - this.dragStart.z);
        if (this.viewMode === "x") nx = this.dragOrig[0];
        if (this.viewMode === "y") ny = this.dragOrig[1];
        if (this.viewMode === "z") nz = this.dragOrig[2];
        if (grid) {
          // only grid the axes the view can actually move
          if (this.viewMode !== "x") nx = grid(nx);
          if (this.viewMode !== "y") ny = grid(ny);
          if (this.viewMode !== "z") nz = grid(nz);
        }
      } else if (surf) {
        nx = surf.x;
        nz = surf.z;
        ny = surf.y + this.dragBottomOffset; // base sits on the surface
        if (grid) {
          nx = grid(nx);
          nz = grid(nz); // grid the footprint, keep Y exactly on the surface
        }
      } else {
        const hit = new THREE.Vector3();
        if (!this.groundPoint(e, this.dragPlane, hit)) return;
        nx = this.dragOrig[0] + (hit.x - this.dragStart.x);
        nz = this.dragOrig[2] + (hit.z - this.dragStart.z);
        if (grid) {
          nx = grid(nx);
          nz = grid(nz);
        }
      }
    }
    const gdx = nx - this.dragOrig[0];
    const gdy = ny - this.dragOrig[1];
    const gdz = nz - this.dragOrig[2];
    let moved = false;
    for (const entry of this.dragSel) {
      const c = this.data.components[entry.idx];
      if (!c) continue;
      const tx = entry.p[0] + gdx;
      const ty = entry.p[1] + gdy;
      const tz = entry.p[2] + gdz;
      const dx = tx - c.p[0];
      const dy = ty - c.p[1];
      const dz = tz - c.p[2];
      if (dx || dy || dz) {
        // live-preview: shift the tagged visuals; physics catches up on release
        for (const o of this.objectsFor(entry.idx))
          o.position.add(new THREE.Vector3(dx, dy, dz));
        c.p = [tx, ty, tz];
        moved = true;
      }
    }
    if (moved) {
      this.separateCrates(this.dragSel.map((entry) => entry.idx));
      this.refreshSelectionBox();
      this.renderProps();
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (!this.active) return;
    try {
      if (this.dom.hasPointerCapture(e.pointerId))
        this.dom.releasePointerCapture(e.pointerId);
    } catch {
      /* capture optional */
    }
    if (this.drawing) return; // pen tool owns the pointer (vertices drop on down)
    if (this.spaceHeld) {
      this.dom.style.cursor = "grab";
      this.downAt = null;
      return;
    }
    if (this.moveDrag) {
      this.moveDrag = null;
      if (this.controls) this.controls.enabled = true;
      this.commit(); // one undo step for the whole axis move
      return;
    }
    if (this.gizmoDrag) {
      this.gizmoDrag = null;
      if (this.controls) this.controls.enabled = true;
      this.commit(); // one undo step for the whole group scale (also refreshes the gizmo)
      return;
    }
    if (this.hdlDrag) {
      this.hdlDrag = null;
      if (this.controls) this.controls.enabled = true;
      this.commit(); // one undo step for the whole handle stretch
      return;
    }
    const clickish =
      this.downAt !== null &&
      Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 5 &&
      e.button === 0;
    if (this.marquee) {
      const m = this.marquee;
      const nodesMode = this.marqueeNodes;
      this.marquee = null;
      this.marqueeNodes = false;
      this.hideMarquee();
      if (this.controls) this.controls.enabled = true;
      // a real sweep adds everything it touched (whole groups come along);
      // a sub-click shift-tap on empty space falls through to click logic
      if (!clickish) {
        if (nodesMode && this.resizeIdx >= 0) {
          // node mode: the box selects the shape's NODES (screen-projected)
          const r = this.dom.getBoundingClientRect();
          const x0 = Math.min(m.x0, m.x1);
          const x1 = Math.max(m.x0, m.x1);
          const y0 = Math.min(m.y0, m.y1);
          const y1 = Math.max(m.y0, m.y1);
          const picked = new Set<number>(this.marqueeAdd ? this.selVtxs : []);
          for (const def of this.hdlDefs) {
            if (def.vtx === undefined) continue;
            const s = def.pos.clone().project(this.camera);
            const sx = r.left + ((s.x + 1) / 2) * r.width;
            const sy = r.top + ((1 - s.y) / 2) * r.height;
            if (sx >= x0 && sx <= x1 && sy >= y0 && sy <= y1)
              picked.add(def.vtx);
          }
          this.selVtxs = picked;
          this.tintHandles();
          this.renderProps();
          this.downAt = null;
          return;
        }
        const hits = this.marqueePick(m).flatMap((i) => this.expandToGroup(i));
        this.setSelection(this.marqueeAdd ? [...this.sel, ...hits] : hits);
        this.downAt = null;
        return;
      }
    }
    if (this.dragging) {
      if (clickish) {
        this.rollbackActiveGesture(true);
      } else {
        this.dragging = false;
        this.dragSel = [];
        this.dragAddedFrom = null;
        this.dragGroupsBefore = null;
        this.dragSourceJson = null;
        this.dragSelectionBefore = null;
        if (this.controls) this.controls.enabled = true;
        this.commit(); // rebuild: colliders/rails regenerate at the new spot
        this.downAt = null;
        return;
      }
      // grab-with-no-movement is just a click — fall through
    }
    // plain click: select / deselect · modifier-click: toggle in/out.
    // Groups select as a unit — the click lands on the whole group.
    if (clickish) {
      const hit = this.pick(e);
      const unit = this.expandToGroup(hit);
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        if (hit >= 0) {
          const allIn = unit.every((i) => this.sel.includes(i));
          if (allIn)
            this.setSelection(this.sel.filter((i) => !unit.includes(i)));
          else this.setSelection([...this.sel, ...unit]);
        }
      } else {
        this.setSelection(unit);
      }
    }
    this.downAt = null;
  };

  private onKey = (e: KeyboardEvent): void => {
    if (!this.active) return;
    const typing =
      (e.target as HTMLElement)?.tagName === "INPUT" ||
      (e.target as HTMLElement)?.tagName === "SELECT";
    if (typing) return;
    // HOLD SPACE: grabby hand — left-drag pans the canvas (Figma rules)
    if (e.code === "Space") {
      e.preventDefault();
      if (!this.spaceHeld && !this.dragging && !this.hdlDrag) {
        this.spaceHeld = true;
        if (this.controls) this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
        this.dom.style.cursor = "grab";
      }
      return;
    }
    const cmd = e.metaKey || e.ctrlKey;
    // pen tool: Enter closes the shape, Escape abandons it
    if (this.drawing) {
      if (e.code === "Enter") this.finishDraw();
      else if (e.code === "Escape") this.cancelDraw();
      return;
    }
    if (e.code === "Escape") {
      if (this.rollbackActiveGesture(true)) return;
      // step out: resize mode first, then the selection itself
      if (this.resizeIdx >= 0) this.setResize(-1);
      else this.select(-1);
    }
    if (e.code === "Delete" || e.code === "Backspace") this.deleteSelected();
    if (e.code === "KeyD" && cmd) {
      e.preventDefault();
      this.duplicateSelected();
    }
    if (e.code === "KeyC" && cmd) {
      e.preventDefault();
      this.copySelected();
    }
    if (e.code === "KeyX" && cmd) {
      e.preventDefault();
      this.cutSelected();
    }
    if (e.code === "KeyV" && cmd) {
      e.preventDefault();
      this.paste();
    }
    if (e.code === "KeyA" && cmd) {
      e.preventDefault();
      this.setSelection(
        this.data.components
          .map((_, i) => i)
          .filter((i) => !this.isLockedIdx(i)),
      );
    }
    if (e.code === "KeyG" && cmd) {
      e.preventDefault();
      if (e.shiftKey) this.ungroupSelection();
      else this.groupSelection();
    }
    if (e.code === "KeyF" && !cmd) this.frameSelection();
    // arrows nudge the selection a grid step (shift+up/down = height)
    if (e.code.startsWith("Arrow") && this.sel.length > 0) {
      e.preventDefault();
      if (e.code === "ArrowUp")
        this.nudge(e.shiftKey ? 0 : 1, 0, e.shiftKey ? 1 : 0);
      else if (e.code === "ArrowDown")
        this.nudge(e.shiftKey ? 0 : -1, 0, e.shiftKey ? -1 : 0);
      else if (e.code === "ArrowLeft") this.nudge(0, -1, 0);
      else if (e.code === "ArrowRight") this.nudge(0, 1, 0);
    }
    // Cmd+Z / Cmd+Shift+Z (mac) — Ctrl works too
    if (e.code === "KeyZ" && cmd) {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === "Space" && this.spaceHeld) {
      this.spaceHeld = false;
      // left goes back to being the SELECT button (disabled on the camera)
      if (this.controls)
        this.controls.mouseButtons.LEFT = -1 as unknown as THREE.MOUSE;
      if (this.active) this.dom.style.cursor = "";
    }
  };

  // ---- spawn marker ----

  private refreshSpawnMarker(): void {
    if (!this.active) return;
    if (!this.spawnMarker) {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6),
        new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
      );
      pole.position.y = 1.6;
      const flag = new THREE.Mesh(
        new THREE.ConeGeometry(0.7, 1.4, 4),
        new THREE.MeshLambertMaterial({ color: 0x58e08a, emissive: 0x1c5a34 }),
      );
      flag.position.y = 3.4;
      g.add(pole, flag);
      this.spawnMarker = g;
      this.scene.add(g);
    }
    this.spawnMarker.position.set(
      this.data.spawn[0],
      this.data.spawn[1],
      this.data.spawn[2],
    );
  }

  // ---- panel ----

  private buildPanel(): void {
    const panel = document.createElement("div");
    panel.className = "ed-panel";
    panel.style.display = "none";
    const h = (html: string): HTMLElement => {
      const d = document.createElement("div");
      d.innerHTML = html;
      return d.firstElementChild as HTMLElement;
    };
    panel.appendChild(h('<div class="ed-title">LEVEL EDITOR</div>'));

    // TWO TABS: the current selection vs the project (level + file + help).
    // TEST lives below the tabs, always one click away.
    const ptabs = h('<div class="ed-ptabs"></div>');
    this.tabSelBtn = h(
      '<button class="ed-ptab ed-ptab-on">SELECTION</button>',
    ) as HTMLButtonElement;
    this.tabProjBtn = h(
      '<button class="ed-ptab">PROJECT</button>',
    ) as HTMLButtonElement;
    this.tabSelBtn.addEventListener("click", () => this.setPanelTab("sel"));
    this.tabProjBtn.addEventListener("click", () => this.setPanelTab("proj"));
    ptabs.appendChild(this.tabSelBtn);
    ptabs.appendChild(this.tabProjBtn);
    panel.appendChild(ptabs);
    const selPane = h('<div class="ed-pane"></div>');
    const projPane = h('<div class="ed-pane" style="display:none"></div>');
    this.selPane = selPane;
    this.projPane = projPane;

    // selection properties FIRST — what you just clicked is always in view
    selPane.appendChild(h('<div class="ed-sect">SELECTION</div>'));
    this.propsEl = h(
      '<div class="ed-props"><div class="ed-dim">click a component…</div></div>',
    );
    selPane.appendChild(this.propsEl);
    panel.appendChild(selPane);
    panel.appendChild(projPane);

    // ---- left-side pop-outs: the item picker and the layers panel live in
    // their own tabs so the inspector stays short ----
    const wrap = h('<div class="ed-popwrap" style="display:none"></div>');
    const tabs = h('<div class="ed-tabs"></div>');
    this.tabAdd = h(
      '<button class="ed-tab">▦<span>ADD</span></button>',
    ) as HTMLButtonElement;
    this.tabLayers = h(
      '<button class="ed-tab">≡<span>LAYERS</span></button>',
    ) as HTMLButtonElement;
    this.tabAdd.addEventListener("click", () =>
      this.setPop(this.popAdd?.style.display === "block" ? "" : "add"),
    );
    this.tabLayers.addEventListener("click", () =>
      this.setPop(this.popLayers?.style.display === "block" ? "" : "layers"),
    );
    tabs.appendChild(this.tabAdd);
    tabs.appendChild(this.tabLayers);
    wrap.appendChild(tabs);

    // item picker pop-out: grouped, icon + label per component
    const popAdd = h('<div class="ed-pop" style="display:none"></div>');
    popAdd.appendChild(h('<div class="ed-title">ADD</div>'));
    for (const sect of PALETTE_SECTIONS) {
      popAdd.appendChild(h(`<div class="ed-sect">${sect.title}</div>`));
      const pal = h('<div class="ed-grid"></div>');
      for (const p of sect.items) {
        const b = h(
          '<button class="ed-btn ed-palbtn"></button>',
        ) as HTMLButtonElement;
        const cv = document.createElement("canvas");
        cv.width = 18;
        cv.height = 18;
        const ctx = cv.getContext("2d");
        if (ctx) p.icon(ctx);
        b.appendChild(cv);
        const lab = document.createElement("span");
        lab.textContent = p.label;
        b.appendChild(lab);
        b.addEventListener("click", () => {
          if (p.penDraw) {
            this.startDraw(p.penDraw);
            b.blur();
            return;
          }
          const at = this.controls
            ? this.controls.target.clone()
            : new THREE.Vector3();
          if (this.snap) {
            at.set(snapHalf(at.x), snapHalf(at.y), snapHalf(at.z));
          }
          this.addComponent(p.make!(at));
          b.blur();
        });
        pal.appendChild(b);
      }
      popAdd.appendChild(pal);
    }
    this.popAdd = popAdd;
    wrap.appendChild(popAdd);

    // layers pop-out
    const popLayers = h('<div class="ed-pop" style="display:none"></div>');
    popLayers.appendChild(h('<div class="ed-title">LAYERS</div>'));
    this.layersEl = h('<div class="ed-layers"></div>');
    popLayers.appendChild(this.layersEl);
    popLayers.appendChild(
      h(
        '<div class="ed-dim">every piece is a row · groups expand with ▸<br>click a name to select it in the world<br>🔒 = click-through (safe from edits)<br>⌘G groups the selection · ✎ renames</div>',
      ),
    );
    this.popLayers = popLayers;
    wrap.appendChild(popLayers);

    // hard view snaps, bottom-left: X/Y/Z aim the orbit camera straight down
    // that axis (click again = the opposite side)
    const views = h('<div class="ed-views"></div>');
    for (const ax of ["x", "y", "z"] as const) {
      const vb = h(
        `<button class="ed-viewbtn">${ax.toUpperCase()}</button>`,
      ) as HTMLButtonElement;
      vb.title = `2D work view down ${ax.toUpperCase()}: drags move in-plane only (again = other side)`;
      vb.addEventListener("click", () => {
        this.snapView(ax);
        vb.blur();
      });
      this.viewBtns[ax] = vb;
      views.appendChild(vb);
    }
    const v3 = h(
      '<button class="ed-viewbtn ed-viewbtn-on">3D</button>',
    ) as HTMLButtonElement;
    v3.title = "back to the free 3D orbit view";
    v3.addEventListener("click", () => {
      this.to3D();
      v3.blur();
    });
    this.viewBtns["3d"] = v3;
    views.appendChild(v3);
    wrap.appendChild(views);

    document.body.appendChild(wrap);
    this.popWrap = wrap;

    // level settings (PROJECT tab)
    const projPane2 = this.projPane!;
    projPane2.appendChild(h('<div class="ed-sect">LEVEL</div>'));
    const lvl = h('<div class="ed-props"></div>');
    // NAME: what the menu row says. A real <input>, so the editor's typing
    // guard (onKey) keeps Delete/⌘D/space-pan out of the text.
    const nameRow = document.createElement("div");
    nameRow.className = "ed-row";
    const nameLab = document.createElement("label");
    nameLab.textContent = "name";
    const nameIn = document.createElement("input");
    nameIn.type = "text";
    nameIn.title = "the name this level shows in the menu";
    nameIn.addEventListener("keydown", (ev) => {
      if (ev.code === "Enter") nameIn.blur();
      ev.stopPropagation(); // typing guard: editor hotkeys stay out
    });
    const applyName = (): void => {
      const v = nameIn.value.trim();
      if (!v || v === this.targetName) {
        nameIn.value = this.targetName;
        return;
      }
      this.data.name = v; // keep the exported file's name in step with the menu
      // Commit first: a hand-built source may fork here, so rename the actual
      // target selected by that transaction rather than the protected source.
      if (!this.commit(false)) {
        this.data.name = this.targetName;
        nameIn.value = this.targetName;
        return;
      }
      renameUserLevel(this.targetId, v);
      this.targetName = findLevel(this.targetId)?.name ?? v;
      nameIn.value = this.targetName;
      this.hooks.levelsChanged();
    };
    nameIn.addEventListener("change", applyName);
    nameIn.addEventListener("blur", applyName);
    nameRow.appendChild(nameLab);
    nameRow.appendChild(nameIn);
    lvl.appendChild(nameRow);
    this.nameInput = nameIn;
    // TIME OF DAY: swaps the painted skybox, the fog colour and the lighting
    // in one move. Saved with the level, so it exports and syncs with it.
    const skyRow = document.createElement("div");
    skyRow.className = "ed-row";
    const skyLab = document.createElement("label");
    skyLab.textContent = "time of day";
    const skySel = document.createElement("select");
    skySel.title = "skybox + fog + lighting preset for this level";
    for (const k of SKY_PRESETS) {
      const o = document.createElement("option");
      o.value = k;
      o.textContent = k;
      skySel.appendChild(o);
    }
    skySel.addEventListener("change", () => {
      this.data.sky = asSkyPreset(skySel.value);
      this.commit(); // rebuild: applyTheme reads the new preset off the level
    });
    skyRow.appendChild(skyLab);
    skyRow.appendChild(skySel);
    lvl.appendChild(skyRow);
    this.skySelect = skySel;
    lvl.appendChild(
      this.numRow(
        "spawn x",
        () => this.data.spawn[0],
        (v) => (this.data.spawn[0] = v),
      ),
    );
    lvl.appendChild(
      this.numRow(
        "spawn y",
        () => this.data.spawn[1],
        (v) => (this.data.spawn[1] = v),
      ),
    );
    lvl.appendChild(
      this.numRow(
        "spawn z",
        () => this.data.spawn[2],
        (v) => (this.data.spawn[2] = v),
      ),
    );
    lvl.appendChild(
      this.numRow(
        "kill y",
        () => this.data.killY,
        (v) => (this.data.killY = v),
      ),
    );
    const spawnHere = h(
      '<button class="ed-btn">spawn = camera focus</button>',
    ) as HTMLButtonElement;
    spawnHere.addEventListener("click", () => {
      if (!this.controls) return;
      const t = this.controls.target;
      this.data.spawn = [snapHalf(t.x), snapHalf(t.y) + 0.6, snapHalf(t.z)];
      this.commit();
      spawnHere.blur();
    });
    lvl.appendChild(spawnHere);
    const snapBtn = h(
      '<button class="ed-btn">grid snap: ON</button>',
    ) as HTMLButtonElement;
    snapBtn.addEventListener("click", () => {
      this.snap = !this.snap;
      snapBtn.textContent = `grid snap: ${this.snap ? "ON" : "OFF"}`;
      snapBtn.blur();
    });
    lvl.appendChild(snapBtn);
    // drop-on-surface: dragging rests a piece on the geometry under the cursor
    const surfBtn = h(
      `<button class="ed-btn">drop on surface: ${this.surfaceSnap ? "ON" : "OFF"}</button>`,
    ) as HTMLButtonElement;
    surfBtn.title =
      "dragging rests the piece on whatever is under the cursor (fixes depth). OFF = flat ground-plane drag";
    surfBtn.addEventListener("click", () => {
      this.surfaceSnap = !this.surfaceSnap;
      localStorage.setItem("solProtoEdSurfaceSnap", this.surfaceSnap ? "1" : "0");
      surfBtn.textContent = `drop on surface: ${this.surfaceSnap ? "ON" : "OFF"}`;
      surfBtn.blur();
    });
    lvl.appendChild(surfBtn);
    projPane2.appendChild(lvl);

    // file ops
    projPane2.appendChild(h('<div class="ed-sect">FILE</div>'));
    const file = h('<div class="ed-grid"></div>');
    const mk = (label: string, fn: () => void): HTMLButtonElement => {
      const b = h(
        `<button class="ed-btn">${label}</button>`,
      ) as HTMLButtonElement;
      b.addEventListener("click", () => {
        fn();
        b.blur();
      });
      file.appendChild(b);
      return b;
    };
    mk("export", () => {
      const blob = new Blob([JSON.stringify(this.data, null, 1)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `level-${this.targetName.replace(/\s+/g, "")}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      this.hooks.showMsg(
        "LEVEL EXPORTED",
        "drop the file into the chat to share it",
      );
    });
    const filePick = document.createElement("input");
    filePick.type = "file";
    filePick.accept = ".json,application/json";
    filePick.style.display = "none";
    filePick.addEventListener("change", () => {
      const f = filePick.files && filePick.files[0];
      if (f)
        void f.text().then((txt) => {
          try {
            // accepts the bare component data AND a whole {name,data} entry
            const o = JSON.parse(txt) as CustomLevelData & {
              data?: CustomLevelData;
            };
            const d = Array.isArray(o.components) ? o : o.data;
            if (!d || d.v !== 1 || !Array.isArray(d.components))
              throw new Error("bad");
            // an imported file becomes its OWN level, never an overwrite
            this.importLevel(
              d,
              o.name ?? d.name ?? f.name.replace(/\.json$/i, ""),
            );
          } catch {
            this.hooks.showMsg("BAD LEVEL FILE");
          }
        });
      filePick.value = "";
    });
    file.appendChild(filePick);
    mk("import", () => filePick.click());
    // Two-tap confirm, shared by the pair below: neither has an undo.
    const arm = (
      b: HTMLButtonElement,
      confirmText: string,
      go: () => void,
    ): void => {
      let t = 0;
      const disarm = (): void => {
        if (t) clearTimeout(t);
        t = 0;
        b.textContent = b.dataset.label ?? "";
        b.style.color = "";
      };
      b.addEventListener("click", () => {
        if (!t) {
          b.textContent = confirmText;
          b.style.color = "#ff9a6b";
          t = window.setTimeout(disarm, 4000);
          return;
        }
        disarm();
        go();
      });
    };

    // RESET. On a level you made: back to a blank slate. On a BUILT-IN you
    // have edited: hand back the design the game shipped with. Label and
    // behaviour swap per target in syncFileButtons().
    const resetBtn = mk("start over", () => {});
    this.resetBtn = resetBtn;
    arm(resetBtn, "tap again to reset", () => {
      if (isBuiltin(this.targetId)) {
        const name = this.targetName;
        this.registryChanged = true;
        restoreBuiltin(this.targetId);
        this.hooks.levelsChanged(this.targetId);
        this.hooks.exitToPlay();
        this.hooks.showMsg("ORIGINAL RESTORED", name);
        return;
      }
      this.data = starterCustomLevel();
      this.data.name = this.targetName;
      this.select(-1);
      this.commit();
    });
    // DUPLICATE: fork the open level into a new menu row and edit that one, so
    // a risky change never costs you the version that worked.
    mk("duplicate", () => {
      if (!this.hooks.preflight()) return;
      const id = saveUserLevel({
        id: "",
        name: `${this.targetName} copy`,
        data: JSON.parse(JSON.stringify(this.data)) as CustomLevelData,
      });
      if (!userLevelStorageHealthy())
        this.hooks.showMsg(
          "SAVE FAILED",
          "copy is session-only · export before reloading",
        );
      this.retarget(id);
      this.hooks.levelsChanged(id);
      this.hooks.showMsg("DUPLICATED", findLevel(id)?.name ?? "");
    });
    // DELETE: drop it from the menu and leave the editor. Built-in levels
    // can't be deleted — they are part of the game — so this hides for them,
    // and "restore original" above is the way back instead.
    const delBtn = mk("delete level", () => {});
    this.delBtn = delBtn;
    arm(delBtn, "tap again to delete", () => {
      const gone = this.targetName;
      this.registryChanged = true;
      deleteUserLevel(this.targetId);
      localStorage.removeItem("solProtoEditorOpen");
      localStorage.removeItem("solProtoEditorTarget");
      this.hooks.levelsChanged(DEFAULT_LEVEL_ID);
      this.hooks.exitToPlay();
      this.hooks.showMsg("LEVEL DELETED", gone);
    });
    mk("undo ⌘Z", () => this.undo());
    mk("redo ⌘⇧Z", () => this.redo());
    projPane2.appendChild(file);

    projPane2.appendChild(
      h(
        '<div class="ed-dim">add pieces + layers: tabs on the LEFT edge<br>select: click · drag empty space = box select<br>move: just drag a piece (shift = height)<br>drop on surface: pieces rest on geometry under the cursor<br>fields: shift+↑/↓ = ±10 · drag up/down to scrub<br>alt-drag = drag out a copy · shift-click = add<br>orbit: RIGHT-drag · pan: middle or SPACE-drag<br>zoom: wheel · X/Y/Z (bottom-left) = view snaps<br>⌘A = all · ⌘G = group · ⌘⇧G = ungroup<br>⌘C copy · ⌘V paste at focus · ⌘X cut<br>arrows = nudge (shift↑↓ = height) · F = frame<br>double-click = resize handles (esc = done)<br>del = delete · ⌘D = duplicate · ⌘Z/⌘⇧Z = undo/redo<br>layer panel: 2+ selected shows scale handles · double-click a row = fly to it · ✎ = rename<br>PROJECT tab: <b>name</b> renames this level in the menu · <b>time of day</b> swaps skybox + fog + lighting<br>opening is read-only until a real edit; hand-built courses create a separate editable copy on first change<br>outline crates: ghost boxes that a "!" crate in the SAME GROUP turns real when hit</div>',
      ),
    );

    // play — always visible under the tabs
    const test = h(
      '<button class="ed-btn ed-test">▶ TEST (play it)</button>',
    ) as HTMLButtonElement;
    test.addEventListener("click", () => {
      this.hooks.exitToPlay();
      test.blur();
    });
    panel.appendChild(test);

    document.body.appendChild(panel);
    this.panel = panel;
    this.injectStyle();
  }

  // one pop-out at a time (photoshop-dock rules); '' closes both
  private setPop(which: "add" | "layers" | "", persist = true): void {
    if (this.popAdd)
      this.popAdd.style.display = which === "add" ? "block" : "none";
    if (this.popLayers)
      this.popLayers.style.display = which === "layers" ? "block" : "none";
    this.tabAdd?.classList.toggle("ed-tab-on", which === "add");
    this.tabLayers?.classList.toggle("ed-tab-on", which === "layers");
    if (persist)
      try {
        localStorage.setItem(`solProtoEditorPop:${this.targetId}`, which);
      } catch {
        /* ignore */
      }
    if (which === "layers") this.renderLayers();
  }

  // right-panel tab: selection fields vs project (level/file/help)
  private setPanelTab(which: "sel" | "proj"): void {
    this.panelTab = which;
    if (this.selPane)
      this.selPane.style.display = which === "sel" ? "" : "none";
    if (this.projPane)
      this.projPane.style.display = which === "proj" ? "" : "none";
    this.tabSelBtn?.classList.toggle("ed-ptab-on", which === "sel");
    this.tabProjBtn?.classList.toggle("ed-ptab-on", which === "proj");
  }

  // aim the orbit camera straight down a world axis at the current focus,
  // keeping the zoom. Already on that axis? Flip to the opposite side.
  snapView(axis: "x" | "y" | "z"): void {
    if (!this.controls) return;
    this.cameraDirty = true;
    const t = this.controls.target;
    const off = new THREE.Vector3().subVectors(this.camera.position, t);
    const u = {
      x: new THREE.Vector3(1, 0, 0),
      y: new THREE.Vector3(0, 1, 0),
      z: new THREE.Vector3(0, 0, 1),
    }[axis];
    // keep the on-screen framing: how tall the current view is at the target
    const halfView =
      Math.max(4, off.length()) *
      Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const along = off.dot(u) / Math.max(1e-4, off.length());
    // same-axis press again = look from the other side; entering = nearest side
    const sign =
      this.viewMode === axis ? -(Math.sign(along) || 1) : Math.sign(along) || 1;
    if (this.viewMode === "3d") {
      // remember the free view (the 3D button restores it exactly)
      this.saved3D = {
        p: this.camera.position.clone(),
        t: t.clone(),
        fov: this.camera.fov,
      };
    }
    this.viewMode = axis;
    // near-flat projection: a long lens from far away reads as a 2D plan view
    this.camera.fov = 8;
    this.camera.updateProjectionMatrix();
    const d = halfView / Math.tan(THREE.MathUtils.degToRad(4));
    const pos = t.clone().addScaledVector(u, d * sign);
    if (axis === "y") pos.z += d * 0.01; // dead-vertical lookAt degenerates (up ∥ view)
    this.camera.position.copy(pos);
    this.camera.lookAt(t);
    this.controls.enableRotate = false; // 2D: pan + zoom only, no orbiting out of plane
    this.markViewButtons();
    this.hooks.showMsg(
      `${axis.toUpperCase()} VIEW · 2D`,
      `drag moves in the ${axis === "y" ? "X/Z" : axis === "x" ? "Z/Y" : "X/Y"} plane · ${axis.toUpperCase()} again = other side · 3D = back`,
    );
    this.saveCam();
  }

  // the 3D button: back to the free orbit view saved when 2D was entered
  to3D(): void {
    if (!this.controls || this.viewMode === "3d") return;
    this.viewMode = "3d";
    if (this.saved3D) {
      this.camera.fov = this.saved3D.fov;
      this.camera.position.copy(this.saved3D.p);
      this.controls.target.copy(this.saved3D.t);
    } else {
      this.camera.fov = TUNING.camFov;
    }
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.controls.target);
    this.controls.enableRotate = true;
    this.markViewButtons();
    this.saveCam();
  }

  private markViewButtons(): void {
    for (const [k, b] of Object.entries(this.viewBtns)) {
      b.classList.toggle("ed-viewbtn-on", k === this.viewMode);
    }
  }

  // ---- outliner (the layers pop-out): items + groups as a tree ----

  private itemLabel(idx: number): string {
    const c = this.data.components[idx];
    if (!c) return "?";
    if (c.nm) {
      if (c.t === "trickgate" || c.t === "trickrail")
        return `${c.nm} · requires ${deckTrickInfo(c.trick ?? "kick").label}`;
      return c.nm;
    }
    if (c.t === "wallpath") return `bendy wall · ${c.pts?.length ?? 0} nodes`;
    if (c.pts && c.pts.length >= 3) return `${c.t} · drawn`;
    if (c.t === "crate")
      return `crate · ${c.kind ?? "wood"}${c.outline ? " (outline)" : ""}`;
    if (c.t === "enemy") return `foe · ${c.foe ?? "grunt"}`;
    if (c.t === "terrain") return `ground · ${c.pts?.length ?? 0} nodes`;
    if (c.t === "woodpath") return `wood path · ${c.pts?.length ?? 0} nodes`;
    if (c.t === "trickgate")
      return `trick gate · ${deckTrickInfo(c.trick ?? "kick").label}`;
    if (c.t === "trickrail")
      return `trick rail · ${deckTrickInfo(c.trick ?? "kick").label}`;
    if (c.t === "returnportal") return "return portal";
    if (c.t === "trampoline") return "trampoline pad";
    if (c.t === "speedpad") return "speed pad";
    if (c.t === "grindosaurus") return "Grindosaurus";
    if (c.t === "angryball") return "Angry Ball";
    if (c.t === "decor")
      return DECOR_LABELS[(c.dkind ?? "fern") as DecorKind] ?? "decor";
    if (c.t === "wall" && c.invisible) return "invis wall";
    if (c.t === "clock") return "tt clock";
    if (c.t === "comboorb") return "combo orb";
    if (c.t === "camnode") {
      // show the node's position in the chain: "cam node 2/5"
      const nodes = this.data.components.filter((o) => o.t === "camnode");
      return `cam node ${nodes.indexOf(c) + 1}/${nodes.length}`;
    }
    return c.t;
  }

  private groupLabel(gid: number): string {
    return this.data.groups?.find((g) => g.id === gid)?.nm ?? `group ${gid}`;
  }

  // inline rename input, shared by group and item rows
  private renameField(
    current: string,
    done: (v: string) => void,
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.className = "ed-layername-input";
    input.value = current;
    input.addEventListener("keydown", (ev) => {
      if (ev.code === "Enter") input.blur();
      ev.stopPropagation(); // typing guard: editor hotkeys stay out
    });
    input.addEventListener("blur", () => {
      this.renaming = null;
      done(input.value.trim());
      this.commit(false);
      this.renderLayers();
    });
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
    return input;
  }

  private renderLayers(): void {
    if (!this.layersEl) return;
    this.layersEl.innerHTML = "";
    const groups = this.data.groups ?? [];
    const childGroups = (parent: number | undefined): number[] =>
      groups.filter((g) => g.parent === parent).map((g) => g.id);
    const directItems = (gid: number | undefined): number[] => {
      const out: number[] = [];
      this.data.components.forEach((c, i) => {
        if (c.grp === gid) out.push(i);
      });
      return out;
    };

    const itemRow = (idx: number, depth: number): HTMLElement => {
      const c = this.data.components[idx];
      const row = document.createElement("div");
      row.className =
        "ed-layerrow" + (this.sel.includes(idx) ? " ed-layer-sel" : "");
      row.style.paddingLeft = `${4 + depth * 12}px`;
      const lock = document.createElement("button");
      lock.className = "ed-lbtn" + (c.lk ? " ed-lockon" : "");
      lock.textContent = "🔒"; // same padlock always; opacity tells the state apart
      lock.style.opacity = c.lk ? "1" : "0.2";
      lock.title = c.lk ? "unlock" : "lock (click-through, edit-proof)";
      lock.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (c.lk) delete c.lk;
        else c.lk = true;
        if (c.lk) this.setSelection(this.sel.filter((i) => i !== idx));
        this.commit(false);
      });
      row.appendChild(lock);
      if (this.renaming?.kind === "item" && this.renaming.id === idx) {
        row.appendChild(
          this.renameField(this.itemLabel(idx), (v) => {
            if (v) c.nm = v;
            else delete c.nm;
          }),
        );
      } else {
        const name = document.createElement("button");
        name.className = "ed-layername";
        name.textContent = this.itemLabel(idx);
        name.title = "click: select · double-click: fly to it (✎ to rename)";
        name.addEventListener("click", () => {
          if (!this.isLockedIdx(idx)) this.setSelection([idx]);
        });
        name.addEventListener("dblclick", (ev) => {
          ev.stopPropagation();
          if (!this.isLockedIdx(idx)) this.setSelection([idx]);
          this.focusOnItem(idx); // navigate the camera to this piece
        });
        row.appendChild(name);
      }
      const tag = document.createElement("span");
      tag.className = "ed-layercount";
      tag.textContent = `#${idx}`;
      row.appendChild(tag);
      const ren = document.createElement("button");
      ren.className = "ed-lbtn";
      ren.textContent = "✎";
      ren.title = "rename";
      ren.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.renaming = { kind: "item", id: idx };
        this.renderLayers();
      });
      row.appendChild(ren);
      return row;
    };

    const groupNode = (gid: number, depth: number, host: HTMLElement): void => {
      const members = this.groupMembers(gid);
      const open = !this.closedGroups.has(gid);
      const row = document.createElement("div");
      const allSel =
        members.length > 0 &&
        members.every((m) => this.sel.includes(m) || this.isLockedIdx(m));
      row.className =
        "ed-layerrow ed-grouprow" + (allSel ? " ed-layer-sel" : "");
      row.style.paddingLeft = `${4 + depth * 12}px`;
      const caret = document.createElement("button");
      caret.className = "ed-lbtn ed-caret";
      caret.textContent = open ? "▾" : "▸";
      caret.title = open ? "collapse" : "expand";
      caret.addEventListener("click", (ev) => {
        ev.stopPropagation();
        if (open) this.closedGroups.add(gid);
        else this.closedGroups.delete(gid);
        this.renderLayers();
      });
      row.appendChild(caret);
      const allLocked =
        members.length > 0 && members.every((m) => this.isLockedIdx(m));
      const lock = document.createElement("button");
      lock.className = "ed-lbtn" + (allLocked ? " ed-lockon" : "");
      lock.textContent = "🔒";
      lock.style.opacity = allLocked ? "1" : "0.2";
      lock.title = allLocked ? "unlock group" : "lock whole group";
      lock.addEventListener("click", (ev) => {
        ev.stopPropagation();
        for (const m of members) {
          if (allLocked) delete this.data.components[m].lk;
          else this.data.components[m].lk = true;
        }
        if (!allLocked)
          this.setSelection(this.sel.filter((i) => !members.includes(i)));
        this.commit(false);
      });
      row.appendChild(lock);
      if (this.renaming?.kind === "group" && this.renaming.id === gid) {
        row.appendChild(
          this.renameField(this.groupLabel(gid), (v) => {
            const g = this.data.groups?.find((x) => x.id === gid);
            if (g) {
              if (v) g.nm = v;
              else delete g.nm;
            }
          }),
        );
      } else {
        const name = document.createElement("button");
        name.className = "ed-layername ed-groupname";
        name.textContent = this.groupLabel(gid);
        name.title =
          "click: select the whole group · double-click: fly to it (✎ to rename)";
        name.addEventListener("click", () => {
          this.setSelection(members.filter((m) => !this.isLockedIdx(m)));
        });
        name.addEventListener("dblclick", (ev) => {
          ev.stopPropagation();
          this.setSelection(members.filter((m) => !this.isLockedIdx(m)));
          this.focusOnGroup(gid); // navigate the camera to the whole group
        });
        row.appendChild(name);
      }
      const n = document.createElement("span");
      n.className = "ed-layercount";
      n.textContent = String(members.length);
      row.appendChild(n);
      const ren = document.createElement("button");
      ren.className = "ed-lbtn";
      ren.textContent = "✎";
      ren.title = "rename group";
      ren.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this.renaming = { kind: "group", id: gid };
        this.renderLayers();
      });
      row.appendChild(ren);
      host.appendChild(row);
      if (!open) return;
      for (const sub of childGroups(gid)) groupNode(sub, depth + 1, host);
      for (const idx of directItems(gid))
        host.appendChild(itemRow(idx, depth + 1));
    };

    // root groups first, then loose items — every piece is a row somewhere
    for (const gid of childGroups(undefined)) groupNode(gid, 0, this.layersEl);
    for (const idx of directItems(undefined))
      this.layersEl.appendChild(itemRow(idx, 0));
    if (this.data.components.length === 0) {
      const empty = document.createElement("div");
      empty.className = "ed-dim";
      empty.textContent = "nothing yet — add pieces from the ▦ ADD tab";
      this.layersEl.appendChild(empty);
    }
  }

  // a labelled number field that commits on change
  // texture dropdown: the surface-kind list shared with the game builder
  /**
   * A labelled dropdown over an explicit option list, with a first entry that
   * means "leave it unset". The library props lean on that: an unset model or
   * colour is not a missing value, it is the prop rolling its own from where
   * it stands, and the empty option says so out loud.
   */
  private pickRow(
    label: string,
    options: [string, string][],
    get: () => string,
    set: (v: string) => void,
    anyLabel: string,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "ed-row";
    const lab = document.createElement("label");
    lab.textContent = label;
    const sel = document.createElement("select");
    for (const [value, text] of [
      ["", anyLabel] as [string, string],
      ...options,
    ]) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      sel.appendChild(opt);
    }
    sel.value = get();
    sel.addEventListener("change", () => {
      set(sel.value);
      this.commit();
      this.renderProps();
    });
    row.appendChild(lab);
    row.appendChild(sel);
    return row;
  }

  private appendTrickPicker(c: CustomComponent): void {
    const select = document.createElement("select");
    select.className = "ed-select";
    for (const { kind, label } of DECK_TRICKS) {
      const option = document.createElement("option");
      option.value = kind;
      option.textContent = `requires ${label}`;
      option.selected = (c.trick ?? "kick") === kind;
      select.appendChild(option);
    }
    const recipe = document.createElement("div");
    recipe.className = "ed-dim";
    const syncRecipe = (): void => {
      recipe.textContent = `input · ${deckTrickInfo(c.trick ?? "kick").recipe} · board air`;
    };
    syncRecipe();
    select.addEventListener("change", () => {
      c.trick = select.value as CustomComponent["trick"];
      syncRecipe();
      this.commit();
      this.renderLayers();
    });
    this.propsEl.appendChild(select);
    this.propsEl.appendChild(recipe);
  }

  private texRow(
    get: () => string | undefined,
    set: (v: string | undefined) => void,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "ed-row";
    const lab = document.createElement("label");
    lab.textContent = "texture";
    const sel = document.createElement("select");
    for (const k of TEX_KINDS) {
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = k;
      sel.appendChild(opt);
    }
    sel.value = get() ?? "checker";
    sel.addEventListener("change", () => {
      set(sel.value === "checker" ? undefined : sel.value);
      this.commit();
    });
    row.appendChild(lab);
    row.appendChild(sel);
    return row;
  }

  // Rotate the whole selection 90° about its center — the way you turn a
  // stretch of course sideways for a side-scroll zone. Positions orbit the
  // pivot; yaw-capable items add the turn; drawn shapes rotate their node
  // coordinates; zones swap footprint AND remap their travel direction so the
  // side-scroll follows the rotated geometry.
  private rotateSelection(deg: 90 | -90): void {
    const comps = this.sel.map((i) => this.data.components[i]);
    if (comps.length === 0) return;
    let cx = 0;
    let cz = 0;
    for (const c of comps) {
      cx += c.p[0];
      cz += c.p[2];
    }
    cx /= comps.length;
    cz /= comps.length;
    // R(+90) about +Y sends (x, z) -> (z, -x); R(-90) sends it to (-z, x) —
    // the same transform three.js applies for rotation.y, so positions and
    // per-item yaw stay in perfect agreement.
    const rot = (x: number, z: number): [number, number] =>
      deg === 90 ? [z, -x] : [-z, x];
    const yawable = new Set([
      "platform",
      "ramp",
      "wall",
      "wallpath",
      "crumble",
      "rock",
      "rail",
      "trickrail",
      "rope",
      "enemy",
      "pendulum",
      "ropeswing",
      "pit",
      "gate",
      "vertramp",
      "trampoline",
      "speedpad",
      "trickgate",
      "returnportal",
      "grindosaurus",
      "angryball",
      "decor",
    ]);
    for (const c of comps) {
      if (
        c.t === "crusher" ||
        c.t === "mover" ||
        c.t === "phasepad" ||
        c.t === "zone"
      )
        this.materializeDims(c);
      const [rx, rz] = rot(c.p[0] - cx, c.p[2] - cz);
      c.p = [
        Math.round((cx + rx) * 100) / 100,
        c.p[1],
        Math.round((cz + rz) * 100) / 100,
      ];
      if (c.pts) {
        c.pts = c.pts.map((pt) => {
          const [nx, nz] = rot(pt[0], pt[1]);
          const out = [...pt] as typeof pt;
          out[0] = Math.round(nx * 100) / 100;
          out[1] = Math.round(nz * 100) / 100;
          return out;
        });
      } else if (c.t === "zone") {
        if (c.s) c.s = [c.s[2], c.s[1], c.s[0]];
        const map: Record<"E" | "W" | "N" | "S", "E" | "W" | "N" | "S"> =
          deg === 90
            ? { W: "N", N: "E", E: "S", S: "W" }
            : { E: "N", N: "W", W: "S", S: "E" };
        c.dir = map[c.dir ?? "E"];
      } else if (c.t === "crusher") {
        if (c.s) c.s = [c.s[2], c.s[1], c.s[0]];
      } else if (c.t === "mover") {
        if (c.s) c.s = [c.s[2], c.s[1], c.s[0]];
        if (c.axis === "x") c.axis = "z";
        else if (c.axis === "z") c.axis = "x"; // a lift ("y") stays a lift
      } else if (c.t === "phasepad") {
        if (c.s) c.s = [c.s[2], c.s[1], c.s[0]];
      } else if (yawable.has(c.t)) {
        c.yaw = ((((c.yaw ?? 0) + deg) % 360) + 360) % 360;
      }
      // Symmetric travel axes rotate with their owner. Direction sign is not
      // authored (motion is ±range), so a quarter turn is exactly an X/Z swap.
      if (
        (c.t === "rail" || c.t === "ropeswing") &&
        (c.axis === "x" || c.axis === "z")
      )
        c.axis = c.axis === "x" ? "z" : "x";
      if (c.t === "stone") c.axis = c.axis === "x" ? "z" : "x";
      if (c.t === "returnportal") {
        if (c.to) {
          const [tx, tz] = rot(c.to[0] - cx, c.to[2] - cz);
          c.to = [
            Math.round((cx + tx) * 100) / 100,
            c.to[1],
            Math.round((cz + tz) * 100) / 100,
          ];
        }
        // exitYaw uses -Z as zero. Rotate the actual heading vector, then
        // convert it back, rather than assuming its sign convention matches
        // component yaw.
        const exit = THREE.MathUtils.degToRad(c.exitYaw ?? 0);
        const [hx, hz] = rot(Math.sin(exit), -Math.cos(exit));
        c.exitYaw =
          ((THREE.MathUtils.radToDeg(Math.atan2(hx, -hz)) % 360) + 360) %
          360;
      }
    }
    this.commit();
    this.renderProps();
  }

  private numRow(
    label: string,
    get: () => number,
    set: (v: number) => void,
    step = 0.5,
  ): HTMLElement {
    const row = document.createElement("div");
    row.className = "ed-row";
    const lab = document.createElement("label");
    lab.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.step = String(step);
    input.value = String(get());
    input.title = "shift+↑/↓ = ±10 · drag up/down to scrub";
    // read the field, apply it, coalesce bursts into one undo step, resync
    const apply = (commitChange = true): void => {
      const v = parseFloat(input.value);
      if (isFinite(v)) {
        set(THREE.MathUtils.clamp(v, -100_000, 100_000));
        if (commitChange) this.commit(true, `num:${label}`);
        else this.hooks.rebuild();
      }
      input.value = String(get());
    };
    input.addEventListener("change", () => apply());
    // SHIFT+ARROW = coarse ±10 steps (plain arrows keep the field's fine step)
    input.addEventListener("keydown", (e) => {
      if (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const cur = parseFloat(input.value) || 0;
        input.value = String(
          +(cur + (e.key === "ArrowUp" ? 10 : -10)).toFixed(4),
        );
        apply();
      }
    });
    // DRAG-SCRUB: press and drag up/down on the field to slide the value
    // (Blender/Figma style). Shift while scrubbing = coarse. A plain click
    // (no drag) still focuses the field for typing.
    let scrub: {
      y: number;
      val: number;
      moved: boolean;
      id: number;
      source: string;
    } | null =
      null;
    let lastScrub = 0;
    input.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      scrub = {
        y: e.clientY,
        val: parseFloat(input.value) || 0,
        moved: false,
        id: e.pointerId,
        source: JSON.stringify(this.data),
      };
      this.cancelScrub = () => endScrub(true);
    });
    input.addEventListener("pointermove", (e) => {
      if (!scrub) return;
      const dy = scrub.y - e.clientY; // up = increase
      if (!scrub.moved) {
        if (Math.abs(dy) < 3) return; // small movement is still a click
        scrub.moved = true;
        try {
          input.setPointerCapture(scrub.id);
        } catch {
          /* capture optional */
        }
        input.style.cursor = "ns-resize";
        input.blur(); // no text caret while scrubbing
      }
      e.preventDefault();
      const per = e.shiftKey ? 2 : 0.25; // world units per pixel
      input.value = String(+(scrub.val + dy * per).toFixed(3));
      const now = performance.now();
      if (now - lastScrub > 60) {
        lastScrub = now;
        apply(false);
      }
    });
    const endScrub = (cancel = false): void => {
      if (scrub?.moved) {
        try {
          input.releasePointerCapture(scrub.id);
        } catch {
          /* ignore */
        }
        input.style.cursor = "";
        if (cancel) {
          this.data = migrateCustomLevel(
            JSON.parse(scrub.source) as CustomLevelData,
          );
          this.hooks.resetPreview();
          this.renderProps();
        } else apply(); // land the final value
      }
      scrub = null;
      this.cancelScrub = null;
    };
    input.addEventListener("pointerup", () => endScrub(false));
    input.addEventListener("pointercancel", () => endScrub(true));
    input.addEventListener("lostpointercapture", () => endScrub(true));
    row.appendChild(lab);
    row.appendChild(input);
    return row;
  }

  // properties for the current selection, generated per component type
  private renderProps(): void {
    this.panel.dataset.editorTarget = this.targetId;
    this.panel.dataset.editorChanged = this.changedThisSession ? "1" : "0";
    this.panel.dataset.editorComponentCount = String(this.data.components.length);
    this.propsEl.innerHTML = "";
    if (this.sel.length === 0 || !this.data.components[this.selected]) {
      this.propsEl.innerHTML =
        '<div class="ed-dim">click a component…<br>shift-click adds · shift-drag empty space = box select</div>';
      return;
    }
    // MULTI-selection: a group toolkit instead of per-type fields
    if (this.sel.length > 1) {
      const counts = new Map<string, number>();
      for (const i of this.sel) {
        const t = this.data.components[i].t;
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
      const parts = [...counts.entries()]
        .map(([t, n]) => (n > 1 ? `${t} ×${n}` : t))
        .join(" · ");
      const head = document.createElement("div");
      head.className = "ed-selhead";
      head.textContent = `${this.sel.length} selected`;
      this.propsEl.appendChild(head);
      const list = document.createElement("div");
      list.className = "ed-dim ed-sellist";
      list.textContent = parts;
      this.propsEl.appendChild(list);
      const grid = document.createElement("div");
      grid.className = "ed-grid";
      const mkBtn = (label: string, fn: () => void, danger = false): void => {
        const b = document.createElement("button");
        b.className = danger ? "ed-btn ed-danger" : "ed-btn";
        b.textContent = label;
        b.addEventListener("click", () => {
          fn();
          b.blur();
        });
        grid.appendChild(b);
      };
      mkBtn("copy ⌘C", () => this.copySelected());
      mkBtn("duplicate ⌘D", () => this.duplicateSelected());
      mkBtn("rotate ⟲ 90°", () => this.rotateSelection(90));
      mkBtn("rotate ⟳ 90°", () => this.rotateSelection(-90));
      mkBtn("group ⌘G", () => this.groupSelection());
      if (this.sel.some((i) => this.chainOf(i).length > 0)) {
        mkBtn("ungroup ⌘⇧G", () => this.ungroupSelection());
      }
      mkBtn("match height", () => {
        // align the group to the PRIMARY's y — the fast way to level a row
        const y = this.data.components[this.selected].p[1];
        for (const i of this.sel) this.data.components[i].p[1] = y;
        this.commit();
      });
      mkBtn("delete", () => this.deleteSelected(), true);
      this.propsEl.appendChild(grid);
      const all = this.sel.map((i) => this.data.components[i]);
      const prim = this.data.components[this.selected];
      // POSITION is per-piece, NOT a shared value: the layout IS the
      // relationship between pieces. Editing x/y/z MOVES the whole selection
      // by the delta from the primary's coordinate — exactly like dragging —
      // so relative offsets are preserved. (Setting them all to one absolute
      // value would collapse the level; that's what "match height" is for, on
      // purpose.) Each axis carries its OWN grouping key so a spinner burst on
      // one axis doesn't coalesce with another.
      const posHdr = document.createElement("div");
      posHdr.className = "ed-dim";
      posHdr.textContent = `position — moves all ${this.sel.length} together:`;
      this.propsEl.appendChild(posHdr);
      const prow = (label: string, axis: 0 | 1 | 2): void =>
        void this.propsEl.appendChild(
          this.numRow(
            label,
            () => prim.p[axis],
            (v) => {
              const d = v - prim.p[axis];
              if (d) for (const cc of all) cc.p[axis] += d;
            },
          ),
        );
      prow("x", 0);
      prow("y", 1);
      prow("z", 2);
      // GROUP SIZE (Figma): the selection's overall bounding-box dimensions.
      // Typing one SCALES the whole selection about the box's low corner —
      // scalable pieces resize, fixed-size pieces (crates, pickups...) keep
      // their size but reposition proportionally. "proportional" links axes.
      const gb0 = this.selectionBounds();
      if (gb0) {
        const sizeHdr = document.createElement("div");
        sizeHdr.className = "ed-dim";
        sizeHdr.textContent = "group size — scales the whole selection:";
        this.propsEl.appendChild(sizeHdr);
        const propBtn = document.createElement("button");
        propBtn.className = "ed-btn";
        propBtn.textContent = `proportional: ${this.scaleProp ? "ON" : "OFF"}`;
        propBtn.addEventListener("click", () => {
          this.scaleProp = !this.scaleProp;
          this.renderProps();
        });
        this.propsEl.appendChild(propBtn);
        const gdim = (label: string, comp: 0 | 1 | 2): void => {
          const liveSize = (): number => {
            const b = this.selectionBounds();
            return b
              ? +b.getSize(new THREE.Vector3()).getComponent(comp).toFixed(2)
              : 0;
          };
          this.propsEl.appendChild(
            this.numRow(label, liveSize, (v) => {
              const b = this.selectionBounds();
              if (!b) return;
              const cur = b.getSize(new THREE.Vector3()).getComponent(comp);
              if (cur < 1e-3 || v <= 0) return;
              const f = v / cur;
              const anchor = b.min.clone();
              if (this.scaleProp) this.scaleSelection(f, f, f, anchor, "gsize");
              else
                this.scaleSelection(
                  comp === 0 ? f : 1,
                  comp === 1 ? f : 1,
                  comp === 2 ? f : 1,
                  anchor,
                  `gsize${comp}`,
                );
            }),
          );
        };
        gdim("group width", 0);
        gdim("group height", 1);
        gdim("group depth", 2);
      }
      // SHARED variables (Figma): a field that is genuinely one value across
      // the selection (size, spin) shows once and batch-writes to all.
      const shared = document.createElement("div");
      shared.className = "ed-dim";
      shared.textContent = `shared values (apply to all ${this.sel.length}):`;
      this.propsEl.appendChild(shared);
      const brow = (
        label: string,
        get: () => number,
        set: (cc: CustomComponent, v: number) => void,
        step = 0.5,
      ): void =>
        void this.propsEl.appendChild(
          this.numRow(label, get, (v) => all.forEach((cc) => set(cc, v)), step),
        );
      if (all.every((cc) => cc.s)) {
        brow(
          "width",
          () => prim.s![0],
          (cc, v) => (cc.s![0] = Math.max(0.2, v)),
        );
        brow(
          "height",
          () => prim.s![1],
          (cc, v) => (cc.s![1] = Math.max(0.2, v)),
        );
        brow(
          "depth",
          () => prim.s![2],
          (cc, v) => (cc.s![2] = Math.max(0.2, v)),
        );
      }
      const yawable = new Set([
        "platform",
        "ramp",
        "wall",
        "wallpath",
        "pit",
        "crumble",
        "rock",
        "pendulum",
        "ropeswing",
        "enemy",
        "rail",
        "trickrail",
        "rope",
        "gate",
        "vertramp",
        "trampoline",
        "speedpad",
        "trickgate",
        "returnportal",
        "grindosaurus",
        "angryball",
        "decor",
      ]);
      if (all.every((cc) => yawable.has(cc.t) && !cc.pts)) {
        brow(
          "yaw °",
          () => prim.yaw ?? 0,
          (cc, v) => (cc.yaw = v),
          15,
        );
      }
      if (all.every((cc) => cc.len !== undefined)) {
        brow(
          "length",
          () => prim.len!,
          (cc, v) => (cc.len = Math.max(1, v)),
        );
      }
      if (all.every((cc) => cc.t === "enemy")) {
        brow(
          "speed",
          () => prim.speed ?? 3,
          (cc, v) => (cc.speed = Math.max(0.5, v)),
        );
        brow(
          "patrol range",
          () => prim.range ?? 5,
          (cc, v) => (cc.range = Math.max(0.5, v)),
        );
      }
      if (all.every((cc) => cc.t === "wallpath")) {
        brow(
          "thickness",
          () => prim.w ?? 1.2,
          (cc, v) => (cc.w = Math.max(0.1, v)),
        );
        brow(
          "height",
          () => prim.rise ?? 5,
          (cc, v) => (cc.rise = Math.max(0.2, v)),
        );
        brow(
          "collision height",
          () => prim.collisionHeight ?? prim.rise ?? 5,
          (cc, v) => (cc.collisionHeight = Math.max(0.2, v)),
        );
      }
      if (all.every((cc) => cc.t === "camnode")) {
        brow(
          "corner radius",
          () => prim.radius ?? 0,
          (cc, v) => (cc.radius = Math.max(0, v)),
        );
      }
      const colorable = new Set([
        "platform",
        "ramp",
        "wall",
        "wallpath",
        "crumble",
        "rock",
      ]);
      if (all.every((cc) => colorable.has(cc.t))) {
        const row = document.createElement("div");
        row.className = "ed-row";
        const lab = document.createElement("label");
        lab.textContent = "color";
        const input = document.createElement("input");
        input.type = "color";
        input.value = prim.color ?? "#ffffff";
        input.addEventListener("change", () => {
          for (const cc of all) cc.color = input.value;
          this.commit();
        });
        row.appendChild(lab);
        row.appendChild(input);
        this.propsEl.appendChild(row);
        // batch texture: one pick re-surfaces the whole selection
        this.propsEl.appendChild(
          this.texRow(
            () => prim.tex,
            (v) => {
              for (const cc of all) cc.tex = v;
            },
          ),
        );
      }
      const hint = document.createElement("div");
      hint.className = "ed-dim";
      hint.textContent =
        'drag any selected piece to move the group · arrows nudge · a "!" crate grouped with outline crates becomes their switch';
      this.propsEl.appendChild(hint);
      return;
    }
    const c = this.data.components[this.selected];
    const head = document.createElement("div");
    head.className = "ed-selhead";
    const inGroup = this.chainOf(this.selected).length > 0;
    head.textContent = `#${this.selected} · ${c.t}${inGroup ? " · in group" : ""}`;
    this.propsEl.appendChild(head);
    const num = (
      label: string,
      get: () => number,
      set: (v: number) => void,
      step = 0.5,
    ): void =>
      void this.propsEl.appendChild(this.numRow(label, get, set, step));
    num(
      "x",
      () => c.p[0],
      (v) => (c.p[0] = v),
    );
    num(
      "y",
      () => c.p[1],
      (v) => (c.p[1] = v),
    );
    num(
      "z",
      () => c.p[2],
      (v) => (c.p[2] = v),
    );
    const sizeRow = (idx: number, label: string): void => {
      const defaults = this.defaultSizeFor(c) ?? [8, 1, 8];
      num(
        label,
        () => c.s?.[idx] ?? defaults[idx],
        (v) => {
          const size = c.s ? [...c.s] : [...defaults];
          size[idx] = Math.max(0.2, v);
          c.s = size as [number, number, number];
        },
      );
    };
    const boolRow = (
      labelText: string,
      checked: () => boolean,
      set: (value: boolean) => void,
    ): void => {
      const row = document.createElement("div");
      row.className = "ed-row";
      const label = document.createElement("label");
      label.textContent = labelText;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = checked();
      checkbox.addEventListener("change", () => {
        set(checkbox.checked);
        this.commit();
      });
      row.append(label, checkbox);
      this.propsEl.appendChild(row);
    };
    const colorRow = (): void => {
      const row = document.createElement("div");
      row.className = "ed-row";
      const lab = document.createElement("label");
      lab.textContent = "color";
      const input = document.createElement("input");
      input.type = "color";
      input.value = c.color ?? "#ffffff";
      input.addEventListener("change", () => {
        c.color = input.value;
        this.commit();
      });
      row.appendChild(lab);
      row.appendChild(input);
      this.propsEl.appendChild(row);
      // TEXTURE: every paintable surface picks from the shared kind list —
      // the tint above colors the texture, so the two knobs compose
      this.propsEl.appendChild(
        this.texRow(
          () => c.tex,
          (v) => (c.tex = v),
        ),
      );
    };
    // Figma-style node editing: with a shape in resize mode, grabbing a node
    // selects it and its CORNER RADIUS is editable here. Rounds the visual,
    // the collision, the kill footprint, and the grind line alike.
    const nodeRows = (): void => {
      if (!c.pts) return;
      const picked = [...this.selVtxs].filter(
        (i) => i >= 0 && i < c.pts!.length,
      );
      if (this.resizeIdx === this.selected && picked.length > 0) {
        // one field batch-edits every selected node (Figma). Values shown are
        // WORLD coordinates; writing x/z to a multi-selection aligns the
        // nodes onto that line. Rails also expose per-node height — grind
        // lines climb and dive; polygons stay planar (collision needs it).
        const tag =
          picked.length > 1
            ? `${picked.length} nodes`
            : `node ${picked[0] + 1}`;
        const mutate = (
          vi: number,
          mut: (nt: [number, number, number, number, number]) => void,
        ): void => {
          const nt = [...c.pts![vi]] as [number, number, number, number, number];
          if (nt[2] === undefined) nt[2] = 0; // radius slot (0 = square corner)
          mut(nt);
          c.pts![vi] = nt;
        };
        num(
          `${tag} · x`,
          () => c.p[0] + c.pts![picked[0]][0],
          (v) => {
            for (const vi of picked) mutate(vi, (nt) => (nt[0] = v - c.p[0]));
          },
        );
        if (
          c.t === "rail" ||
          c.t === "trickrail" ||
          c.t === "terrain" ||
          c.t === "woodpath" ||
          c.t === "wallpath"
        ) {
          num(
            `${tag} · y`,
            () => c.p[1] + (c.pts![picked[0]][3] ?? 0),
            (v) => {
              for (const vi of picked) mutate(vi, (nt) => (nt[3] = v - c.p[1]));
            },
          );
        }
        num(
          `${tag} · z`,
          () => c.p[2] + c.pts![picked[0]][1],
          (v) => {
            for (const vi of picked) mutate(vi, (nt) => (nt[1] = v - c.p[2]));
          },
        );
        if (c.t !== "woodpath" && c.t !== "terrain")
          num(
            `${tag} · radius`,
            () => c.pts![picked[0]][2] ?? 0,
            (v) => {
              for (const vi of picked)
                mutate(vi, (nt) => (nt[2] = Math.max(0, v)));
            },
          );
        if (c.t === "woodpath" || c.t === "vertramp") {
          num(
            `${tag} · bank °`,
            () => c.pts![picked[0]][4] ?? 0,
            (v) => {
              for (const vi of picked) mutate(vi, (nt) => (nt[4] = v));
            },
            1,
          );
        }
        if (c.t === "woodpath") {
          num(
            `${tag} · width`,
            () => c.widths?.[picked[0]] ?? c.w ?? 6,
            (v) => {
              if (!c.widths) c.widths = c.pts!.map(() => c.w ?? 6);
              for (const vi of picked) c.widths[vi] = Math.max(0.8, v);
            },
            0.25,
          );
        }
      } else {
        const tip = document.createElement("div");
        tip.className = "ed-dim";
        tip.textContent =
          c.t === "woodpath"
            ? "double-click, then grab a knot (shift adds · drag empty space = box-select): edit its position, height, bank, and width here"
            : c.t === "wallpath"
              ? "double-click, then grab a wall knot: edit its position, base height, and corner radius here"
            : c.t === "terrain"
              ? "double-click, then grab a centreline node: edit its position and height here"
              : c.t === "vertramp"
                ? "double-click, then grab a spine node: edit its position, height, corner radius, and bank here"
            : "double-click, then grab a node (shift adds · drag empty space = box-select nodes): edit its position + corner radius here";
        this.propsEl.appendChild(tip);
      }
    };
    if (c.t === "wallpath") {
      if (c.pts && c.pts.length >= 2) {
        const note = document.createElement("div");
        note.className = "ed-dim";
        note.textContent = `bendy wall · ${c.pts.length} nodes — double-click to edit its route`;
        this.propsEl.appendChild(note);
        nodeRows();
      }
      num("thickness", () => c.w ?? 1.2, (v) => (c.w = Math.max(0.1, v)), 0.1);
      if (!c.pts)
        num("length", () => c.len ?? 30, (v) => (c.len = Math.max(1, v)), 1);
      num("height", () => c.rise ?? 5, (v) => (c.rise = Math.max(0.2, v)), 0.25);
      num(
        "collision height",
        () => c.collisionHeight ?? c.rise ?? 5,
        (v) => (c.collisionHeight = Math.max(0.2, v)),
        0.25,
      );
      boolRow("solid collision", () => c.solid !== false, (value) => {
        if (value) delete c.solid;
        else c.solid = false;
      });
      boolRow("invisible in play", () => c.invisible === true, (value) => {
        if (value) c.invisible = true;
        else delete c.invisible;
      });
      const toggle = (text: () => string, action: () => void): void => {
        const button = document.createElement("button");
        button.className = "ed-btn";
        button.textContent = text();
        button.addEventListener("click", () => {
          action();
          this.commit();
          this.renderProps();
        });
        this.propsEl.appendChild(button);
      };
      toggle(
        () => `bends: ${c.curve === "spline" ? "smooth spline" : "filleted corners"}`,
        () => (c.curve = c.curve === "spline" ? "corner" : "spline"),
      );
      toggle(
        () => `path: ${c.closed ? "closed loop" : "open"}`,
        () => {
          const path = c.pts;
          if (!c.closed && (!path || path.length < 3)) {
            this.hooks.showMsg("NEED 3+ KNOTS", "add a knot before closing the wall");
            return;
          }
          c.closed = !c.closed;
        },
      );
      const pathAction = (label: string, action: () => void): void => {
        const button = document.createElement("button");
        button.className = "ed-btn";
        button.textContent = label;
        button.addEventListener("click", () => {
          action();
          this.commit();
          this.renderProps();
        });
        this.propsEl.appendChild(button);
      };
      const points = (): NonNullable<CustomComponent["pts"]> => {
        if (!c.pts) {
          const yaw = THREE.MathUtils.degToRad(c.yaw ?? 0);
          const half = (c.len ?? 30) / 2;
          const dx = Math.sin(yaw) * half;
          const dz = Math.cos(yaw) * half;
          c.pts = [[-dx, -dz], [dx, dz]];
          delete c.yaw;
          delete c.len;
        }
        return c.pts;
      };
      pathAction("+ add end knot", () => {
        const path = points();
        const last = path[path.length - 1];
        const before = path[path.length - 2] ?? [last[0], last[1] + 8];
        path.push([
          last[0] + (last[0] - before[0]),
          last[1] + (last[1] - before[1]),
          0,
          (last[3] ?? 0) + ((last[3] ?? 0) - (before[3] ?? 0)),
        ]);
      });
      pathAction("− remove end knot", () => {
        const path = points();
        if (path.length > 2) path.pop();
      });
      pathAction("reverse route", () => points().reverse());
      pathAction("preset: straight", () => {
        c.pts = [[0, 10], [0, -10]];
        delete c.yaw;
        c.closed = false;
      });
      pathAction("preset: curved", () => {
        c.pts = [[0, 10], [4, 4], [-3, -3], [0, -10]];
        delete c.yaw;
        c.curve = "spline";
        c.closed = false;
      });
      pathAction("preset: enclosure", () => {
        c.pts = [[-8, -6, 2], [8, -6, 2], [8, 6, 2], [-8, 6, 2]];
        delete c.yaw;
        c.curve = "corner";
        c.closed = true;
      });
      if (!c.invisible) colorRow();
    } else if (
      c.pts &&
      c.pts.length >= 2 &&
      (c.t === "woodpath" || c.t === "trickrail")
    ) {
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent = `${c.t === "woodpath" ? "wood path" : "trick rail"} · ${c.pts.length} nodes — double-click to edit its route`;
      this.propsEl.appendChild(note);
      nodeRows();
      if (c.t === "woodpath") {
        num("default width", () => c.w ?? 6, (v) => (c.w = Math.max(0.8, v)), 0.25);
        num(
          "plank spacing",
          () => c.spacing ?? 0.55,
          (v) => (c.spacing = Math.max(0.18, v)),
          0.05,
        );
        num(
          "support depth",
          () => c.supportDepth ?? c.rise ?? 3,
          (v) => (c.supportDepth = Math.max(0.8, v)),
          0.25,
        );
        num(
          "deck thickness",
          () => c.s?.[1] ?? 0.32,
          (v) => {
            const size = c.s ? [...c.s] : [1, 0.32, 1];
            size[1] = Math.max(0.08, v);
            c.s = size as [number, number, number];
          },
          0.05,
        );
        num("variation seed", () => c.seed ?? 7319, (v) => (c.seed = Math.round(v)), 1);
        num(
          "scaffold bay",
          () => c.baySpacing ?? 3.8,
          (v) => (c.baySpacing = Math.max(1.5, v)),
          0.25,
        );
        const toggle = (text: () => string, action: () => void): void => {
          const button = document.createElement("button");
          button.className = "ed-btn";
          button.textContent = text();
          button.addEventListener("click", () => {
            action();
            this.commit();
            this.renderProps();
          });
          this.propsEl.appendChild(button);
        };
        toggle(
          () => `path: ${c.curve === "spline" ? "smooth spline" : "linear"}`,
          () => (c.curve = c.curve === "spline" ? "corner" : "spline"),
        );
        toggle(
          () => `scaffold: ${c.scaffold ? "on" : "off"}`,
          () => (c.scaffold = !c.scaffold),
        );
        toggle(
          () => `support collision: ${(c.supports ?? c.scaffold) ? "on" : "off"}`,
          () => (c.supports = !(c.supports ?? c.scaffold)),
        );
        toggle(
          () => `post feet: ${c.terrainSupports ? "raycast to ground" : "fixed depth"}`,
          () => (c.terrainSupports = !c.terrainSupports),
        );
        toggle(
          () => `grind handrails: ${(c.rails ?? c.scaffold) ? "on" : "off"}`,
          () => (c.rails = !(c.rails ?? c.scaffold)),
        );
        const pathAction = (label: string, action: () => void): void => {
          const button = document.createElement("button");
          button.className = "ed-btn";
          button.textContent = label;
          button.addEventListener("click", () => {
            action();
            this.commit();
            this.renderProps();
          });
          this.propsEl.appendChild(button);
        };
        pathAction("+ add end knot", () => {
          const points = c.pts!;
          const last = points[points.length - 1];
          const before = points[points.length - 2] ?? [last[0], last[1] + 8];
          points.push([
            last[0] + (last[0] - before[0]),
            last[1] + (last[1] - before[1]),
            0,
            (last[3] ?? 0) + ((last[3] ?? 0) - (before[3] ?? 0)),
            last[4] ?? 0,
          ]);
          if (!c.widths) c.widths = points.slice(0, -1).map(() => c.w ?? 6);
          c.widths.push(c.widths[c.widths.length - 1] ?? c.w ?? 6);
        });
        pathAction("− remove end knot", () => {
          if (c.pts!.length <= 2) return;
          c.pts!.pop();
          c.widths?.pop();
        });
        pathAction("reverse route", () => {
          c.pts!.reverse();
          for (const point of c.pts!) {
            if (point[4] !== undefined) point[4] = -point[4];
          }
          c.widths?.reverse();
        });
        pathAction("preset: straight", () => {
          c.pts = [[0, 0, 0, 0, 0], [0, -36, 0, 0, 0]];
          c.widths = [c.w ?? 6, c.w ?? 6];
        });
        pathAction("preset: ramp", () => {
          c.pts = [[0, 0, 0, 0, 0], [0, -36, 0, 7, 0]];
          c.widths = [c.w ?? 6, c.w ?? 6];
        });
        pathAction("preset: serpentine", () => {
          c.pts = [
            [0, 0, 0, 0, 0],
            [5, -12, 0, 1.5, 5],
            [-5, -24, 0, 4, -5],
            [0, -38, 0, 6, 0],
          ];
          c.widths = [c.w ?? 6, (c.w ?? 6) * 1.1, (c.w ?? 6) * 0.9, c.w ?? 6];
        });
        colorRow();
      } else {
        this.appendTrickPicker(c);
      }
    } else if (
      c.pts &&
      c.pts.length >= 3 &&
      (c.t === "platform" || c.t === "wall" || c.t === "pit")
    ) {
      // drawn polygon: the outline is edited with the vertex handles
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent = `drawn polygon · ${c.pts.length} points — double-click to drag the corners`;
      this.propsEl.appendChild(note);
      if (c.t !== "pit") {
        num(
          c.t === "wall" ? "height" : "thickness",
          () => c.s?.[1] ?? (c.t === "wall" ? 4 : 1),
          (v) => {
            const size = c.s
              ? [...c.s]
              : [...(this.defaultSizeFor(c) ?? [8, 1, 8])];
            size[1] = Math.max(0.2, v);
            c.s = size as [number, number, number];
          },
        );
        if (c.t === "platform")
          boolRow("slippery surface", () => c.slip === true, (value) => {
            if (value) c.slip = true;
            else delete c.slip;
          });
        if (c.t === "wall") {
          num(
            "collision height",
            () => c.collisionHeight ?? c.s?.[1] ?? 4,
            (v) => (c.collisionHeight = Math.max(0.2, v)),
          );
          boolRow("invisible in play", () => c.invisible === true, (value) => {
            if (value) c.invisible = true;
            else delete c.invisible;
          });
        }
        if (!(c.t === "wall" && c.invisible)) colorRow();
      }
      nodeRows();
    } else if (c.t === "platform" || c.t === "wall") {
      sizeRow(0, "width");
      sizeRow(1, "height");
      sizeRow(2, "depth");
      if (c.t === "wall")
        num(
          "collision height",
          () => c.collisionHeight ?? c.s?.[1] ?? 4,
          (v) => (c.collisionHeight = Math.max(0.2, v)),
        );
      num(
        "yaw °",
        () => c.yaw ?? 0,
        (v) => (c.yaw = v),
        15,
      ); // platforms AND walls spin freely now
      if (c.t === "platform")
        boolRow("slippery surface", () => c.slip === true, (value) => {
          if (value) c.slip = true;
          else delete c.slip;
        });
      if (c.t === "wall")
        boolRow("invisible in play", () => c.invisible === true, (value) => {
          if (value) c.invisible = true;
          else delete c.invisible;
        });
      if (c.t === "wall" && c.invisible) {
        const note = document.createElement("div");
        note.className = "ed-dim";
        note.textContent = "invisible in play (ghost here)";
        this.propsEl.appendChild(note);
      } else {
        colorRow();
      }
    } else if (c.t === "pit") {
      sizeRow(0, "width");
      sizeRow(2, "depth");
      num(
        "yaw °",
        () => c.yaw ?? 0,
        (v) => (c.yaw = v),
        15,
      );
    } else if (c.t === "crumble") {
      sizeRow(0, "width");
      sizeRow(2, "depth");
      num(
        "fall delay",
        () => c.shake ?? 0.7,
        (v) => (c.shake = Math.max(0, v)),
        0.1,
      );
      num(
        "fall speed",
        () => c.speed ?? 30,
        (v) => (c.speed = Math.max(2, v)),
        5,
      );
      num(
        "yaw °",
        () => c.yaw ?? 0,
        (v) => (c.yaw = v),
        15,
      );
      colorRow();
    } else if (c.t === "ramp") {
      num(
        "length",
        () => c.len ?? 10,
        (v) => (c.len = Math.max(1, v)),
      );
      num(
        "rise",
        () => c.rise ?? 4,
        (v) => (c.rise = v),
      );
      num(
        "width",
        () => c.w ?? 8,
        (v) => (c.w = Math.max(1, v)),
      );
      num(
        "yaw °",
        () => c.yaw ?? 0,
        (v) => (c.yaw = v),
        15,
      );
      colorRow();
    } else if (c.t === "rail" || c.t === "trickrail") {
      if (c.pts && c.pts.length >= 2) {
        const note = document.createElement("div");
        note.className = "ed-dim";
        note.textContent = `rail path · ${c.pts.length} nodes — double-click to drag them`;
        this.propsEl.appendChild(note);
        nodeRows();
      } else {
        num(
          "length",
          () => c.len ?? 12,
          (v) => (c.len = Math.max(1, v)),
        );
        num(
          "yaw °",
          () => c.yaw ?? 0,
          (v) => (c.yaw = v),
          15,
        );
        if (c.t === "rail") {
          // travel > 0 sends the whole line ferrying on a cycle — a moving rail
          const axisBtn = document.createElement("button");
          axisBtn.className = "ed-btn";
          axisBtn.textContent = `travel: ${(c.axis ?? "x").toUpperCase()}${c.axis === "y" ? " (lift)" : ""}`;
          axisBtn.title =
            "which way the whole rail slides — X / Z slide, Y lifts (travel 0 = a fixed rail)";
          axisBtn.addEventListener("click", () => {
            c.axis = c.axis === "x" ? "z" : c.axis === "z" ? "y" : "x";
            this.commit();
            this.renderProps();
          });
          this.propsEl.appendChild(axisBtn);
          num("travel", () => c.amp ?? 0, (v) => (c.amp = Math.max(0, v)), 0.5);
          num("speed", () => c.speed ?? 0.6, (v) => (c.speed = Math.max(0, v)), 0.1);
          num("phase", () => c.phase ?? 0, (v) => (c.phase = v), 0.2);
        }
      }
      if (c.t === "rail")
        boolRow("invisible grind line", () => c.invisible === true, (value) => {
          if (value) c.invisible = true;
          else delete c.invisible;
        });
      if (c.t === "trickrail") {
        this.appendTrickPicker(c);
      }
    } else if (c.t === "trampoline" || c.t === "speedpad") {
      sizeRow(0, "width");
      sizeRow(1, "thickness");
      sizeRow(2, "depth");
      num("yaw °", () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      if (c.t === "trampoline") {
        num("launch", () => c.speed ?? 16, (v) => (c.speed = Math.max(0.1, v)), 0.5);
        num("held Jump ×", () => c.amp ?? 1.25, (v) => (c.amp = Math.max(1, v)), 0.05);
      } else {
        num("boost speed", () => c.speed ?? 48, (v) => (c.speed = Math.max(0.1, v)), 1);
        num("hold seconds", () => c.cycle ?? 3.9, (v) => (c.cycle = Math.max(0.05, v)), 0.1);
      }
    } else if (c.t === "trickgate") {
      sizeRow(0, "barrier width");
      sizeRow(1, "barrier height");
      sizeRow(2, "barrier depth");
      num("opening radius", () => c.radius ?? 2.2, (v) => (c.radius = Math.max(0.8, v)), 0.1);
      num("yaw °", () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      this.appendTrickPicker(c);
    } else if (c.t === "returnportal") {
      sizeRow(0, "width");
      sizeRow(1, "height");
      sizeRow(2, "depth");
      num("entrance yaw °", () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      const destination = (): [number, number, number] => c.to ?? c.p;
      const setDestination = (axis: 0 | 1 | 2, value: number): void => {
        const to = c.to ? [...c.to] : [...c.p];
        to[axis] = value;
        c.to = to as [number, number, number];
      };
      num("exit x", () => destination()[0], (v) => setDestination(0, v), 0.5);
      num("exit y", () => destination()[1], (v) => setDestination(1, v), 0.5);
      num("exit z", () => destination()[2], (v) => setDestination(2, v), 0.5);
      num("exit yaw °", () => c.exitYaw ?? 0, (v) => (c.exitYaw = v), 15);
      const row = document.createElement("div");
      row.className = "ed-row";
      const label = document.createElement("label");
      label.textContent = "airborne only";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = c.airOnly === true;
      checkbox.addEventListener("change", () => {
        c.airOnly = checkbox.checked;
        this.commit();
      });
      row.append(label, checkbox);
      this.propsEl.appendChild(row);
    } else if (c.t === "gate") {
      num(
        "yaw °",
        () => c.yaw ?? 0,
        (v) => (c.yaw = v),
        15,
      );
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        "finish gate — crossing its plane ends the run (one per level; yaw turns it with the course)";
      this.propsEl.appendChild(note);
    } else if (c.t === "clock") {
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        "time-trial activator — skating through the stopwatch starts a timed run to the gate (one per level, lives near spawn)";
      this.propsEl.appendChild(note);
    } else if (c.t === "comboorb") {
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        "combo-run activator — skating through the green plus starts a one-combo run to the gem at the gate (one per level, lives near spawn)";
      this.propsEl.appendChild(note);
    } else if (c.t === "zone") {
      sizeRow(0, "width");
      sizeRow(2, "depth");
      const dirBtn = document.createElement("button");
      dirBtn.className = "ed-btn";
      const dirLabel = (d: string): string =>
        d === "E"
          ? "side-scroll → (east)"
          : d === "W"
            ? "side-scroll ← (west)"
            : d === "N"
              ? "run AT the camera"
              : "normal corridor (south)";
      dirBtn.textContent = dirLabel(c.dir ?? "E");
      dirBtn.addEventListener("click", () => {
        const cycle: Record<string, "E" | "W" | "N" | "S"> = {
          E: "W",
          W: "N",
          N: "S",
          S: "E",
        };
        c.dir = cycle[c.dir ?? "E"];
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(dirBtn);
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        "inside this region the course TURNS: east/west = classic side-scroll, camera holds its corridor view · run-at-camera = boulder-chase framing, forward charges the lens";
      this.propsEl.appendChild(note);
    } else if (c.t === "rope") {
      num(
        "length",
        () => c.len ?? 12,
        (v) => (c.len = Math.max(2, v)),
      );
      num(
        "yaw °",
        () => c.yaw ?? 0,
        (v) => (c.yaw = v),
        15,
      );
      num(
        "sag",
        () => c.amp ?? 1.2,
        (v) => (c.amp = Math.max(0.1, v)),
        0.1,
      );
      num(
        "break secs",
        () => c.shake ?? 3,
        (v) => (c.shake = Math.max(0.2, v)),
        0.2,
      );
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        "a grindable rope strung between posts: it sags under a grind, snaps after the break time, and restrings itself";
      this.propsEl.appendChild(note);
    } else if (c.t === "vertramp") {
      num("yaw °", () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      if (!c.pts)
        num(
          "length",
          () => c.len ?? 30,
          (v) => (c.len = Math.max(4, v)),
          2,
        );
      num(
        "flat half",
        () => c.w ?? 3,
        (v) => (c.w = Math.max(0, v)),
      );
      num(
        "wall radius",
        () => c.rise ?? 6,
        (v) => (c.rise = Math.max(0.5, v)),
      );
      num(
        "arc °",
        () => c.arc ?? 90,
        (v) => (c.arc = Math.max(5, Math.min(90, v))),
        5,
      );
      num(
        "deck",
        () => c.deck ?? 0,
        (v) => (c.deck = Math.max(0, v)),
      );
      if (c.pts)
        num(
          "auto bank",
          () => c.bank ?? 0,
          (v) => (c.bank = Math.max(0, v)),
          5,
        );
      if (c.pts) nodeRows();
      const toggle = (label: () => string, onClick: () => void): void => {
        const b = document.createElement("button");
        b.className = "ed-btn";
        b.textContent = label();
        b.addEventListener("click", () => {
          onClick();
          this.commit();
          this.renderProps();
        });
        this.propsEl.appendChild(b);
      };
      toggle(
        () => `shape: ${c.vkind ?? "quarter"}`,
        () =>
          (c.vkind = (c.vkind ?? "quarter") === "quarter" ? "half" : "quarter"),
      );
      if (c.pts && c.pts.length > 2) {
        toggle(
          () => `path: ${c.closed ? "closed loop" : "open"}`,
          () => (c.closed = !c.closed),
        );
        toggle(
          () =>
            `bends: ${c.curve === "spline" ? "spline" : "filleted corners"}`,
          () => (c.curve = c.curve === "spline" ? "corner" : "spline"),
        );
      }
      toggle(
        () => `surface: ${c.vert === false ? "banked road" : "VERT"}`,
        () => (c.vert = c.vert === false ? undefined : false),
      );
      const vnote = document.createElement("div");
      vnote.className = "ed-dim";
      vnote.textContent = c.pts
        ? "drawn along a spine — drag its nodes to steer it, corner radii round the bends, node heights make the coping climb. Closed loops make pools; a 5th node number banks the deck."
        : "the vert part: quarter or half, any size. Straight 90° halves get the full lip-trick physics; arc, deck and drawn spines make bowls, corners and roads.";
      this.propsEl.appendChild(vnote);
    } else if (c.t === "crate") {
      const sel = document.createElement("select");
      sel.className = "ed-select";
      for (const k of CRATE_KINDS) {
        const o = document.createElement("option");
        o.value = k;
        o.textContent =
          k === "metalbounce"
            ? "arrow (metal)"
            : k === "bouncy"
              ? "arrow (wood)"
              : k;
        if ((c.kind ?? "wood") === k) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        c.kind = sel.value as CustomComponent["kind"];
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(sel);
      if (c.kind === "bang") {
        const note = document.createElement("div");
        note.className = "ed-dim";
        note.textContent =
          "metal switch: hit it in play to materialize the OUTLINE crates in its group (⌘G). ungrouped = fires all ungrouped outlines. never breaks, not counted";
        this.propsEl.appendChild(note);
      } else {
        // outline state: any crate can start as a pass-through ghost
        const row = document.createElement("div");
        row.className = "ed-row";
        const lab = document.createElement("label");
        lab.textContent = "outline";
        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = !!c.outline;
        chk.addEventListener("change", () => {
          if (chk.checked) c.outline = true;
          else delete c.outline;
          this.commit();
        });
        row.appendChild(lab);
        row.appendChild(chk);
        this.propsEl.appendChild(row);
        if (c.outline) {
          const note = document.createElement("div");
          note.className = "ed-dim";
          note.textContent =
            'ghost (no collision) until a "!" crate in its group is hit';
          this.propsEl.appendChild(note);
        }
      }
    } else if (c.t === "rock") {
      sizeRow(0, "width");
      sizeRow(1, "height");
      sizeRow(2, "depth");
      num(
        "yaw °",
        () => c.yaw ?? 0,
        (v) => (c.yaw = v),
        15,
      );
      const shuffle = document.createElement("button");
      shuffle.className = "ed-btn";
      shuffle.textContent = "reshuffle shape";
      shuffle.addEventListener("click", () => {
        c.seed = Math.floor(Math.random() * 1e6);
        this.commit();
        shuffle.blur();
      });
      this.propsEl.appendChild(shuffle);
      colorRow();
    } else if (c.t === "camnode") {
      num(
        "corner radius",
        () => c.radius ?? 0,
        (v) => (c.radius = Math.max(0, v)),
      );
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        "camera lane: nodes chain in order (see LAYERS). In play, the camera and the controls steer along the line — hold forward through winding corridors, Crash 3 style. 2+ nodes = live. Corner radius rounds the turn AT this node.";
      this.propsEl.appendChild(note);
      const chain = document.createElement("button");
      chain.className = "ed-btn";
      chain.textContent = "+ chain next node";
      chain.addEventListener("click", () => {
        // continue the lane: step onward along the last segment's direction
        const nodes: number[] = [];
        this.data.components.forEach((o, i) => {
          if (o.t === "camnode") nodes.push(i);
        });
        const lastIdx = nodes[nodes.length - 1];
        const last = this.data.components[lastIdx];
        const prev =
          nodes.length > 1
            ? this.data.components[nodes[nodes.length - 2]]
            : null;
        let dx = 0;
        let dz = -6;
        if (prev) {
          const l =
            Math.hypot(last.p[0] - prev.p[0], last.p[2] - prev.p[2]) || 1;
          dx = ((last.p[0] - prev.p[0]) / l) * 6;
          dz = ((last.p[2] - prev.p[2]) / l) * 6;
        }
        this.addComponent({
          t: "camnode",
          p: [last.p[0] + dx, last.p[1], last.p[2] + dz],
        });
        chain.blur();
      });
      this.propsEl.appendChild(chain);
    } else if (c.t === "terrain") {
      if (c.pts) nodeRows();
      num(
        "width",
        () => c.w ?? 12,
        (v) => (c.w = Math.max(1, v)),
      );
      num(
        "bumpiness",
        () => c.amp ?? 0.45,
        (v) => (c.amp = Math.max(0, v)),
        0.05,
      );
      const row = document.createElement("div");
      row.className = "ed-row";
      const lab = document.createElement("label");
      lab.textContent = "berms";
      const chk = document.createElement("input");
      chk.type = "checkbox";
      chk.checked = c.berms === true;
      chk.addEventListener("change", () => {
        if (chk.checked) c.berms = true;
        else delete c.berms;
        this.commit();
      });
      row.appendChild(lab);
      row.appendChild(chk);
      this.propsEl.appendChild(row);
      const curveBtn = document.createElement("button");
      curveBtn.className = "ed-btn";
      curveBtn.textContent = `path: ${c.curve === "spline" ? "smooth spline" : "linear"}`;
      curveBtn.addEventListener("click", () => {
        c.curve = c.curve === "spline" ? undefined : "spline";
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(curveBtn);
      colorRow();
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        "the nodes are its CENTRELINE: drag one sideways to bend the path, " +
        "up or down to roll it. They are read in z order, so it runs " +
        "down-course and cannot fold back on itself.";
      this.propsEl.appendChild(note);
    } else if (c.t === "decor") {
      // One panel for every prop, showing only the knobs that prop has. The
      // kind dropdown is a live swap: change your mind about a fern without
      // deleting it and placing a broadleaf in the same spot.
      const kindSel = document.createElement("select");
      kindSel.className = "ed-select";
      for (const k of DECOR_KINDS) {
        const o = document.createElement("option");
        o.value = k;
        o.textContent = DECOR_LABELS[k];
        if ((c.dkind ?? "fern") === k) o.selected = true;
        kindSel.appendChild(o);
      }
      kindSel.addEventListener("change", () => {
        c.dkind = kindSel.value as DecorKind;
        // carry over the new prop's defaults for anything it needs and the
        // old one never had (a fern has no height; a tree does)
        const bag = c as unknown as Record<string, unknown>;
        for (const [k, v] of Object.entries(DECOR_DEFAULTS[c.dkind]))
          if (bag[k] === undefined) bag[k] = v;
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(kindSel);
      const dk = (c.dkind ?? "fern") as DecorKind;
      // LIBRARY FAMILIES. One kind, many models: the panel gets a model picker
      // and a colour picker, plus the size/spin/lean every one of them takes.
      // 'any' on both means the prop keeps rolling its own from where it
      // stands — drag it somewhere else and it becomes a different plant.
      if (PROP_FAMILIES.includes(dk as PropFamily)) {
        const fam = dk as PropFamily;
        const roll = propRoll(fam, Math.round(c.p[0] * 71 + c.p[2] * 131));
        this.propsEl.appendChild(
          this.pickRow(
            "model",
            propModels(fam).map((m, i) => [String(i), m.label]),
            () => (c.vr === undefined ? "" : String(c.vr)),
            (v) => (c.vr = v === "" ? undefined : Number(v)),
            `any (now: ${propModels(fam)[roll.variant]?.label ?? "-"})`,
          ),
        );
        this.propsEl.appendChild(
          this.pickRow(
            "colour",
            (PROP_TINTS[fam] ?? []).map((t, i) => [String(i), t.name]),
            () => (c.tn === undefined ? "" : String(c.tn)),
            (v) => (c.tn = v === "" ? undefined : Number(v)),
            `any (now: ${PROP_TINTS[fam]?.[roll.tint]?.name ?? "-"})`,
          ),
        );
        num(
          "scale",
          () => c.w ?? 1,
          (v) => (c.w = Math.max(0.05, v)),
          0.1,
        );
        num(
          "yaw °",
          () => c.yaw ?? 0,
          (v) => (c.yaw = v),
          15,
        );
        num(
          "lean °",
          () => c.amp ?? 0,
          (v) => (c.amp = Math.max(-40, Math.min(40, v))),
          2,
        );
        const size = propSize(fam, c.vr ?? roll.variant, c.w ?? 1);
        const note = document.createElement("div");
        note.className = "ed-dim";
        note.textContent =
          `${propModels(fam).length} models, ${(PROP_TINTS[fam] ?? []).length} colours` +
          ` — this one stands ${size.height.toFixed(1)}u tall.` +
          " Scenery: visual only, never a floor and never a wall.";
        this.propsEl.appendChild(note);
      }
      // ...and none of the hand-built props' knobs below match a library kind,
      // so they simply render nothing for one. Only the closing note has to
      // know, or a library prop would carry two.
      const SCALED: DecorKind[] = [
        "fern",
        "broadleaf",
        "toadstool",
        "toadstools",
        "mossrock",
        "idol",
      ];
      const TALL: Record<string, string> = {
        jungletree: "height",
        palm: "height",
        vines: "drop",
      };
      if (SCALED.includes(dk))
        num(
          "scale",
          () => c.w ?? (dk === "mossrock" ? 1.6 : 1),
          (v) => (c.w = Math.max(0.1, v)),
          0.1,
        );
      if (TALL[dk])
        num(
          TALL[dk],
          () =>
            c.rise ??
            (dk === "jungletree" ? 9 : dk === "palm" ? 4.8 : 4),
          (v) => (c.rise = Math.max(0.5, v)),
          0.5,
        );
      if (dk === "jungletree" || dk === "palm")
        num(
          "lean",
          () => c.amp ?? 0,
          (v) => (c.amp = v),
          0.02,
        );
      if (dk === "vines")
        num(
          "strands",
          () => c.n ?? 3,
          (v) => (c.n = THREE.MathUtils.clamp(Math.round(v), 1, 64)),
          1,
        );
      if (dk === "log")
        num(
          "length",
          () => c.len ?? 13,
          (v) => (c.len = Math.max(1, v)),
          1,
        );
      if (dk === "ruinblock" || dk === "block") {
        sizeRow(0, "width");
        sizeRow(1, "height");
        sizeRow(2, "depth");
      }
      if (dk === "block") colorRow();
      if (dk === "meshycourtyard") {
        num(
          "fitted size",
          () => c.w ?? 11.52,
          (v) => (c.w = Math.max(0.1, v)),
          0.1,
        );
        num("yaw °", () => c.yaw ?? 90, (v) => (c.yaw = v), 15);
        num(
          "pitch °",
          () => c.amp ?? 0,
          (v) => (c.amp = THREE.MathUtils.clamp(v, -45, 45)),
          1,
        );
      }
      if (dk === "idol" || dk === "ruinblock" || dk === "block")
        num(
          "yaw °",
          () => c.yaw ?? 0,
          (v) => (c.yaw = v),
          15,
        );
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        dk === "meshycourtyard"
          ? "compressed owner-supplied Meshy bridge — visual only; keep a separate ride hull"
          : dk === "idol"
          ? "scenery — solid: it blocks, so it can frame a doorway"
          : dk === "log"
            ? "scenery — solid: a hop-over obstacle across the path"
            : dk === "block"
              ? "massing — looks solid, is not: you fall straight through it"
              : "scenery — visual only, never a floor and never a wall";
      if (!PROP_FAMILIES.includes(dk as PropFamily))
        this.propsEl.appendChild(note);
    } else if (c.t === "grindosaurus") {
      num("patrol ±", () => c.range ?? 4, (v) => (c.range = Math.max(0, v)), 0.5);
      num("patrol speed", () => c.speed ?? 1.5, (v) => (c.speed = Math.max(0, v)), 0.25);
      num(
        "required coverage",
        () => c.coverage ?? 0.65,
        (v) => (c.coverage = THREE.MathUtils.clamp(v, 0.1, 1)),
        0.05,
      );
      num("patrol yaw °", () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        "fatal patrol body — catch its moving spine rail and ride the required fraction to defeat it";
      this.propsEl.appendChild(note);
    } else if (c.t === "angryball") {
      num("flat half", () => c.w ?? 3, (v) => (c.w = Math.max(0, v)), 0.25);
      num("pipe radius", () => c.rise ?? 4.6, (v) => (c.rise = Math.max(0.5, v)), 0.25);
      num("ball radius", () => c.radius ?? 0.8, (v) => (c.radius = Math.max(0.25, v)), 0.1);
      num("activation", () => c.range ?? 12, (v) => (c.range = Math.max(1, v)), 1);
      num("chase speed", () => c.speed ?? 7, (v) => (c.speed = Math.max(0, v)), 0.5);
      num("spawn arc offset", () => c.amp ?? 0, (v) => (c.amp = v), 0.5);
      num("cross yaw °", () => c.yaw ?? 0, (v) => (c.yaw = v), 15);
      const note = document.createElement("div");
      note.className = "ed-dim";
      note.textContent =
        "wakes when you approach and chases at constant arc speed across its analytic flat + quarter-pipe profile";
      this.propsEl.appendChild(note);
    } else if (c.t === "enemy") {
      const sel = document.createElement("select");
      sel.className = "ed-select";
      for (const f of FOE_KINDS) {
        const o = document.createElement("option");
        o.value = f.k;
        o.textContent = f.label;
        if ((c.foe ?? "grunt") === f.k) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        c.foe = sel.value as EnemyKind;
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(sel);
      const stationary = c.foe === "sentry" || c.foe === "spinner";
      const alongZ =
        (((c.yaw ?? 0) % 180) + 180) % 180 >= 45 &&
        (((c.yaw ?? 0) % 180) + 180) % 180 < 135;
      if (!stationary) {
        num(
          alongZ ? "patrol ±z" : "patrol ±x",
          () => c.range ?? 5,
          (v) => (c.range = Math.max(0, v)),
        );
        num(
          "speed",
          () => c.speed ?? 3,
          (v) => (c.speed = Math.max(0.5, v)),
        );
      }
      if (!stationary) {
        const axisBtn = document.createElement("button");
        axisBtn.className = "ed-btn";
        axisBtn.textContent = `patrol: along ${alongZ ? "Z" : "X"}`;
        axisBtn.title = "the walk is axis-bound — rotation comes in 90° steps";
        axisBtn.addEventListener("click", () => {
          c.yaw = alongZ ? 0 : 90;
          this.commit();
          this.renderProps();
        });
        this.propsEl.appendChild(axisBtn);
      }
    } else if (c.t === "crusher") {
      sizeRow(0, "width");
      sizeRow(1, "height");
      sizeRow(2, "depth");
      num(
        "cycle s",
        () => c.cycle ?? 3.2,
        (v) => (c.cycle = Math.max(0.5, v)),
        0.2,
      );
      num(
        "phase",
        () => c.phase ?? 0,
        (v) => (c.phase = v),
        0.2,
      );
    } else if (c.t === "mover") {
      sizeRow(0, "width");
      sizeRow(1, "thickness");
      sizeRow(2, "depth");
      const axisBtn = document.createElement("button");
      axisBtn.className = "ed-btn";
      const axLabel = (): string =>
        `travel: ${(c.axis ?? "x").toUpperCase()}${c.axis === "y" ? " (lift)" : ""}`;
      axisBtn.textContent = axLabel();
      axisBtn.title = "which way the platform slides — X / Z slide, Y lifts";
      axisBtn.addEventListener("click", () => {
        c.axis = c.axis === "x" ? "z" : c.axis === "z" ? "y" : "x";
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(axisBtn);
      num(
        "travel",
        () => c.amp ?? 4,
        (v) => (c.amp = Math.max(0, v)),
      );
      num(
        "speed",
        () => c.speed ?? 0.6,
        (v) => (c.speed = Math.max(0, v)),
        0.1,
      );
      num(
        "phase",
        () => c.phase ?? 0,
        (v) => (c.phase = v),
        0.2,
      );
      const litBtn = document.createElement("button");
      litBtn.className = "ed-btn";
      litBtn.textContent = c.lit ? "burning: ON" : "burning: off";
      litBtn.title =
        "warm iron deck with a brazier riding it — the platform carries its own light through a dark level";
      litBtn.addEventListener("click", () => {
        if (c.lit) delete c.lit;
        else c.lit = true;
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(litBtn);
    } else if (c.t === "torch") {
      num(
        "post height",
        () => c.rise ?? 2.2,
        (v) => (c.rise = Math.max(0, v)),
        0.2,
      );
      num(
        "flame size",
        () => c.w ?? 1,
        (v) => (c.w = Math.max(0.2, v)),
        0.1,
      );
    } else if (c.t === "phasepad") {
      sizeRow(0, "width");
      sizeRow(1, "thickness");
      sizeRow(2, "depth");
      num(
        "cycle (s)",
        () => c.cycle ?? 4,
        (v) => (c.cycle = Math.max(0.5, v)),
        0.2,
      );
      num(
        "lit share",
        () => c.amp ?? 0.5,
        (v) => (c.amp = Math.min(0.9, Math.max(0.1, v))),
        0.05,
      );
      num(
        "phase",
        () => c.phase ?? 0,
        (v) => (c.phase = ((v % 1) + 1) % 1),
        0.05,
      );
    } else if (c.t === "stone") {
      num(
        "patrol ±z",
        () => c.range ?? 20,
        (v) => (c.range = Math.max(1, v)),
        1,
      );
      num(
        "speed",
        () => c.speed ?? 6,
        (v) => (c.speed = Math.max(0, v)),
        0.5,
      );
      num(
        "radius",
        () => c.radius ?? 0.9,
        (v) => (c.radius = Math.max(0.2, v)),
        0.1,
      );
    } else if (c.t === "pendulum") {
      num(
        "arm len",
        () => c.len ?? 5,
        (v) => (c.len = Math.max(1, v)),
      );
      num(
        "swing amp",
        () => c.amp ?? 1.0,
        (v) => (c.amp = Math.max(0.1, v)),
        0.1,
      );
      num(
        "speed",
        () => c.speed ?? 1.6,
        (v) => (c.speed = Math.max(0.2, v)),
        0.1,
      );
      num(
        "phase",
        () => c.phase ?? 0,
        (v) => (c.phase = v),
        0.2,
      );
      num(
        "yaw °",
        () => c.yaw ?? 0,
        (v) => (c.yaw = v),
        15,
      ); // spins the whole gallows + swing plane
    } else if (c.t === "ropeswing") {
      num(
        "rope len",
        () => c.len ?? 6,
        (v) => (c.len = Math.max(2, v)),
      );
      num(
        "swing amp",
        () => c.amp ?? 0.85,
        (v) => (c.amp = Math.max(0.1, v)),
        0.05,
      );
      num(
        "speed",
        () => c.speed ?? 0,
        (v) => (c.speed = Math.max(0, v)),
        0.1,
      ); // 0 = natural pendulum for the length
      num(
        "phase",
        () => c.phase ?? 0,
        (v) => (c.phase = v),
        0.2,
      );
      num(
        "yaw °",
        () => c.yaw ?? 0,
        (v) => (c.yaw = v),
        15,
      ); // spins the swing plane
      // ferry range > 0 sends the whole anchor TRAVELLING on its own cycle —
      // a swing that also carries you across a gap
      const ferryBtn = document.createElement("button");
      ferryBtn.className = "ed-btn";
      ferryBtn.textContent = `ferry: ${(c.axis ?? "x").toUpperCase()}`;
      ferryBtn.title =
        "which way the anchor travels (ferry range 0 = a fixed swing)";
      ferryBtn.addEventListener("click", () => {
        c.axis = c.axis === "x" ? "z" : c.axis === "z" ? "y" : "x";
        this.commit();
        this.renderProps();
      });
      this.propsEl.appendChild(ferryBtn);
      num(
        "ferry range",
        () => c.range ?? 0,
        (v) => (c.range = Math.max(0, v)),
        0.5,
      );
      num(
        "ferry speed",
        () => c.cycle ?? 0.5,
        (v) => (c.cycle = Math.max(0, v)),
        0.05,
      );
    }
    const row = document.createElement("div");
    row.className = "ed-grid";
    // One implementation for single and multi-selection rotation; path nodes,
    // yaw, travel axes, portal destinations, zones and sparse size defaults
    // must all obey the same transform contract.
    const rotatable = new Set<CustomComponent["t"]>([
      "platform", "ramp", "rail", "trickrail", "wall", "pit", "crumble",
      "rock", "pendulum", "ropeswing", "enemy", "gate", "vertramp", "rope",
      "trampoline", "speedpad", "trickgate", "returnportal", "grindosaurus",
      "angryball", "decor", "crusher", "mover", "phasepad", "zone", "stone",
      "terrain", "woodpath", "wallpath",
    ]);
    if (rotatable.has(c.t)) {
      const rot = document.createElement("button");
      rot.className = "ed-btn";
      rot.textContent = "rotate 90°";
      rot.addEventListener("click", () => this.rotateSelection(90));
      row.appendChild(rot);
    }
    const dup = document.createElement("button");
    dup.className = "ed-btn";
    dup.textContent = "duplicate";
    dup.addEventListener("click", () => this.duplicateSelected());
    const cpy = document.createElement("button");
    cpy.className = "ed-btn";
    cpy.textContent = "copy ⌘C";
    cpy.addEventListener("click", () => this.copySelected());
    const del = document.createElement("button");
    del.className = "ed-btn ed-danger";
    del.textContent = "delete";
    del.addEventListener("click", () => this.deleteSelected());
    row.appendChild(dup);
    row.appendChild(cpy);
    row.appendChild(del);
    this.propsEl.appendChild(row);
  }

  private injectStyle(): void {
    const css = document.createElement("style");
    css.textContent = `
      .ed-panel {
        position: fixed; right: 10px; top: 10px; bottom: 10px; width: 228px;
        overflow-y: auto; z-index: 60; padding: 10px;
        font: 11px ui-monospace, Menlo, Consolas, monospace; color: #cdd6e4;
        background: rgba(16, 20, 30, 0.92); border: 1px solid #3a4152;
        border-radius: 10px;
      }
      .ed-title { font-weight: bold; letter-spacing: 1px; color: #58e08a; margin-bottom: 8px; }
      .ed-ptabs { display: flex; gap: 4px; margin-bottom: 6px; }
      .ed-ptab {
        flex: 1; font: 9px ui-monospace, Menlo, Consolas, monospace; letter-spacing: 1px;
        background: #141a26; color: #7c8aa6; border: 1px solid #2a3142;
        border-radius: 6px; padding: 5px 4px; cursor: pointer;
      }
      .ed-ptab-on { background: #1c2a22; color: #58e08a; border-color: #2f6a48; }
      .ed-sect { color: #8fa2c0; letter-spacing: 1px; font-size: 10px; margin: 10px 0 4px; border-bottom: 1px solid #2a3142; padding-bottom: 2px; }
      .ed-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
      .ed-btn {
        font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: #1c2230; color: #9fb0c8; border: 1px solid #3a4152;
        border-radius: 6px; padding: 5px 4px; cursor: pointer;
      }
      .ed-palbtn {
        display: flex; align-items: center; gap: 6px; text-align: left;
        padding: 3px 6px;
      }
      .ed-palbtn canvas { flex: 0 0 18px; image-rendering: pixelated; }
      .ed-row input[type=color] { padding: 0; height: 22px; }
      .ed-danger { color: #ff8484; }
      .ed-test { width: 100%; margin-top: 10px; color: #58e08a; font-weight: bold; padding: 8px; }
      .ed-row { display: grid; grid-template-columns: 80px 1fr; gap: 6px; align-items: center; margin: 3px 0; }
      .ed-row label { color: #9fb0c8; }
      .ed-row input, .ed-row select, .ed-select {
        width: 100%; font: 11px ui-monospace, Menlo, Consolas, monospace;
        background: #10141e; color: #d5e0f0; border: 1px solid #3a4152;
        border-radius: 4px; padding: 3px 5px;
      }
      .ed-selhead { color: #ffd75e; margin: 4px 0; }
      .ed-dim { color: #6b7890; margin-top: 8px; line-height: 1.5; }
      .ed-sellist { margin: 0 0 6px; }
      /* editing: the play HUD gets out of the tools' way (build stamp stays) */
      body.ed-active [class^="hud-"]:not(.hud-build),
      body.ed-active [class*=" hud-"]:not(.hud-build) { display: none !important; }
      .ed-tabs {
        position: fixed; left: 10px; top: 120px; z-index: 60;
        display: flex; flex-direction: column; gap: 6px;
      }
      .ed-tab {
        font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: rgba(16, 20, 30, 0.92); color: #9fb0c8;
        border: 1px solid #3a4152; border-radius: 8px; cursor: pointer;
        padding: 7px 6px; display: flex; flex-direction: column;
        align-items: center; gap: 3px; width: 44px;
      }
      .ed-tab span { letter-spacing: 1px; font-size: 8px; }
      .ed-tab-on { background: #1c2a22; color: #58e08a; border-color: #2f6a48; }
      .ed-pop {
        position: fixed; left: 62px; top: 120px; z-index: 60; width: 212px;
        max-height: calc(100vh - 190px); overflow-y: auto; padding: 10px;
        font: 11px ui-monospace, Menlo, Consolas, monospace; color: #cdd6e4;
        background: rgba(16, 20, 30, 0.94); border: 1px solid #3a4152;
        border-radius: 10px;
      }
      .ed-views {
        position: fixed; left: 10px; bottom: 26px; z-index: 60;
        display: flex; gap: 5px;
      }
      .ed-viewbtn {
        font: bold 11px ui-monospace, Menlo, Consolas, monospace;
        background: rgba(16, 20, 30, 0.92); color: #9fb0c8;
        border: 1px solid #3a4152; border-radius: 7px; cursor: pointer;
        width: 30px; height: 26px;
      }
      .ed-viewbtn-on { background: #58e08a !important; color: #0b0f1a !important; }
      .ed-layerrow {
        display: flex; align-items: center; gap: 4px; margin: 2px 0;
        padding: 2px 3px; border-radius: 5px;
      }
      .ed-layer-sel { background: rgba(88, 224, 138, 0.12); }
      .ed-grouprow { border-top: 1px solid rgba(58, 65, 82, 0.5); }
      .ed-groupname { color: #8fd4ff; }
      .ed-caret { width: 14px; }
      .ed-lockon { opacity: 1; color: #ffd75e; }
      .ed-lbtn {
        font: 10px ui-monospace, Menlo, Consolas, monospace;
        background: none; border: none; color: #9fb0c8; cursor: pointer;
        padding: 1px 2px;
      }
      .ed-layername {
        flex: 1; text-align: left; font: 11px ui-monospace, Menlo, Consolas, monospace;
        background: none; border: none; color: #cdd6e4; cursor: pointer; padding: 2px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .ed-layername-input {
        flex: 1; font: 11px ui-monospace, Menlo, Consolas, monospace;
        background: #10141e; color: #d5e0f0; border: 1px solid #3a4152;
        border-radius: 4px; padding: 1px 4px; min-width: 0;
      }
      .ed-layercount { color: #6b7890; font-size: 10px; }
      .ed-layers .ed-grid { margin-top: 4px; }
      .ed-marquee {
        position: fixed; display: none; z-index: 55; pointer-events: none;
        border: 1px dashed #58e08a; background: rgba(88, 224, 138, 0.10);
        border-radius: 2px;
      }
      /* ---- mouse-only states ---------------------------------------------
         Gated for the same reason as the HUD's: a tap on iOS leaves a faked
         hover behind, which read as every button in here staying selected. */
      @media (hover: hover) {
        .ed-ptab:hover { color: #cdd6e4; }
        .ed-btn:hover { background: #262e42; color: #d5e0f0; }
        .ed-tab:hover { background: #262e42; color: #d5e0f0; }
        .ed-viewbtn:hover { background: #262e42; color: #58e08a; }
        .ed-lbtn:hover { color: #d5e0f0; }
      }
    `;
    document.head.appendChild(css);
  }
}
