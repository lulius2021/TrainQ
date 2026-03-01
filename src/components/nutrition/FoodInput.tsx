// src/components/nutrition/FoodInput.tsx
import React, { useState, useRef } from "react";
import { ScanBarcode, ArrowUp, Plus } from "lucide-react";

interface FoodInputProps {
  onSubmit: (raw: string) => void;
  onBarcodeTap: () => void;
  onCreateFood?: () => void;
}

const FoodInput: React.FC<FoodInputProps> = ({ onSubmit, onBarcodeTap, onCreateFood }) => {
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
      {value.trim() ? (
        <button
          onClick={handleSubmit}
          className="w-8 h-8 rounded-full bg-[var(--accent-color)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
        >
          <ArrowUp size={16} className="text-white" />
        </button>
      ) : (
        <>
          {onCreateFood && (
            <button
              onClick={onCreateFood}
              className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            >
              <Plus size={16} className="text-[var(--text-secondary)]" />
            </button>
          )}
          <button
            onClick={onBarcodeTap}
            className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <ScanBarcode size={16} className="text-[var(--text-secondary)]" />
          </button>
        </>
      )}
    </div>
  );
};

export default FoodInput;
