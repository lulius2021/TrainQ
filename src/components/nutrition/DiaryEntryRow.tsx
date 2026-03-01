// src/components/nutrition/DiaryEntryRow.tsx
import React, { useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Trash2 } from "lucide-react";
import type { DiaryEntry } from "../../types/nutrition";

const MotionDiv = motion.div as any;

interface DiaryEntryRowProps {
  entry: DiaryEntry;
  onDelete: (id: string) => void;
  onTap: (entry: DiaryEntry) => void;
}

const DELETE_THRESHOLD = -80;

const DiaryEntryRow: React.FC<DiaryEntryRowProps> = ({
  entry,
  onDelete,
  onTap,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-100, -50, 0], [1, 0.5, 0]);
  const deleteScale = useTransform(x, [-100, -50, 0], [1, 0.8, 0.5]);

  const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
    if (info.offset.x < DELETE_THRESHOLD) {
      setIsDeleting(true);
      onDelete(entry.id);
    }
  };

  if (isDeleting) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete background */}
      <MotionDiv
        className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-2xl"
        style={{ opacity: deleteOpacity }}
      >
        <MotionDiv style={{ scale: deleteScale }}>
          <Trash2 size={20} className="text-white" />
        </MotionDiv>
      </MotionDiv>

      {/* Draggable row */}
      <MotionDiv
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        onClick={() => onTap(entry)}
        className="relative bg-[var(--card-bg)] rounded-2xl px-4 py-3 border border-[var(--border-color)] cursor-pointer active:bg-[var(--border-color)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-[var(--text-color)] truncate">
              {entry.foodName}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-0.5">
              {entry.displayAmount}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-bold text-[var(--text-color)] tabular-nums">
              {entry.macros.kcal} kcal
            </div>
            <div className="text-xs text-blue-500 font-semibold tabular-nums">
              {entry.macros.protein}g P
            </div>
          </div>
        </div>
      </MotionDiv>
    </div>
  );
};

export default DiaryEntryRow;
