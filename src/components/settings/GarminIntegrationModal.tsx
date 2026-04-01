import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence } from "framer-motion";
import { MotionDiv } from "../ui/Motion";
import { X, RefreshCw, Unlink, Link, Loader2, AlertCircle } from "lucide-react";
import { useGarminConnection } from "../../hooks/useGarminConnection";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function GarminIntegrationModal({ isOpen, onClose }: Props) {
  const { t } = useTranslation();
  const { connected, garminUserId, lastSyncAt, loading, statusLoading, syncing, error, connect, disconnect, fetchLatest } = useGarminConnection();
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  useBodyScrollLock(isOpen);

  const handleDisconnect = async () => {
    setShowDisconnectConfirm(false);
    await disconnect();
  };

  const formattedLastSync = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[160] bg-black/60 backdrop-blur-md"
          />

          <MotionDiv
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.9 }}
            className="fixed inset-x-0 bottom-0 z-[170] h-[92vh] rounded-t-[32px] bg-[var(--modal-bg)] overflow-hidden flex flex-col border-t border-[var(--border-color)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)] bg-[var(--modal-header)] z-10">
              <h2 className="text-xl font-bold text-[var(--text-color)]">Garmin Connect</h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 bg-[var(--button-bg)] rounded-full hover:opacity-80 text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 pb-40 space-y-6">
              {/* Status Card */}
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--card-bg)] p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-base font-semibold text-[var(--text-color)]">Status</span>
                  {statusLoading ? (
                    <span className="flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full bg-zinc-500/20 text-zinc-400">
                      <Loader2 size={13} className="animate-spin" />
                      {t("common.loading", "Laden...")}
                    </span>
                  ) : (
                    <span className={`text-sm font-medium px-3 py-1 rounded-full ${connected ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-500/20 text-zinc-400"}`}>
                      {connected ? t("settings.integrations.connected") : t("settings.integrations.notConnected")}
                    </span>
                  )}
                </div>

                {connected && garminUserId && (
                  <div className="text-sm text-[var(--text-secondary)] mb-2">
                    {t("settings.integrations.userId", "Garmin ID")}: {garminUserId}
                  </div>
                )}

                {connected && formattedLastSync && (
                  <div className="text-sm text-[var(--text-secondary)]">
                    {t("settings.integrations.lastSync", "Letzte Sync")}: {formattedLastSync}
                  </div>
                )}

                <p className="text-sm text-[var(--text-secondary)] mt-3">
                  {t("settings.integrations.syncNote")}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                  <AlertCircle size={20} className="text-red-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                {!connected ? (
                  <button
                    onClick={connect}
                    disabled={loading}
                    className="w-full h-14 rounded-2xl bg-emerald-600 text-white font-bold text-[17px] flex items-center justify-center gap-2 active:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {loading ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Link size={20} />
                    )}
                    {loading ? t("settings.integrations.connecting", "Verbinde...") : t("settings.integrations.connect")}
                  </button>
                ) : (
                  <>
                    {/* Sync Now */}
                    <button
                      onClick={fetchLatest}
                      disabled={syncing || loading}
                      className="w-full h-14 rounded-2xl bg-[var(--accent-color)] text-white font-bold text-[17px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50 transition-colors"
                    >
                      {syncing ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <RefreshCw size={20} />
                      )}
                      {syncing ? t("settings.integrations.syncing", "Synchronisiere...") : t("settings.integrations.syncNow", "Jetzt synchronisieren")}
                    </button>

                    {/* Disconnect */}
                    <button
                      onClick={() => setShowDisconnectConfirm(true)}
                      disabled={loading}
                      className="w-full h-14 rounded-2xl border border-red-500/50 text-red-500 font-bold text-[17px] flex items-center justify-center gap-2 active:bg-red-500/10 disabled:opacity-50 transition-colors"
                    >
                      <Unlink size={20} />
                      {t("settings.integrations.disconnect")}
                    </button>
                  </>
                )}
              </div>

              {/* Disconnect Confirmation */}
              {showDisconnectConfirm && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 space-y-4">
                  <p className="text-base font-medium text-[var(--text-color)]">
                    {t("settings.confirm.disconnectGarmin")}
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDisconnectConfirm(false)}
                      className="flex-1 h-12 rounded-xl border border-[var(--border-color)] text-[var(--text-color)] font-medium"
                    >
                      {t("common.cancel", "Abbrechen")}
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="flex-1 h-12 rounded-xl bg-red-600 text-white font-medium"
                    >
                      {t("settings.integrations.disconnect")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </MotionDiv>
        </>
      )}
    </AnimatePresence>
  );
}
