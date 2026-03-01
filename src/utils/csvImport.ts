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
  const headerMap = parseHeader(lines[0], separator);

  // Validate required columns
  const dateIdx = headerMap.get("date");
  const exerciseIdx = headerMap.get("exercise");
  const weightIdx = headerMap.get("weight");
  const repsIdx = headerMap.get("reps");
  const setsIdx = headerMap.get("sets");

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
    const cols = lines[i].split(separator);
    if (cols[dateIdx]) dateSamples.push(cols[dateIdx].trim());
  }
  const dateFormat = detectDateFormat(dateSamples);

  // Parse data rows
  let parseErrors = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(separator).map((c) => c.trim());

    const rawDate = cols[dateIdx] || "";
    const exercise = cols[exerciseIdx] || "";
    const rawWeight = weightIdx !== undefined ? cols[weightIdx] : "0";
    const rawReps = repsIdx !== undefined ? cols[repsIdx] : "0";
    const rawSets = setsIdx !== undefined ? cols[setsIdx] : "1";

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

    rows.push({ date, exercise, weightKg, reps, sets });
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

  const uniqueDates = new Set(rows.map((r) => r.date));
  const totalWorkouts = uniqueDates.size;

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
  exercises: WorkoutHistoryExercise[];
}

/**
 * Group parsed CSV rows by date into workout entries.
 */
export function groupRowsIntoEntries(
  rows: CsvParsedRow[],
  matches: Map<string, string>
): GroupedWorkout[] {
  // Group rows by date
  const byDate = new Map<string, CsvParsedRow[]>();
  for (const row of rows) {
    const existing = byDate.get(row.date) || [];
    existing.push(row);
    byDate.set(row.date, existing);
  }

  const result: GroupedWorkout[] = [];

  for (const [date, dateRows] of byDate) {
    // Group by exercise name within this date
    const byExercise = new Map<string, CsvParsedRow[]>();
    for (const row of dateRows) {
      const key = row.exercise;
      const existing = byExercise.get(key) || [];
      existing.push(row);
      byExercise.set(key, existing);
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

    result.push({ date, exercises });
  }

  // Sort by date
  result.sort((a, b) => a.date.localeCompare(b.date));

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
          title: `Import ${dateISO}`,
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
