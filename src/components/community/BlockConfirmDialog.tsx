import React, { useState } from "react";
import { AppButton } from "../ui/AppButton";
import { blockUser } from "../../services/community/api";
import { useI18n } from "../../i18n/useI18n";

interface Props {
  blockerId: string;
  blockedId: string;
  blockedName: string;
  onClose: () => void;
  onBlocked?: () => void;
}

export default function BlockConfirmDialog({ blockerId, blockedId, blockedName, onClose, onBlocked }: Props) {
  const { t } = useI18n();
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
          {t("community.block.title", { name: blockedName })}
        </h3>
        <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
          {t("community.block.description")}
        </p>
        <div className="flex gap-3">
          <AppButton onClick={onClose} variant="secondary" size="sm" className="flex-1">
            {t("common.cancel")}
          </AppButton>
          <AppButton onClick={handleBlock} variant="danger" size="sm" className="flex-1" isLoading={submitting}>
            {t("community.block.confirm")}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
