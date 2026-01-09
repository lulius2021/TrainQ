// src/components/feedback/FeedbackModal.tsx
import { useEffect, useRef, useState } from "react";
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

  const closeTimerRef = useRef<number | null>(null);

  // ✅ ESC schließt
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // ✅ Timer cleanup
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!rating) {
      setErrorMessage("Bitte gib eine Bewertung mit Sternen ab.");
      return;
    }

    if (!feedbackMessage.trim() && !note.trim()) {
      setErrorMessage("Bitte schreibe kurz dein Feedback oder eine Notiz zum Problem.");
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

      closeTimerRef.current = window.setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
      setErrorMessage("Leider konnte dein Feedback nicht gesendet werden. Bitte versuche es später erneut.");
    } finally {
      setIsSending(false);
    }
  };

  const StarButton = ({ value }: { value: FeedbackRating }) => {
    const active = rating !== null && value <= rating;
    return (
      <button
        type="button"
        onClick={() => setRating(value)}
        className={
          "text-2xl leading-none px-1 select-none transition-colors " +
          (active ? "text-blue-400" : "text-white/25 hover:text-white/45")
        }
        aria-label={`${value} Sterne`}
      >
        ★
      </button>
    );
  };

  // WICHTIG: Kein Overlay / kein fixed hier mehr – das macht FeedbackBar.
  return (
    <div className="w-full rounded-2xl bg-brand-card border border-white/10 p-5 sm:p-6 text-white">
      <div className="flex items-start justify-between gap-3 mb-4" data-overlay-drag-handle="true">
        <div className="min-w-0">
          <div className="text-[11px] text-white/55">Feedback</div>
          <h2 className="text-base sm:text-lg font-semibold text-white/90 truncate">
            Feedback zur Seite: {page}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/70 hover:bg-white/5"
          aria-label="Schließen"
          title="Schließen"
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Sterne */}
        <div className="rounded-xl border border-white/10 bg-black/25 p-3">
          <label className="block text-[12px] text-white/75 mb-2">Wie zufrieden bist du? (1–5 Sterne)</label>
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((v) => (
              <StarButton key={v} value={v as FeedbackRating} />
            ))}
          </div>
        </div>

        {/* Positives */}
        <div className="space-y-1">
          <label className="block text-[12px] text-white/75">Positives oder Verbesserungsvorschläge</label>
          <textarea
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            className="w-full rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25 min-h-[90px]"
            placeholder="Was gefällt dir? Was können wir besser machen?"
          />
        </div>

        {/* Problem */}
        <div className="space-y-1">
          <label className="block text-[12px] text-white/75">Notiz zum Problem oder zur fehlenden Funktion</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25 min-h-[90px]"
            placeholder="Beschreibe hier kurz, was genau nicht funktioniert oder fehlt."
          />
        </div>

        {/* Name / Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-[12px] text-white/75">Name (optional)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25"
              placeholder="Dein Name"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] text-white/75">E-Mail (optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/15 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25"
              placeholder="Damit wir dich kontaktieren können"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        </div>

        {/* Meldungen */}
        {errorMessage && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-100">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[12px] text-emerald-100">
            {successMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-white/15 bg-black/30 text-sm text-white/80 hover:bg-white/5"
          >
            Abbrechen
          </button>

          <button
            type="submit"
            disabled={isSending}
            className="px-5 py-2 rounded-xl bg-brand-primary text-sm font-semibold text-black hover:bg-brand-primary/90 disabled:opacity-60"
          >
            {isSending ? "Senden..." : "Feedback senden"}
          </button>
        </div>
      </form>
    </div>
  );
}
