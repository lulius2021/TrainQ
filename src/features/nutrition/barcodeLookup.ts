// src/features/nutrition/barcodeLookup.ts
import type { BarcodeCacheEntry, Macros } from "../../types/nutrition";

const BARCODE_CACHE_KEY = "trainq_barcode_cache_v1";
const SEARCH_CACHE_KEY = "trainq_search_cache_v1";
const BARCODE_TTL_DAYS = 30;
const SEARCH_TTL_HOURS = 6;

// ── In-memory search cache (session-level, instant repeat queries) ────────────
const memSearchCache = new Map<string, { results: OFFSearchResult[]; ts: number }>();

// ── Persistent caches ─────────────────────────────────────────────────────────

function loadBarcodeCache(): Record<string, BarcodeCacheEntry> {
  try {
    const raw = localStorage.getItem(BARCODE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveBarcodeCache(cache: Record<string, BarcodeCacheEntry>): void {
  try { localStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify(cache)); } catch { }
}

type SearchCacheEntry = { results: OFFSearchResult[]; fetchedAt: string };

function loadSearchCache(): Record<string, SearchCacheEntry> {
  try {
    const raw = localStorage.getItem(SEARCH_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSearchCache(cache: Record<string, SearchCacheEntry>): void {
  try { localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache)); } catch { }
}

// ── HTTP helper — plain fetch, OFF has CORS: * ───────────────────────────────

const OFF_HEADERS = {
  "User-Agent": "TrainQ/1.0 (iOS; trainq.app) - trainq.app",
};

async function fetchJSON(url: string, timeoutMs = 8000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { signal: controller.signal, headers: OFF_HEADERS });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Macro extractor ───────────────────────────────────────────────────────────

function extractMacros(n: any): Macros {
  return {
    kcal: Math.round(n?.["energy-kcal_100g"] ?? n?.["energy-kcal"] ?? 0),
    protein: Math.round((n?.proteins_100g ?? 0) * 10) / 10,
    carbs: Math.round((n?.carbohydrates_100g ?? 0) * 10) / 10,
    fat: Math.round((n?.fat_100g ?? 0) * 10) / 10,
  };
}

function productName(p: any): string {
  return (
    p?.product_name_de ||
    p?.product_name ||
    p?.product_name_en ||
    p?.generic_name_de ||
    p?.generic_name ||
    ""
  ).trim();
}

// ── Public types ──────────────────────────────────────────────────────────────

export interface BarcodeResult {
  ean: string;
  foodName: string;
  per100g: Macros;
  servingGrams?: number;
}

export interface OFFSearchResult {
  ean: string;
  name: string;
  brand: string;
  per100g: Macros;
  servingGrams?: number;
  imageUrl?: string;
}

// ── Barcode lookup ────────────────────────────────────────────────────────────

export async function lookupBarcode(ean: string): Promise<BarcodeResult | null> {
  const cache = loadBarcodeCache();
  const cached = cache[ean];
  if (cached) {
    const ageDays = (Date.now() - new Date(cached.fetchedAt).getTime()) / 86400000;
    if (ageDays < BARCODE_TTL_DAYS) {
      return { ean: cached.ean, foodName: cached.foodName, per100g: cached.per100g, servingGrams: cached.servingGrams };
    }
  }

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=code,product_name,product_name_de,generic_name,generic_name_de,brands,nutriments,serving_quantity`;
    const data = await fetchJSON(url);
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const name = productName(p) || "Unbekanntes Produkt";
    const per100g = extractMacros(p.nutriments);
    const servingGrams = p.serving_quantity ? parseFloat(p.serving_quantity) || undefined : undefined;

    const entry: BarcodeCacheEntry = { ean, foodName: name, per100g, servingGrams, fetchedAt: new Date().toISOString() };
    cache[ean] = entry;
    saveBarcodeCache(cache);

    return { ean, foodName: name, per100g, servingGrams };
  } catch {
    return null;
  }
}

// ── Food name search ──────────────────────────────────────────────────────────

const FIELDS = "code,product_name,product_name_de,product_name_en,brands,nutriments,serving_quantity,image_small_url";

function mapProduct(p: any): OFFSearchResult | null {
  const name = productName(p);
  if (!name) return null;
  const macros = extractMacros(p.nutriments);
  if (macros.kcal === 0 && macros.protein === 0 && macros.carbs === 0 && macros.fat === 0) return null;
  return {
    ean: p.code || "",
    name,
    brand: (p.brands || "").split(",")[0].trim(),
    per100g: macros,
    servingGrams: p.serving_quantity ? parseFloat(p.serving_quantity) || undefined : undefined,
    imageUrl: p.image_small_url || undefined,
  };
}

async function searchOFF(query: string, countryCode: string, limit: number): Promise<OFFSearchResult[]> {
  const params = new URLSearchParams({
    search_terms: query,
    json: "1",
    page_size: String(limit),
    fields: FIELDS,
    sort_by: "unique_scans_n",
    cc: countryCode,
    lc: "de",
  });
  const url = `https://world.openfoodfacts.org/api/v2/search?${params}`;
  const data = await fetchJSON(url, 6000);
  if (!data.products || !Array.isArray(data.products)) return [];
  return data.products.map(mapProduct).filter(Boolean) as OFFSearchResult[];
}

export async function searchFoodByName(query: string, limit = 20): Promise<OFFSearchResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = `${q.toLowerCase()}:${limit}`;

  // 1. Memory cache (instant)
  const mem = memSearchCache.get(cacheKey);
  if (mem && Date.now() - mem.ts < 300_000) return mem.results; // 5min TTL in-memory

  // 2. Persistent cache (6h)
  const persistCache = loadSearchCache();
  const persisted = persistCache[cacheKey];
  if (persisted) {
    const ageHours = (Date.now() - new Date(persisted.fetchedAt).getTime()) / 3600000;
    if (ageHours < SEARCH_TTL_HOURS) {
      memSearchCache.set(cacheKey, { results: persisted.results, ts: Date.now() });
      return persisted.results;
    }
  }

  // 3. Fetch — run DE + world in parallel, merge, deduplicate by EAN
  try {
    const [deResults, worldResults] = await Promise.allSettled([
      searchOFF(q, "de", limit),
      searchOFF(q, "fr", Math.ceil(limit / 2)), // broader world results as supplement
    ]);

    const seen = new Set<string>();
    const merged: OFFSearchResult[] = [];

    // DE results first (better for German products)
    const deArr = deResults.status === "fulfilled" ? deResults.value : [];
    for (const r of deArr) {
      const key = r.ean || r.name;
      if (!seen.has(key)) { seen.add(key); merged.push(r); }
    }
    // Supplement with world results
    const worldArr = worldResults.status === "fulfilled" ? worldResults.value : [];
    for (const r of worldArr) {
      const key = r.ean || r.name;
      if (!seen.has(key)) { seen.add(key); merged.push(r); }
    }

    const results = merged.slice(0, limit);

    // Store in both caches
    memSearchCache.set(cacheKey, { results, ts: Date.now() });
    persistCache[cacheKey] = { results, fetchedAt: new Date().toISOString() };
    saveSearchCache(persistCache);

    return results;
  } catch {
    return [];
  }
}
