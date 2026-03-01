// src/components/nutrition/DiaryList.tsx
import React from "react";
import { UtensilsCrossed } from "lucide-react";
import type { DiaryEntry } from "../../types/nutrition";
import DiaryEntryRow from "./DiaryEntryRow";

interface DiaryListProps {
  entries: DiaryEntry[];
  onDelete: (id: string) => void;
  onTapEntry: (entry: DiaryEntry) => void;
}

const DiaryList: React.FC<DiaryListProps> = ({
  entries,
  onDelete,
  onTapEntry,
}) => {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--border-color)] flex items-center justify-center mb-3">
          <UtensilsCrossed size={22} className="text-[var(--text-secondary)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-secondary)] text-center">
          Noch keine Eintr&auml;ge heute
        </p>
        <p className="text-xs text-[var(--text-secondary)] mt-1 text-center opacity-70">
          Tippe oben, um Essen zu tracken
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <DiaryEntryRow
          key={entry.id}
          entry={entry}
          onDelete={onDelete}
          onTap={onTapEntry}
        />
      ))}
    </div>
  );
};

export default DiaryList;
