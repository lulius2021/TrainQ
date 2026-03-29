import React, { useState } from "react";
import { AppButton } from "../ui/AppButton";
import { blockUser } from "../../services/community/api";

interface Props {
  blockerId: string;
  blockedId: string;
  blockedName: string;
  onClose: () => void;
  onBlocked?: () => void;
}

export default function BlockConfirmDialog({ blockerId, blockedId, blockedName, onClose, onBlocked }: Props) {
  const [submitting, setSubmitting] = useState(false);

  const handleBlock = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await blockUser(blockerId, blockedId);
      onBlocked?.();
      onClose();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }} onPointerDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); onClose(); } }}>
      <div
        className="w-[85%] max-w-sm rounded-2xl p-5"
        style={{ background: "var(--card-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-base mb-2" style={{ color: "var(--text-color)" }}>
          {blockedName} blockieren?
        </h3>
        <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
          Blockierte Nutzer können deine Beiträge nicht sehen und dir nicht folgen. Du siehst auch deren Inhalte nicht mehr.
        </p>
        <div className="flex gap-3">
          <AppButton onClick={onClose} variant="secondary" size="sm" className="flex-1">
            Abbrechen
          </AppButton>
          <AppButton onClick={handleBlock} variant="danger" size="sm" className="flex-1" isLoading={submitting}>
            Blockieren
          </AppButton>
        </div>
      </div>
    </div>
  );
}
