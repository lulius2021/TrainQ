import { useState, useEffect, useCallback } from "react";
import i18next from "i18next";
import { getSupabaseClient } from "../lib/supabaseClient";
import type { GarminConnectionStatus } from "../services/garmin/types";

const TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(i18next.t("garmin.error.timeout"))), ms)
    ),
  ]);
}

export function useGarminConnection() {
  const [status, setStatus] = useState<GarminConnectionStatus>({ connected: false, garminUserId: null, lastSyncAt: null });
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const checkStatus = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) { setStatusLoading(false); return; }

    try {
      setStatusLoading(true);
      const { data, error: err } = await withTimeout(
        supabase.functions.invoke("garmin-status"),
        TIMEOUT_MS
      );
      if (err) throw err;
      setStatus(data as GarminConnectionStatus);
    } catch (e) {
      // Silently ignore status check errors — show as disconnected
      setStatus({ connected: false, garminUserId: null, lastSyncAt: null });
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      setLoading(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError(i18next.t("garmin.error.noSession"));
        return;
      }
      const { data, error: err } = await withTimeout(
        supabase.functions.invoke("garmin-auth-init", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        TIMEOUT_MS
      );
      if (err) throw err;
      if (data?.error) throw new Error(data.error);

      const { authorizeUrl } = data as { authorizeUrl: string };
      if (!authorizeUrl) throw new Error(i18next.t("garmin.error.noAuthorizeUrl"));

      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: authorizeUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : i18next.t("garmin.error.connectFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      setLoading(true);
      setError(null);
      const { data: { session: discSession } } = await supabase.auth.getSession();
      if (!discSession) {
        setError(i18next.t("garmin.error.noSession"));
        return;
      }
      const { error: err } = await withTimeout(
        supabase.functions.invoke("garmin-disconnect", {
          headers: { Authorization: `Bearer ${discSession.access_token}` },
        }),
        TIMEOUT_MS
      );
      if (err) throw err;
      setStatus({ connected: false, garminUserId: null, lastSyncAt: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : i18next.t("garmin.error.disconnectFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLatest = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      setSyncing(true);
      setError(null);
      const { data: { session: syncSession } } = await supabase.auth.getSession();
      if (!syncSession) {
        setError(i18next.t("garmin.error.noSession"));
        return;
      }
      const { data, error: err } = await withTimeout(
        supabase.functions.invoke("garmin-fetch-data", {
          headers: { Authorization: `Bearer ${syncSession.access_token}` },
        }),
        TIMEOUT_MS
      );
      if (err) throw err;
      if (data?.skipped) {
        setError(i18next.t("garmin.error.syncCooldown"));
        return;
      }
      await checkStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : i18next.t("garmin.error.syncFailed"));
    } finally {
      setSyncing(false);
    }
  }, [checkStatus]);

  // Check status on mount (non-blocking — don't show global loading)
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen for deep link callback via custom events dispatched by MainAppShell
  useEffect(() => {
    const onConnected = () => { checkStatus(); };
    const onError = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      const raw = detail?.message ?? i18next.t("garmin.error.connectionFailed");
      setError(decodeURIComponent(raw));
    };

    window.addEventListener("trainq:garmin_connected", onConnected);
    window.addEventListener("trainq:garmin_error", onError);

    return () => {
      window.removeEventListener("trainq:garmin_connected", onConnected);
      window.removeEventListener("trainq:garmin_error", onError);
    };
  }, [checkStatus]);

  return {
    connected: status.connected,
    garminUserId: status.garminUserId,
    lastSyncAt: status.lastSyncAt,
    loading,
    statusLoading,
    syncing,
    error,
    connect,
    disconnect,
    fetchLatest,
    checkStatus,
  };
}
