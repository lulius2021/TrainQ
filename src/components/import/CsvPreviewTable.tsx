// src/components/import/CsvPreviewTable.tsx
// Simple table showing first 50 rows of parsed CSV data.

import React from "react";
import type { CsvParsedRow } from "../../types/csvImport";

interface CsvPreviewTableProps {
  rows: CsvParsedRow[];
  matchedExercises: Map<string, string>;
}

const MAX_PREVIEW_ROWS = 50;

const CsvPreviewTable: React.FC<CsvPreviewTableProps> = ({ rows, matchedExercises }) => {
  const displayed = rows.slice(0, MAX_PREVIEW_ROWS);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[var(--card-bg)] border-b border-[var(--border-color)]">
            <th className="text-left px-3 py-2.5 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Datum
            </th>
            <th className="text-left px-3 py-2.5 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Uebung
            </th>
            <th className="text-right px-3 py-2.5 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Gewicht
            </th>
            <th className="text-right px-3 py-2.5 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Wdh
            </th>
            <th className="text-right px-3 py-2.5 font-semibold text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              Saetze
            </th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((row, idx) => {
            const matched = matchedExercises.get(row.exercise);
            const isUnmatched = !matched;

            return (
              <tr
                key={idx}
                className="border-b border-[var(--border-color)] last:border-0 hover:bg-[var(--button-bg)] transition-colors"
              >
                <td className="px-3 py-2 text-[var(--text-color)] font-mono text-xs">
                  {row.date}
                </td>
                <td className="px-3 py-2">
                  <div className="text-[var(--text-color)] text-sm">
                    {matched || row.exercise}
                  </div>
                  {matched && matched !== row.exercise && (
                    <div className="text-[var(--text-secondary)] text-xs mt-0.5">
                      CSV: {row.exercise}
                    </div>
                  )}
                  {isUnmatched && (
                    <div className="text-amber-400 text-xs mt-0.5">
                      Nicht zugeordnet
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-[var(--text-color)] font-mono">
                  {row.weightKg > 0 ? `${row.weightKg} kg` : "-"}
                </td>
                <td className="px-3 py-2 text-right text-[var(--text-color)] font-mono">
                  {row.reps}
                </td>
                <td className="px-3 py-2 text-right text-[var(--text-color)] font-mono">
                  {row.sets}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rows.length > MAX_PREVIEW_ROWS && (
        <div className="px-3 py-2 text-center text-xs text-[var(--text-secondary)] bg-[var(--card-bg)] border-t border-[var(--border-color)]">
          ... und {rows.length - MAX_PREVIEW_ROWS} weitere Zeilen
        </div>
      )}
    </div>
  );
};

export default CsvPreviewTable;
