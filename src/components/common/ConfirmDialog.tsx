import React from "react";

type Props = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  const confirmClass = destructive
    ? "bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25"
    : "bg-[var(--accent-color,#2563EB)] text-white hover:opacity-90";

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      data-overlay-open="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#0B0D12]/97 p-5 shadow-2xl backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-semibold text-white">{title}</div>
        {message && (
          <div className="mt-2 text-[13px] text-white/70 whitespace-pre-line">{message}</div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/80 active:scale-[0.98] transition-transform"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-2xl px-4 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
