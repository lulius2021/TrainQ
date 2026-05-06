// src/components/paywall/PaywallModal.tsx
import { useState, useCallback } from "react";
import type { PaywallReason } from "../../utils/entitlements";
import { FREE_LIMITS } from "../../utils/entitlements";
import { useI18n } from "../../i18n/useI18n";
import {
  isBillingSupported,
  purchaseSubscription,
  restorePurchases,
  refreshProStatus,
} from "../../services/purchases";

type Props = {
  open: boolean;
  reason: PaywallReason;
  onClose: () => void;
  isPro: boolean;
  adaptiveBCRemaining: number;
  planShiftRemaining: number;
  calendar7DaysRemaining: number;
  onPurchaseSuccess: () => void;
};

type PurchaseState = "idle" | "loading" | "success" | "error" | "unsupported" | "sync_pending";

function reasonTitle(t: (key: any, vars?: any) => string, reason: PaywallReason): string {
  if (reason === "adaptive_limit") return t("paywall.reason.adaptive");
  if (reason === "plan_shift") return t("paywall.reason.planShift");
  if (reason === "suggestion_weekly_limit") return t("paywall.reason.suggestionLimit");
  if (reason === "stats_history_limit") return t("paywall.reason.statsLimit");
  if (reason === "active_plan_limit") return t("paywall.reason.planLimit");
  if (reason === "template_limit") return t("paywall.reason.templateLimit");
  return t("paywall.reason.calendar");
}

function reasonSubtitle(t: (key: any, vars?: any) => string, reason: PaywallReason): string {
  if (reason === "adaptive_limit") return t("paywall.reason.adaptiveSub", { limit: FREE_LIMITS.adaptiveBCPerMonth });
  if (reason === "plan_shift") return t("paywall.reason.planShiftSub", { limit: FREE_LIMITS.planShiftPerMonth });
  if (reason === "calendar_7days") return t("paywall.reason.calendarSub", { limit: FREE_LIMITS.calendar7DaysPerMonth });
  if (reason === "suggestion_weekly_limit") return t("paywall.reason.suggestionLimitSub");
  if (reason === "stats_history_limit") return t("paywall.reason.statsLimitSub");
  if (reason === "active_plan_limit") return t("paywall.reason.planLimitSub");
  if (reason === "template_limit") return t("paywall.reason.templateLimitSub");
  return t("paywall.hero.headline");
}

function formatRemaining(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return String(Math.max(0, Math.floor(n)));
}

const BULLETS = [
  "paywall.bullet.adaptive",
  "paywall.bullet.planShift",
  "paywall.bullet.stats",
  "paywall.bullet.coach",
  "paywall.bullet.earlyAccess",
] as const;

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
    onPurchaseSuccess,
  } = props;

  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handlePurchase = useCallback(
    async (plan: "monthly" | "yearly") => {
      setPurchaseState("loading");
      setErrorMsg("");
      try {
        const supported = await isBillingSupported();
        if (!supported) {
          setPurchaseState("unsupported");
          return;
        }

        await purchaseSubscription(plan);

        // Validate that the store confirmed Pro status
        const isNowPro = await refreshProStatus();
        if (isNowPro) {
          setPurchaseState("success");
          onPurchaseSuccess();
        } else {
          // RevenueCat webhook may still be processing — soft success
          setPurchaseState("sync_pending");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "";
        // User cancellation — silently close
        if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("user")) {
          setPurchaseState("idle");
          return;
        }
        if (msg.toLowerCase().includes("produkt-id") || msg.toLowerCase().includes("missing")) {
          setErrorMsg(t("paywall.error.missingProductId"));
        } else {
          setErrorMsg(t("paywall.error.generic"));
        }
        setPurchaseState("error");
      }
    },
    [t, onPurchaseSuccess]
  );

  const handleRestore = useCallback(async () => {
    setPurchaseState("loading");
    setErrorMsg("");
    try {
      const supported = await isBillingSupported();
      if (!supported) {
        setPurchaseState("unsupported");
        return;
      }

      const didRestore = await restorePurchases();
      if (didRestore) {
        setPurchaseState("success");
        onPurchaseSuccess();
      } else {
        setErrorMsg(t("paywall.error.noActiveSub"));
        setPurchaseState("error");
      }
    } catch {
      setErrorMsg(t("paywall.error.restoreFailed"));
      setPurchaseState("error");
    }
  }, [t, onPurchaseSuccess]);

  const handleClose = useCallback(() => {
    setPurchaseState("idle");
    setErrorMsg("");
    onClose();
  }, [onClose]);

  if (!open) return null;

  const isLoading = purchaseState === "loading";
  const isSuccess = purchaseState === "success";
  const isSyncPending = purchaseState === "sync_pending";

  const remainingLine = (() => {
    if (isPro) return t("paywall.remaining.proActive");
    if (reason === "adaptive_limit") return t("paywall.remaining.adaptive", { value: formatRemaining(adaptiveBCRemaining) });
    if (reason === "plan_shift") return t("paywall.remaining.planShift", { value: formatRemaining(planShiftRemaining) });
    if (reason === "calendar_7days") return t("paywall.remaining.calendar", { value: formatRemaining(calendar7DaysRemaining) });
    return null;
  })();

  return (
    <div
      className="fixed inset-0 z-[999] flex items-end justify-center sm:items-center bg-black/70 px-4 pb-safe"
      data-overlay-open="true"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0B0D12]/97 pb-6 pt-5 px-5 shadow-2xl backdrop-blur mb-4 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success overlay */}
        {(isSuccess || isSyncPending) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#0B0D12]/97 px-6 text-center">
            <div className="text-4xl">🎉</div>
            <div className="text-lg font-bold text-white">
              {isSuccess ? t("paywall.success.title") : t("paywall.plan.yearly")}
            </div>
            <div className="text-sm text-white/70">
              {isSuccess ? t("paywall.success.subtitle") : t("paywall.error.syncFailed")}
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 rounded-2xl bg-[var(--accent-color)] px-6 py-3 text-sm font-semibold text-white shadow-lg"
            >
              {t("common.done") ?? "Fertig"}
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-[var(--accent-color)]">
              {t("paywall.title")}
            </div>
            <div className="text-xl font-bold text-white leading-tight mt-0.5">
              {reasonTitle(t, reason)}
            </div>
            <div className="mt-1 text-[13px] text-white/65 leading-snug">
              {reasonSubtitle(t, reason)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10 active:scale-95 transition-transform"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Remaining credits */}
        {remainingLine && (
          <div className="mt-3 rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-[12px] text-white/60">
            {remainingLine}
          </div>
        )}

        {/* Feature bullets */}
        <div className="mt-4 grid grid-cols-1 gap-1.5">
          {BULLETS.map((key) => (
            <div key={key} className="flex items-center gap-2.5 text-[13px] text-white/85">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 text-[11px]">
                ✓
              </span>
              <span>{t(key)}</span>
            </div>
          ))}
        </div>

        {/* Error message */}
        {purchaseState === "error" && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">
            {errorMsg || t("paywall.error.generic")}
          </div>
        )}
        {purchaseState === "unsupported" && (
          <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-300">
            {t("paywall.error.notSupported")}
          </div>
        )}

        {/* Pricing buttons */}
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={() => handlePurchase("yearly")}
            disabled={isLoading}
            className="relative w-full rounded-2xl border border-[var(--accent-color)]/40 bg-[var(--accent-color)]/15 px-4 py-3.5 text-left active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{t("paywall.plan.yearly")}</div>
                <div className="text-[12px] text-white/60">{t("paywall.plan.yearlyDetail")}</div>
              </div>
              <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                {t("paywall.plan.recommended")}
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handlePurchase("monthly")}
            disabled={isLoading}
            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-left active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-white">{t("paywall.plan.monthly")}</div>
                <div className="text-[12px] text-white/60">{t("paywall.plan.monthlyDetail")}</div>
              </div>
            </div>
          </button>

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-2 text-[13px] text-white/60">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
              {t("paywall.loading.processing")}
            </div>
          )}

          <button
            type="button"
            onClick={handleRestore}
            disabled={isLoading}
            className="w-full rounded-2xl border border-white/8 bg-transparent px-4 py-2.5 text-[12px] text-white/50 hover:text-white/70 hover:bg-white/5 transition-colors disabled:opacity-40"
          >
            {t("paywall.restore")}
          </button>
        </div>

        {/* Legal */}
        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-white/35">
          <span>{t("paywall.loading.applePayHint")}</span>
        </div>
      </div>
    </div>
  );
}
