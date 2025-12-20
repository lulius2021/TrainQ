// src/services/trainqCore.ts
// TrainQ Launch-Core: Orchestrator Service

import type {
  CalendarWorkout,
  NewCalendarWorkout,
  TrainingPlan,
  NewTrainingPlan,
  WorkoutHistoryEntry,
  ISODate,
  WorkoutType,
  AdaptiveProfile,
} from "../types";

import type { LiveWorkout } from "../types/liveWorkout";

import {
  loadPlans,
  savePlans,
  loadCalendarWorkouts,
  saveCalendarWorkouts,
  loadWorkoutHistory,
  saveWorkoutHistory,
  generateId,
  loadActiveLiveWorkout,
  saveActiveLiveWorkout,
  clearActiveLiveWorkout,
} from "../utils/trainqStorage";

import { generateCalendarWorkouts, toISODateLocal } from "../utils/calendarGeneration";

import {
  validateSingleActivePlan,
  validatePlanWeeklyRules,
  validateCalendarWorkouts,
} from "../utils/calendarValidation";

import {
  skipCalendarWorkout,
  completeCalendarWorkout,
  overwriteCalendarWorkoutAdaptive,
} from "../utils/calendarActions";

import {
  createLiveWorkoutFromCalendar,
  completeLiveWorkout,
  abortLiveWorkout,
  liveWorkoutToHistoryEntry,
} from "../utils/liveWorkoutFactory";

// ------------------------------
const DEFAULT_GENERATION_DAYS = 28;

// ------------------------------
export type CoreValidationIssue =
  | { domain: "plans"; issues: ReturnType<typeof validateSingleActivePlan> }
  | { domain: "planRules"; issues: ReturnType<typeof validatePlanWeeklyRules> }
  | { domain: "calendar"; issues: ReturnType<typeof validateCalendarWorkouts> };

export interface CoreState {
  plans: TrainingPlan[];
  calendarWorkouts: CalendarWorkout[];
  history: WorkoutHistoryEntry[];
}

export interface EnsureCalendarResult {
  state: CoreState;
  createdCount: number;
  createdDates: ISODate[];
  validation: CoreValidationIssue[];
}

// ------------------------------
function sortByDateAsc<T extends { date: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.date.localeCompare(b.date));
}

function collectValidation(plans: TrainingPlan[], calendarWorkouts: CalendarWorkout[]): CoreValidationIssue[] {
  const issues: CoreValidationIssue[] = [];

  const p1 = validateSingleActivePlan(plans);
  if (p1.length) issues.push({ domain: "plans", issues: p1 });

  const active = plans.find((p) => p.isActive);
  if (active) {
    const p2 = validatePlanWeeklyRules(active);
    if (p2.length) issues.push({ domain: "planRules", issues: p2 });
  }

  const c1 = validateCalendarWorkouts(calendarWorkouts);
  if (c1.length) issues.push({ domain: "calendar", issues: c1 });

  return issues;
}

function applyIdsToNewCalendarWorkouts(items: NewCalendarWorkout[]): CalendarWorkout[] {
  const now = new Date().toISOString();
  return items.map((it) => ({
    ...it,
    id: generateId("cw"),
    createdAt: now,
    updatedAt: now,
  }));
}

function findCalendarWorkoutOrThrow(calendarWorkouts: CalendarWorkout[], id: string, action: string): CalendarWorkout {
  const cw = calendarWorkouts.find((w) => w.id === id);
  if (!cw) throw new Error(`${action}: CalendarWorkout not found: ${id}`);
  return cw;
}

// ------------------------------
// Public API
// ------------------------------

export function loadCoreState(): CoreState {
  return {
    plans: loadPlans(),
    calendarWorkouts: loadCalendarWorkouts(),
    history: loadWorkoutHistory(),
  };
}

export function createPlan(
  input: NewTrainingPlan,
  opts: { activate?: boolean } = { activate: true }
): { plan: TrainingPlan; state: CoreState; validation: CoreValidationIssue[] } {
  const plans = loadPlans();
  const activate = opts.activate ?? true;

  const now = new Date().toISOString();
  const plan: TrainingPlan = {
    ...input,
    id: generateId("plan"),
    isActive: activate ? true : input.isActive ?? false,
    createdAt: now,
    updatedAt: now,
  };

  let nextPlans = [...plans];

  if (activate) {
    nextPlans = nextPlans.map((p) => (p.isActive ? { ...p, isActive: false, updatedAt: now } : p));
  }

  nextPlans.push(plan);
  savePlans(nextPlans);

  const state: CoreState = {
    plans: nextPlans,
    calendarWorkouts: loadCalendarWorkouts(),
    history: loadWorkoutHistory(),
  };

  const validation = collectValidation(state.plans, state.calendarWorkouts);
  return { plan, state, validation };
}

export function activatePlan(planId: string): { state: CoreState; validation: CoreValidationIssue[] } {
  const plans = loadPlans();
  const now = new Date().toISOString();

  const nextPlans = plans.map((p) => {
    if (p.id === planId) return { ...p, isActive: true, updatedAt: now };
    if (p.isActive) return { ...p, isActive: false, updatedAt: now };
    return p;
  });

  savePlans(nextPlans);

  const state: CoreState = {
    plans: nextPlans,
    calendarWorkouts: loadCalendarWorkouts(),
    history: loadWorkoutHistory(),
  };

  const validation = collectValidation(state.plans, state.calendarWorkouts);
  return { state, validation };
}

export function ensureCalendarForActivePlan(opts: { days?: number; fromDate?: ISODate } = {}): EnsureCalendarResult {
  const days = opts.days ?? DEFAULT_GENERATION_DAYS;

  const plans = loadPlans();
  const calendarWorkouts = loadCalendarWorkouts();
  const history = loadWorkoutHistory();

  const active = plans.find((p) => p.isActive);

  if (!active) {
    const validation = collectValidation(plans, calendarWorkouts);
    return { state: { plans, calendarWorkouts, history }, createdCount: 0, createdDates: [], validation };
  }

  const fromDate = opts.fromDate ?? toISODateLocal(new Date());

  const gen = generateCalendarWorkouts(active, calendarWorkouts, {
    fromDate,
    days,
    defaultStatus: "planned",
  });

  const createdWithIds = applyIdsToNewCalendarWorkouts(gen.created);
  const nextCalendar = sortByDateAsc([...calendarWorkouts, ...createdWithIds]);

  saveCalendarWorkouts(nextCalendar);

  const nextState: CoreState = { plans, calendarWorkouts: nextCalendar, history };
  const validation = collectValidation(nextState.plans, nextState.calendarWorkouts);

  return {
    state: nextState,
    createdCount: createdWithIds.length,
    createdDates: createdWithIds.map((c) => c.date),
    validation,
  };
}

// ------------------------------
// Calendar actions (persisted)
// ------------------------------

export function skipWorkoutToday(
  calendarWorkoutId: string,
  note?: string
): { calendarWorkouts: CalendarWorkout[]; validation: CoreValidationIssue[] } {
  const plans = loadPlans();
  const calendarWorkouts = loadCalendarWorkouts();

  const next = skipCalendarWorkout(calendarWorkouts, calendarWorkoutId, { note });
  saveCalendarWorkouts(next);

  const validation = collectValidation(plans, next);
  return { calendarWorkouts: next, validation };
}

/**
 * Quick Pick (oder manuelle Überschreibung): kann workoutType ändern.
 */
export function overwriteWorkoutAdaptive(
  calendarWorkoutId: string,
  newWorkoutType: WorkoutType,
  note?: string
): { calendarWorkouts: CalendarWorkout[]; validation: CoreValidationIssue[] } {
  const plans = loadPlans();
  const calendarWorkouts = loadCalendarWorkouts();

  const next = overwriteCalendarWorkoutAdaptive(calendarWorkouts, calendarWorkoutId, {
    newWorkoutType,
    note,
    newStatus: "adaptive",
    keepPlanReference: true,
  });

  saveCalendarWorkouts(next);

  const validation = collectValidation(plans, next);
  return { calendarWorkouts: next, validation };
}

/**
 * Adaptiv (Launch): überschreibt NICHT die Muskelgruppe.
 * Es setzt nur status/meta am heutigen Eintrag.
 */
export function applyAdaptiveToWorkout(
  calendarWorkoutId: string,
  meta: {
    adaptiveProfile: AdaptiveProfile; // "A"|"B"|"C"
    adaptiveReasons?: string[];
    estimatedMinutes?: number;
    note?: string;
  }
): { calendarWorkouts: CalendarWorkout[]; validation: CoreValidationIssue[] } {
  const plans = loadPlans();
  const calendarWorkouts = loadCalendarWorkouts();

  const cw = findCalendarWorkoutOrThrow(calendarWorkouts, calendarWorkoutId, "applyAdaptiveToWorkout");

  const next = overwriteCalendarWorkoutAdaptive(calendarWorkouts, calendarWorkoutId, {
    // MUSS gleich bleiben:
    newWorkoutType: cw.workoutType,
    newStatus: "adaptive",
    keepPlanReference: true,
    note: meta.note ?? cw.notes,

    adaptiveProfile: meta.adaptiveProfile,
    adaptiveReasons: meta.adaptiveReasons ?? [],
    estimatedMinutes: meta.estimatedMinutes,
  });

  saveCalendarWorkouts(next);

  const validation = collectValidation(plans, next);
  return { calendarWorkouts: next, validation };
}

export function completeWorkout(
  calendarWorkoutId: string,
  historyEntry: WorkoutHistoryEntry
): {
  calendarWorkouts: CalendarWorkout[];
  history: WorkoutHistoryEntry[];
  validation: CoreValidationIssue[];
} {
  const plans = loadPlans();
  const calendarWorkouts = loadCalendarWorkouts();
  const history = loadWorkoutHistory();

  const entry: WorkoutHistoryEntry = (historyEntry as any).id
    ? historyEntry
    : ({ ...historyEntry, id: generateId("wh"), createdAt: new Date().toISOString() } as any);

  const nextHistory = [...history, entry];
  saveWorkoutHistory(nextHistory);

  const nextCalendar = completeCalendarWorkout(calendarWorkouts, calendarWorkoutId, {
    historyEntryId: (entry as any).id,
  });

  saveCalendarWorkouts(nextCalendar);

  const validation = collectValidation(plans, nextCalendar);
  return { calendarWorkouts: nextCalendar, history: nextHistory, validation };
}

// ------------------------------
// LiveWorkout minimal (persisted)
// ------------------------------

export function startWorkout(
  calendarWorkoutId: string,
  opts: { notes?: string } = {}
): { liveWorkout: LiveWorkout; validation: CoreValidationIssue[] } {
  const plans = loadPlans();
  const calendarWorkouts = loadCalendarWorkouts();

  const cw = findCalendarWorkoutOrThrow(calendarWorkouts, calendarWorkoutId, "startWorkout");

  const existing = loadActiveLiveWorkout();
  if (existing?.status === "active") {
    throw new Error("startWorkout: another LiveWorkout is already active");
  }

  const liveWorkout = createLiveWorkoutFromCalendar(cw, { notes: opts.notes });
  saveActiveLiveWorkout(liveWorkout);

  const validation = collectValidation(plans, calendarWorkouts);
  return { liveWorkout, validation };
}

export function abortActiveWorkout(opts: { notes?: string } = {}): { cleared: true } {
  const active = loadActiveLiveWorkout();
  if (!active) throw new Error("abortActiveWorkout: no active workout");

  const aborted = abortLiveWorkout(active, { notes: opts.notes });

  saveActiveLiveWorkout(aborted);
  clearActiveLiveWorkout();

  return { cleared: true };
}

export function completeActiveWorkout(
  opts: { notes?: string } = {}
): { calendarWorkouts: CalendarWorkout[]; history: WorkoutHistoryEntry[]; validation: CoreValidationIssue[] } {
  const activeLW = loadActiveLiveWorkout();
  if (!activeLW) throw new Error("completeActiveWorkout: no active workout");

  const plans = loadPlans();
  const calendarWorkouts = loadCalendarWorkouts();
  const history = loadWorkoutHistory();

  const cw = findCalendarWorkoutOrThrow(calendarWorkouts, activeLW.calendarWorkoutId, "completeActiveWorkout");

  const completedLW = completeLiveWorkout(activeLW, { notes: opts.notes });

  const entry = liveWorkoutToHistoryEntry(completedLW, cw);
  const nextHistory = [...history, entry];
  saveWorkoutHistory(nextHistory);

  const nextCalendar = completeCalendarWorkout(calendarWorkouts, cw.id, {
    historyEntryId: (entry as any).id,
  });
  saveCalendarWorkouts(nextCalendar);

  clearActiveLiveWorkout();

  const validation = collectValidation(plans, nextCalendar);
  return { calendarWorkouts: nextCalendar, history: nextHistory, validation };
}