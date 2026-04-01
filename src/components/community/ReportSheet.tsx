import React, { useState } from "react";
import { X } from "lucide-react";
import { AppButton } from "../ui/AppButton";
import { createReport } from "../../services/community/api";
import type { ReportReason, ReportTarget } from "../../services/community/types";
import { REPORT_REASON_KEYS } from "../../services/community/types";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";
import { useI18n } from "../../i18n/useI18n";

interface Props {
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  onClose: () => void;
  onDone?: () => void;
}

const REASONS: ReportReason[] = ["spam", "harassment", "hate", "nudity", "self_harm", "other"];

export default function ReportSheet({ reporterId, targetType, targetId, onClose, onDone }: Props) {
  useBodyScrollLock(true);
  const { t } = useI18n();
  const [selected, setSelected] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    try {
      await createReport(reporterId, targetType, targetId, selected, details.trim() || undefined);
      setDone(true);
      setTimeout(() => { onDone?.(); onClose(); }, 1500);
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onPointerDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); onClose(); } }}>
      <div
        className="w-full max-w-md rounded-t-2xl p-4 pb-safe"
        style={{ background: "var(--card-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <span className="font-semibold text-base" style={{ color: "var(--text-color)" }}>{t("community.report.title")}</span>
          <button onClick={onClose} className="p-1" style={{ color: "var(--text-secondary)" }}><X size={20} /></button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium" style={{ color: "var(--text-color)" }}>{t("community.report.thanks")}</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>{t("community.report.review")}</p>
          </div>
        ) : (
          <>
            <p className="text-sm mb-3" style={{ color: "var(--text-secondary)" }}>{t("community.report.prompt")}</p>
            <div className="flex flex-col gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setSelected(r)}
                  className="text-left px-3 py-2.5 rounded-xl text-sm"
                  style={{
                    background: selected === r ? "var(--accent-color)" : "var(--border-color)",
                    color: selected === r ? "#fff" : "var(--text-color)",
                  }}
                >
                  {t(REPORT_REASON_KEYS[r])}
                </button>
              ))}
            </div>

            {selected === "other" && (
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder={t("community.report.detailsPlaceholder")}
                maxLength={500}
                className="w-full mt-3 p-3 rounded-xl text-sm bg-transparent border resize-none h-20 outline-none"
                style={{ borderColor: "var(--border-color)", color: "var(--text-color)" }}
              />
            )}

            <AppButton
              onClick={handleSubmit}
              variant="primary"
              fullWidth
              disabled={!selected || submitting}
              isLoading={submitting}
              className="mt-4"
            >
              {t("community.report.submit")}
            </AppButton>
          </>
        )}
      </div>
    </div>
  );
}
