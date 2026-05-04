import { useEffect, useState, useCallback, useRef } from "react";
import { Keyboard } from "@capacitor/keyboard";
import { useModalStore } from "../../store/useModalStore";
import { useI18n } from "../../i18n/useI18n";

/**
 * Floating "Fertig" button — only shows for number inputs in Live Training.
 * The iOS numeric keyboard has no "Done" button, so we provide one.
 * Text/email/search keyboards already have their own return key.
 */
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
          checkAndShow();
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

  function checkAndShow() {
    const isLiveTraining = !!document.querySelector('[data-live-training]');
    if (!isLiveTraining) return;

    const active = document.activeElement as HTMLInputElement | null;
    if (!active) return;

    // Only show for number inputs (numeric keyboard has no Done key)
    const isNumberInput = active.tagName === 'INPUT' && active.type === 'number';
    if (isNumberInput) {
      setVisible(true);
    }
  }

  // Fallback: focus-based detection for when Capacitor plugin doesn't fire
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const isLiveTraining = !!document.querySelector('[data-live-training]');
      if (!isLiveTraining) return;

      const target = e.target as HTMLInputElement;
      if (!target?.tagName || target.tagName !== 'INPUT') return;

      // Only for number inputs — text inputs have their own return key
      if (target.type === 'number') {
        setVisible(true);
      } else {
        setVisible(false);
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
        top: "60%",
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
