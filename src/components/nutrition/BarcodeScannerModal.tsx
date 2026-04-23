// src/components/nutrition/BarcodeScannerModal.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Camera, AlertCircle } from "lucide-react";
import { Capacitor } from "@capacitor/core";

import { scanBarcode } from "../../native/barcodeScanner";
import { searchFoodByName, type OFFSearchResult } from "../../features/nutrition/barcodeLookup";
import { BottomSheet } from "../common/BottomSheet";

type TabMode = "search" | "barcode";

interface BarcodeScannerModalProps {
  open: boolean;
  initialTab?: TabMode;
  onScan: (ean: string) => void;
  onSelectProduct: (product: OFFSearchResult) => void;
  onClose: () => void;
}

// ─── Native Camera Scanner Button ──────────────────────────────────────────

const NativeScannerButton: React.FC<{ onScan: (code: string) => void }> = ({ onScan }) => {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const code = await scanBarcode();
      if (code) {
        onScan(code);
      }
      // null = user cancelled or not on iOS — no error needed
    } catch (e: any) {
      const msg = String(e?.message || e || "");
      if (msg.includes("PERMISSION_DENIED")) {
        setError("Kamera-Zugriff verweigert. Bitte unter Einstellungen → TrainQ → Kamera aktivieren.");
      } else if (msg.includes("NO_CAMERA")) {
        setError("Keine Kamera verfügbar.");
      } else {
        setError(`Scanner-Fehler: ${msg}`);
      }
    } finally {
      setScanning(false);
    }
  }, [onScan]);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <button
        onClick={handleScan}
        disabled={scanning}
        className="w-full rounded-3xl flex flex-col items-center justify-center gap-3 py-12 transition-all active:scale-[0.97] disabled:opacity-60"
        style={{
          backgroundColor: "var(--card-bg)",
          border: "2px dashed var(--border-color)",
        }}
      >
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--accent-color)" }}>
          <Camera size={28} className="text-white" />
        </div>
        <span className="text-base font-bold" style={{ color: "var(--text-color)" }}>
          {scanning ? "Scanner öffnet..." : "Barcode scannen"}
        </span>
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Kamera öffnet sich automatisch
        </span>
      </button>
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl w-full" style={{ backgroundColor: "rgba(255,59,48,0.1)" }}>
          <AlertCircle size={16} style={{ color: "#FF3B30" }} />
          <p className="text-xs" style={{ color: "#FF3B30" }}>{error}</p>
        </div>
      )}
    </div>
  );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  open,
  initialTab = "search",
  onScan,
  onSelectProduct,
  onClose,
}) => {
  const [tab, setTab] = useState<TabMode>("search");
  const [query, setQuery] = useState("");
  const [ean, setEan] = useState("");
  const [results, setResults] = useState<OFFSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const eanRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setEan("");
    setResults([]);
    setSearching(false);
    setTab(initialTab);
    const ref = initialTab === "barcode" ? eanRef : searchRef;
    setTimeout(() => ref.current?.focus(), 400);
  }, [open]);

  // Lock scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setSearching(false); return; }
    setSearching(true);
    const res = await searchFoodByName(q, 20);
    setResults(res);
    setSearching(false);
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleManualEan = () => {
    const trimmed = ean.trim();
    if (!trimmed) return;
    onScan(trimmed);
  };

  const handleScan = useCallback((code: string) => {
    onScan(code);
  }, [onScan]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      height="92dvh"
      showHandle
      header={
        <div className="px-5 pb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--text-color)" }}>Barcode scannen</h2>
        </div>
      }
      contentClassName="flex-1 min-h-0 overflow-y-auto px-5 pb-8"
    >
      <div className="flex flex-col items-center gap-5">
        <NativeScannerButton onScan={handleScan} />

        {/* Divider */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-[var(--border-color)]" />
          <span className="text-xs font-medium text-[var(--text-secondary)]">oder EAN eingeben</span>
          <div className="flex-1 h-px bg-[var(--border-color)]" />
        </div>

        {/* Manual EAN */}
        <div className="w-full">
          <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] flex items-center gap-2 px-3 py-2">
            <input
              ref={eanRef}
              type="text"
              value={ean}
              onChange={(e) => setEan(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleManualEan(); } }}
              placeholder="EAN / Barcode-Nummer"
              className="flex-1 bg-transparent text-sm text-[var(--text-color)] placeholder-[var(--text-secondary)] outline-none min-w-0 tabular-nums"
              inputMode="numeric"
              maxLength={13}
              autoComplete="off"
            />
            <button
              onClick={handleManualEan}
              disabled={!ean.trim()}
              className="px-4 py-2 rounded-xl bg-[var(--accent-color)] text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 flex items-center gap-1.5"
            >
              <Search size={14} />
              Suchen
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

export default BarcodeScannerModal;
