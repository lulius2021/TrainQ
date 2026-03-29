import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { getSupabaseClient } from "../lib/supabaseClient";
import type { GarminConnectionStatus } from "../services/garmin/types";

const TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Zeitüberschreitung — bitte prüfe deine Verbindung.")), ms)
    ),
  ]);
}

export function useGarminConnection() {
  const [status, setStatus] = useState<GarminConnectionStatus>({ connected: false, garminUserId: null, lastSyncAt: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const checkStatus = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) { setLoading(false); return; }

    try {
      setLoading(true);
      const { data, error: err } = await withTimeout(
        supabase.functions.invoke("garmin-status"),
        TIMEOUT_MS
      );
      if (err) throw err;
      setStatus(data as GarminConnectionStatus);
      setError(null);
    } catch (e) {
      // Silently ignore status check errors — show as disconnected
      setStatus({ connected: false, garminUserId: null, lastSyncAt: null });
    } finally {
      setLoading(false);
    }
  }, []);

  const connect = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      setLoading(true);
      setError(null);
      const { data, error: err } = await withTimeout(
        supabase.functions.invoke("garmin-auth-init"),
        TIMEOUT_MS
      );
      if (err) throw err;
      if (data?.error) throw new Error(data.error);

      const { authorizeUrl } = data as { authorizeUrl: string };
      if (!authorizeUrl) throw new Error("Keine Authorize-URL erhalten");

      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: authorizeUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verbindung fehlgeschlagen");
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
      const { error: err } = await withTimeout(
        supabase.functions.invoke("garmin-disconnect"),
        TIMEOUT_MS
      );
      if (err) throw err;
      setStatus({ connected: false, garminUserId: null, lastSyncAt: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trennung fehlgeschlagen");
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
      const { data, error: err } = await withTimeout(
        supabase.functions.invoke("garmin-fetch-data"),
        TIMEOUT_MS
      );
      if (err) throw err;
      if (data?.skipped) {
        setError("Bitte warte ein paar Minuten vor der nächsten Synchronisation.");
        return;
      }
      await checkStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync fehlgeschlagen");
    } finally {
      setSyncing(false);
    }
  }, [checkStatus]);

  // Check status on mount (non-blocking — don't show global loading)
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen for deep link callback — both custom event and Capacitor appUrlOpen
  useEffect(() => {
    const onConnected = () => { checkStatus(); };
    window.addEventListener("trainq:garmin_connected", onConnected);

    let removeAppListener: (() => void) | null = null;
    if (Capacitor.isNativePlatform()) {
      import("@capacitor/app").then(({ App }) => {
        App.addListener("appUrlOpen", (event: { url: string }) => {
          if (event.url.includes("garmin")) {
            window.dispatchEvent(new CustomEvent("trainq:garmin_connected"));
          }
        }).then((handle) => {
          removeAppListener = () => handle.remove();
        });
      });
    }

    return () => {
      window.removeEventListener("trainq:garmin_connected", onConnected);
      removeAppListener?.();
    };
  }, [checkStatus]);

  return {
    connected: status.connected,
    garminUserId: status.garminUserId,
    lastSyncAt: status.lastSyncAt,
    loading,
    syncing,
    error,
    connect,
    disconnect,
    fetchLatest,
    checkStatus,
  };
}
