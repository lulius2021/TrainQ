// src/components/paywall/PaywallModal.tsx
import type { PaywallReason } from "../../utils/entitlements";
import { FREE_LIMITS } from "../../utils/entitlements";
import { useI18n } from "../../i18n/useI18n";

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
  return t("paywall.reason.calendar");
}

function reasonSubtitle(t: (key: any, vars?: any) => string, reason: PaywallReason): string {
  if (reason === "adaptive_limit") {
    return t("paywall.reason.adaptiveSub"); // Hardcoded limit in json
  }
  if (reason === "plan_shift") {
    return t("paywall.reason.planShiftSub");
  }
  return t("paywall.reason.calendarSub");
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

function formatRemaining(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return String(Math.max(0, Math.floor(n)));
}

export default function PaywallModal(props: Props) {
  const { t } = useI18n();
  const {
    open,
    reason,
    onClose,
    isPro,
    adaptiveBCRemaining,
    planShiftRemaining,
    calendar7DaysRemaining,
    onBuyMonthly,
    onBuyYearly,
    onRestore,
  } = props;

  if (!open) return null;

  const remainingLine = (() => {
    if (isPro) return t("paywall.remaining.proActive");

    if (reason === "adaptive_limit")
      return `${t("paywall.remaining.adaptive")}: ${formatRemaining(adaptiveBCRemaining)}`;
    if (reason === "plan_shift")
      return `${t("paywall.remaining.planShift")}: ${formatRemaining(planShiftRemaining)}`;
    return `${t("paywall.remaining.calendar")}: ${formatRemaining(calendar7DaysRemaining)}`;
  })();
  const bullets = buildBullets(t);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4"
      data-overlay-open="true"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-white/60">{t("paywall.title")}</div>
            <div className="text-lg font-semibold text-white">{reasonTitle(t, reason)}</div>
            <div className="mt-1 text-sm text-white/70 leading-snug">{reasonSubtitle(t, reason)}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
            aria-label={t("common.close")}
            title={t("common.close")}
          >
            ✕
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
          {remainingLine}
        </div>

        <div className="mt-4 space-y-2">
          {bullets.map((b) => (
            <div key={b.label} className="flex items-center gap-2 text-sm text-white/85">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-200 text-[12px]">
                ✓
              </span>
              <span>{b.label}</span>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={onBuyYearly}
            className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-left hover:bg-white/15"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{t("paywall.plan.yearly")}</div>
                <div className="text-[12px] text-white/65">{t("paywall.plan.yearlyDetail")}</div>
              </div>
              <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-[11px] text-emerald-100">
                {t("paywall.plan.recommended")}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={onBuyMonthly}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left hover:bg-white/10"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{t("paywall.plan.monthly")}</div>
                <div className="text-[12px] text-white/65">{t("paywall.plan.monthlyDetail")}</div>
              </div>
            </div>
          </button>

          {typeof onRestore === "function" && (
            <button
              type="button"
              onClick={onRestore}
              className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-[12px] text-white/70 hover:bg-white/5"
            >
              {t("paywall.restore")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
