// src/features/nutrition/foodParser.ts
import type { ParsedFoodInput } from "../../types/nutrition";

/**
 * German unit synonyms → canonical unit id
 */
const UNIT_MAP: Record<string, string> = {
  // grams
  g: "g",
  gr: "g",
  gramm: "g",
  gram: "g",
  // kilograms
  kg: "kg",
  kilo: "kg",
  kilogramm: "kg",
  // milliliters
  ml: "ml",
  milliliter: "ml",
  // liters
  l: "l",
  liter: "l",
  // pieces
  stk: "piece",
  stück: "piece",
  stueck: "piece",
  stuc: "piece",
  pc: "piece",
  pcs: "piece",
  piece: "piece",
  pieces: "piece",
  // tablespoon
  el: "tbsp",
  essl: "tbsp",
  esslöffel: "tbsp",
  essloeffel: "tbsp",
  tbsp: "tbsp",
  // teaspoon
  tl: "tsp",
  teel: "tsp",
  teelöffel: "tsp",
  teeloeffel: "tsp",
  tsp: "tsp",
  // slice
  scheibe: "slice",
  scheiben: "slice",
  slice: "slice",
  slices: "slice",
  // cup
  tasse: "cup",
  tassen: "cup",
  becher: "cup",
  cup: "cup",
  cups: "cup",
  // handful
  handvoll: "handful",
  hand: "handful",
  handful: "handful",
  // portion
  portion: "portion",
  portionen: "portion",
  serving: "portion",
};

/**
 * Parse a food input string like "2 Eier", "200g Skyr", "0,5l Milch"
 * into structured { qty, unit, query }.
 */
export function parseFoodInput(raw: string): ParsedFoodInput {
  const input = raw.trim();
  if (!input) return { qty: 1, unit: "piece", query: "" };

  // Normalize German decimal comma → dot for parsing
  // But only in the numeric portion
  // Pattern: optional number (with comma/dot), optional unit, rest is food name
  // Examples: "2 Eier", "200g Skyr", "0,5l Milch", "1.5 kg Hähnchen", "Apfel", "3 EL Olivenöl"

  // Step 1: Try to extract a leading number (int, float, fraction, German comma)
  // Matches: "200", "0,5", "1.5", "1/2", "2,5", "0.25"
  const numRegex = /^(\d+[.,]?\d*|\d+\/\d+)\s*/;
  const numMatch = input.match(numRegex);

  let qty = 1;
  let rest = input;

  if (numMatch) {
    const numStr = numMatch[1].replace(",", ".");
    if (numStr.includes("/")) {
      const [num, den] = numStr.split("/").map(Number);
      qty = den > 0 ? num / den : 1;
    } else {
      qty = parseFloat(numStr) || 1;
    }
    rest = input.slice(numMatch[0].length);
  }

  // Step 2: Try to extract a unit from the beginning of `rest`
  // Unit can be attached to number ("200g") or separated ("200 g")
  const unitRegex = /^([a-zA-ZäöüÄÖÜß]+)\s*/;
  const unitMatch = rest.match(unitRegex);

  let unit = "piece";
  let query = rest.trim();

  if (unitMatch) {
    const candidate = unitMatch[1].toLowerCase();
    if (UNIT_MAP[candidate]) {
      unit = UNIT_MAP[candidate];
      query = rest.slice(unitMatch[0].length).trim();
    }
    // If no unit match found, the whole rest is the food query
  }

  // If no number was found but we matched something, treat entire input as query
  if (!numMatch && query === input) {
    return { qty: 1, unit: "piece", query: input };
  }

  return { qty, unit, query };
}
