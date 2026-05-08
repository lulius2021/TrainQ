// src/services/trainingSync.ts
// Offline-first sync for training data (calendar, workouts, templates, exercises).
// Pattern: fire-and-forget push + pull-and-merge on login.

import { getSupabaseClient } from "../lib/supabaseClient";
import { getActiveUserId } from "../utils/session";
import { getScopedItem, setScopedItem } from "../utils/scopedStorage";
import type { CalendarEvent } from "../types/training";

const SYNC_TS_KEY = "trainq_training_sync_ts_v1";

function getUserId(): string | null { return getActiveUserId(); }
function isLocalUser(): boolean { const uid = getUserId(); return !uid || uid.startsWith("local_"); }
function getClient() { if (isLocalUser()) return null; return getSupabaseClient(); }
function getLastSync(table: string): string {
  return getScopedItem(`${SYNC_TS_KEY}_${table}`, getUserId()) || "1970-01-01T00:00:00Z";
}
function setLastSync(table: string, ts: string): void {
  setScopedItem(`${SYNC_TS_KEY}_${table}`, ts, getUserId());
}
function now(): string { return new Date().toISOString(); }

function logSyncError(context: string, err: unknown): void {
  if (import.meta.env.DEV) console.error(`[TrainingSync] ${context}:`, err);
}

// ==================== Types ====================

interface WorkoutEntry {
  id: string;
  calendarEventId?: string;
  title?: string;
  sport?: string;
  startedAt?: string;
  endedAt?: string;
  durationSec?: number;
  sessionRpe?: number;
  exercises?: unknown;
  distanceKm?: number;
  paceSecPerKm?: number;
  totalVolume?: number;
  adaptiveScore?: number;
  rating?: number;
  gpsPoints?: unknown;
  elevationGainM?: number;
  calories?: number;
  postFeedback?: unknown;
  updatedAt?: string;
}

interface TrainingTemplateSync {
  id: string;
  name?: string;
  sportType?: string;
  exercises?: unknown;
  sourcePlanId?: string;
  sourceDayIndex?: number;
  signature?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TrainingPlanTemplateSync {
  id: string;
  name?: string;
  kind?: string;
  startDate?: string;
  durationWeeks?: number;
  days?: unknown;
  createdAt?: string;
  updatedAt?: string;
}

interface CustomExerciseSync {
  id: string;
  name?: string;
  aliases?: string[];
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  equipment?: string;
  movement?: string;
  type?: string;
  metrics?: unknown;
  imageSrc?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AiCoachProfileSync {
  goal?: string;
  level?: string;
  daysPerWeek?: number;
  equipment?: string[];
  durationWeeks?: number;
}

// ==================== PUSH: Calendar Events ====================

export function pushCalendarEvent(event: CalendarEvent): void {
  const client = getClient(); if (!client) return;
  const uid = getUserId();
  client.from("calendar_events").upsert({
    id: event.id, user_id: uid, title: event.title, date: event.date,
    start_time: event.startTime || "", end_time: event.endTime || "",
    event_type: event.type, training_type: event.trainingType,
    training_status: event.trainingStatus, completed_at: event.completedAt,
    skipped_at: event.skippedAt, workout_id: event.workoutId,
    template_id: event.templateId, deload: event.deload,
    workout_data: event.workoutData, cardio_target: event.cardioTarget,
    adaptive_profile: event.adaptiveProfile, adaptive_suggestion: event.adaptiveSuggestion,
    description: event.description, notes: event.notes, sport: event.sport,
    updated_at: now(),
  }).then(() => {}, (err) => logSyncError("pushCalendarEvent", err));
}

export function pushCalendarEventDelete(id: string): void {
  const client = getClient(); if (!client) return;
  client.from("calendar_events").update({ deleted_at: now() }).eq("id", id).eq("user_id", getUserId())
    .then(() => {}, (err) => logSyncError("pushCalendarEventDelete", err));
}

export function pushCalendarEventsBatch(events: CalendarEvent[]): void {
  const client = getClient(); if (!client) return;
  const uid = getUserId();
  const rows = events.map((e) => ({
    id: e.id, user_id: uid, title: e.title, date: e.date,
    start_time: e.startTime || "", end_time: e.endTime || "",
    event_type: e.type, training_type: e.trainingType,
    training_status: e.trainingStatus, workout_data: e.workoutData,
    template_id: e.templateId, updated_at: now(),
  }));
  client.from("calendar_events").upsert(rows)
    .then(() => {}, (err) => logSyncError("pushCalendarEventsBatch", err));
}

// ==================== PUSH: Workout History ====================

export function pushWorkoutEntry(entry: WorkoutEntry): void {
  const client = getClient(); if (!client) return;
  const uid = getUserId();
  client.from("workout_history").upsert({
    id: entry.id, user_id: uid, calendar_event_id: entry.calendarEventId,
    title: entry.title, sport: entry.sport,
    started_at: entry.startedAt, ended_at: entry.endedAt,
    duration_sec: entry.durationSec, session_rpe: entry.sessionRpe,
    exercises: entry.exercises, distance_km: entry.distanceKm,
    pace_sec_per_km: entry.paceSecPerKm, total_volume: entry.totalVolume,
    adaptive_score: entry.adaptiveScore, rating: entry.rating,
    gps_points: entry.gpsPoints, elevation_gain_m: entry.elevationGainM,
    calories: entry.calories, post_feedback: entry.postFeedback,
    updated_at: now(),
  }).then(() => {}, (err) => logSyncError("pushWorkoutEntry", err));
}

// ==================== PUSH: Training Templates ====================

export function pushTrainingTemplate(tpl: TrainingTemplateSync): void {
  const client = getClient(); if (!client) return;
  const uid = getUserId();
  client.from("training_templates").upsert({
    id: tpl.id, user_id: uid, name: tpl.name, sport_type: tpl.sportType,
    exercises: tpl.exercises, source_plan_id: tpl.sourcePlanId,
    source_day_index: tpl.sourceDayIndex, signature: tpl.signature,
    created_at: tpl.createdAt, updated_at: tpl.updatedAt || now(),
  }).then(() => {}, (err) => logSyncError("pushTrainingTemplate", err));
}

export function pushTrainingTemplateDelete(id: string): void {
  const client = getClient(); if (!client) return;
  client.from("training_templates").update({ deleted_at: now() }).eq("id", id).eq("user_id", getUserId())
    .then(() => {}, (err) => logSyncError("pushTrainingTemplateDelete", err));
}

// ==================== PUSH: Training Plan Templates ====================

export function pushTrainingPlanTemplate(plan: TrainingPlanTemplateSync): void {
  const client = getClient(); if (!client) return;
  const uid = getUserId();
  client.from("training_plan_templates").upsert({
    id: plan.id, user_id: uid, name: plan.name, kind: plan.kind,
    start_date: plan.startDate, duration_weeks: plan.durationWeeks,
    days: plan.days, created_at: plan.createdAt, updated_at: plan.updatedAt || now(),
  }).then(() => {}, (err) => logSyncError("pushTrainingPlanTemplate", err));
}

// ==================== PUSH: Custom Exercises ====================

export function pushCustomExercise(ex: CustomExerciseSync): void {
  const client = getClient(); if (!client) return;
  const uid = getUserId();
  client.from("custom_exercises").upsert({
    id: ex.id, user_id: uid, name: ex.name, aliases: ex.aliases,
    primary_muscles: ex.primaryMuscles, secondary_muscles: ex.secondaryMuscles,
    equipment: ex.equipment, movement: ex.movement, exercise_type: ex.type,
    metrics: ex.metrics, image_src: ex.imageSrc,
    created_at: ex.createdAt || now(), updated_at: ex.updatedAt || now(),
  }).then(() => {}, (err) => logSyncError("pushCustomExercise", err));
}

export function pushCustomExerciseDelete(id: string): void {
  const client = getClient(); if (!client) return;
  client.from("custom_exercises").update({ deleted_at: now() }).eq("id", id).eq("user_id", getUserId())
    .then(() => {}, (err) => logSyncError("pushCustomExerciseDelete", err));
}

// ==================== PUSH: AI Coach Profile ====================

export function pushAiCoachProfile(profile: AiCoachProfileSync): void {
  const client = getClient(); if (!client) return;
  const uid = getUserId();
  client.from("ai_coach_profiles").upsert({
    user_id: uid, goal: profile.goal, level: profile.level,
    days_per_week: profile.daysPerWeek, equipment: profile.equipment,
    duration_weeks: profile.durationWeeks, updated_at: now(),
  }).then(() => {}, (err) => logSyncError("pushAiCoachProfile", err));
}

// ==================== PULL & MERGE ====================

export async function pullAndMergeTrainingData(): Promise<void> {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();
  if (!uid) return;

  const syncNow = now();

  try {
    // First login with local data? Push everything to Supabase first
    const firstSyncKey = `trainq_training_initial_push_done_${uid}`;
    if (!localStorage.getItem(firstSyncKey)) {
      if (import.meta.env.DEV) console.log("[TrainingSync] First sync — pushing all local data...");
      await pushAllLocalData();
      localStorage.setItem(firstSyncKey, "1");
    }

    await Promise.all([
      pullCalendarEvents(client, uid),
      pullWorkoutHistory(client, uid),
      pullTrainingTemplates(client, uid),
      pullTrainingPlanTemplates(client, uid),
      pullCustomExercises(client, uid),
      pullAiCoachProfile(client, uid),
    ]);

    // Update sync timestamps
    ["calendar_events", "workout_history", "training_templates", "training_plan_templates", "custom_exercises", "ai_coach_profiles"]
      .forEach((t) => setLastSync(t, syncNow));
  } catch (e) {
    logSyncError("Pull failed", e);
  }
}

async function pullCalendarEvents(client: ReturnType<typeof getSupabaseClient>, uid: string) {
  const lastSync = getLastSync("calendar_events");
  const { data } = await client!.from("calendar_events").select("*").eq("user_id", uid).gt("updated_at", lastSync);
  if (!data?.length) return;

  const raw = getScopedItem("trainq_calendar_events", uid);
  const local: CalendarEvent[] = raw ? JSON.parse(raw) : [];
  const localMap = new Map(local.map((e) => [e.id, e]));

  for (const re of data) {
    if (re.deleted_at) { localMap.delete(re.id); continue; }
    const localItem = localMap.get(re.id);
    const remoteTs = re.updated_at || re.created_at;
    const localTs = (localItem as Record<string, unknown>)?.updatedAt as string || "";
    if (!localItem || remoteTs > localTs) {
      localMap.set(re.id, {
        id: re.id, title: re.title, date: re.date, startTime: re.start_time, endTime: re.end_time,
        type: re.event_type, trainingType: re.training_type, trainingStatus: re.training_status,
        completedAt: re.completed_at, skippedAt: re.skipped_at, workoutId: re.workout_id,
        templateId: re.template_id, deload: re.deload, workoutData: re.workout_data,
        cardioTarget: re.cardio_target, description: re.description, notes: re.notes,
        sport: re.sport, adaptiveProfile: re.adaptive_profile, adaptiveSuggestion: re.adaptive_suggestion,
      } as CalendarEvent);
    }
  }
  setScopedItem("trainq_calendar_events", JSON.stringify([...localMap.values()]), uid);
  window.dispatchEvent(new Event("trainq:update_events"));
}

async function pullWorkoutHistory(client: ReturnType<typeof getSupabaseClient>, uid: string) {
  const lastSync = getLastSync("workout_history");
  const { data } = await client!.from("workout_history").select("*").eq("user_id", uid).gt("updated_at", lastSync);
  if (!data?.length) return;

  const raw = getScopedItem("trainq_workout_history_v1", uid);
  const local: WorkoutEntry[] = raw ? JSON.parse(raw) : [];
  const localMap = new Map(local.map((e) => [e.id, e]));

  for (const re of data) {
    if (re.deleted_at) { localMap.delete(re.id); continue; }
    const localItem = localMap.get(re.id);
    if (!localItem || (re.updated_at || "") > (localItem.updatedAt || "")) {
      localMap.set(re.id, {
        id: re.id, calendarEventId: re.calendar_event_id, title: re.title, sport: re.sport,
        startedAt: re.started_at, endedAt: re.ended_at, durationSec: re.duration_sec,
        sessionRpe: re.session_rpe, exercises: re.exercises, distanceKm: re.distance_km,
        paceSecPerKm: re.pace_sec_per_km, totalVolume: re.total_volume,
        adaptiveScore: re.adaptive_score, rating: re.rating, gpsPoints: re.gps_points,
        elevationGainM: re.elevation_gain_m, calories: re.calories, postFeedback: re.post_feedback,
      });
    }
  }
  setScopedItem("trainq_workout_history_v1", JSON.stringify([...localMap.values()]), uid);
  window.dispatchEvent(new Event("trainq:workoutHistoryUpdated"));
}

async function pullTrainingTemplates(client: ReturnType<typeof getSupabaseClient>, uid: string) {
  const lastSync = getLastSync("training_templates");
  const { data } = await client!.from("training_templates").select("*").eq("user_id", uid).gt("updated_at", lastSync);
  if (!data?.length) return;

  const storageKey = `trainq:${uid}:training_templates_v1`;
  const raw = localStorage.getItem(storageKey);
  const local: TrainingTemplateSync[] = raw ? JSON.parse(raw) : [];
  const localMap = new Map(local.map((e) => [e.id, e]));

  for (const re of data) {
    if (re.deleted_at) { localMap.delete(re.id); continue; }
    const localItem = localMap.get(re.id);
    if (!localItem || (re.updated_at || "") > (localItem.updatedAt || "")) {
      localMap.set(re.id, {
        id: re.id, name: re.name, sportType: re.sport_type,
        exercises: re.exercises, sourcePlanId: re.source_plan_id,
        sourceDayIndex: re.source_day_index, signature: re.signature,
        createdAt: re.created_at, updatedAt: re.updated_at,
      });
    }
  }
  localStorage.setItem(storageKey, JSON.stringify([...localMap.values()]));
}

async function pullTrainingPlanTemplates(client: ReturnType<typeof getSupabaseClient>, uid: string) {
  const lastSync = getLastSync("training_plan_templates");
  const { data } = await client!.from("training_plan_templates").select("*").eq("user_id", uid).gt("updated_at", lastSync);
  if (!data?.length) return;

  const storageKey = `trainq:${uid}:training_plan_templates_v1`;
  const raw = localStorage.getItem(storageKey);
  const local: TrainingPlanTemplateSync[] = raw ? JSON.parse(raw) : [];
  const localMap = new Map(local.map((e) => [e.id, e]));

  for (const re of data) {
    if (re.deleted_at) { localMap.delete(re.id); continue; }
    const localItem = localMap.get(re.id);
    if (!localItem || (re.updated_at || "") > (localItem.updatedAt || "")) {
      localMap.set(re.id, {
        id: re.id, name: re.name, kind: re.kind,
        startDate: re.start_date, durationWeeks: re.duration_weeks,
        days: re.days, createdAt: re.created_at, updatedAt: re.updated_at,
      });
    }
  }
  localStorage.setItem(storageKey, JSON.stringify([...localMap.values()]));
}

async function pullCustomExercises(client: ReturnType<typeof getSupabaseClient>, uid: string) {
  const lastSync = getLastSync("custom_exercises");
  const { data } = await client!.from("custom_exercises").select("*").eq("user_id", uid).gt("updated_at", lastSync);
  if (!data?.length) return;

  const raw = getScopedItem("trainq_custom_exercises_v1", uid);
  const local: CustomExerciseSync[] = raw ? JSON.parse(raw) : [];
  const localMap = new Map(local.map((e) => [e.id, e]));

  for (const re of data) {
    if (re.deleted_at) { localMap.delete(re.id); continue; }
    localMap.set(re.id, {
      id: re.id, name: re.name, aliases: re.aliases,
      primaryMuscles: re.primary_muscles, secondaryMuscles: re.secondary_muscles,
      equipment: re.equipment, movement: re.movement, type: re.exercise_type,
      metrics: re.metrics, imageSrc: re.image_src,
      createdAt: re.created_at, updatedAt: re.updated_at,
    });
  }
  setScopedItem("trainq_custom_exercises_v1", JSON.stringify([...localMap.values()]), uid);
}

async function pullAiCoachProfile(client: ReturnType<typeof getSupabaseClient>, uid: string) {
  const { data } = await client!.from("ai_coach_profiles").select("*").eq("user_id", uid).maybeSingle();
  if (!data) return;
  const profile: AiCoachProfileSync = { goal: data.goal, level: data.level, daysPerWeek: data.days_per_week, equipment: data.equipment, durationWeeks: data.duration_weeks };
  setScopedItem("trainq_ai_coach_profile", JSON.stringify(profile), uid);
}

// ==================== INITIAL PUSH (first login migration) ====================

export async function pushAllLocalData(): Promise<void> {
  const client = getClient();
  if (!client) return;
  const uid = getUserId();
  if (!uid) return;

  // Calendar events
  const rawCal = getScopedItem("trainq_calendar_events", uid);
  if (rawCal) {
    try {
      const events: CalendarEvent[] = JSON.parse(rawCal);
      if (events.length) pushCalendarEventsBatch(events);
    } catch (e) { logSyncError("pushAll/calendar parse", e); }
  }

  // Workout history
  const rawWh = getScopedItem("trainq_workout_history_v1", uid);
  if (rawWh) {
    try {
      const entries: WorkoutEntry[] = JSON.parse(rawWh);
      for (const e of entries) pushWorkoutEntry(e);
    } catch (e) { logSyncError("pushAll/workout parse", e); }
  }

  // Training templates
  const rawTt = localStorage.getItem(`trainq:${uid}:training_templates_v1`);
  if (rawTt) {
    try {
      const templates: TrainingTemplateSync[] = JSON.parse(rawTt);
      for (const t of templates) pushTrainingTemplate(t);
    } catch (e) { logSyncError("pushAll/templates parse", e); }
  }

  // Plan templates
  const rawPt = localStorage.getItem(`trainq:${uid}:training_plan_templates_v1`);
  if (rawPt) {
    try {
      const plans: TrainingPlanTemplateSync[] = JSON.parse(rawPt);
      for (const p of plans) pushTrainingPlanTemplate(p);
    } catch (e) { logSyncError("pushAll/plans parse", e); }
  }

  // Custom exercises
  const rawCe = getScopedItem("trainq_custom_exercises_v1", uid);
  if (rawCe) {
    try {
      const exercises: CustomExerciseSync[] = JSON.parse(rawCe);
      for (const e of exercises) pushCustomExercise(e);
    } catch (e) { logSyncError("pushAll/exercises parse", e); }
  }

  // AI coach profile
  const rawAi = getScopedItem("trainq_ai_coach_profile", uid);
  if (rawAi) {
    try { pushAiCoachProfile(JSON.parse(rawAi)); } catch (e) { logSyncError("pushAll/aiCoach parse", e); }
  }
}
