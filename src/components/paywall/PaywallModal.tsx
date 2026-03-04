// src/components/paywall/PaywallModal.tsx
import { useEffect } from "react";
import type { PaywallReason } from "../../utils/entitlements";
import { useI18n } from "../../i18n/useI18n";
import { track } from "../../analytics/track";

type Props = {
  open: boolean;
  reason: PaywallReason;
  onClose: () => void;

  // UI state
  isPro: boolean;

  // remaining credits (Free)
  adaptiveBCRemaining: number; // B/C
  planShiftRemaining: number;
  calendar7DaysRemaining: number;

  // actions
  onBuyMonthly: () => void; // später IAP
  onBuyYearly: () => void; // später IAP
  onRestore?: () => void; // optional später
};

function reasonTitle(t: (key: any, vars?: any) => string, reason: PaywallReason): string {
  if (reason === "adaptive_limit") return t("paywall.reason.adaptive");
  if (reason === "plan_shift") return t("paywall.reason.planShift");
  if (reason === "suggestion_weekly_limit") return t("paywall.reason.suggestionLimit");
  if (reason === "stats_history_limit") return t("paywall.reason.statsLimit");
  if (reason === "active_plan_limit") return t("paywall.reason.planLimit");
  if (reason === "template_limit") return t("paywall.reason.templateLimit");
  return t("paywall.reason.calendar");
}

function buildBullets(t: (key: any) => string): Array<{ label: string; ok: boolean }> {
  return [
    { label: t("paywall.bullet.adaptive"), ok: true },
    { label: t("paywall.bullet.planShift"), ok: true },
    { label: t("paywall.bullet.stats"), ok: true },
    { label: t("paywall.bullet.coach"), ok: true },
    { label: t("paywall.bullet.earlyAccess"), ok: true },
  ];
}

export default function PaywallModal(props: Props) {
  const { t } = useI18n();
  const {
    open,
    reason,
    onClose,
    onBuyMonthly,
    onBuyYearly,
    onRestore,
  } = props;

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      track("monetization_paywall_viewed", { reason });
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, reason]);

  if (!open) return null;

  const bullets = buildBullets(t);

  return (
    <div
      className="fixed inset-0 z-[9999] h-[100dvh] w-full bg-black/90 backdrop-blur-xl flex justify-center items-start overflow-y-auto"
      data-overlay-open="true"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <div
        className="relative w-full max-w-sm my-10 overflow-hidden rounded-[32px] border border-[var(--border-color)] bg-[var(--card-bg)] shadow-2xl backdrop-blur-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative p-6 pt-8 text-center pb-8">
          {/* Close Button absolute top right */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[var(--button-bg)] text-[var(--text-secondary)] hover:opacity-80 hover:text-[var(--text-color)] z-10"
          >
            ✕
          </button>

          {/* Header Icon & Title */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#007AFF]/20 to-[#0055BB]/5 border border-[#007AFF]/30 shadow-lg shadow-blue-900/20">
            <span className="text-3xl">✨</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight text-[var(--text-color)] mb-2">
            TrainQ <span className="text-[#007AFF]">Pro</span>
          </h2>

          <p className="max-w-[85%] mx-auto text-sm text-[var(--text-secondary)] leading-relaxed mb-6">
            {reason !== "calendar_7days" ? reasonTitle(t, reason) : t("paywall.title")}
          </p>

          {/* Feature List */}
          <div className="space-y-3 pl-2 pr-2 mb-8 text-left">
            {bullets.map((b) => (
              <div key={b.label} className="flex items-start gap-3">
                <span className="mt-0.5 flex-shrink-0 text-[#007AFF]">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
                </span>
                <span className="text-[15px] font-medium text-[var(--text-color)] leading-tight">
                  {b.label}
                </span>
              </div>
            ))}
          </div>

          {/* Pricing Cards */}
          <div className="space-y-3">
            {/* Yearly - HERO */}
            <button
              type="button"
              onClick={() => { track("monetization_upgrade_clicked", { plan: "yearly", reason }); onBuyYearly(); }}
              className="relative w-full group overflow-hidden rounded-2xl border-2 border-[#007AFF] bg-[#007AFF]/20 p-4 text-left transition-all active:scale-[0.98]"
            >
              <div className="absolute top-0 right-0 rounded-bl-xl bg-[#007AFF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                {t("paywall.plan.recommended")}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-[var(--text-color)] mb-0.5">{t("paywall.plan.yearly")}</div>
                  <div className="text-xs font-medium text-[var(--text-secondary)]">{t("paywall.plan.yearlyDetail")}</div>
                </div>
                <div className="text-right">
                  {/* Just dummy savings text or arrow */}
                  <div className="font-bold text-[var(--text-color)] text-lg">→</div>
                </div>
              </div>
            </button>

            {/* Monthly */}
            <button
              type="button"
              onClick={() => { track("monetization_upgrade_clicked", { plan: "monthly", reason }); onBuyMonthly(); }}
              className="relative w-full rounded-2xl border border-[var(--border-color)] bg-[var(--button-bg)] p-4 text-left transition-all hover:opacity-80 active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-semibold text-[var(--text-color)] mb-0.5">{t("paywall.plan.monthly")}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{t("paywall.plan.monthlyDetail")}</div>
                </div>
              </div>
            </button>
          </div>

          {/* Main CTA */}
          <button
            type="button"
            onClick={() => { track("monetization_upgrade_clicked", { plan: "yearly", reason }); onBuyYearly(); }}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-[#007AFF] to-[#0055BB] py-4 text-lg font-bold text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-[0.97] hover:scale-[1.01]"
          >
            Jetzt Pro aktivieren
          </button>

          {/* Restore Link */}
          {typeof onRestore === "function" && (
            <button
              type="button"
              onClick={onRestore}
              className="mt-4 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-color)] underline underline-offset-4"
            >
              {t("paywall.restore")}
            </button>
          )}

          {/* Challenge Hint */}
          <button
            type="button"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path: "/challenges" } }));
            }}
            className="mt-4 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors"
          >
            {t("paywall.challengeHint")}
          </button>

          {/* Bottom Spacer for safe scrolling */}
          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}
