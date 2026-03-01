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
