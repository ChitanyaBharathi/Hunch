// Anything below these is suppressed (not shown with a warning).
export const MIN_PRODUCT_N = 5;      // any per-product figure
export const MIN_SEGMENT_N = 10;     // any split: age band, persona, fast/slow
export const MIN_PERSONA_SIZE = 10;  // people in a persona before it is reported
export const MIN_ANCHOR_N = 30;      // responses with a previous item, for the anchoring regression
export const MIN_ANCHOR_RESPONDENTS = 10;
export const MIN_CLUSTER_RESPONDENTS = 30; // eligible respondents before we try to find personas

export const THRESHOLDS = { product: MIN_PRODUCT_N, segment: MIN_SEGMENT_N, persona: MIN_PERSONA_SIZE, anchoring: MIN_ANCHOR_N };
export const suppressed = (n, minimum) => ({ suppressed: true, n, minimum });
