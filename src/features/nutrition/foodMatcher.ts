// src/features/nutrition/foodMatcher.ts
import type { FoodItem, FoodMatchResult } from "../../types/nutrition";

/**
 * Normalize a string for comparison: lowercase, trim, strip umlauts.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/**
 * Levenshtein distance between two strings.
 * Used for fuzzy matching with typos.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row optimization
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // deletion
        curr[j - 1] + 1,  // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Check if query fuzzy-matches a target string.
 * Returns a score 0-1 or null if no match.
 */
function fuzzyMatch(target: string, query: string): number | null {
  const t = normalize(target);
  const q = normalize(query);
  if (!q || !t) return null;

  // For short queries, allow 1 typo; for longer, allow more
  const maxDist = q.length <= 3 ? 1 : q.length <= 6 ? 2 : 3;

  // Check whole-word fuzzy match
  const dist = levenshtein(t, q);
  if (dist <= maxDist) {
    return Math.max(0.3, 0.7 - dist * 0.15);
  }

  // Check if query fuzzy-matches the start of the target
  const sub = t.slice(0, q.length + 1);
  const startDist = levenshtein(sub, q);
  if (startDist <= maxDist) {
    return Math.max(0.25, 0.6 - startDist * 0.15);
  }

  // Check individual words in target
  const tWords = t.split(/[\s(),%/·\-]+/).filter(Boolean);
  for (const tw of tWords) {
    const wDist = levenshtein(tw, q);
    if (wDist <= maxDist) {
      return Math.max(0.2, 0.5 - wDist * 0.15);
    }
  }

  return null;
}

/**
 * Score a food item against a query string.
 * Returns 0 if no match, up to 1.0 for best match.
 */
function scoreFood(food: FoodItem, query: string): FoodMatchResult | null {
  const q = normalize(query);
  if (!q) return null;

  const name = normalize(food.name);
  const nameEn = normalize(food.nameEn);

  // Exact name match
  if (name === q || nameEn === q) {
    return { food, score: 1.0, matchedOn: name === q ? "name" : "nameEn" };
  }

  // Name startsWith
  if (name.startsWith(q) || nameEn.startsWith(q)) {
    return { food, score: 0.95, matchedOn: name.startsWith(q) ? "name" : "nameEn" };
  }

  // Alias exact match
  for (const alias of food.aliases) {
    const a = normalize(alias);
    if (a === q) return { food, score: 0.92, matchedOn: "alias" };
    if (a.startsWith(q)) return { food, score: 0.88, matchedOn: "alias" };
  }

  // Name contains
  if (name.includes(q)) {
    return { food, score: 0.8, matchedOn: "name" };
  }
  if (nameEn.includes(q)) {
    return { food, score: 0.75, matchedOn: "nameEn" };
  }

  // Alias contains
  for (const alias of food.aliases) {
    if (normalize(alias).includes(q)) {
      return { food, score: 0.7, matchedOn: "alias" };
    }
  }

  // Partial: query words all found in name
  const qWords = q.split(/\s+/).filter(Boolean);
  if (qWords.length > 1) {
    const allInName = qWords.every(
      (w) => name.includes(w) || nameEn.includes(w)
    );
    if (allInName) return { food, score: 0.6, matchedOn: "name" };

    const allInAliases = qWords.every((w) =>
      food.aliases.some((a) => normalize(a).includes(w))
    );
    if (allInAliases) return { food, score: 0.5, matchedOn: "alias" };
  }

  // Fuzzy matching (typo tolerance)
  const nameFuzzy = fuzzyMatch(food.name, query);
  if (nameFuzzy) return { food, score: nameFuzzy, matchedOn: "name" };

  const nameEnFuzzy = fuzzyMatch(food.nameEn, query);
  if (nameEnFuzzy) return { food, score: nameEnFuzzy, matchedOn: "nameEn" };

  for (const alias of food.aliases) {
    const aliasFuzzy = fuzzyMatch(alias, query);
    if (aliasFuzzy) return { food, score: aliasFuzzy * 0.9, matchedOn: "alias" };
  }

  return null;
}

/**
 * Search the food database for matches.
 * Returns top results sorted by score, max `limit` items.
 */
export function searchFoods(
  db: FoodItem[],
  query: string,
  limit = 8
): FoodMatchResult[] {
  if (!query.trim()) return [];

  const results: FoodMatchResult[] = [];
  for (const food of db) {
    const match = scoreFood(food, query);
    if (match) results.push(match);
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Check if a match is high-confidence enough for auto-logging.
 */
export function isHighConfidence(result: FoodMatchResult): boolean {
  return result.score >= 0.9;
}
