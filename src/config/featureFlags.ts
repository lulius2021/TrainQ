// src/config/featureFlags.ts
// Feature flags for gating unreleased features.
// Flip to `true` when ready to ship.

export const FEATURE_FLAGS = {
  /** Garmin Connect integration (OAuth, sync, recovery metrics) */
  garmin: false,
  /** Haptic feedback (vibration on actions) */
  haptics: false,
  /** iOS Widgets & Live Activities (lock screen workout tracking) */
  widgets: false,
  /** Warm-up sets (auto-generated warm-up before working sets) */
  warmupSets: false,
} as const;
