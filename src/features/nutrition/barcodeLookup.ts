// src/features/nutrition/barcodeLookup.ts
import type { BarcodeCacheEntry, Macros } from "../../types/nutrition";

const CACHE_KEY = "trainq_barcode_cache_v1";
const CACHE_TTL_DAYS = 30;

function loadCache(): Record<string, BarcodeCacheEntry> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveCache(cache: Record<string, BarcodeCacheEntry>): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // storage full — ignore
  }
}

function isCacheValid(entry: BarcodeCacheEntry): boolean {
  const fetchedAt = new Date(entry.fetchedAt).getTime();
  if (isNaN(fetchedAt)) return false;
  const ageDays = (Date.now() - fetchedAt) / (1000 * 60 * 60 * 24);
  return ageDays < CACHE_TTL_DAYS;
}

export interface BarcodeResult {
  ean: string;
  foodName: string;
  per100g: Macros;
  servingGrams?: number;
}

/**
 * Look up a barcode (EAN) against the Open Food Facts API.
 * Results are cached in localStorage for 30 days.
 */
export async function lookupBarcode(ean: string): Promise<BarcodeResult | null> {
  // Check cache first
  const cache = loadCache();
  const cached = cache[ean];
  if (cached && isCacheValid(cached)) {
    return {
      ean: cached.ean,
      foodName: cached.foodName,
      per100g: cached.per100g,
      servingGrams: cached.servingGrams,
    };
  }

  // Fetch from Open Food Facts
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "TrainQ/1.0 (iOS; contact@trainq.app)" },
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    if (data.status !== 1 || !data.product) return null;

    const product = data.product;
    const nutriments = product.nutriments || {};

    const per100g: Macros = {
      kcal: Math.round(nutriments["energy-kcal_100g"] ?? nutriments["energy-kcal"] ?? 0),
      protein: Math.round((nutriments.proteins_100g ?? 0) * 10) / 10,
      carbs: Math.round((nutriments.carbohydrates_100g ?? 0) * 10) / 10,
      fat: Math.round((nutriments.fat_100g ?? 0) * 10) / 10,
    };

    const foodName =
      product.product_name_de ||
      product.product_name ||
      product.generic_name_de ||
      product.generic_name ||
      "Unbekanntes Produkt";

    const servingGrams = product.serving_quantity
      ? parseFloat(product.serving_quantity)
      : undefined;

    // Cache the result
    const entry: BarcodeCacheEntry = {
      ean,
      foodName,
      per100g,
      servingGrams: servingGrams && !isNaN(servingGrams) ? servingGrams : undefined,
      fetchedAt: new Date().toISOString(),
    };
    cache[ean] = entry;
    saveCache(cache);

    return { ean, foodName, per100g, servingGrams: entry.servingGrams };
  } catch {
    return null;
  }
}
