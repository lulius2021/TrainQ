// src/utils/csvImport.ts
// Main CSV import logic: parsing, exercise matching, grouping, and import execution.

import type { CsvParsedRow, CsvImportPreview, CsvImportResult } from "../types/csvImport";
import type { WorkoutHistoryEntry, WorkoutHistoryExercise, WorkoutHistorySet } from "./workoutHistory";
import { addWorkoutEntry, loadWorkoutHistory, computeTotalVolume } from "./workoutHistory";
import {
  findExerciseByToken,
  normalizeExerciseToken,
  EXERCISES,
  getLevenshteinDistance,
} from "../data/exerciseLibrary";
import {
  detectSeparator,
  detectDateFormat,
  normalizeDate,
  parseHeader,
  splitCsvRows,
  splitCsvLine,
  parseHevyDateTime,
} from "./csvParser";

// -------------------- Exercise Matching --------------------

/**
 * 3-tier matching:
 * 1. Exact token match via exerciseLibrary's findExerciseByToken
 * 2. Substring match (normalized CSV name contained in exercise name or alias)
 * 3. Fuzzy Levenshtein match (distance <= 3)
 */
export function matchExercise(csvName: string): { matchedName: string; exerciseId: string } | null {
  const token = normalizeExerciseToken(csvName);
  if (!token) return null;

  // Tier 1: Exact token match
  const exact = findExerciseByToken(csvName);
  if (exact) {
    return { matchedName: exact.nameDe || exact.nameEn || exact.name, exerciseId: exact.id };
  }

  // Tier 2: Substring match
  for (const ex of EXERCISES) {
    const targets = [
      normalizeExerciseToken(ex.nameEn),
      normalizeExerciseToken(ex.nameDe),
      normalizeExerciseToken(ex.name),
      ...(ex.aliases?.en || []).map(normalizeExerciseToken),
      ...(ex.aliases?.de || []).map(normalizeExerciseToken),
    ].filter(Boolean);

    for (const target of targets) {
      if (target.includes(token) || token.includes(target)) {
        return { matchedName: ex.nameDe || ex.nameEn || ex.name, exerciseId: ex.id };
      }
    }
  }

  // Tier 3: Fuzzy Levenshtein (distance <= 3)
  let bestMatch: { matchedName: string; exerciseId: string } | null = null;
  let bestDistance = Infinity;

  for (const ex of EXERCISES) {
    const targets = [
      normalizeExerciseToken(ex.nameEn),
      normalizeExerciseToken(ex.nameDe),
      normalizeExerciseToken(ex.name),
      ...(ex.aliases?.en || []).map(normalizeExerciseToken),
      ...(ex.aliases?.de || []).map(normalizeExerciseToken),
    ].filter(Boolean);

    for (const target of targets) {
      const dist = getLevenshteinDistance(token, target);
      if (dist <= 3 && dist < bestDistance) {
        bestDistance = dist;
        bestMatch = { matchedName: ex.nameDe || ex.nameEn || ex.name, exerciseId: ex.id };
      }
    }
  }

  return bestMatch;
}

// -------------------- Hevy Detection --------------------

/**
 * Returns true if the headers match the actual Hevy export format.
 * Hevy exports have a "start_time" column (→ semantic "startTime") and
 * "exercise_title" (→ semantic "exercise" via "exercise title" mapping).
 */
export function isHevyFormat(headers: Map<string, number>): boolean {
  return headers.has("startTime") && (headers.has("workoutTitle") || headers.has("exercise"));
}

// -------------------- CSV Parsing --------------------

/**
 * Parse full CSV content into a CsvImportPreview.
 */
export function parseCsvForImport(content: string): CsvImportPreview {
  const warnings: string[] = [];
  const rows: CsvParsedRow[] = [];

  const lines = splitCsvRows(content);
  if (lines.length < 2) {
    return {
      rows: [],
      matchedExercises: new Map(),
      unmatchedExercises: [],
      totalWorkouts: 0,
      dateRange: { from: "", to: "" },
      warnings: ["CSV-Datei ist leer oder hat keine Datenzeilen."],
    };
  }

  const separator = detectSeparator(lines.slice(0, 5));
  const headerMap = parseHeader(lines[0], separator, true);

  const hevy = isHevyFormat(headerMap);

  if (hevy) {
    // ---- Hevy format: one row per set ----
    const startTimeIdx = headerMap.get("startTime")!;
    const endTimeIdx   = headerMap.get("endTime");
    const exerciseIdx  = headerMap.get("exercise")!;
    const workoutTitleIdx = headerMap.get("workoutTitle");
    const weightIdx    = headerMap.get("weight");
    const repsIdx      = headerMap.get("reps");
    const setTypeIdx   = headerMap.get("setType");
    const rpeIdx       = headerMap.get("rpe");
    const distKmIdx    = headerMap.get("distanceKm");
    const durSecIdx    = headerMap.get("durationSeconds");

    let parseErrors = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i], separator);

      const rawStart   = cols[startTimeIdx] || "";
      const exercise   = (exerciseIdx !== undefined ? cols[exerciseIdx] : "") || "";
      const workoutTitle = workoutTitleIdx !== undefined ? (cols[workoutTitleIdx] || "").trim() : undefined;

      if (!rawStart || !exercise) { parseErrors++; continue; }

      const parsed = parseHevyDateTime(rawStart);
      if (!parsed) { parseErrors++; continue; }

      const rawEnd = endTimeIdx !== undefined ? cols[endTimeIdx] || "" : "";
      const endParsed = rawEnd ? parseHevyDateTime(rawEnd) : null;

      const weightKg = weightIdx !== undefined ? Math.max(0, parseFloat((cols[weightIdx] || "0").replace(",", ".")) || 0) : 0;
      const reps     = repsIdx   !== undefined ? Math.max(0, Math.round(parseFloat((cols[repsIdx]   || "0").replace(",", ".")) || 0)) : 0;

      // set_type → TrainQ setType
      let setType: CsvParsedRow["setType"] = undefined;
      if (setTypeIdx !== undefined) {
        const rawType = (cols[setTypeIdx] || "").trim().toLowerCase();
        if (rawType === "warmup")  setType = "warmup";
        else if (rawType === "failure") setType = "failure";
        else setType = "normal";
      }

      const rpe     = rpeIdx    !== undefined ? (parseFloat(cols[rpeIdx]    || "") || undefined) : undefined;
      const distKm  = distKmIdx !== undefined ? (parseFloat(cols[distKmIdx] || "") || undefined) : undefined;
      const durSec  = durSecIdx !== undefined ? (parseFloat(cols[durSecIdx] || "") || undefined) : undefined;

      rows.push({
        date: parsed.date,
        exercise,
        weightKg,
        reps,
        sets: 1,
        workoutTitle: workoutTitle || undefined,
        startTime: parsed.isoDatetime,
        endTime: endParsed?.isoDatetime,
        setType,
        rpe,
        durationSeconds: durSec,
        distanceKm: distKm,
      });
    }

    if (parseErrors > 0) {
      warnings.push(`${parseErrors} Zeile(n) konnten nicht gelesen werden.`);
    }
  } else {
    // ---- Generic format ----
    const dateIdx      = headerMap.get("date");
    const exerciseIdx  = headerMap.get("exercise");
    const weightIdx    = headerMap.get("weight");
    const repsIdx      = headerMap.get("reps");
    const setsIdx      = headerMap.get("sets");
    const workoutTitleIdx = headerMap.get("workoutTitle");

    if (dateIdx === undefined) warnings.push("Spalte 'Datum' / 'Date' nicht gefunden.");
    if (exerciseIdx === undefined) warnings.push("Spalte 'Übung' / 'Exercise' nicht gefunden.");
    if (weightIdx === undefined && repsIdx === undefined) {
      warnings.push("Weder 'Gewicht'/'Weight' noch 'Wiederholungen'/'Reps' gefunden.");
    }

    if (dateIdx === undefined || exerciseIdx === undefined) {
      return { rows: [], matchedExercises: new Map(), unmatchedExercises: [], totalWorkouts: 0, dateRange: { from: "", to: "" }, warnings };
    }

    const dateSamples: string[] = [];
    for (let i = 1; i < Math.min(lines.length, 20); i++) {
      const cols = splitCsvLine(lines[i], separator);
      if (cols[dateIdx]) dateSamples.push(cols[dateIdx].trim());
    }
    const dateFormat = detectDateFormat(dateSamples);

    let parseErrors = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = splitCsvLine(lines[i], separator);
      const rawDate  = cols[dateIdx] || "";
      const exercise = cols[exerciseIdx] || "";
      const rawWeight = weightIdx !== undefined ? cols[weightIdx] : "0";
      const rawReps   = repsIdx   !== undefined ? cols[repsIdx]   : "0";
      const rawSets   = setsIdx   !== undefined ? cols[setsIdx]   : "1";
      const workoutTitle = workoutTitleIdx !== undefined ? (cols[workoutTitleIdx] || "").trim() : undefined;

      if (!rawDate || !exercise) { parseErrors++; continue; }

      const date = normalizeDate(rawDate, dateFormat);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { parseErrors++; continue; }

      const weightKg = Math.max(0, parseFloat(rawWeight.replace(",", ".")) || 0);
      const reps     = Math.max(0, Math.round(parseFloat(rawReps.replace(",", ".")) || 0));
      const sets     = Math.max(1, Math.round(parseFloat(rawSets.replace(",", ".")) || 1));

      rows.push({ date, exercise, weightKg, reps, sets, workoutTitle: workoutTitle || undefined });
    }

    if (parseErrors > 0) {
      warnings.push(`${parseErrors} Zeile(n) konnten nicht gelesen werden.`);
    }
  }

  // Match exercises
  const matchedExercises = new Map<string, string>();
  const unmatchedExercises: string[] = [];
  const uniqueExercises = [...new Set(rows.map((r) => r.exercise))];

  for (const csvName of uniqueExercises) {
    const match = matchExercise(csvName);
    if (match) {
      matchedExercises.set(csvName, match.matchedName);
    } else {
      unmatchedExercises.push(csvName);
    }
  }

  if (unmatchedExercises.length > 0) {
    warnings.push(
      `${unmatchedExercises.length} Übung(en) konnten nicht zugeordnet werden und werden mit dem CSV-Namen importiert.`
    );
  }

  const dates = rows.map((r) => r.date).sort();
  const dateRange = { from: dates[0] || "", to: dates[dates.length - 1] || "" };

  // Count unique workouts: for Hevy, use startTime as the key; for generic, date+workoutTitle
  const uniqueWorkoutKeys = new Set(
    rows.map((r) => r.startTime ? r.startTime : (r.workoutTitle ? `${r.date}\0${r.workoutTitle}` : r.date))
  );
  const totalWorkouts = uniqueWorkoutKeys.size;

  const existingHistory = loadWorkoutHistory();
  if (existingHistory.length + totalWorkouts > 300) {
    warnings.push(
      `Import wuerde ${totalWorkouts} Workouts hinzufuegen. Mit den bestehenden ${existingHistory.length} Eintraegen wird das Limit von 300 ueberschritten. Aeltere Eintraege werden automatisch entfernt.`
    );
  }

  return { rows, matchedExercises, unmatchedExercises, totalWorkouts, dateRange, warnings };
}

// -------------------- Grouping --------------------

interface GroupedWorkout {
  date: string;
  title: string;        // workout title: Hevy workout name or fallback "Import YYYY-MM-DD"
  startedAt: string;    // ISO datetime
  endedAt: string;      // ISO datetime
  exercises: WorkoutHistoryExercise[];
}

/**
 * Group parsed CSV rows into workout entries.
 *
 * For Hevy CSVs (rows have workoutTitle): groups by "date + workoutTitle" so
 * multiple workouts on the same day are kept separate and the Hevy workout name
 * is used as the entry title.
 *
 * For generic CSVs: groups by date only (backward-compatible behaviour).
 */
export function groupRowsIntoEntries(
  rows: CsvParsedRow[],
  matches: Map<string, string>
): GroupedWorkout[] {
  // Key: Hevy uses startTime (unique per session); generic uses date+workoutTitle or date.
  const byKey = new Map<string, {
    date: string;
    title: string;
    startedAt: string;
    endedAt: string;
    rows: CsvParsedRow[];
  }>();

  for (const row of rows) {
    const key = row.startTime ?? (row.workoutTitle ? `${row.date}\0${row.workoutTitle}` : row.date);
    if (!byKey.has(key)) {
      const title = row.workoutTitle || `Import ${row.date}`;
      const startedAt = row.startTime ? `${row.startTime}` : `${row.date}T08:00:00`;
      const endedAt   = row.endTime   ? `${row.endTime}`   : `${row.date}T09:00:00`;
      byKey.set(key, { date: row.date, title, startedAt, endedAt, rows: [] });
    }
    // Update endedAt if this row has a later endTime (all rows share same workout end)
    const bucket = byKey.get(key)!;
    if (row.endTime && row.endTime > bucket.endedAt) {
      bucket.endedAt = row.endTime;
    }
    bucket.rows.push(row);
  }

  const result: GroupedWorkout[] = [];

  for (const { date, title, startedAt, endedAt, rows: workoutRows } of byKey.values()) {
    const byExercise = new Map<string, CsvParsedRow[]>();
    for (const row of workoutRows) {
      const existing = byExercise.get(row.exercise) || [];
      existing.push(row);
      byExercise.set(row.exercise, existing);
    }

    const exercises: WorkoutHistoryExercise[] = [];

    for (const [csvName, exRows] of byExercise) {
      const matchedName = matches.get(csvName) || csvName;
      const matchResult = matchExercise(csvName);

      const sets: WorkoutHistorySet[] = [];
      for (const row of exRows) {
        for (let s = 0; s < row.sets; s++) {
          const set: WorkoutHistorySet = { reps: row.reps, weight: row.weightKg };
          if (row.setType) {
            set.setType = row.setType;
            if (row.setType === "warmup") set.isWarmup = true;
          }
          if (row.rpe !== undefined) set.rpe = row.rpe;
          sets.push(set);
        }
      }

      exercises.push({
        name: matchedName,
        exerciseId: matchResult?.exerciseId,
        sets,
      });
    }

    result.push({ date, title, startedAt, endedAt, exercises });
  }

  result.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    return dateCmp !== 0 ? dateCmp : a.title.localeCompare(b.title);
  });

  return result;
}

// -------------------- Dedup --------------------

function isDuplicate(
  existing: WorkoutHistoryEntry[],
  date: string,
  exerciseName: string,
  weight: number,
  reps: number
): boolean {
  for (const entry of existing) {
    const entryDate = entry.startedAt.slice(0, 10);
    if (entryDate !== date) continue;

    for (const ex of entry.exercises) {
      if (ex.name !== exerciseName) continue;

      for (const s of ex.sets) {
        if (s.weight === weight && s.reps === reps) {
          return true;
        }
      }
    }
  }
  return false;
}

// -------------------- Execute Import --------------------

/**
 * Execute the import: save parsed data to workout history.
 * Deduplicates against existing entries.
 */
export function executeImport(preview: CsvImportPreview): CsvImportResult {
  const errors: string[] = [];
  let importedCount = 0;
  let skippedCount = 0;

  const existingHistory = loadWorkoutHistory();
  const grouped = groupRowsIntoEntries(preview.rows, preview.matchedExercises);

  for (const workout of grouped) {
    // Filter out duplicate sets
    const dedupedExercises: WorkoutHistoryExercise[] = [];
    let workoutSkipped = 0;
    let workoutImported = 0;

    for (const ex of workout.exercises) {
      const dedupedSets: WorkoutHistorySet[] = [];

      for (const set of ex.sets) {
        if (isDuplicate(existingHistory, workout.date, ex.name, set.weight, set.reps)) {
          workoutSkipped++;
        } else {
          dedupedSets.push(set);
          workoutImported++;
        }
      }

      if (dedupedSets.length > 0) {
        dedupedExercises.push({
          ...ex,
          sets: dedupedSets,
        });
      }
    }

    skippedCount += workoutSkipped;

    if (dedupedExercises.length === 0) {
      // All sets were duplicates, skip this workout
      continue;
    }

    importedCount += workoutImported;

    const totalVolume = computeTotalVolume(dedupedExercises);
    void totalVolume; // used by addWorkoutEntry internally

    const startedAt = workout.startedAt;
    const endedAt   = workout.endedAt;
    const startMs   = new Date(startedAt).getTime();
    const endMs     = new Date(endedAt).getTime();
    const durationSec = !isNaN(startMs) && !isNaN(endMs) && endMs > startMs
      ? Math.round((endMs - startMs) / 1000)
      : 3600;

    try {
      addWorkoutEntry(
        {
          title: workout.title,
          sport: "Gym",
          startedAt,
          endedAt,
          durationSec,
          exercises: dedupedExercises,
        },
        { allowEmptyExercises: false }
      );
    } catch (err) {
      errors.push(`Fehler beim Import von ${workout.date}: ${String(err)}`);
    }
  }

  return { importedCount, skippedCount, errors };
}
