import React, { useState } from "react";
import { Heart } from "lucide-react";
import { useWellness } from "../../hooks/useWellness";

const WELLBEING_EMOJI = ["", "😩", "😣", "😔", "😕", "😐", "🙂", "😊", "😃", "😄", "🤩"];
const SLEEP_EMOJI    = ["", "😴", "😴", "😪", "🥱", "😶", "🙂", "😊", "😃", "😄", "⚡"];

export default function WellbeingCheckIn() {
  const { todayEntry, saveEntry } = useWellness();
  const [wellbeing, setWellbeing] = useState(7);
  const [sleep,     setSleep]     = useState(7);
  const [saved,     setSaved]     = useState(false);

  // If already checked in today or just saved, don't render
  if (todayEntry || saved) return null;

  const handleSave = () => {
    const today = new Date().toISOString().slice(0, 10);
    saveEntry({ date: today, wellbeingScore: wellbeing, sleepQuality: sleep });
    setSaved(true);
  };

  return (
    <div className="rounded-[24px] p-4 border border-[var(--border-color)] bg-[var(--card-bg)]">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
          <Heart size={16} />
        </div>
        <div>
          <div className="text-sm font-semibold text-[var(--text-color)]">Wie fühlst du dich?</div>
          <div className="text-xs text-[var(--text-secondary)]">Check-in verbessert deine Deload-Empfehlung</div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1.5">
            <span>Wohlbefinden</span>
            <span className="font-semibold text-[var(--text-color)]">
              {WELLBEING_EMOJI[wellbeing]} {wellbeing}/10
            </span>
          </div>
          <input
            type="range"
            min={1} max={10}
            value={wellbeing}
            onChange={(e) => setWellbeing(Number(e.target.value))}
            className="w-full accent-rose-500 h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-0.5">
            <span>Erschöpft</span><span>Topfit</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-[var(--text-secondary)] mb-1.5">
            <span>Schlafqualität</span>
            <span className="font-semibold text-[var(--text-color)]">
              {SLEEP_EMOJI[sleep]} {sleep}/10
            </span>
          </div>
          <input
            type="range"
            min={1} max={10}
            value={sleep}
            onChange={(e) => setSleep(Number(e.target.value))}
            className="w-full accent-blue-500 h-1.5 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-[var(--text-secondary)] mt-0.5">
            <span>Schlecht</span><span>Sehr gut</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="mt-3 w-full rounded-2xl py-2 text-xs font-bold bg-rose-500 text-white active:scale-95 transition-transform"
      >
        Speichern
      </button>
    </div>
  );
}
