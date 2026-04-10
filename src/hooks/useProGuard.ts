// src/hooks/useProGuard.ts
// Monetization removed — all features are accessible

import { useCallback } from "react";

export function useProGuard(_userId?: string) {
  return useCallback((_reason: string, action?: () => void) => {
    action?.();
    return true;
  }, []);
}
