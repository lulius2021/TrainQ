// src/components/paywall/PaywallModal.tsx
import { useState, useEffect, useRef } from "react";
import type { PaywallReason } from "../../utils/entitlements";
import { useI18n } from "../../i18n/useI18n";
import { track } from "../../analytics/track";
import { BottomSheet } from "../common/BottomSheet";
import { getSubscriptionProducts } from "../../services/purchases";
import type { Product } from "@capgo/native-purchases";

type Props = {
  open: boolean;
  reason: PaywallReason;
  onClose: () => void;
  onBuyMonthly: () => Promise<void>;
  onBuyYearly: () => Promise<void>;
  onRestore?: () => Promise<void>;
};

type UiState = "idle" | "loading" | "success";

function reasonSubtext(t: (key: any) => string, reason: PaywallReason): string {
  if (reason === "adaptive_limit") return t("paywall.reason.adaptive");
  if (reason === "plan_shift") return t("paywall.reason.planShift");
  if (reason === "suggestion_weekly_limit") return t("paywall.reason.suggestionLimit");
  if (reason === "stats_history_limit") return t("paywall.reason.statsLimit");
  if (reason === "active_plan_limit") return t("paywall.reason.planLimit");
  if (reason === "template_limit") return t("paywall.reason.templateLimit");
  return t("paywall.reason.calendar");
}

function buildBullets(t: (key: any) => string): string[] {
  return [
    t("paywall.bullet.adaptive"),
    t("paywall.bullet.planShift"),
    t("paywall.bullet.stats"),
    t("paywall.bullet.coach"),
    t("paywall.bullet.earlyAccess"),
  ];
}

export default function PaywallModal({ open, reason, onClose, onBuyMonthly, onBuyYearly, onRestore }: Props) {
  const { t } = useI18n();
  const [selectedPlan, setSelectedPlan] = useState<"yearly" | "monthly">("yearly");
  const [uiState, setUiState] = useState<UiState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state and load real App Store prices when sheet opens
  useEffect(() => {
    if (!open) return;
    setUiState("idle");
    setError(null);
    setSelectedPlan("yearly");
    track("monetization_paywall_viewed", { reason });
    getSubscriptionProducts().then(setProducts).catch(() => { /* use i18n fallback prices */ });
  }, [open, reason]);

  // Auto-close 2.2 s after success
  useEffect(() => {
    if (uiState !== "success") return;
    timerRef.current = setTimeout(() => {
      onClose();
      setUiState("idle");
    }, 2200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [uiState, onClose]);

  function priceFor(plan: "yearly" | "monthly"): string | null {
    const prod = products.find((p) =>
      p.productIdentifier?.toLowerCase().includes(plan) ||
      p.title?.toLowerCase().includes(plan)
    );
    return prod?.localizedPrice ?? null;
  }

  async function handleBuy() {
    if (uiState !== "idle") return;
    setError(null);
    setUiState("loading");
    try {
      if (selectedPlan === "yearly") await onBuyYearly();
      else await onBuyMonthly();
      setUiState("success");
    } catch (e: any) {
      setUiState("idle");
      setError(e?.message ?? t("paywall.error.generic"));
    }
  }

  async function handleRestore() {
    if (!onRestore || uiState !== "idle") return;
    setError(null);
    setUiState("loading");
    try {
      await onRestore();
      setUiState("success");
    } catch (e: any) {
      setUiState("idle");
      setError(e?.message ?? t("paywall.error.restoreFailed"));
    }
  }

  const isLoading = uiState === "loading";
  const isSuccess = uiState === "success";
  const yearlyPrice = priceFor("yearly");
  const monthlyPrice = priceFor("monthly");
  const bullets = buildBullets(t);

  const header = (
    <div className="flex items-center justify-between px-5 pt-1 pb-0">
      <h2 className="text-lg font-bold text-[var(--text-color)]">
        TrainQ <span className="text-[#007AFF]">Pro</span>
      </h2>
      <button
        type="button"
        onClick={onClose}
        disabled={isLoading}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--button-bg)] text-[var(--text-secondary)] hover:opacity-80 disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  );

  const footer = (
    <div className="px-5 pb-6 pt-3 space-y-3">
      {/* Inline error */}
      {error && (
        <p className="text-center text-sm text-red-400 leading-snug">{error}</p>
      )}

      {/* Success state */}
      {isSuccess ? (
        <div className="flex flex-col items-center gap-1.5 py-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#007AFF]/15 border border-[#007AFF]/30">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6 text-[#007AFF]">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-base font-bold text-[var(--text-color)]">{t("paywall.success.title")}</p>
          <p className="text-sm text-[var(--text-secondary)] text-center">{t("paywall.success.subtitle")}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { track("monetization_upgrade_clicked", { plan: selectedPlan, reason }); handleBuy(); }}
          disabled={isLoading}
          className="w-full rounded-2xl bg-gradient-to-r from-[#007AFF] to-[#0055BB] py-4 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition-transform active:scale-[0.97] disabled:opacity-70 flex items-center justify-center gap-2"
          style={{ boxShadow: "0 0 18px rgba(0,122,255,0.4), 0 4px 20px rgba(0,122,255,0.28)" }}
        >
          {isLoading ? (
            <>
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {t("paywall.loading.processing")}
            </>
          ) : (
            t("paywall.action.activatePro")
          )}
        </button>
      )}

      {/* Apple Pay hint */}
      {!isSuccess && (
        <p className="text-center text-[11px] text-[var(--text-secondary)]">
          {t("paywall.loading.applePayHint")}
        </p>
      )}

      {/* Restore + Legal row */}
      <div className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--text-secondary)]">
        {typeof onRestore === "function" && !isSuccess && (
          <>
            <button
              type="button"
              onClick={handleRestore}
              disabled={isLoading}
              className="hover:text-[var(--text-color)] underline underline-offset-2 disabled:opacity-40"
            >
              {t("paywall.restore")}
            </button>
            <span aria-hidden="true">·</span>
          </>
        )}
        <button
          type="button"
          onClick={() => window.open("/privacy", "_system")}
          className="hover:text-[var(--text-color)] underline underline-offset-2"
        >
          {t("paywall.legal.privacy")}
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => window.open("/terms", "_system")}
          className="hover:text-[var(--text-color)] underline underline-offset-2"
        >
          {t("paywall.legal.terms")}
        </button>
      </div>
    </div>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      header={header}
      footer={footer}
      height="82dvh"
      zIndex={9999}
      showHandle
      variant="docked"
    >
      {/* Aurora hero card */}
      <div
        className="mx-4 mb-5 overflow-hidden rounded-[24px] relative"
        style={{ background: "linear-gradient(145deg, #1a3a6e 0%, #0a1f3d 45%, #000814 100%)", minHeight: 140 }}
      >
        {/* Radial blob highlight */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 55% at 30% 30%, rgba(0,122,255,0.22) 0%, transparent 70%)" }}
        />
        <div className="relative p-5 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-2xl">✨</span>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.6)" }}>TrainQ Pro</span>
          </div>
          <p className="text-[21px] font-black leading-tight" style={{ color: "#ffffff" }}>
            {t("paywall.hero.headline")}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>
            {reasonSubtext(t, reason)}
          </p>
        </div>
      </div>

      {/* Feature bullets */}
      <div className="px-5 space-y-3 mb-5">
        {bullets.map((label) => (
          <div key={label} className="flex items-start gap-3">
            <span className="mt-0.5 flex-shrink-0 text-[#007AFF]">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </span>
            <span className="text-[15px] font-medium text-[var(--text-color)] leading-tight">{label}</span>
          </div>
        ))}
      </div>

      {/* Plan selector */}
      <div className="px-4 space-y-3 pb-2">
        {/* Yearly — recommended */}
        <button
          type="button"
          onClick={() => setSelectedPlan("yearly")}
          disabled={isLoading}
          className={`relative w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98] border-2 disabled:opacity-60 ${
            selectedPlan === "yearly"
              ? "border-[#007AFF] bg-[#007AFF]/15"
              : "border-[var(--border-color)] bg-[var(--button-bg)]"
          }`}
          style={selectedPlan === "yearly" ? { boxShadow: "0 0 10px rgba(0,122,255,0.18)" } : undefined}
        >
          <div className="absolute top-0 right-0 rounded-bl-xl bg-[#007AFF] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
            {t("paywall.plan.recommended")}
          </div>
          <div className="flex items-center justify-between pr-20">
            <div>
              <div className="text-base font-bold text-[var(--text-color)]">{t("paywall.plan.yearly")}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                {yearlyPrice ? `${yearlyPrice} / ${t("common.year")}` : t("paywall.plan.yearlyDetail")}
              </div>
            </div>
            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              selectedPlan === "yearly" ? "border-[#007AFF] bg-[#007AFF]" : "border-[var(--border-color)]"
            }`}>
              {selectedPlan === "yearly" && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
          </div>
        </button>

        {/* Monthly */}
        <button
          type="button"
          onClick={() => setSelectedPlan("monthly")}
          disabled={isLoading}
          className={`relative w-full rounded-2xl p-4 text-left transition-all active:scale-[0.98] border-2 disabled:opacity-60 ${
            selectedPlan === "monthly"
              ? "border-[#007AFF] bg-[#007AFF]/15"
              : "border-[var(--border-color)] bg-[var(--button-bg)]"
          }`}
          style={selectedPlan === "monthly" ? { boxShadow: "0 0 10px rgba(0,122,255,0.18)" } : undefined}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base font-semibold text-[var(--text-color)]">{t("paywall.plan.monthly")}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                {monthlyPrice ? `${monthlyPrice} / ${t("common.month")}` : t("paywall.plan.monthlyDetail")}
              </div>
            </div>
            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
              selectedPlan === "monthly" ? "border-[#007AFF] bg-[#007AFF]" : "border-[var(--border-color)]"
            }`}>
              {selectedPlan === "monthly" && <div className="h-2 w-2 rounded-full bg-white" />}
            </div>
          </div>
        </button>
      </div>

      {/* Challenge hint */}
      <div className="px-5 pt-1 pb-3">
        <button
          type="button"
          onClick={() => {
            onClose();
            window.dispatchEvent(new CustomEvent("trainq:navigate", { detail: { path: "/challenges" } }));
          }}
          className="w-full text-center text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors py-2"
        >
          {t("paywall.challengeHint")}
        </button>
      </div>
    </BottomSheet>
  );
}
