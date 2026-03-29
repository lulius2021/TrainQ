// src/components/nutrition/FoodInput.tsx
import React, { useState, useRef } from "react";
import { ScanBarcode, ArrowUp, Plus, Search } from "lucide-react";

interface FoodInputProps {
  onSubmit: (raw: string) => void;
  onSearchTap: () => void;
  onBarcodeTap: () => void;
  onCreateFood?: () => void;
}

const FoodInput: React.FC<FoodInputProps> = ({ onSubmit, onSearchTap, onBarcodeTap, onCreateFood }) => {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Text input */}
      <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] flex items-center gap-2 px-3 py-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="z.B. 200g Skyr, 2 Eier..."
          className="flex-1 bg-transparent text-sm text-[var(--text-color)] placeholder-[var(--text-secondary)] outline-none min-w-0"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
        />
        {value.trim() && (
          <button
            onClick={handleSubmit}
            className="w-10 h-10 rounded-full bg-[var(--accent-color)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <ArrowUp size={18} className="text-white" />
          </button>
        )}
      </div>

      {/* Action buttons row */}
      <div className="flex gap-2">
        <button
          onClick={onSearchTap}
          className="flex-1 h-12 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
        >
          <Search size={18} className="text-[var(--accent-color)]" />
          <span className="text-sm font-semibold text-[var(--text-color)]">Suche</span>
        </button>
        <button
          onClick={onBarcodeTap}
          className="flex-1 h-12 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
        >
          <ScanBarcode size={18} className="text-[var(--accent-color)]" />
          <span className="text-sm font-semibold text-[var(--text-color)]">Barcode</span>
        </button>
        {onCreateFood && (
          <button
            onClick={onCreateFood}
            className="flex-1 h-12 rounded-2xl bg-[var(--card-bg)] border border-[var(--border-color)] flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
          >
            <Plus size={18} className="text-[var(--accent-color)]" />
            <span className="text-sm font-semibold text-[var(--text-color)]">Erstellen</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default FoodInput;
