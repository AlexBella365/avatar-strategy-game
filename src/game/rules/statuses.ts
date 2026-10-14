// Status registry. Spec §11.
// TODO(step 3): apply/trigger/expire OffBalance, Exposed, Bound, Exhausted.
export const STATUS_IDS = ["OffBalance", "Exposed", "Bound", "Exhausted"] as const;
