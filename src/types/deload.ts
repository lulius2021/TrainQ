export type DeloadRule = {
  reduceSetsPct?: number;
  reduceWeightPct?: number;
  forceFailureToNormal?: boolean;
  applyWeightToDropsets?: boolean;
};

export type DeloadPlan = {
  id: string;
  startISO: string;
  endISO: string;
  createdAtISO: string;
  dismissedUntilISO?: string;
  baselineIntervalWeeks?: number;
  rules: DeloadRule;
};
