import * as Sentry from "@sentry/react";

const enabled = !import.meta.env.DEV;

export function initSentry() {
  if (!enabled) return;

  Sentry.init({
    dsn: "https://e19f546bdb90494a446eac53522da9bc@o4511371770331136.ingest.de.sentry.io/4511371772821584",
    environment: "production",
    sendDefaultPii: false,
    enabled: true,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value ?? "";
      if (msg.includes("ResizeObserver")) return null;
      if (msg.includes("FetchError") || msg.includes("Failed to fetch")) return null;
      return event;
    },
    integrations: [
      Sentry.browserTracingIntegration(),
    ],
  });
}

export function captureError(error: unknown, context?: Record<string, unknown>) {
  if (!enabled) {
    console.error("[Sentry disabled]", error);
    return;
  }
  Sentry.captureException(error, { extra: context });
}

export function setSentryUser(user: { id: string } | null) {
  if (!enabled) return;
  Sentry.setUser(user ? { id: user.id } : null);
}

export { Sentry };
