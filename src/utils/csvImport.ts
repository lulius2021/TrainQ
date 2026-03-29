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
 * Returns true if the header set contains the "workout name" column,
 * which is the reliable signal for a Hevy-format CSV export.
 */
export function isHevyFormat(headers: Map<string, number>): boolean {
  return headers.has("workoutTitle");
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

  // Validate required columns
  const dateIdx = headerMap.get("date");
  const exerciseIdx = headerMap.get("exercise");
  const weightIdx = headerMap.get("weight");
  const repsIdx = headerMap.get("reps");
  const setsIdx = headerMap.get("sets");
  const workoutTitleIdx = headerMap.get("workoutTitle"); // Hevy only

  if (dateIdx === undefined) warnings.push("Spalte 'Datum' / 'Date' nicht gefunden.");
  if (exerciseIdx === undefined) warnings.push("Spalte 'Übung' / 'Exercise' nicht gefunden.");
  if (weightIdx === undefined && repsIdx === undefined) {
    warnings.push("Weder 'Gewicht'/'Weight' noch 'Wiederholungen'/'Reps' gefunden.");
  }

  if (dateIdx === undefined || exerciseIdx === undefined) {
    return {
      rows: [],
      matchedExercises: new Map(),
      unmatchedExercises: [],
      totalWorkouts: 0,
      dateRange: { from: "", to: "" },
      warnings,
    };
  }

  // Detect date format from samples
  const dateSamples: string[] = [];
  for (let i = 1; i < Math.min(lines.length, 20); i++) {
    const cols = splitCsvLine(lines[i], separator);
    if (cols[dateIdx]) dateSamples.push(cols[dateIdx].trim());
  }
  const dateFormat = detectDateFormat(dateSamples);

  // Parse data rows
  let parseErrors = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i], separator);

    const rawDate = cols[dateIdx] || "";
    const exercise = cols[exerciseIdx] || "";
    const rawWeight = weightIdx !== undefined ? cols[weightIdx] : "0";
    const rawReps = repsIdx !== undefined ? cols[repsIdx] : "0";
    const rawSets = setsIdx !== undefined ? cols[setsIdx] : "1";
    const workoutTitle = workoutTitleIdx !== undefined ? (cols[workoutTitleIdx] || "").trim() : undefined;

    if (!rawDate || !exercise) {
      parseErrors++;
      continue;
    }

    const date = normalizeDate(rawDate, dateFormat);
    // Validate the normalized date looks correct
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      parseErrors++;
      continue;
    }

    const weightKg = Math.max(0, parseFloat(rawWeight.replace(",", ".")) || 0);
    const reps = Math.max(0, Math.round(parseFloat(rawReps.replace(",", ".")) || 0));
    const sets = Math.max(1, Math.round(parseFloat(rawSets.replace(",", ".")) || 1));

    rows.push({ date, exercise, weightKg, reps, sets, workoutTitle: workoutTitle || undefined });
  }

  if (parseErrors > 0) {
    warnings.push(`${parseErrors} Zeile(n) konnten nicht gelesen werden.`);
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

  // Compute date range and total workouts
  const dates = rows.map((r) => r.date).sort();
  const dateRange = {
    from: dates[0] || "",
    to: dates[dates.length - 1] || "",
  };

  // For Hevy CSVs, multiple workouts can share the same date; count unique date+workoutTitle combos.
  const uniqueWorkoutKeys = new Set(
    rows.map((r) => (r.workoutTitle ? `${r.date}\0${r.workoutTitle}` : r.date))
  );
  const totalWorkouts = uniqueWorkoutKeys.size;

  // 300-entry limit warning
  const existingHistory = loadWorkoutHistory();
  if (existingHistory.length + totalWorkouts > 300) {
    warnings.push(
      `Import wuerde ${totalWorkouts} Workouts hinzufuegen. Mit den bestehenden ${existingHistory.length} Eintraegen wird das Limit von 300 ueberschritten. Aeltere Eintraege werden automatisch entfernt.`
    );
  }

  return {
    rows,
    matchedExercises,
    unmatchedExercises,
    totalWorkouts,
    dateRange,
    warnings,
  };
}

// -------------------- Grouping --------------------

interface GroupedWorkout {
  date: string;
  title: string;  // workout title: Hevy workout name or fallback "Import YYYY-MM-DD"
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
  // Build composite key: "date\0workoutTitle" for Hevy, just "date" for generic.
  const byKey = new Map<string, { date: string; title: string; rows: CsvParsedRow[] }>();

  for (const row of rows) {
    const key = row.workoutTitle ? `${row.date}\0${row.workoutTitle}` : row.date;
    if (!byKey.has(key)) {
      const title = row.workoutTitle || `Import ${row.date}`;
      byKey.set(key, { date: row.date, title, rows: [] });
    }
    byKey.get(key)!.rows.push(row);
  }

  const result: GroupedWorkout[] = [];

  for (const { date, title, rows: workoutRows } of byKey.values()) {
    // Group by exercise name within this workout
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
        // Each row may represent multiple sets
        for (let s = 0; s < row.sets; s++) {
          sets.push({
            reps: row.reps,
            weight: row.weightKg,
          });
        }
      }

      exercises.push({
        name: matchedName,
        exerciseId: matchResult?.exerciseId,
        sets,
      });
    }

    result.push({ date, title, exercises });
  }

  // Sort by date (then title for same-day workouts)
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

    // Build WorkoutHistoryEntry
    const dateISO = workout.date;
    const startedAt = `${dateISO}T08:00:00.000Z`;
    const endedAt = `${dateISO}T09:00:00.000Z`;

    const totalVolume = computeTotalVolume(dedupedExercises);

    try {
      addWorkoutEntry(
        {
          title: workout.title,
          sport: "Gym",
          startedAt,
          endedAt,
          durationSec: 3600,
          exercises: dedupedExercises,
        },
        { allowEmptyExercises: false }
      );
    } catch (err) {
      errors.push(`Fehler beim Import von ${dateISO}: ${String(err)}`);
    }
  }

  return { importedCount, skippedCount, errors };
}
