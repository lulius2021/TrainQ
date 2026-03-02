import { useState, useEffect, useCallback } from "react";
import { getSupabaseClient } from "../lib/supabaseClient";
import type { GarminConnectionStatus } from "../services/garmin/types";

export function useGarminConnection() {
  const [status, setStatus] = useState<GarminConnectionStatus>({ connected: false, garminUserId: null, lastSyncAt: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const checkStatus = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) { setLoading(false); return; }

    try {
      setLoading(true);
      const { data, error: err } = await supabase.functions.invoke("garmin-status");
      if (err) throw err;
      setStatus(data as GarminConnectionStatus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status check failed");
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
      const { data, error: err } = await supabase.functions.invoke("garmin-auth-init");
      if (err) throw err;

      const { authorizeUrl } = data as { authorizeUrl: string };

      // Open in system browser via Capacitor Browser plugin
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: authorizeUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
      setLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      setLoading(true);
      setError(null);
      const { error: err } = await supabase.functions.invoke("garmin-disconnect");
      if (err) throw err;
      setStatus({ connected: false, garminUserId: null, lastSyncAt: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
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
      const { data, error: err } = await supabase.functions.invoke("garmin-fetch-data");
      if (err) throw err;
      if (data?.skipped) {
        setError("Bitte warte ein paar Minuten vor der nächsten Synchronisation.");
        return;
      }
      await checkStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [checkStatus]);

  // Check status on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Listen for deep link callback
  useEffect(() => {
    const onConnected = () => {
      checkStatus();
    };
    window.addEventListener("trainq:garmin_connected", onConnected);
    return () => window.removeEventListener("trainq:garmin_connected", onConnected);
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
