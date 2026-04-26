// src/pages/NutritionPage.tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Settings2, Check, AlertCircle, History, Search, X, Loader2 } from "lucide-react";
import { BottomSheet } from "../components/common/BottomSheet";
import { motion, AnimatePresence } from "framer-motion";
import { hapticMedium, hapticLight } from "../native/haptics";
import type { FoodItem, FoodMatchResult, Macros, DiaryEntry, CustomFoodItem } from "../types/nutrition";
import { useNutrition } from "../hooks/useNutrition";
import { useFoodSearch } from "../hooks/useFoodSearch";
import { resolveToGrams } from "../features/nutrition/unitResolver";
import { computeMacros } from "../features/nutrition/macroCalculator";
import { isHighConfidence } from "../features/nutrition/foodMatcher";
import { lookupBarcode, searchFoodByName, type OFFSearchResult } from "../features/nutrition/barcodeLookup";
import { addCustomFood, updateCustomFood } from "../utils/customFoodsStore";
import DailyMacroSummary from "../components/nutrition/DailyMacroSummary";
import FoodInput from "../components/nutrition/FoodInput";
import FoodSuggestionList from "../components/nutrition/FoodSuggestionList";
import DiaryList from "../components/nutrition/DiaryList";
import FoodDetailSheet from "../components/nutrition/FoodDetailSheet";
import MacroGoalsSheet from "../components/nutrition/MacroGoalsSheet";
import BarcodeScannerModal from "../components/nutrition/BarcodeScannerModal";
import CreateFoodSheet from "../components/nutrition/CreateFoodSheet";
import NutritionHistory from "../components/nutrition/NutritionHistory";
import NutritionStatsBlock from "../components/nutrition/NutritionStatsBlock";
import { useI18n } from "../i18n/useI18n";

const MotionDiv = motion.div as any;

function generateId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

function formatDateISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(iso: string, t: (key: string) => string): string {
  const today = formatDateISO(new Date());
  if (iso === today) return t("nutrition.today");
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === formatDateISO(yesterday)) return t("nutrition.yesterday");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (iso === formatDateISO(tomorrow)) return t("nutrition.tomorrow");
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("de-DE", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

// --- Toast Component ---
interface ToastState {
  message: string;
  type: "success" | "error";
}

const Toast: React.FC<{ toast: ToastState | null }> = ({ toast }) => (
  <AnimatePresence>
    {toast && (
      <MotionDiv
        className="fixed top-[calc(env(safe-area-inset-top)+60px)] left-4 right-4 z-[20000] pointer-events-none flex justify-center"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.25 }}
      >
        <div
          className={`inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm shadow-lg backdrop-blur-xl ${
            toast.type === "success"
              ? "bg-green-500/90 text-white"
              : "bg-red-500/90 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <Check size={16} strokeWidth={3} />
          ) : (
            <AlertCircle size={16} />
          )}
          {toast.message}
        </div>
      </MotionDiv>
    )}
  </AnimatePresence>
);

// --- Search Food BottomSheet ---

const SearchFoodSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onSelectProduct: (product: OFFSearchResult) => void;
}> = ({ open, onClose, onSelectProduct }) => {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OFFSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setSearching(false);
    setTimeout(() => inputRef.current?.focus(), 400);
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const res = await searchFoodByName(q, 20);
    setResults(res);
    setSearching(false);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      height="92dvh"
      showHandle
      header={
        <div className="px-5 pb-2">
          <h2 className="text-lg font-bold mb-3" style={{ color: "var(--text-color)" }}>{t("nutrition.search.title")}</h2>
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] flex items-center gap-2 px-3 py-2">
            <Search size={16} style={{ color: "var(--text-secondary)" }} className="shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={t("nutrition.search.placeholder")}
              className="flex-1 bg-transparent text-sm outline-none min-w-0"
              style={{ color: "var(--text-color)" }}
              autoComplete="off"
              autoCapitalize="off"
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); }} className="p-1">
                <X size={14} style={{ color: "var(--text-secondary)" }} />
              </button>
            )}
          </div>
        </div>
      }
      contentClassName="flex-1 min-h-0 overflow-y-auto px-5 pb-8"
    >
      <div className="space-y-2">
        {searching && (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 size={18} className="animate-spin" style={{ color: "var(--accent-color)" }} />
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("nutrition.search.searching")}</span>
          </div>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("nutrition.search.noResults")}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{t("nutrition.search.tryDifferent")}</p>
          </div>
        )}
        {!searching && results.map((r, i) => (
          <button
            key={`${r.ean}-${i}`}
            onClick={() => { onSelectProduct(r); onClose(); }}
            className="w-full text-left rounded-2xl border p-3.5 active:scale-[0.98] transition-transform"
            style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--border-color)" }}
          >
            <div className="flex items-start gap-3">
              {r.imageUrl ? (
                <img src={r.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover" style={{ backgroundColor: "var(--border-color)" }} loading="lazy" />
              ) : (
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--input-bg)" }}>
                  <Search size={16} style={{ color: "var(--text-secondary)" }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--text-color)" }}>{r.name}</p>
                {r.brand && <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{r.brand}</p>}
                <div className="flex gap-3 mt-1.5">
                  <span className="text-xs font-bold" style={{ color: "var(--accent-color)" }}>{r.per100g.kcal} kcal</span>
                  <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>P {r.per100g.protein}g</span>
                  <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>K {r.per100g.carbs}g</span>
                  <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>F {r.per100g.fat}g</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
};

// --- Main Page ---
interface NutritionPageProps {
  onBack: () => void;
}

const NutritionPage: React.FC<NutritionPageProps> = ({ onBack }) => {
  const { t } = useI18n();
  // Date navigation
  const [dateOffset, setDateOffset] = useState(0);
  const dateISO = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dateOffset);
    return formatDateISO(d);
  }, [dateOffset]);

  const {
    entries,
    goals,
    totals,
    progress,
    addEntry,
    removeEntry,
    editEntry,
    setGoals,
  } = useNutrition(dateISO);

  const { search, parseInput, findById } = useFoodSearch();

  // UI state
  const [suggestions, setSuggestions] = useState<FoodMatchResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [pendingQty, setPendingQty] = useState(1);
  const [pendingUnit, setPendingUnit] = useState("g");
  const [showGoalsSheet, setShowGoalsSheet] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showSearchSheet, setShowSearchSheet] = useState(false);
  const [barcodeModalTab, setBarcodeModalTab] = useState<"search" | "barcode">("search");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showCreateFood, setShowCreateFood] = useState(false);
  const [createFoodInitialName, setCreateFoodInitialName] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

  // Track whether we're editing an existing entry
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // For barcode-scanned foods (not in the main DB)
  const [barcodeFood, setBarcodeFood] = useState<FoodItem | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Live search while typing
  const handleLiveSearch = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      const parsed = parseInput(trimmed);
      const results = search(parsed.query);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setPendingQty(parsed.qty);
      setPendingUnit(parsed.unit);
    },
    [search, parseInput]
  );

  const handleFoodInput = useCallback(
    (raw: string) => {
      setEditingEntryId(null);
      const parsed = parseInput(raw);
      const results = search(parsed.query);

      if (results.length === 0) {
        setSuggestions([]);
        setShowSuggestions(false);
        showToast(t("nutrition.notFound", { query: parsed.query }), "error");
        setCreateFoodInitialName(parsed.query);
        return;
      }

      if (results.length === 1 && isHighConfidence(results[0])) {
        const food = results[0].food;
        setSelectedFood(food);
        setBarcodeFood(null);
        setPendingQty(parsed.unit === "g" || parsed.unit === "ml"
          ? resolveToGrams(parsed.qty, parsed.unit, food)
          : parsed.qty);
        setPendingUnit(parsed.unit);
        setSuggestions([]);
        setShowSuggestions(false);
      } else {
        setSuggestions(results);
        setShowSuggestions(true);
        setPendingQty(parsed.qty);
        setPendingUnit(parsed.unit);
      }
    },
    [search, parseInput, showToast]
  );

  const handleSelectSuggestion = useCallback(
    (food: FoodItem) => {
      setEditingEntryId(null);
      const grams = resolveToGrams(pendingQty, pendingUnit, food);
      setSelectedFood(food);
      setBarcodeFood(null);
      setPendingQty(
        pendingUnit === "g" || pendingUnit === "ml" ? grams : pendingQty
      );
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [pendingQty, pendingUnit]
  );

  const handleLog = useCallback(
    (foodId: string, amountGrams: number, displayAmount: string, macros: Macros) => {
      if (editingEntryId) {
        // Update existing entry
        editEntry(editingEntryId, { amountGrams, displayAmount, macros });
        showToast(t("nutrition.entryUpdated"));
      } else {
        // Create new entry
        const now = new Date().toISOString();
        const entry: DiaryEntry = {
          id: generateId(),
          dateISO,
          createdAt: now,
          updatedAt: now,
          foodId,
          foodName: selectedFood?.name || barcodeFood?.name || "Unbekannt",
          amountGrams,
          displayAmount,
          macros,
          source: barcodeFood ? "barcode" : "parser",
        };
        addEntry(entry);
        showToast(t("nutrition.logged"));
      }

      setSelectedFood(null);
      setBarcodeFood(null);
      setEditingEntryId(null);

      hapticMedium();
    },
    [dateISO, addEntry, editEntry, editingEntryId, selectedFood, barcodeFood, showToast]
  );

  const handleDeleteEntry = useCallback(
    (id: string) => {
      removeEntry(id);
      hapticLight();
      showToast(t("nutrition.deleted"));
    },
    [removeEntry, showToast]
  );

  const handleTapEntry = useCallback(
    (entry: DiaryEntry) => {
      // Try to find the food in DB first, otherwise create synthetic
      const dbFood = findById(entry.foodId);
      if (dbFood) {
        setSelectedFood(dbFood);
      } else {
        const syntheticFood: FoodItem = {
          id: entry.foodId,
          name: entry.foodName,
          nameEn: entry.foodName,
          aliases: [],
          category: "other",
          per100g:
            entry.amountGrams > 0
              ? {
                  kcal: Math.round((entry.macros.kcal / entry.amountGrams) * 100),
                  protein: Math.round((entry.macros.protein / entry.amountGrams) * 1000) / 10,
                  carbs: Math.round((entry.macros.carbs / entry.amountGrams) * 1000) / 10,
                  fat: Math.round((entry.macros.fat / entry.amountGrams) * 1000) / 10,
                }
              : entry.macros,
          servings: [],
        };
        setSelectedFood(syntheticFood);
      }
      setBarcodeFood(null);
      setEditingEntryId(entry.id);
      setPendingQty(entry.amountGrams);
      setPendingUnit("g");
    },
    [findById]
  );

  const handleBarcodeScan = useCallback(
    async (ean: string) => {
      setShowBarcodeModal(false);
      setEditingEntryId(null);
      try {
        const result = await lookupBarcode(ean);
        if (!result) {
          showToast(t("nutrition.productNotFound"), "error");
          return;
        }
        const food: FoodItem = {
          id: `barcode_${ean}`,
          name: result.foodName,
          nameEn: result.foodName,
          aliases: [],
          category: "other",
          per100g: result.per100g,
          servings: result.servingGrams
            ? [{ unit: "portion", label: "1 Portion", grams: result.servingGrams }]
            : [],
        };
        setBarcodeFood(food);
        setSelectedFood(food);
        setPendingQty(result.servingGrams || 100);
        setPendingUnit(result.servingGrams ? "portion" : "g");
      } catch {
        showToast(t("nutrition.barcodeFailed"), "error");
      }
    },
    [showToast]
  );

  const handleSelectProduct = useCallback(
    (product: OFFSearchResult) => {
      setShowBarcodeModal(false);
      setEditingEntryId(null);
      const food: FoodItem = {
        id: `off_${product.ean || Date.now()}`,
        name: product.brand ? `${product.name} (${product.brand})` : product.name,
        nameEn: product.name,
        aliases: [],
        category: "other",
        per100g: product.per100g,
        servings: product.servingGrams
          ? [{ unit: "portion", label: "1 Portion", grams: product.servingGrams }]
          : [],
      };
      setBarcodeFood(food);
      setSelectedFood(food);
      setPendingQty(product.servingGrams || 100);
      setPendingUnit(product.servingGrams ? "portion" : "g");
    },
    []
  );

  const handleCloseDetailSheet = useCallback(() => {
    setSelectedFood(null);
    setBarcodeFood(null);
    setEditingEntryId(null);
  }, []);

  const handleSaveCustomFood = useCallback(
    (food: CustomFoodItem) => {
      if (food.createdAt !== food.updatedAt) {
        // Editing existing
        updateCustomFood(food.id, food);
      } else {
        addCustomFood(food);
      }
      setShowCreateFood(false);
      setCreateFoodInitialName("");
      showToast(t("nutrition.foodSaved"));
    },
    [showToast]
  );

  // Dismiss suggestions when tapping outside
  const handleContentTap = useCallback(() => {
    if (showSuggestions) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [showSuggestions]);

  // Swipe to change day with animation direction
  const swipeDirRef = useRef(0);
  const prevOffsetRef = useRef(dateOffset);
  if (dateOffset !== prevOffsetRef.current) {
    swipeDirRef.current = dateOffset > prevOffsetRef.current ? 1 : -1;
    prevOffsetRef.current = dateOffset;
  }

  const slideVariants = useMemo(() => ({
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0.3 }),
    center: { x: "0%", opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0.3 }),
  }), []);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < 80 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (dx > 0) setDateOffset((d) => d - 1);
    else setDateOffset((d) => d + 1);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] pb-32">
      {/* Toast */}
      <Toast toast={toast} />

      {/* Header */}
      <div className="pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ backgroundColor: "var(--input-bg)" }}
          >
            <ChevronLeft size={20} style={{ color: "var(--text-color)" }} />
          </button>

          {/* Date picker inline */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDateOffset((d) => d - 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ backgroundColor: "var(--input-bg)" }}
            >
              <ChevronLeft size={16} style={{ color: "var(--text-secondary)" }} />
            </button>
            <button
              onClick={() => setDateOffset(0)}
              className="text-sm font-bold min-w-[100px] text-center"
              style={{ color: "var(--text-color)" }}
            >
              {formatDisplayDate(dateISO, t)}
            </button>
            <button
              onClick={() => setDateOffset((d) => d + 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
              style={{ backgroundColor: "var(--input-bg)" }}
            >
              <ChevronRight size={16} style={{ color: "var(--text-secondary)" }} />
            </button>
          </div>

          <button
            onClick={() => setShowGoalsSheet(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ backgroundColor: "var(--input-bg)" }}
          >
            <Settings2 size={18} style={{ color: "var(--text-color)" }} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-hidden" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <AnimatePresence mode="popLayout" custom={swipeDirRef.current} initial={false}>
          <MotionDiv
            key={dateISO}
            custom={swipeDirRef.current}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            className="p-4 space-y-4 max-w-md mx-auto"
            onClick={handleContentTap}
          >
        {/* Macro summary */}
        <DailyMacroSummary
          totals={totals}
          goals={goals}
          progress={progress}
        />

        {/* Food input */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <FoodInput
            onSubmit={handleFoodInput}
            onLiveSearch={handleLiveSearch}
            onSearchTap={() => setShowSearchSheet(true)}
            onBarcodeTap={() => setShowBarcodeModal(true)}
            onCreateFood={() => {
              setCreateFoodInitialName("");
              setShowCreateFood(true);
            }}
          />
          {/* Suggestion dropdown */}
          <div className="mt-1">
            <FoodSuggestionList
              results={suggestions}
              onSelect={handleSelectSuggestion}
              visible={showSuggestions}
            />
          </div>
        </div>

        {/* "Create food" prompt when search found nothing */}
        {createFoodInitialName && suggestions.length === 0 && !showSuggestions && (
          <button
            onClick={() => setShowCreateFood(true)}
            className="w-full py-3 rounded-2xl border border-dashed border-[var(--border-color)] text-sm font-semibold text-[var(--accent-color)] active:scale-[0.98] transition-transform"
          >
            &quot;{createFoodInitialName}&quot; erstellen
          </button>
        )}

        {/* Diary section header */}
        <div className="flex items-center justify-between pt-2">
          <h3 className="text-sm font-bold text-[var(--text-secondary)] uppercase tracking-wider text-[11px] pl-1">
            {t("nutrition.diary")}
          </h3>
          {entries.length > 0 && (
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              {entries.length} {entries.length === 1 ? t("nutrition.entry") : t("nutrition.entries")}
            </span>
          )}
        </div>

        {/* Diary list */}
        <DiaryList
          entries={entries}
          onDelete={handleDeleteEntry}
          onTapEntry={handleTapEntry}
        />

        {/* Nutrition Stats */}
        <div className="pt-4">
          <NutritionStatsBlock />
        </div>

        {/* History Button */}
        <button
          onClick={() => setHistoryOpen(true)}
          className="w-full rounded-3xl p-4 flex items-center justify-between transition-all active:scale-[0.98]"
          style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--border-color)", outline: "none", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-2xl" style={{ backgroundColor: "var(--input-bg)", color: "var(--text-muted)" }}>
              <History className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-medium" style={{ color: "var(--text-color)" }}>{t("nutrition.history")}</div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>Vergangene Tage ansehen</div>
            </div>
          </div>
          <div style={{ color: "var(--text-muted)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
          </div>
        </button>
          </MotionDiv>
        </AnimatePresence>
      </div>

      {/* History BottomSheet */}
      <BottomSheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        height="92dvh"
        showHandle
        header={
          <div className="px-5 pb-1">
            <h2 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>{t("nutrition.history")}</h2>
          </div>
        }
        contentClassName="flex-1 min-h-0 overflow-y-auto px-4 pb-8"
      >
        <NutritionHistory goals={goals} />
      </BottomSheet>

      {/* Search BottomSheet */}
      <SearchFoodSheet
        open={showSearchSheet}
        onClose={() => setShowSearchSheet(false)}
        onSelectProduct={handleSelectProduct}
      />

      {/* Sheets/Modals */}
      <FoodDetailSheet
        food={selectedFood}
        initialQty={pendingQty}
        initialUnit={pendingUnit}
        onLog={handleLog}
        onClose={handleCloseDetailSheet}
      />

      {showGoalsSheet && (
        <MacroGoalsSheet
          goals={goals}
          onSave={(g) => {
            setGoals(g);
            setShowGoalsSheet(false);
            showToast(t("nutrition.goalsSaved"));
          }}
          onClose={() => setShowGoalsSheet(false)}
        />
      )}

      <BarcodeScannerModal
        open={showBarcodeModal}
        initialTab={barcodeModalTab}
        onScan={handleBarcodeScan}
        onSelectProduct={handleSelectProduct}
        onClose={() => setShowBarcodeModal(false)}
      />

      {showCreateFood && (
        <CreateFoodSheet
          initialName={createFoodInitialName}
          onSave={handleSaveCustomFood}
          onClose={() => {
            setShowCreateFood(false);
            setCreateFoodInitialName("");
          }}
        />
      )}
    </div>
  );
};

export default NutritionPage;
