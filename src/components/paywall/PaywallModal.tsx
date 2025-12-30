// src/components/paywall/PaywallModal.tsx
import type { PaywallReason } from "../../utils/entitlements";
import { FREE_LIMITS } from "../../utils/entitlements";

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
  onStartTrial: () => void; // MVP CTA (Trial “immer möglich”)
  onBuyMonthly: () => void; // später IAP
  onBuyYearly: () => void; // später IAP
  onRestore?: () => void; // optional später
};

function reasonTitle(reason: PaywallReason): string {
  if (reason === "adaptive_limit") return "Adaptives Training freischalten";
  if (reason === "plan_shift") return "Trainingsplan verschieben freischalten";
  return "Mehr als 7 Tage voraus planen";
}

function reasonSubtitle(reason: PaywallReason): string {
  if (reason === "adaptive_limit") {
    return `Du hast dein Free-Limit für Profil B/C erreicht (${FREE_LIMITS.adaptiveBCPerMonth}×/Monat). Profil A bleibt immer frei.`;
  }
  if (reason === "plan_shift") {
    return `Du hast dein Free-Limit fürs Plan-Verschieben erreicht (${FREE_LIMITS.planShiftPerMonth}×/Monat).`;
  }
  return `Du hast dein Free-Limit fürs Vorausplanen erreicht (${FREE_LIMITS.calendar7DaysPerMonth}×/Monat).`;
}

const BULLETS: Array<{ label: string; ok: boolean }> = [
  { label: "Unbegrenztes adaptives Training (B/C)", ok: true },
  { label: "Unbegrenztes Plan verschieben", ok: true },
  { label: "Erweiterte Statistiken", ok: true },
  { label: "KI-Coach (Coming soon)", ok: true },
  { label: "Frühzugang zu neuen Features", ok: true },
];

function formatRemaining(n: number): string {
  if (!Number.isFinite(n)) return "∞";
  return String(Math.max(0, Math.floor(n)));
}

export default function PaywallModal(props: Props) {
  const {
    open,
    reason,
    onClose,
    isPro,
    adaptiveBCRemaining,
    planShiftRemaining,
    calendar7DaysRemaining,
    onStartTrial,
    onBuyMonthly,
    onBuyYearly,
    onRestore,
  } = props;

  if (!open) return null;

  const remainingLine = (() => {
    if (isPro) return "Pro aktiv – unbegrenzt freigeschaltet.";

    if (reason === "adaptive_limit")
      return `Verbleibend diesen Monat: ${formatRemaining(adaptiveBCRemaining)} (B/C)`;
    if (reason === "plan_shift")
      return `Verbleibend diesen Monat: ${formatRemaining(planShiftRemaining)} (Plan Shift)`;
    return `Verbleibend diesen Monat: ${formatRemaining(calendar7DaysRemaining)} (>7 Tage)`;
  })();

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0B0D12]/95 p-5 shadow-2xl backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-white/60">TrainQ Pro</div>
            <div className="text-lg font-semibold text-white">{reasonTitle(reason)}</div>
            <div className="mt-1 text-sm text-white/70 leading-snug">{reasonSubtitle(reason)}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
            aria-label="Close paywall"
            title="Schließen"
          >
            ✕
          </button>
        </div>

        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[12px] text-white/70">
          {remainingLine}
        </div>

        <div className="mt-4 space-y-2">
          {BULLETS.map((b) => (
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
                <div className="text-sm font-semibold text-white">Jährlich</div>
                <div className="text-[12px] text-white/65">79,99 € / Jahr · Best Value</div>
              </div>
              <span className="rounded-full bg-emerald-400/20 px-2 py-1 text-[11px] text-emerald-100">
                Empfohlen
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
                <div className="text-sm font-semibold text-white">Monatlich</div>
                <div className="text-[12px] text-white/65">9,99 € / Monat</div>
              </div>
            </div>
          </button>

          {/* Trial CTA (immer möglich als MVP CTA) */}
          <button
            type="button"
            onClick={onStartTrial}
            className="mt-1 w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-[#061226] hover:bg-blue-500/90"
          >
            Kostenlos testen
          </button>

          {typeof onRestore === "function" && (
            <button
              type="button"
              onClick={onRestore}
              className="w-full rounded-2xl border border-white/10 bg-transparent px-4 py-3 text-[12px] text-white/70 hover:bg-white/5"
            >
              Käufe wiederherstellen
            </button>
          )}
        </div>

        <div className="mt-4 text-[11px] text-white/45 leading-relaxed">
          Hinweis: In der MVP/Demo wird Pro lokal gespeichert. Für echte Käufe integrieren wir später In-App Purchases
          (App Store).
        </div>
      </div>
    </div>
  );
}