// src/hooks/useCsvImport.ts
// Multi-step CSV import flow hook.

import { useState, useCallback } from "react";
import type { CsvImportStep, CsvImportPreview, CsvImportResult } from "../types/csvImport";
import { parseCsvForImport, executeImport } from "../utils/csvImport";
import { useI18n } from "../i18n/useI18n";

export function useCsvImport() {
  const { t } = useI18n();
  const [step, setStep] = useState<CsvImportStep>("idle");
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickFile = useCallback(() => {
    setStep("picking");
    setError(null);

    // Create a visually-hidden file input and trigger it.
    // NOTE: We use opacity/position instead of display:none because iOS WKWebView
    // does not reliably fire the 'change' event on display:none inputs.
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.style.cssText =
      "position:fixed;top:0;left:0;opacity:0;pointer-events:none;width:1px;height:1px;";

    let settled = false;

    const cleanup = () => {
      input.removeEventListener("change", handleChange);
      input.removeEventListener("cancel", handleCancel);
      input.remove();
    };

    const handleChange = () => {
      if (settled) return;
      settled = true;

      const file = input.files?.[0];
      if (!file) {
        setStep("idle");
        cleanup();
        return;
      }

      setStep("parsing");

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const content = reader.result as string;
          const parsed = parseCsvForImport(content);

          if (parsed.rows.length === 0) {
            // Check if it was a column mismatch vs truly empty
            const hasMissingColumnWarning = parsed.warnings.some(
              (w) => w.includes("Spalte") || w.includes("nicht gefunden")
            );
            setError(
              hasMissingColumnWarning
                ? t("csvImport.columnsMissing")
                : t("csvImport.emptyFile")
            );
            setStep("error");
          } else {
            setPreview(parsed);
            setStep("preview");
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(`${t("csvImport.parseError")} (${msg})`);
          setStep("error");
        }
        cleanup();
      };

      reader.onerror = () => {
        setError(t("csvImport.readError"));
        setStep("error");
        cleanup();
      };

      reader.readAsText(file, "utf-8");
    };

    const handleCancel = () => {
      if (settled) return;
      settled = true;
      setStep("idle");
      cleanup();
    };

    input.addEventListener("change", handleChange);
    input.addEventListener("cancel", handleCancel);

    document.body.appendChild(input);
    input.click();
  }, [t]);

  const startImport = useCallback(() => {
    if (!preview) return;

    setStep("importing");
    setError(null);

    // Defer execution to allow "importing" UI state to render
    setTimeout(() => {
      try {
        const importResult = executeImport(preview);
        setResult(importResult);

        if (importResult.errors.length > 0 && importResult.importedCount === 0) {
          // All failed — show error state
          setError(importResult.errors.join("\n"));
          setStep("error");
        } else {
          setStep("done");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`${t("csvImport.importFailed")} (${msg})`);
        setStep("error");
      }
    }, 50);
  }, [preview, t]);

  const reset = useCallback(() => {
    setStep("idle");
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  return { step, preview, result, error, pickFile, startImport, reset };
}
