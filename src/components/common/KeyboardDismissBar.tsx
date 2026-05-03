import { useEffect, useState, useCallback, useRef } from "react";
import { Keyboard } from "@capacitor/keyboard";
import { useModalStore } from "../../store/useModalStore";
import { useI18n } from "../../i18n/useI18n";

export function KeyboardDismissBar() {
  const [visible, setVisible] = useState(false);
  const keyboardOpen = useRef(false);
  const activateShield = useModalStore((s) => s.activateShield);
  const { t } = useI18n();

  // Track actual keyboard state via Capacitor plugin
  useEffect(() => {
    let showListener: any;
    let hideListener: any;

    const setup = async () => {
      try {
        showListener = await Keyboard.addListener("keyboardWillShow", () => {
          keyboardOpen.current = true;
          const isLiveTraining = !!document.querySelector('[data-live-training]');
          if (isLiveTraining) setVisible(true);
        });
        hideListener = await Keyboard.addListener("keyboardWillHide", () => {
          keyboardOpen.current = false;
          setVisible(false);
        });
      } catch {}
    };

    setup();
    return () => { showListener?.remove(); hideListener?.remove(); };
  }, []);

  // Fallback: focus-based detection for when Capacitor plugin doesn't fire
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const isLiveTraining = !!document.querySelector('[data-live-training]');
      if (!isLiveTraining) return;

      const target = e.target as HTMLElement;
      if (!target?.tagName) return;
      const tag = target.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        // Only show if we believe keyboard is open (give it a moment)
        setTimeout(() => {
          if (keyboardOpen.current) setVisible(true);
        }, 400);
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
