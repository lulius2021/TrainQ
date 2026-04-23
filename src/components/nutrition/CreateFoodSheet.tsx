// src/components/nutrition/CreateFoodSheet.tsx
import React, { useState } from "react";
import type { CustomFoodItem, FoodCategory } from "../../types/nutrition";
import { BottomSheet } from "../common/BottomSheet";

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
    <BottomSheet
      open
      onClose={onClose}
      height="88dvh"
      showHandle
      header={
        <div className="px-5 pb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>
            {editFood ? "Lebensmittel bearbeiten" : "Lebensmittel erstellen"}
          </h2>
        </div>
      }
      contentClassName="flex-1 min-h-0 overflow-y-auto px-5 pb-8"
      footer={
        <div className="px-5 pt-3 pb-2">
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
      }
    >
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--text-secondary)" }}>Name</label>
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Protein-Riegel"
              className="w-full px-4 py-3 bg-transparent text-sm font-medium outline-none"
              style={{ color: "var(--text-color)" }}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Nährwerte pro 100g */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--text-secondary)" }}>Nährwerte pro 100g</label>
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
            <RowInput label="Kalorien" unit="kcal" value={kcal} onChange={setKcal} />
            <div className="h-px mx-4" style={{ backgroundColor: "var(--border-color)" }} />
            <RowInput label="Protein" unit="g" value={protein} onChange={setProtein} />
            <div className="h-px mx-4" style={{ backgroundColor: "var(--border-color)" }} />
            <RowInput label="Kohlenhydrate" unit="g" value={carbs} onChange={setCarbs} />
            <div className="h-px mx-4" style={{ backgroundColor: "var(--border-color)" }} />
            <RowInput label="Fett" unit="g" value={fat} onChange={setFat} />
          </div>
        </div>

        {/* Kategorie */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--text-secondary)" }}>Kategorie</label>
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as FoodCategory)}
              className="w-full px-4 py-3 bg-transparent text-sm font-medium outline-none appearance-none"
              style={{ color: "var(--text-color)" }}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Portionsgröße */}
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider mb-2 block" style={{ color: "var(--text-secondary)" }}>Portionsgröße (optional)</label>
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "var(--card-bg)" }}>
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Name</span>
              <input
                type="text"
                value={servingName}
                onChange={(e) => setServingName(e.target.value)}
                placeholder="z.B. 1 Riegel"
                className="bg-transparent text-sm font-medium outline-none text-right w-40"
                style={{ color: "var(--text-color)" }}
                autoComplete="off"
              />
            </div>
            <div className="h-px mx-4" style={{ backgroundColor: "var(--border-color)" }} />
            <RowInput label="Gramm" unit="g" value={servingGrams} onChange={setServingGrams} />
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

function RowInput({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <span className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value || ""}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isNaN(v) ? 0 : Math.max(0, v));
          }}
          className="w-16 bg-transparent text-sm font-bold outline-none text-right tabular-nums"
          style={{ color: "var(--text-color)" }}
          inputMode="decimal"
          min="0"
          placeholder="0"
        />
        <span className="text-xs font-medium w-7" style={{ color: "var(--text-muted)" }}>{unit}</span>
      </div>
    </div>
  );
}

export default CreateFoodSheet;
