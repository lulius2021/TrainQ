// src/components/feedback/FeedbackModal.tsx

import { useState } from "react";
import type { FeedbackRating } from "../../types/feedback";
import { sendFeedbackEmail } from "../../utils/sendFeedbackEmails";

interface FeedbackModalProps {
  page: string;
  onClose: () => void;
}

export function FeedbackModal({ page, onClose }: FeedbackModalProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [note, setNote] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!rating) {
      setErrorMessage("Bitte gib eine Bewertung mit Sternen ab.");
      return;
    }

    if (!feedbackMessage.trim() && !note.trim()) {
      setErrorMessage(
        "Bitte schreibe kurz dein Feedback oder eine Notiz zum Problem."
      );
      return;
    }

    setIsSending(true);

    try {
      await sendFeedbackEmail({
        rating,
        feedbackMessage: feedbackMessage.trim(),
        note: note.trim(),
        name: name.trim(),
        email: email.trim(),
        page,
        createdAt: new Date().toISOString(),
      });

      setSuccessMessage("Danke! Dein Feedback wurde erfolgreich gesendet.");
      setFeedbackMessage("");
      setNote("");
      setName("");
      setEmail("");
      setRating(null);

      // Modal nach kurzer Zeit schließen
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        "Leider konnte dein Feedback nicht gesendet werden. Bitte versuche es später erneut."
      );
    } finally {
      setIsSending(false);
    }
  };

  const renderStar = (value: FeedbackRating) => {
    const isActive = rating !== null && value <= rating;
    return (
      <button
        key={value}
        type="button"
        onClick={() => setRating(value)}
        className="text-2xl border-none bg-transparent cursor-pointer"
        style={{
          color: isActive ? "#00A3FF" : "#777",
          padding: "0 4px",
        }}
        aria-label={`${value} Sterne`}
      >
        ★
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="rounded-2xl p-6 max-w-md w-full"
        style={{
          backgroundColor: "#111827",
          border: "1px solid #1f2937",
        }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-white">
            Feedback zur Seite: {page}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Sterne-Bewertung */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Wie zufrieden bist du? (1–5 Sterne)
            </label>
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((value) =>
                renderStar(value as FeedbackRating)
              )}
            </div>
          </div>

          {/* Positives / Verbesserung */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Positives oder Verbesserungsvorschläge
            </label>
            <textarea
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              className="w-full rounded-xl bg-gray-900 text-gray-100 px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid #374151", minHeight: 70 }}
              placeholder="Was gefällt dir? Was können wir besser machen?"
            />
          </div>

          {/* Notiz zu Problem / fehlender Funktion */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Notiz zum Problem oder zur fehlenden Funktion
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl bg-gray-900 text-gray-100 px-3 py-2 text-sm outline-none"
              style={{ border: "1px solid #374151", minHeight: 70 }}
              placeholder="Beschreibe hier kurz, was genau nicht funktioniert oder fehlt."
            />
          </div>

          {/* Name & Email */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Name (optional)
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-gray-900 text-gray-100 px-3 py-2 text-sm outline-none"
                style={{ border: "1px solid #374151" }}
                placeholder="Dein Name"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                E-Mail (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-gray-900 text-gray-100 px-3 py-2 text-sm outline-none"
                style={{ border: "1px solid #374151" }}
                placeholder="Damit wir dich kontaktieren können"
              />
            </div>
          </div>

          {/* Meldungen */}
          {errorMessage && (
            <p className="text-sm text-red-400">{errorMessage}</p>
          )}
          {successMessage && (
            <p className="text-sm text-green-400">{successMessage}</p>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-sm text-gray-300 bg-gray-800 hover:bg-gray-700"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-60"
            >
              {isSending ? "Senden..." : "Feedback senden"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
