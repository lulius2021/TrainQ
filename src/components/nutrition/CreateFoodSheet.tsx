// src/components/nutrition/CreateFoodSheet.tsx
import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { CustomFoodItem, FoodCategory } from "../../types/nutrition";

const MotionDiv = motion.div as any;

interface CreateFoodSheetProps {
  onSave: (food: CustomFoodItem) => void;
  onClose: () => void;
  editFood?: CustomFoodItem;
  initialName?: string;
}

const CATEGORY_OPTIONS: { value: FoodCategory; label: string }[] = [
  { value: "other", label: "Sonstiges" },
  { value: "dairy", label: "Milchprodukte" },
  { value: "meat", label: "Fleisch" },
  { value: "fish", label: "Fisch" },
  { value: "eggs", label: "Eier" },
  { value: "grains", label: "Getreide" },
  { value: "bread", label: "Brot & Gebäck" },
  { value: "pasta", label: "Nudeln" },
  { value: "legumes", label: "Hülsenfrüchte" },
  { value: "vegetables", label: "Gemüse" },
  { value: "fruits", label: "Obst" },
  { value: "nuts", label: "Nüsse" },
  { value: "oils", label: "Öle & Fette" },
  { value: "sweets", label: "Süßes" },
  { value: "beverages", label: "Getränke" },
  { value: "snacks", label: "Snacks" },
  { value: "sauces", label: "Saucen" },
  { value: "supplements", label: "Supplements" },
  { value: "fastfood", label: "Fast Food" },
  { value: "plantbased", label: "Pflanzlich" },
  { value: "seeds", label: "Samen & Kerne" },
  { value: "alcohol", label: "Alkohol" },
  { value: "readymeals", label: "Fertiggerichte" },
];

function generateCustomFoodId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `cf_${Date.now()}_${rand}`;
}

const CreateFoodSheet: React.FC<CreateFoodSheetProps> = ({
  onSave,
  onClose,
  editFood,
  initialName,
}) => {
  const [name, setName] = useState(editFood?.name || initialName || "");
  const [kcal, setKcal] = useState(editFood?.per100g.kcal ?? 0);
  const [protein, setProtein] = useState(editFood?.per100g.protein ?? 0);
  const [carbs, setCarbs] = useState(editFood?.per100g.carbs ?? 0);
  const [fat, setFat] = useState(editFood?.per100g.fat ?? 0);
  const [category, setCategory] = useState<FoodCategory>(editFood?.category || "other");
  const [servingName, setServingName] = useState(editFood?.servings[0]?.label || "");
  const [servingGrams, setServingGrams] = useState(editFood?.servings[0]?.grams ?? 0);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    const servings =
      servingName.trim() && servingGrams > 0
        ? [{ unit: "portion", label: servingName.trim(), grams: servingGrams }]
        : [];

    const food: CustomFoodItem = {
      id: editFood?.id || generateCustomFoodId(),
      name: name.trim(),
      nameEn: "",
      aliases: [],
      category,
      per100g: { kcal, protein, carbs, fat },
      servings,
      createdAt: editFood?.createdAt || now,
      updatedAt: now,
    };
    onSave(food);
  };

  return (
    <MotionDiv
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <MotionDiv
        className="absolute left-0 right-0 bottom-0 bg-[var(--card-bg)] rounded-t-3xl border-t border-[var(--border-color)] pb-[env(safe-area-inset-bottom)] max-h-[85vh] overflow-y-auto"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 300 }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-10 rounded-full bg-[var(--border-color)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h3 className="text-lg font-bold text-[var(--text-color)]">
            {editFood ? "Lebensmittel bearbeiten" : "Lebensmittel erstellen"}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <X size={16} className="text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-2 space-y-3">
          <FieldInput label="Name" value={name} onChange={setName} type="text" />
          <FieldInput label="Kalorien pro 100g (kcal)" value={kcal} onChange={setKcal} />
          <FieldInput label="Protein pro 100g (g)" value={protein} onChange={setProtein} />
          <FieldInput label="Kohlenhydrate pro 100g (g)" value={carbs} onChange={setCarbs} />
          <FieldInput label="Fett pro 100g (g)" value={fat} onChange={setFat} />

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
              Kategorie
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FoodCategory)}
              className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-color)] outline-none focus:border-[var(--accent-color)]"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Optional serving */}
          <div className="pt-2">
            <label className="text-xs font-medium text-[var(--text-secondary)] mb-2 block">
              Portionsgr&ouml;&szlig;e (optional)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <FieldInput
                label="Name (z.B. 1 Riegel)"
                value={servingName}
                onChange={setServingName}
                type="text"
              />
              <FieldInput
                label="Gramm"
                value={servingGrams}
                onChange={setServingGrams}
              />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="px-5 pt-4 pb-6">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`w-full py-3.5 rounded-2xl font-bold text-[15px] active:scale-[0.98] transition-transform ${
              canSave
                ? "bg-[var(--accent-color)] text-white"
                : "bg-[var(--border-color)] text-[var(--text-secondary)]"
            }`}
          >
            Speichern
          </button>
        </div>
      </MotionDiv>
    </MotionDiv>
  );
};

function FieldInput({
  label,
  value,
  onChange,
  type = "number",
}: {
  label: string;
  value: string | number;
  onChange: (v: any) => void;
  type?: "text" | "number";
}) {
  return (
    <div>
      <label className="text-xs font-medium text-[var(--text-secondary)] mb-1 block">
        {label}
      </label>
      {type === "text" ? (
        <input
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-color)] outline-none focus:border-[var(--accent-color)]"
          autoComplete="off"
        />
      ) : (
        <input
          type="number"
          value={value as number}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isNaN(v) ? 0 : Math.max(0, v));
          }}
          className="w-full bg-[var(--bg-color)] border border-[var(--border-color)] rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-color)] outline-none focus:border-[var(--accent-color)] tabular-nums"
          inputMode="decimal"
          min="0"
        />
      )}
    </div>
  );
}

export default CreateFoodSheet;
