// src/types/csvImport.ts

export interface CsvParsedRow {
  date: string;       // normalized to YYYY-MM-DD
  exercise: string;   // raw from CSV
  weightKg: number;
  reps: number;
  sets: number;       // how many sets (default 1)
}

export interface CsvImportPreview {
  rows: CsvParsedRow[];
  matchedExercises: Map<string, string>; // csvName -> matchedLibraryName
  unmatchedExercises: string[];
  totalWorkouts: number;
  dateRange: { from: string; to: string };
  warnings: string[];
}

export type CsvImportStep = "idle" | "picking" | "parsing" | "preview" | "importing" | "done" | "error";

export interface CsvImportResult {
  importedCount: number;
  skippedCount: number;
  errors: string[];
}
