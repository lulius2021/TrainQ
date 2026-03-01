// src/components/nutrition/BarcodeScannerModal.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ScanBarcode, Search, Camera, AlertCircle } from "lucide-react";

const MotionDiv = motion.div as any;

interface BarcodeScannerModalProps {
  open: boolean;
  onScan: (ean: string) => void;
  onClose: () => void;
}

/**
 * Try to use the native MLKit barcode scanner.
 * Returns the scanned barcode string, or null if cancelled/unavailable.
 */
async function startNativeScan(): Promise<string | null> {
  try {
    const { BarcodeScanner } = await import(
      "@capacitor-mlkit/barcode-scanning"
    );

    // Check/request permission
    const permResult = await BarcodeScanner.requestPermissions();
    if (permResult.camera !== "granted") {
      return null;
    }

    // Check if supported (not available on web/simulator)
    const { supported } = await BarcodeScanner.isSupported();
    if (!supported) {
      return null;
    }

    // Start scanning — uses the native full-screen scanner
    const result = await BarcodeScanner.scan();

    if (result.barcodes && result.barcodes.length > 0) {
      return result.barcodes[0].rawValue || null;
    }

    return null;
  } catch {
    // Plugin not available (web), or user cancelled, or error
    return null;
  }
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  open,
  onScan,
  onClose,
}) => {
  const [ean, setEan] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [nativeAvailable, setNativeAvailable] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check native availability on open
  useEffect(() => {
    if (!open) return;
    setEan("");
    setLoading(false);
    setScanError(null);

    (async () => {
      try {
        const { BarcodeScanner } = await import(
          "@capacitor-mlkit/barcode-scanning"
        );
        const { supported } = await BarcodeScanner.isSupported();
        setNativeAvailable(supported);
      } catch {
        setNativeAvailable(false);
      }
    })();

    // Focus manual input after animation
    setTimeout(() => inputRef.current?.focus(), 400);
  }, [open]);

  // Lock scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleNativeScan = useCallback(async () => {
    setScanError(null);
    setLoading(true);
    const barcode = await startNativeScan();
    setLoading(false);

    if (barcode) {
      onScan(barcode);
    } else {
      setScanError("Scan abgebrochen oder nicht verfuegbar.");
    }
  }, [onScan]);

  const handleManualSearch = () => {
    const trimmed = ean.trim();
    if (!trimmed) return;
    setLoading(true);
    setScanError(null);
    onScan(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleManualSearch();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0 z-[10000] bg-[var(--bg-color)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Header */}
          <div className="pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-lg font-bold text-[var(--text-color)]">
                Barcode scannen
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={16} className="text-[var(--text-secondary)]" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center px-8 pt-8">
            {/* Native scan button */}
            <button
              onClick={handleNativeScan}
              disabled={loading || nativeAvailable === false}
              className="w-64 h-64 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-40 border-2 border-dashed border-[var(--border-color)]"
              style={{
                backgroundColor:
                  nativeAvailable !== false
                    ? "var(--card-bg)"
                    : "transparent",
              }}
            >
              {loading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-medium text-[var(--text-secondary)]">
                    Scanne...
                  </p>
                </div>
              ) : nativeAvailable === false ? (
                <div className="flex flex-col items-center gap-3">
                  <ScanBarcode
                    size={48}
                    className="text-[var(--text-secondary)] opacity-40"
                  />
                  <p className="text-xs text-[var(--text-secondary)] text-center px-4">
                    Kamera-Scan nicht verfuegbar (Simulator/Web)
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--accent-color)]/10 flex items-center justify-center">
                    <Camera
                      size={32}
                      className="text-[var(--accent-color)]"
                    />
                  </div>
                  <p className="text-sm font-bold text-[var(--text-color)]">
                    Kamera starten
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] text-center">
                    Halte den Barcode vor die Kamera
                  </p>
                </div>
              )}
            </button>

            {/* Error message */}
            {scanError && (
              <div className="flex items-center gap-2 mt-4 px-4 py-2.5 rounded-xl bg-red-500/10">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <p className="text-xs font-medium text-red-500">{scanError}</p>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 w-full max-w-xs my-6">
              <div className="flex-1 h-px bg-[var(--border-color)]" />
              <span className="text-xs font-medium text-[var(--text-secondary)]">
                oder EAN manuell eingeben
              </span>
              <div className="flex-1 h-px bg-[var(--border-color)]" />
            </div>

            {/* Manual EAN input */}
            <div className="w-full max-w-xs">
              <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] flex items-center gap-2 px-3 py-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={ean}
                  onChange={(e) =>
                    setEan(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  onKeyDown={handleKeyDown}
                  placeholder="EAN / Barcode-Nummer"
                  className="flex-1 bg-transparent text-sm text-[var(--text-color)] placeholder-[var(--text-secondary)] outline-none min-w-0 tabular-nums"
                  inputMode="numeric"
                  maxLength={13}
                  autoComplete="off"
                />
                <button
                  onClick={handleManualSearch}
                  disabled={!ean.trim() || loading}
                  className="px-4 py-2 rounded-xl bg-[var(--accent-color)] text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Search size={14} />
                  Suchen
                </button>
              </div>
            </div>
          </div>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};

export default BarcodeScannerModal;
