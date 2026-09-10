/** Measured cap-band scale of the supplied 1672×941 HUD reference. */
export const ROO_REFERENCE_HEIGHT = 941;
export const ROO_REFERENCE_NUMBER_CAP = 107;
export const ROO_REFERENCE_TITLE_CAP = 165;
export const ROO_NUMBER_VH = ROO_REFERENCE_NUMBER_CAP / ROO_REFERENCE_HEIGHT * 100;
export const ROO_TITLE_VH = ROO_REFERENCE_TITLE_CAP / ROO_REFERENCE_HEIGHT * 100;
/** Existing authoring API uses 200 units per cap band. */
export const ROO_COUNTER_TRACKING = 20;
export const rooNumberCap = (height:number) => height * ROO_REFERENCE_NUMBER_CAP / ROO_REFERENCE_HEIGHT;
export const rooTitleCap = (height:number) => height * ROO_REFERENCE_TITLE_CAP / ROO_REFERENCE_HEIGHT;
