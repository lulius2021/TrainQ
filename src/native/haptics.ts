import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

// ─── Semantic Haptic API ───────────────────────────────────────────────────────
// All haptic calls in the app go through these functions — never raw Haptics calls.
// .catch(() => {}) silences errors on web/Android where haptics may not be available.

export const hapticLight      = () => Haptics.impact({ style: ImpactStyle.Light  }).catch(() => {});
export const hapticMedium     = () => Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
export const hapticHeavy      = () => Haptics.impact({ style: ImpactStyle.Heavy  }).catch(() => {});
export const hapticSuccess    = () => Haptics.notification({ type: NotificationType.Success }).catch(() => {});
export const hapticError      = () => Haptics.notification({ type: NotificationType.Error   }).catch(() => {});
export const hapticWarning    = () => Haptics.notification({ type: NotificationType.Warning }).catch(() => {});

// Semantic aliases — use these in UI code for clarity
export const hapticButton     = hapticLight;   // standard tap: button, tab, chip
export const hapticSelect     = hapticLight;   // segment, radio, checkbox, picker item
export const hapticDestructive = hapticHeavy;  // delete / irreversible action
export const hapticSheetClose = hapticLight;   // swipe-to-dismiss sheet
export const hapticToggle     = hapticLight;   // toggle switch flip
