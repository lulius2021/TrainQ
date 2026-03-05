// src/components/cardio/CardioControls.tsx
// Pause/Resume/Stop buttons for cardio tracking

import React from "react";
import { Pause, Play, Square } from "lucide-react";

interface CardioControlsProps {
  status: "idle" | "tracking" | "paused" | "stopped";
  isStarting?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

const CardioControls: React.FC<CardioControlsProps> = ({
  status,
  isStarting,
  onStart,
  onPause,
  onResume,
  onStop,
}) => {
  if (status === "idle") {
    if (isStarting) {
      // GPS permission pending — pause disabled, stop always available
      return (
        <div className="flex justify-center items-center gap-8 px-4">
          <button
            disabled
            className="w-16 h-16 rounded-full bg-amber-500/40 text-white/40 flex items-center justify-center shadow-lg"
          >
            <Pause size={28} fill="currentColor" />
          </button>
          <button
            onClick={onStop}
            className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <Square size={22} fill="white" />
          </button>
        </div>
      );
    }
    return (
      <div className="flex justify-center px-4">
        <button
          onClick={onStart}
          className="w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Play size={36} fill="white" />
        </button>
      </div>
    );
  }

  if (status === "tracking") {
    return (
      <div className="flex justify-center items-center gap-8 px-4">
        <button
          onClick={onPause}
          className="w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Pause size={28} fill="white" />
        </button>
        <button
          onClick={onStop}
          className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Square size={22} fill="white" />
        </button>
      </div>
    );
  }

  if (status === "paused") {
    return (
      <div className="flex justify-center items-center gap-8 px-4">
        <button
          onClick={onResume}
          className="w-16 h-16 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Play size={28} fill="white" />
        </button>
        <button
          onClick={onStop}
          className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
        >
          <Square size={22} fill="white" />
        </button>
      </div>
    );
  }

  return null;
};

export default CardioControls;
