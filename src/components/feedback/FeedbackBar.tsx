// src/components/feedback/FeedbackBar.tsx

import { useState } from "react";
import { FeedbackModal } from "./FeedbackModal";

interface FeedbackBarProps {
  page: string; // z.B. "Dashboard", "Kalender", "Trainingsplan", "Profil"
}

export function FeedbackBar({ page }: FeedbackBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        className="w-full flex justify-center mt-4 mb-2"
        style={{ fontSize: "0.8rem" }}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="text-gray-400 hover:text-blue-400 underline underline-offset-2"
        >
          Wir freuen uns über Feedback!
        </button>
      </div>

      {isOpen && (
        <FeedbackModal
          page={page}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
