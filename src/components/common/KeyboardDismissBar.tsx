import { useEffect, useState, useCallback } from "react";
import { Keyboard } from "@capacitor/keyboard";
import { useModalStore } from "../../store/useModalStore";
import { useI18n } from "../../i18n/useI18n";

export function KeyboardDismissBar() {
  const [visible, setVisible] = useState(false);
  const activateShield = useModalStore((s) => s.activateShield);
  const { t } = useI18n();

  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      // Only show in live training context
      const isLiveTraining = !!document.querySelector('[data-live-training]');
      if (!isLiveTraining) return;

      const target = e.target as HTMLElement;
      if (!target?.tagName) return;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        setVisible(true);
      }
    };

    const onBlur = () => {
      setTimeout(() => {
        const active = document.activeElement;
        if (!active || active === document.body) {
          setVisible(false);
        }
      }, 150);
    };

    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
    };
  }, []);

  const dismiss = useCallback(() => {
    activateShield();
    (document.activeElement as HTMLElement)?.blur();
    Keyboard.hide().catch(() => {});
    setVisible(false);
  }, [activateShield]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onPointerDown={(e) => { e.preventDefault(); dismiss(); }}
      className="fixed z-[9999] active:scale-95 transition-transform"
      style={{
        right: 16,
        // Positioned between content and keyboard — 61% keeps it visible
        // above the iOS keyboard (~40% of screen) while not overlapping header
        top: "61%",
        transform: "translateY(-50%)",
        backgroundColor: "var(--accent-color, #007AFF)",
        color: "#fff",
        fontSize: 14,
        fontWeight: 600,
        borderRadius: 10,
        padding: "10px 20px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
        border: "none",
      }}
    >
      {t("common.done")}
    </button>
  );
}
