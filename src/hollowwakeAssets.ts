import {HOLLOWWAKE_ASSETS as generated} from './hollowwakeAssets.generated';
import {DROWNED_CROWN_EXCELLENCE_MODELS} from './drownedCrownExcellence.generated';
/** The same approved sculpted slate used in Merchant Wreck, at tunnel ranges. */
export const HOLLOWWAKE_ASSETS={...generated,
 hollowwallrock:{...DROWNED_CROWN_EXCELLENCE_MODELS.crowncrashcavernrock,label:'Hollowwake · Merchant Wreck slate',lodRange:[44,74] as const},
} as const;
