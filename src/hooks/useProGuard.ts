// src/hooks/useProGuard.ts
import { useCallback } from "react";
import type { PaywallReason } from "../utils/entitlements";
import { useEntitlements } from "./useEntitlements";

export function useProGuard(userId?: string) {
  const { isPro } = useEntitlements(userId);

  return useCallback(
    (reason: PaywallReason, action?: () => void) => {
      if (isPro) {
        action?.();
        return true;
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("trainq:open_paywall", { detail: { reason } }));
      }
      return false;
    },
    [isPro]
  );
}
