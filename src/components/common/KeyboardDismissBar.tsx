import { useEffect, useState } from "react";
import { Keyboard } from "@capacitor/keyboard";
import { useModalStore } from "../../store/useModalStore";

/**
 * Shows a "Fertig" button floating just above the iOS keyboard.
 * Uses @capacitor/keyboard events to get exact keyboard height in WKWebView.
 * Ghost-click protection via global shield in useModalStore.
 */
export function KeyboardDismissBar() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const activateShield = useModalStore((s) => s.activateShield);

  useEffect(() => {
    let showListener: any;
    let hideListener: any;

    const setup = async () => {
      showListener = await Keyboard.addListener("keyboardWillShow", (info) => {
        setKeyboardHeight(info.keyboardHeight);
      });
      hideListener = await Keyboard.addListener("keyboardWillHide", () => {
        setKeyboardHeight(0);
      });
    };

    setup();

    return () => {
      showListener?.remove();
      hideListener?.remove();
    };
  }, []);

  if (keyboardHeight === 0) return null;

  const dismiss = () => {
    activateShield();
    (document.activeElement as HTMLElement)?.blur();
    Keyboard.hide().catch(() => {});
  };

  return (
    <div
      className="fixed left-0 right-0 flex justify-end px-4 py-2 z-[9999]"
      style={{
        bottom: keyboardHeight,
        background: "var(--card-bg)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid var(--border-color)",
      }}
    >
      <button
        onPointerDown={(e) => { e.preventDefault(); dismiss(); }}
        className="text-[#007AFF] text-base font-semibold px-2 py-1 active:opacity-60"
      >
        Fertig
      </button>
    </div>
  );
}
