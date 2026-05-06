// src/components/paywall/PaywallModal.tsx
import { useState, useCallback, useEffect, useRef } from "react";
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

const SUCCESS_AUTO_CLOSE_MS = 1800;

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

// Strict cancel detection — only matches known iOS/Android cancel error codes/messages.
// Avoids false positives like "user not authenticated".
function isUserCancelError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const err = e as { code?: string | number; message?: string };
  // iOS StoreKit: SKErrorPaymentCancelled = 2
  if (err.code === 2 || err.code === "2") return true;
  // Capgo native-purchases standardized codes
  if (err.code === "PURCHASE_CANCELLED" || err.code === "USER_CANCELLED") return true;
  // Android Billing: BillingClient.BillingResponseCode.USER_CANCELED = 1
  if (err.code === 1 || err.code === "1") return true;
  const msg = (err.message ?? "").toLowerCase();
  // Specific phrases — NOT generic "user" or "cancel"
  if (msg.includes("payment cancelled") || msg.includes("payment canceled")) return true;
  if (msg.includes("user cancelled") || msg.includes("user canceled")) return true;
  if (msg.includes("benutzer hat abgebrochen") || msg.includes("abgebrochen vom benutzer")) return true;
  return false;
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

  // Track mount status — async store calls can resolve after the modal closes.
  // Without this, setState would fire on an unmounted/hidden component.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset transient state every time the modal is opened fresh.
  // Without this, stale errors/success would remain from the previous session.
  useEffect(() => {
    if (open) {
      setPurchaseState("idle");
      setErrorMsg("");
    }
  }, [open]);

  // Auto-close after success so the user actually sees the celebration screen.
  // The parent's onPurchaseSuccess updates Pro state but does NOT close us anymore.
  useEffect(() => {
    if (purchaseState !== "success" && purchaseState !== "sync_pending") return;
    const timer = setTimeout(() => {
      if (mountedRef.current) onClose();
    }, SUCCESS_AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [purchaseState, onClose]);

  const safeSetState = useCallback((next: PurchaseState, msg = "") => {
    if (!mountedRef.current) return;
    setPurchaseState(next);
    setErrorMsg(msg);
  }, []);

  const handlePurchase = useCallback(
    async (plan: "monthly" | "yearly") => {
      safeSetState("loading");
      try {
        const supported = await isBillingSupported();
        if (!supported) {
          safeSetState("unsupported");
          return;
        }

        await purchaseSubscription(plan);
        const isNowPro = await refreshProStatus();

        if (!mountedRef.current) return;
        if (isNowPro) {
          // Update parent's Pro state FIRST — so when auto-close fires, UI is unlocked.
          onPurchaseSuccess();
          safeSetState("success");
        } else {
          // Webhook hasn't confirmed yet — show pending state, let user retry restore later.
          safeSetState("sync_pending");
        }
      } catch (e: unknown) {
        if (isUserCancelError(e)) {
          safeSetState("idle");
          return;
        }
        const msg = e instanceof Error ? e.message.toLowerCase() : "";
        if (msg.includes("produkt-id") || msg.includes("missing") || msg.includes("not found")) {
          safeSetState("error", t("paywall.error.missingProductId"));
        } else {
          safeSetState("error", t("paywall.error.generic"));
        }
      }
    },
    [t, onPurchaseSuccess, safeSetState]
  );

  const handleRestore = useCallback(async () => {
    safeSetState("loading");
    try {
      const supported = await isBillingSupported();
      if (!supported) {
        safeSetState("unsupported");
        return;
      }
      const didRestore = await restorePurchases();
      if (!mountedRef.current) return;
      if (didRestore) {
        onPurchaseSuccess();
        safeSetState("success");
      } else {
        safeSetState("error", t("paywall.error.noActiveSub"));
      }
    } catch {
      safeSetState("error", t("paywall.error.restoreFailed"));
    }
  }, [t, onPurchaseSuccess, safeSetState]);

  const isLoading = purchaseState === "loading";
  const isSuccess = purchaseState === "success";
  const isSyncPending = purchaseState === "sync_pending";

  const handleBackdropClick = useCallback(() => {
    // Don't dismiss while a purchase is in flight or success is showing —
    // prevents user from losing the success screen or orphaning a pending purchase.
    if (isLoading || isSuccess || isSyncPending) return;
    onClose();
  }, [isLoading, isSuccess, isSyncPending, onClose]);

  const handleCloseButton = useCallback(() => {
    if (isLoading) return;
    onClose();
  }, [isLoading, onClose]);

  if (!open) return null;

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
      onClick={handleBackdropClick}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0B0D12]/97 pb-6 pt-5 px-5 shadow-2xl backdrop-blur mb-4 sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        {(isSuccess || isSyncPending) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-3xl bg-[#0B0D12]/97 px-6 text-center">
            <div className="text-5xl">{isSuccess ? "🎉" : "⏳"}</div>
            <div className="text-lg font-bold text-white">
              {isSuccess ? t("paywall.success.title") : t("paywall.plan.yearly")}
            </div>
            <div className="text-sm text-white/70">
              {isSuccess ? t("paywall.success.subtitle") : t("paywall.error.syncFailed")}
            </div>
          </div>
        )}

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
            onClick={handleCloseButton}
            disabled={isLoading}
            className="shrink-0 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60 hover:bg-white/10 active:scale-95 transition-transform disabled:opacity-30"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {remainingLine && (
          <div className="mt-3 rounded-xl border border-white/8 bg-white/4 px-3 py-2 text-[12px] text-white/60">
            {remainingLine}
          </div>
        )}

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

        <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-white/35">
          <span>{t("paywall.loading.applePayHint")}</span>
        </div>
      </div>
    </div>
  );
}
