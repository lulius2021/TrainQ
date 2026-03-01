// src/components/import/CsvImportSummary.tsx
// Summary card showing import results.

import React from "react";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { CsvImportResult } from "../../types/csvImport";

interface CsvImportSummaryProps {
  result: CsvImportResult;
  dateRange?: { from: string; to: string };
}

const CsvImportSummary: React.FC<CsvImportSummaryProps> = ({ result, dateRange }) => {
  const hasErrors = result.errors.length > 0;
  const allSkipped = result.importedCount === 0 && result.skippedCount > 0;

  return (
    <div className="space-y-4">
      {/* Main result card */}
      <div
        className={`p-6 rounded-2xl border ${
          hasErrors
            ? "bg-red-500/10 border-red-500/20"
            : allSkipped
              ? "bg-amber-500/10 border-amber-500/20"
              : "bg-green-500/10 border-green-500/20"
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          {hasErrors ? (
            <XCircle size={28} className="text-red-400" />
          ) : allSkipped ? (
            <AlertTriangle size={28} className="text-amber-400" />
          ) : (
            <CheckCircle size={28} className="text-green-400" />
          )}
          <h3 className="text-lg font-bold text-[var(--text-color)]">
            {hasErrors
              ? "Import mit Fehlern"
              : allSkipped
                ? "Alle Eintraege bereits vorhanden"
                : "Import erfolgreich"}
          </h3>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[var(--card-bg)] rounded-xl p-3 border border-[var(--border-color)]">
            <div className="text-2xl font-bold text-green-400 tabular-nums">
              {result.importedCount}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Saetze importiert
            </div>
          </div>

          <div className="bg-[var(--card-bg)] rounded-xl p-3 border border-[var(--border-color)]">
            <div className="text-2xl font-bold text-amber-400 tabular-nums">
              {result.skippedCount}
            </div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              Saetze uebersprungen
            </div>
          </div>
        </div>

        {/* Date range */}
        {dateRange && dateRange.from && dateRange.to && (
          <div className="mt-3 text-sm text-[var(--text-secondary)]">
            Zeitraum: {dateRange.from} bis {dateRange.to}
          </div>
        )}
      </div>

      {/* Errors */}
      {hasErrors && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <h4 className="font-bold text-red-400 text-sm mb-2">Fehler:</h4>
          <ul className="space-y-1">
            {result.errors.map((err, idx) => (
              <li key={idx} className="text-xs text-red-300">
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CsvImportSummary;
