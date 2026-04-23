import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { FEATURE_FLAGS } from "../config/featureFlags";

// ─── Haptic Preference ──────────────────────────────────────────────────────
// Cached in memory — no localStorage read on every tap.
// SettingPage calls `setHapticEnabled(bool)` when the user toggles.

const isNative = FEATURE_FLAGS.haptics && Capacitor.isNativePlatform();

let _enabled = true;
try {
  const stored = localStorage.getItem("trainq_pref_haptic");
  _enabled = stored !== "false";
} catch { /* default true */ }

/** Call from SettingPage when the user toggles haptics. */
export function setHapticEnabled(on: boolean): void {
  _enabled = on;
  try { localStorage.setItem("trainq_pref_haptic", String(on)); } catch { /* ignore */ }
}

// ─── Semantic Haptic API ───────────────────────────────────────────────────────
// All haptic calls in the app go through these functions — never raw Haptics calls.
// Fires synchronously on native, silently no-ops on web.

export const hapticLight      = () => { if (_enabled && isNative) Haptics.impact({ style: ImpactStyle.Light  }).catch(() => {}); };
export const hapticMedium     = () => { if (_enabled && isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {}); };
export const hapticHeavy      = () => { if (_enabled && isNative) Haptics.impact({ style: ImpactStyle.Heavy  }).catch(() => {}); };
export const hapticSuccess    = () => { if (_enabled && isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {}); };
export const hapticError      = () => { if (_enabled && isNative) Haptics.notification({ type: NotificationType.Error   }).catch(() => {}); };
export const hapticWarning    = () => { if (_enabled && isNative) Haptics.notification({ type: NotificationType.Warning }).catch(() => {}); };

// Semantic aliases — use these in UI code for clarity
export const hapticButton     = hapticLight;   // standard tap: button, tab, chip
export const hapticSelect     = hapticLight;   // segment, radio, checkbox, picker item
export const hapticDestructive = hapticHeavy;  // delete / irreversible action
export const hapticSheetClose = hapticLight;   // swipe-to-dismiss sheet
export const hapticToggle     = hapticLight;   // toggle switch flip
