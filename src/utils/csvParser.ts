// src/utils/csvParser.ts
// Low-level CSV parsing utilities: separator detection, date format detection,
// header matching, and row splitting.

/**
 * Detect the most likely column separator from the first few lines.
 * Counts occurrences of `,` `;` and `\t` across the sample, picks the most frequent.
 */
export function detectSeparator(firstLines: string[]): string {
  const candidates = [",", ";", "\t"];
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };

  const sample = firstLines.slice(0, 5);
  for (const line of sample) {
    for (const ch of candidates) {
      const matches = line.split(ch).length - 1;
      counts[ch] += matches;
    }
  }

  let best = ",";
  let bestCount = 0;
  for (const ch of candidates) {
    if (counts[ch] > bestCount) {
      bestCount = counts[ch];
      best = ch;
    }
  }

  return best;
}

/**
 * Detect date format from a sample of date strings.
 * Returns one of: "YYYY-MM-DD", "DD.MM.YYYY", "MM/DD/YYYY"
 */
export function detectDateFormat(samples: string[]): string {
  let isoCount = 0;
  let dotCount = 0;
  let slashCount = 0;

  for (const s of samples) {
    const trimmed = s.trim();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) isoCount++;
    else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(trimmed)) dotCount++;
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) slashCount++;
  }

  if (isoCount >= dotCount && isoCount >= slashCount) return "YYYY-MM-DD";
  if (dotCount >= isoCount && dotCount >= slashCount) return "DD.MM.YYYY";
  return "MM/DD/YYYY";
}

/**
 * Normalize a date string to YYYY-MM-DD based on the detected format.
 */
export function normalizeDate(raw: string, format: string): string {
  const trimmed = raw.trim();

  if (format === "YYYY-MM-DD") {
    const m = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  }

  if (format === "DD.MM.YYYY") {
    const m = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }

  if (format === "MM/DD/YYYY") {
    const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  }

  // Fallback: try to parse with Date
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return trimmed;
}

// Canonical header names (lowercase, normalized) -> semantic column
const HEADER_MAP: Record<string, string> = {
  // Date
  datum: "date",
  date: "date",
  tag: "date",
  day: "date",
  // Exercise
  "ubung": "exercise",
  "uebung": "exercise",
  exercise: "exercise",
  exercisename: "exercise",
  "exercise name": "exercise",
  name: "exercise",
  // Weight
  gewicht: "weight",
  weight: "weight",
  "weight (kg)": "weight",
  "gewicht (kg)": "weight",
  kg: "weight",
  // Reps
  wiederholungen: "reps",
  wdh: "reps",
  reps: "reps",
  repetitions: "reps",
  // Sets
  "satze": "sets",
  "saetze": "sets",
  sets: "sets",
  "set": "sets",
};

function normalizeHeaderKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s()]/g, "")
    .trim();
}

/**
 * Parse the header line and return a mapping from semantic column names to their indices.
 * Supports both German and English headers.
 */
export function parseHeader(headerLine: string, separator: string): Map<string, number> {
  const cols = headerLine.split(separator).map((c) => c.trim());
  const result = new Map<string, number>();

  for (let i = 0; i < cols.length; i++) {
    const normalized = normalizeHeaderKey(cols[i]);
    const semantic = HEADER_MAP[normalized];
    if (semantic && !result.has(semantic)) {
      result.set(semantic, i);
    }
  }

  return result;
}

/**
 * Split CSV content into rows.
 * - Strips BOM (byte order mark)
 * - Splits by newline (\r\n or \n)
 * - Filters empty lines
 */
export function splitCsvRows(content: string): string[] {
  // Strip BOM
  let cleaned = content;
  if (cleaned.charCodeAt(0) === 0xfeff) {
    cleaned = cleaned.slice(1);
  }

  return cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
