// src/pages/AdaptiveTestPage.tsx
/**
 * Adaptive Engine Test & Demo Page
 * 
 * For development and validation:
 * - Test different recovery scenarios
 * - Validate weight calculations
 * - Verify deload detection
 * - Stress test the engine
 */

import React, { useState } from "react";
import { calculateAdaptiveWorkout, stressTestAdaptiveEngine } from "../features/adaptive/adaptiveEngine";
import { AdaptiveInfoBadge } from "../components/adaptive/AdaptiveInfoBadge";
import type { AdaptiveResult } from "../features/adaptive/adaptiveEngine";
import { AppCard } from "../components/ui/AppCard";
import { AppButton } from "../components/ui/AppButton";

export default function AdaptiveTestPage() {
    const [result, setResult] = useState<AdaptiveResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState("push");
    const [testLogs, setTestLogs] = useState<string[]>([]);

    const runTest = async (templateId: string) => {
        setLoading(true);
        setTestLogs([]);

        try {
            const adaptiveResult = await calculateAdaptiveWorkout({
                templateId,
                plateIncrement: 1.25
            });

            setResult(adaptiveResult);

            // Log results
            const logs = [
                `✅ Adaptives Training generiert für: ${templateId}`,
                `📊 Erholungswert: ${adaptiveResult.recoveryScore}%`,
                `🎯 Erholungsfaktor: ${adaptiveResult.recoveryModifier.toFixed(3)}`,
                `📈 Overload-Faktor: ${adaptiveResult.overloadFactor.toFixed(3)}`,
                `🔄 Datenquelle: ${adaptiveResult.biometricsSource}`,
                `💪 Übungen: ${adaptiveResult.exercises.length}`,
                `⚠️ Deload notwendig: ${adaptiveResult.needsDeload ? "JA" : "NEIN"}`,
                adaptiveResult.deloadReason ? `📝 Deload Grund: ${adaptiveResult.deloadReason}` : "",
            ].filter(Boolean);

            setTestLogs(logs);
        } catch (error) {
            setTestLogs([`❌ Fehler: ${error instanceof Error ? error.message : "Unbekannter Fehler"}`]);
        } finally {
            setLoading(false);
        }
    };

    const runStressTest = () => {
        setTestLogs(["🔬 Starte Stresstest (siehe Konsole)..."]);
        stressTestAdaptiveEngine();
        setTestLogs(prev => [...prev, "✅ Stresstest abgeschlossen - siehe Browser Konsole"]);
    };

    return (
        <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] p-4 pt-0 pb-[var(--nav-height)]">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Header */}
                <AppCard>
                    <h1 className="text-3xl font-bold mb-2">🧠 Adaptive Engine Testlabor</h1>
                    <p className="text-[var(--muted)]">
                        Testen und Validieren des adaptiven Trainingssystems
                    </p>
                </AppCard>

                {/* Controls */}
                <AppCard title="Test-Steuerung">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--muted)] mb-2">
                                Vorlage
                            </label>
                            <select
                                value={selectedTemplate}
                                onChange={(e) => setSelectedTemplate(e.target.value)}
                                className="w-full h-12 rounded-xl bg-[var(--surface2)] border-none px-4 text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                            >
                                <option value="push">Push</option>
                                <option value="pull">Pull</option>
                                <option value="legs">Legs (Beine)</option>
                                <option value="upper">Upper (Oberkörper)</option>
                                <option value="lower">Lower (Unterkörper)</option>
                            </select>
                        </div>

                        <div className="flex items-end gap-2">
                            <AppButton
                                onClick={() => runTest(selectedTemplate)}
                                disabled={loading}
                                variant="primary"
                                isLoading={loading}
                                className="flex-1"
                            >
                                Training Generieren
                            </AppButton>

                            <AppButton
                                onClick={runStressTest}
                                variant="secondary"
                            >
                                Stresstest
                            </AppButton>
                        </div>
                    </div>
                </AppCard>

                {/* Test Logs */}
                {testLogs.length > 0 && (
                    <AppCard title="📋 Test Protokoll" variant="soft">
                        <div className="space-y-2 font-mono text-sm max-h-[300px] overflow-y-auto">
                            {testLogs.map((log, i) => (
                                <div key={i} className="text-[var(--text)]">
                                    {log}
                                </div>
                            ))}
                        </div>
                    </AppCard>
                )}

                {/* Results */}
                {result && (
                    <div className="space-y-4">
                        {/* Summary */}
                        <AppCard title="📊 Zusammenfassung">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                <div className="rounded-xl bg-[var(--surface2)] p-3">
                                    <div className="text-xs text-[var(--muted)] mb-1">Erholungswert</div>
                                    <div className="text-2xl font-bold">{result.recoveryScore}%</div>
                                </div>

                                <div className="rounded-xl bg-[var(--surface2)] p-3">
                                    <div className="text-xs text-[var(--muted)] mb-1">Erholungsfaktor</div>
                                    <div className="text-2xl font-bold">{(result.recoveryModifier * 100).toFixed(1)}%</div>
                                </div>

                                <div className="rounded-xl bg-[var(--surface2)] p-3">
                                    <div className="text-xs text-[var(--muted)] mb-1">Overload-Faktor</div>
                                    <div className="text-2xl font-bold">{(result.overloadFactor * 100).toFixed(1)}%</div>
                                </div>

                                <div className="rounded-xl bg-[var(--surface2)] p-3">
                                    <div className="text-xs text-[var(--muted)] mb-1">Übungen</div>
                                    <div className="text-2xl font-bold">{result.exercises.length}</div>
                                </div>
                            </div>

                            <AdaptiveInfoBadge
                                reason={result.globalReason}
                                recoveryScore={result.recoveryScore}
                                isDeload={result.needsDeload}
                                details={result.deloadReason}
                            />
                        </AppCard>

                        {/* Exercises */}
                        <AppCard title="💪 Generierte Übungen">
                            <div className="space-y-4">
                                {result.exercises.map((exercise, idx) => (
                                    <AppCard
                                        key={exercise.id}
                                        variant="soft"
                                        className="p-4"
                                        noPadding
                                    >
                                        <div className="mb-3 flex items-start justify-between">
                                            <div>
                                                <div className="font-semibold text-lg">{exercise.name}</div>
                                                <div className="text-sm text-[var(--muted)]">
                                                    {exercise.sets.length} Sätze × {exercise.restSeconds}s Pause
                                                </div>
                                            </div>
                                            <div className="text-sm text-[var(--muted)]">#{idx + 1}</div>
                                        </div>

                                        <div className="space-y-2">
                                            {exercise.sets.map((set, setIdx) => (
                                                <div
                                                    key={set.id}
                                                    className="flex items-center gap-4 rounded-lg bg-[var(--bg)] p-3 text-sm"
                                                >
                                                    <div className="w-12 text-[var(--muted)]">Satz {setIdx + 1}</div>
                                                    <div className="flex-1 grid grid-cols-3 gap-4">
                                                        <div>
                                                            <span className="text-[var(--muted)]">Wdh: </span>
                                                            <span className="font-semibold">{set.reps}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[var(--muted)]">Gewicht: </span>
                                                            <span className="font-semibold">{set.weight}kg</span>
                                                        </div>
                                                        <div className="text-xs text-[var(--muted)] truncate">
                                                            {set.notes || "—"}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </AppCard>
                                ))}
                            </div>
                        </AppCard>
                    </div>
                )}

                {/* Documentation */}
                <AppCard title="📖 Testszenarien">
                    <div className="space-y-3 text-sm text-[var(--muted)]">
                        <div className="rounded-xl bg-[var(--surface2)] p-3">
                            <div className="font-semibold text-[var(--text)] mb-1">✅ Normaler Ablauf</div>
                            <p>Generiert ein Training mit aktueller zeitzonenbasierter Erholungssimulation</p>
                        </div>

                        <div className="rounded-xl bg-[var(--surface2)] p-3">
                            <div className="font-semibold text-[var(--text)] mb-1">🔬 Stresstest</div>
                            <p>Simuliert 100 verschiedene Erholungswerte (0-100%) und protokolliert die Gewichtsberechnungen</p>
                        </div>

                        <div className="rounded-xl bg-[var(--surface2)] p-3">
                            <div className="font-semibold text-[var(--text)] mb-1">⚠️ Deload Erkennung</div>
                            <p>Löst automatisch aus nach 3 aufeinanderfolgenden Fehlversuchen (simuliert in echter Nutzung)</p>
                        </div>

                        <div className="rounded-xl bg-[var(--surface2)] p-3">
                            <div className="font-semibold text-[var(--text)] mb-1">🔄 Fallback Logik</div>
                            <p>Nutzt 7-Tage Durchschnitt wenn Garmin API fehlschlägt (5% Zufallsfehlerquote)</p>
                        </div>
                    </div>
                </AppCard>
            </div>
        </div>
    );
}
