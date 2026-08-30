import type { CustomLevelData } from "../level";
import { BONUS_LEVEL } from "./bonus-level";
import { COASTAL_STREET_RUN_LEVEL } from "./coastal-street-run";
import { ISLAND_HOPPER_LEVEL } from "./island-hopper";
import { JUNGLE_GATE_RUN_LEVEL } from "./jungle-gate-run";
import { MESHYLOOK_THORNS_LEVEL } from "./meshylook-thorns";

export interface UnityPortLevelEntry {
  readonly id: string;
  readonly name: string;
  readonly data: CustomLevelData;
}

/** Source-owned, editor-compatible browser ports of the current Unity scenes. */
export const UNITY_PORT_LEVELS: readonly UnityPortLevelEntry[] = [
  { id: "bonus-level", name: BONUS_LEVEL.name, data: BONUS_LEVEL },
  {
    id: "coastal-street-run",
    name: COASTAL_STREET_RUN_LEVEL.name,
    data: COASTAL_STREET_RUN_LEVEL,
  },
  {
    id: "island-hopper",
    name: ISLAND_HOPPER_LEVEL.name,
    data: ISLAND_HOPPER_LEVEL,
  },
  {
    id: "jungle-gate-run",
    name: JUNGLE_GATE_RUN_LEVEL.name,
    data: JUNGLE_GATE_RUN_LEVEL,
  },
  {
    id: "meshylook-thorns",
    name: MESHYLOOK_THORNS_LEVEL.name,
    data: MESHYLOOK_THORNS_LEVEL,
  },
];
