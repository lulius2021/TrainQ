// src/pages/NutritionPage.tsx
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { ChevronLeft, ChevronRight, Settings2, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import type { FoodItem, FoodMatchResult, Macros, DiaryEntry, CustomFoodItem } from "../types/nutrition";
import { useNutrition } from "../hooks/useNutrition";
import { useFoodSearch } from "../hooks/useFoodSearch";
import { resolveToGrams } from "../features/nutrition/unitResolver";
import { computeMacros } from "../features/nutrition/macroCalculator";
import { isHighConfidence } from "../features/nutrition/foodMatcher";
import { lookupBarcode } from "../features/nutrition/barcodeLookup";
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
  const [toast, setToast] = useState<ToastState | null>(null);
  const [showCreateFood, setShowCreateFood] = useState(false);
  const [createFoodInitialName, setCreateFoodInitialName] = useState("");
  const [activeTab, setActiveTab] = useState<"diary" | "history">("diary");

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

      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
    },
    [dateISO, addEntry, editEntry, editingEntryId, selectedFood, barcodeFood, showToast]
  );

  const handleDeleteEntry = useCallback(
    (id: string) => {
      removeEntry(id);
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
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

  return (
    <div className="min-h-screen bg-[var(--bg-color)] text-[var(--text-color)] pb-32">
      {/* Toast */}
      <Toast toast={toast} />

      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-[var(--nav-bg)] backdrop-blur-xl border-b border-[var(--border-color)] pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 pb-3 mt-[10px]">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-[var(--border-color)] flex items-center justify-center active:scale-90 transition-transform"
          >
            <ChevronLeft size={20} className="text-[var(--text-color)]" />
          </button>
          <h1 className="text-lg font-bold text-[var(--text-color)]">
            {t("nutrition.title")}
          </h1>
          <button
            onClick={() => setShowGoalsSheet(true)}
            className="w-9 h-9 rounded-full bg-[var(--border-color)] flex items-center justify-center active:scale-90 transition-transform"
          >
            <Settings2 size={18} className="text-[var(--text-color)]" />
          </button>
        </div>

        {/* Date picker */}
        <div className="flex items-center justify-center gap-4 pb-3">
          <button
            onClick={() => setDateOffset((d) => d - 1)}
            className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center active:scale-90 transition-transform"
          >
            <ChevronLeft size={16} className="text-[var(--text-secondary)]" />
          </button>
          <button
            onClick={() => setDateOffset(0)}
            className="text-sm font-semibold text-[var(--text-color)] min-w-[120px] text-center"
          >
            {formatDisplayDate(dateISO, t)}
          </button>
          <button
            onClick={() => setDateOffset((d) => d + 1)}
            className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center active:scale-90 transition-transform"
          >
            <ChevronRight size={16} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center justify-center gap-1 pb-3 px-4">
          <button
            onClick={() => setActiveTab("diary")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "diary"
                ? "bg-[var(--accent-color)] text-white"
                : "bg-[var(--border-color)] text-[var(--text-secondary)]"
            }`}
          >
            {t("nutrition.diary")}
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "history"
                ? "bg-[var(--accent-color)] text-white"
                : "bg-[var(--border-color)] text-[var(--text-secondary)]"
            }`}
          >
            {t("nutrition.history")}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-w-md mx-auto" onClick={handleContentTap}>
        {/* Macro summary */}
        <DailyMacroSummary
          totals={totals}
          goals={goals}
          progress={progress}
        />

        {activeTab === "diary" ? (
          <>
            {/* Food input */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <FoodInput
                onSubmit={handleFoodInput}
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
          </>
        ) : (
          <NutritionHistory goals={goals} />
        )}
      </div>

      {/* Sheets/Modals */}
      <FoodDetailSheet
        food={selectedFood}
        initialQty={pendingQty}
        initialUnit={pendingUnit}
        onLog={handleLog}
        onClose={handleCloseDetailSheet}
      />

      <AnimatePresence>
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
      </AnimatePresence>

      <BarcodeScannerModal
        open={showBarcodeModal}
        onScan={handleBarcodeScan}
        onClose={() => setShowBarcodeModal(false)}
      />

      <AnimatePresence>
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
      </AnimatePresence>
    </div>
  );
};

export default NutritionPage;
