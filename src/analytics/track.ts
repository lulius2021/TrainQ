type EventName =
  | "monetization_paywall_viewed"
  | "monetization_upgrade_clicked"
  | "monetization_purchase_success"
  | "monetization_purchase_failed"
  | "monetization_restore_success"
  | "feature_blocked"
  | "feature_used"
  | "robot_detail_opened"
  | "robot_detail_closed"
  | "robot_stage_scrolled";

type EventPayload = Record<string, string | number | boolean | undefined>;

export function track(event: EventName, payload?: EventPayload): void {
  // TODO: Replace with Segment/Firebase/Mixpanel
  if (typeof console !== "undefined") {
    console.log(`[analytics] ${event}`, payload ?? {});
  }
}
