// src/components/feedback/FeedbackModal.tsx
import { useEffect, useRef, useState } from "react";
import type { FeedbackRating } from "../../types/feedback";
import { sendFeedbackEmail } from "../../utils/sendFeedbackEmails";
import { useI18n } from "../../i18n/useI18n";

interface FeedbackModalProps {
  page: string;
  onClose: () => void;
}

export function FeedbackModal({ page, onClose }: FeedbackModalProps) {
  const { t } = useI18n();
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
      setErrorMessage(t("feedback.error.ratingRequired"));
      return;
    }

    if (!feedbackMessage.trim() && !note.trim()) {
      setErrorMessage(t("feedback.error.messageRequired"));
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

      setSuccessMessage(t("feedback.success"));
      setFeedbackMessage("");
      setNote("");
      setName("");
      setEmail("");
      setRating(null);

      closeTimerRef.current = window.setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setErrorMessage(t("feedback.error.sendFailed"));
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
        aria-label={t("feedback.ratingStar", { value })}
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
          <div className="text-[11px] text-white/55">{t("feedback.title")}</div>
          <h2 className="text-base sm:text-lg font-semibold text-white/90 truncate">
            {t("feedback.subtitle", { page })}
          </h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-9 w-9 flex items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/70 hover:bg-white/5"
          aria-label={t("common.close")}
          title={t("common.close")}
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Sterne */}
        <div className="rounded-3xl border border-white/10 bg-black/25 p-3">
          <label className="block text-[12px] text-white/75 mb-2">{t("feedback.ratingLabel")}</label>
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((v) => (
              <StarButton key={v} value={v as FeedbackRating} />
            ))}
          </div>
        </div>

        {/* Positives */}
        <div className="space-y-1">
          <label className="block text-[12px] text-white/75">{t("feedback.positiveLabel")}</label>
          <textarea
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            className="w-full rounded-3xl bg-black/30 border border-white/15 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25 min-h-[90px]"
            placeholder={t("feedback.positivePlaceholder")}
          />
        </div>

        {/* Problem */}
        <div className="space-y-1">
          <label className="block text-[12px] text-white/75">{t("feedback.problemLabel")}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full rounded-3xl bg-black/30 border border-white/15 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25 min-h-[90px]"
            placeholder={t("feedback.problemPlaceholder")}
          />
        </div>

        {/* Name / Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-[12px] text-white/75">{t("feedback.nameLabel")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-3xl bg-black/30 border border-white/15 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25"
              placeholder={t("feedback.namePlaceholder")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[12px] text-white/75">{t("feedback.emailLabel")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-3xl bg-black/30 border border-white/15 px-3 py-2 text-sm text-white/90 outline-none focus:border-white/25"
              placeholder={t("feedback.emailPlaceholder")}
              autoCapitalize="none"
              autoCorrect="off"
            />
          </div>
        </div>

        {/* Meldungen */}
        {errorMessage && (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-3 text-[12px] text-red-100">
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[12px] text-emerald-100">
            {successMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-3xl border border-white/15 bg-black/30 text-sm text-white/80 hover:bg-white/5"
          >
            {t("common.cancel")}
          </button>

          <button
            type="submit"
            disabled={isSending}
            className="px-5 py-2 rounded-3xl bg-brand-primary text-sm font-semibold text-black hover:bg-brand-primary/90 disabled:opacity-60"
          >
            {isSending ? t("feedback.sending") : t("feedback.send")}
          </button>
        </div>
      </form>
    </div>
  );
}
