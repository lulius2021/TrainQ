// src/components/nutrition/BarcodeScannerModal.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ScanBarcode, Search, Camera, AlertCircle, Loader2 } from "lucide-react";

import { scanBarcode } from "../../native/barcodeScanner";
import { searchFoodByName, type OFFSearchResult } from "../../features/nutrition/barcodeLookup";

const MotionDiv = motion.div as any;

type TabMode = "search" | "barcode";

interface BarcodeScannerModalProps {
  open: boolean;
  initialTab?: TabMode;
  onScan: (ean: string) => void;
  onSelectProduct: (product: OFFSearchResult) => void;
  onClose: () => void;
}

// ─── Native Barcode Scanner Button ────────────────────────────────────────────

const NativeScanButton: React.FC<{ onScan: (code: string) => void }> = ({ onScan }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async () => {
    setError(null);
    setScanning(true);
    try {
      const code = await scanBarcode();
      if (code) {
        onScan(code);
      }
      // null = user cancelled, no error shown
    } catch (e: any) {
      if (e?.code === "ERR_NO_CAMERA") {
        setError("Kamera nicht verfügbar. Bitte auf echtem Gerät nutzen.");
      } else if (e?.code === "ERR_PERMISSION_DENIED") {
        setError("Kamera-Zugriff verweigert. Bitte unter Einstellungen → TrainQ → Kamera aktivieren.");
      } else {
        setError("Scan fehlgeschlagen. Bitte erneut versuchen.");
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={handleScan}
        disabled={scanning}
        className="w-56 h-56 rounded-3xl flex flex-col items-center justify-center gap-3 bg-[var(--card-bg)] border-2 border-[var(--border-color)] active:scale-95 transition-transform disabled:opacity-60"
      >
        {scanning ? (
          <Loader2 size={44} className="animate-spin text-[var(--accent-color)]" />
        ) : (
          <Camera size={44} className="text-[var(--accent-color)]" />
        )}
        <span className="text-sm font-semibold text-[var(--text-color)]">
          {scanning ? "Scannen..." : "Kamera öffnen"}
        </span>
      </button>
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-500/10 max-w-xs w-full">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-500">{error}</p>
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
    <AnimatePresence>
      {open && (
        <MotionDiv
          className="fixed inset-0 z-[10000] bg-[var(--bg-color)] flex flex-col"
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
        >
          {/* Header */}
          <div className="pt-[env(safe-area-inset-top)]">
            <div className="flex items-center justify-between px-5 py-3">
              <h2 className="text-lg font-bold text-[var(--text-color)]">Lebensmittel finden</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-[var(--border-color)] flex items-center justify-center active:scale-90 transition-transform"
              >
                <X size={16} className="text-[var(--text-secondary)]" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mx-5 p-1 rounded-xl bg-[var(--border-color)]/40">
              <button
                onClick={() => { setTab("search"); setTimeout(() => searchRef.current?.focus(), 100); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "search" ? "bg-[var(--accent-color)] text-white shadow-sm" : "text-[var(--text-secondary)]"}`}
              >
                <Search size={14} className="inline mr-1.5 -mt-0.5" />
                Suche
              </button>
              <button
                onClick={() => { setTab("barcode"); setTimeout(() => eanRef.current?.focus(), 100); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === "barcode" ? "bg-[var(--accent-color)] text-white shadow-sm" : "text-[var(--text-secondary)]"}`}
              >
                <ScanBarcode size={14} className="inline mr-1.5 -mt-0.5" />
                Barcode
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-[env(safe-area-inset-bottom)]">
            {tab === "search" ? (
              <>
                <div className="bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] flex items-center gap-2 px-3 py-2">
                  <Search size={16} className="text-[var(--text-secondary)] shrink-0" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="z.B. Nutella, Skyr, Haferflocken..."
                    className="flex-1 bg-transparent text-sm text-[var(--text-color)] placeholder-[var(--text-secondary)] outline-none min-w-0"
                    autoComplete="off"
                    autoCapitalize="off"
                  />
                  {query && (
                    <button onClick={() => { setQuery(""); setResults([]); }} className="p-1">
                      <X size={14} className="text-[var(--text-secondary)]" />
                    </button>
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {searching && (
                    <div className="flex items-center justify-center py-8 gap-2">
                      <Loader2 size={18} className="animate-spin text-[var(--accent-color)]" />
                      <span className="text-sm text-[var(--text-secondary)]">Suche...</span>
                    </div>
                  )}
                  {!searching && query.trim().length >= 2 && results.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-[var(--text-secondary)]">Keine Ergebnisse gefunden</p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">Versuche einen anderen Suchbegriff</p>
                    </div>
                  )}
                  {!searching && results.map((r, i) => (
                    <button
                      key={`${r.ean}-${i}`}
                      onClick={() => onSelectProduct(r)}
                      className="w-full text-left bg-[var(--card-bg)] rounded-2xl border border-[var(--border-color)] p-3.5 active:scale-[0.98] transition-transform"
                    >
                      <div className="flex items-start gap-3">
                        {r.imageUrl ? (
                          <img src={r.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover bg-[var(--border-color)]" loading="lazy" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-[var(--border-color)]/50 flex items-center justify-center shrink-0">
                            <Search size={16} className="text-[var(--text-secondary)]" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-color)] truncate">{r.name}</p>
                          {r.brand && <p className="text-xs text-[var(--text-secondary)] truncate">{r.brand}</p>}
                          <div className="flex gap-3 mt-1.5">
                            <span className="text-xs font-bold text-[var(--accent-color)]">{r.per100g.kcal} kcal</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">P {r.per100g.protein}g</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">K {r.per100g.carbs}g</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">F {r.per100g.fat}g</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Barcode tab */
              <div className="flex flex-col items-center gap-5">
                <NativeScanButton onScan={handleScan} />

                {/* Divider */}
                <div className="flex items-center gap-3 w-full max-w-xs">
                  <div className="flex-1 h-px bg-[var(--border-color)]" />
                  <span className="text-xs font-medium text-[var(--text-secondary)]">oder EAN eingeben</span>
                  <div className="flex-1 h-px bg-[var(--border-color)]" />
                </div>

                {/* Manual EAN */}
                <div className="w-full max-w-xs">
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
            )}
          </div>
        </MotionDiv>
      )}
    </AnimatePresence>
  );
};

export default BarcodeScannerModal;
