import posthog from "posthog-js";

const enabled = !import.meta.env.DEV;

export function initAnalytics() {
  if (!enabled) return;

  posthog.init("phc_mCGqbmD8mDp5qVJPMKoqMd7wBxCjNNA9Y6Tr2BSrAcv3", {
    api_host: "https://eu.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    persistence: "localStorage",
    disable_session_recording: true,
  });
}

export type TrackEvent =
  | "app_opened"
  | "workout_started"
  | "workout_completed"
  | "calendar_viewed"
  | "adaptive_plan_viewed";

export function trackEvent(event: TrackEvent, properties?: Record<string, unknown>) {
  if (!enabled) return;
  posthog.capture(event, properties);
}

export function identifyUser(userId: string, traits?: Record<string, unknown>) {
  if (!enabled) return;
  posthog.identify(userId, traits);
}

export function resetAnalytics() {
  if (!enabled) return;
  posthog.reset();
}
