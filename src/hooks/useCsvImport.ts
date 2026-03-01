// src/hooks/useCsvImport.ts
// Multi-step CSV import flow hook.

import { useState, useCallback, useRef } from "react";
import type { CsvImportStep, CsvImportPreview, CsvImportResult } from "../types/csvImport";
import { parseCsvForImport, executeImport } from "../utils/csvImport";

export function useCsvImport() {
  const [step, setStep] = useState<CsvImportStep>("idle");
  const [preview, setPreview] = useState<CsvImportPreview | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pickFile = useCallback(() => {
    setStep("picking");
    setError(null);

    // Create a hidden file input and trigger it
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.txt";
    input.style.display = "none";
    fileInputRef.current = input;

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) {
        setStep("idle");
        input.remove();
        return;
      }

      setStep("parsing");

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const content = reader.result as string;
          const parsed = parseCsvForImport(content);
          setPreview(parsed);

          if (parsed.rows.length === 0) {
            setError("Keine Daten in der CSV-Datei gefunden.");
            setStep("error");
          } else {
            setStep("preview");
          }
        } catch (err) {
          setError(`Fehler beim Lesen der Datei: ${String(err)}`);
          setStep("error");
        }
        input.remove();
      };

      reader.onerror = () => {
        setError("Datei konnte nicht gelesen werden.");
        setStep("error");
        input.remove();
      };

      reader.readAsText(file, "utf-8");
    });

    // Handle cancel (no file selected)
    input.addEventListener("cancel", () => {
      setStep("idle");
      input.remove();
    });

    document.body.appendChild(input);
    input.click();
  }, []);

  const startImport = useCallback(() => {
    if (!preview) return;

    setStep("importing");
    setError(null);

    try {
      const importResult = executeImport(preview);
      setResult(importResult);

      if (importResult.errors.length > 0) {
        setError(importResult.errors.join("\n"));
      }

      setStep("done");
    } catch (err) {
      setError(`Import fehlgeschlagen: ${String(err)}`);
      setStep("error");
    }
  }, [preview]);

  const reset = useCallback(() => {
    setStep("idle");
    setPreview(null);
    setResult(null);
    setError(null);
  }, []);

  return { step, preview, result, error, pickFile, startImport, reset };
}
