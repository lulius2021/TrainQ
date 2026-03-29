// src/pages/CsvImportPage.tsx
// Full-page CSV import flow with steps: pick file, preview, import, summary.

import React from "react";
import { ChevronLeft, Upload, FileText, Loader2, AlertTriangle } from "lucide-react";
import { useI18n } from "../i18n/useI18n";
import { useCsvImport } from "../hooks/useCsvImport";
import CsvPreviewTable from "../components/import/CsvPreviewTable";
import CsvImportSummary from "../components/import/CsvImportSummary";

interface CsvImportPageProps {
  onBack: () => void;
}

const CsvImportPage: React.FC<CsvImportPageProps> = ({ onBack }) => {
  const { t } = useI18n();
  const { step, preview, result, error, pickFile, startImport, reset } = useCsvImport();

  return (
    <div className="flex flex-col h-full bg-[var(--bg-color)] text-[var(--text-color)] overflow-hidden">
      {/* HEADER */}
      <div className="pt-page px-6 pb-4 bg-[var(--bg-color)] shrink-0 z-10">
        <div className="flex items-center mb-2">
          <button
            onClick={() => {
              if (step === "preview") {
                reset();
              } else {
                onBack();
              }
            }}
            className="p-2 -ml-3 rounded-full hover:bg-[var(--button-bg)] transition-colors text-[var(--text-color)]"
          >
            <ChevronLeft size={32} />
          </button>
        </div>
        <h1 className="text-3xl font-bold text-[var(--text-color)] tracking-tight">
          {t("csvImport.title")}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t("csvImport.subtitle")}
        </p>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto px-4 scroll-pb">
        {/* STEP: IDLE - File picker */}
        {(step === "idle" || step === "picking") && (
          <div className="max-w-lg mx-auto space-y-6 pt-4">
            {/* Info card */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-3xl text-blue-300 text-sm space-y-2">
              <p className="font-semibold text-blue-400">{t("csvImport.supportedFormat")}</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li>{t("csvImport.format.csvOrTxt")}</li>
                <li>{t("csvImport.format.columns")}</li>
                <li>{t("csvImport.format.languages")}</li>
                <li>{t("csvImport.format.delimiters")}</li>
                <li>{t("csvImport.format.dateFormats")}</li>
              </ul>
            </div>

            {/* Example format */}
            <div className="p-4 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-3xl">
              <p className="text-xs text-[var(--text-secondary)] font-semibold mb-2 uppercase tracking-wider">
                {t("csvImport.example")}
              </p>
              <pre className="text-xs text-[var(--text-color)] font-mono leading-relaxed overflow-x-auto">
{`Datum;Uebung;Gewicht;Wiederholungen;Saetze
26.02.2026;Bankdruecken;80;8;3
26.02.2026;Kniebeugen;100;5;5
27.02.2026;Kreuzheben;120;5;3`}
              </pre>
            </div>

            {/* Pick file button */}
            <button
              onClick={pickFile}
              disabled={step === "picking"}
              className="w-full h-[52px] bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-3"
            >
              {step === "picking" ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Upload size={20} />
              )}
              {t("csvImport.pickFile")}
            </button>
          </div>
        )}

        {/* STEP: PARSING */}
        {step === "parsing" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="animate-spin text-blue-400" />
            <p className="text-[var(--text-secondary)]">{t("csvImport.parsing")}</p>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === "preview" && preview && (
          <div className="max-w-2xl mx-auto space-y-4 pt-2">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[var(--card-bg)] rounded-xl p-3 border border-[var(--border-color)] text-center">
                <div className="text-xl font-bold text-blue-400 tabular-nums">
                  {preview.rows.length}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t("csvImport.rows")}</div>
              </div>
              <div className="bg-[var(--card-bg)] rounded-xl p-3 border border-[var(--border-color)] text-center">
                <div className="text-xl font-bold text-green-400 tabular-nums">
                  {preview.totalWorkouts}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t("csvImport.workouts")}</div>
              </div>
              <div className="bg-[var(--card-bg)] rounded-xl p-3 border border-[var(--border-color)] text-center">
                <div className="text-xl font-bold text-purple-400 tabular-nums">
                  {preview.matchedExercises.size + preview.unmatchedExercises.length}
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">{t("csvImport.exercises")}</div>
              </div>
            </div>

            {/* Date range */}
            {preview.dateRange.from && (
              <div className="text-sm text-[var(--text-secondary)] text-center">
                {preview.dateRange.from} {t("csvImport.to")} {preview.dateRange.to}
              </div>
            )}

            {/* Warnings */}
            {preview.warnings.length > 0 && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                {preview.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-amber-300">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Unmatched exercises */}
            {preview.unmatchedExercises.length > 0 && (
              <div className="p-3 bg-[var(--card-bg)] border border-[var(--border-color)] rounded-xl">
                <p className="text-xs text-[var(--text-secondary)] font-semibold mb-1">
                  {t("csvImport.unmatchedExercises")}
                </p>
                <div className="flex flex-wrap gap-1">
                  {preview.unmatchedExercises.map((name, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded-md text-xs"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Preview table */}
            <CsvPreviewTable rows={preview.rows} matchedExercises={preview.matchedExercises} />

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={reset}
                className="flex-1 h-[52px] bg-[var(--card-bg)] text-[var(--text-color)] font-bold rounded-2xl border border-[var(--border-color)] transition-all active:scale-[0.98]"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={startImport}
                className="flex-1 h-[52px] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <FileText size={18} />
                {t("csvImport.import")}
              </button>
            </div>
          </div>
        )}

        {/* STEP: IMPORTING */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 size={40} className="animate-spin text-blue-400" />
            <p className="text-[var(--text-secondary)]">{t("csvImport.importing")}</p>
          </div>
        )}

        {/* STEP: DONE */}
        {step === "done" && result && (
          <div className="max-w-lg mx-auto space-y-6 pt-4">
            <CsvImportSummary result={result} dateRange={preview?.dateRange} />

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 h-[52px] bg-[var(--card-bg)] text-[var(--text-color)] font-bold rounded-2xl border border-[var(--border-color)] transition-all active:scale-[0.98]"
              >
                {t("csvImport.importAgain")}
              </button>
              <button
                onClick={onBack}
                className="flex-1 h-[52px] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98]"
              >
                {t("common.done")}
              </button>
            </div>
          </div>
        )}

        {/* STEP: ERROR */}
        {step === "error" && (
          <div className="max-w-lg mx-auto space-y-6 pt-4">
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <div className="flex items-center gap-3 mb-3">
                <AlertTriangle size={24} className="text-red-400" />
                <h3 className="font-bold text-red-400">{t("common.error")}</h3>
              </div>
              <p className="text-sm text-red-300">{error || t("csvImport.unknownError")}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={reset}
                className="flex-1 h-[52px] bg-[var(--card-bg)] text-[var(--text-color)] font-bold rounded-2xl border border-[var(--border-color)] transition-all active:scale-[0.98]"
              >
                {t("common.back")}
              </button>
              <button
                onClick={pickFile}
                className="flex-1 h-[52px] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-[0.98]"
              >
                {t("csvImport.otherFile")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CsvImportPage;
