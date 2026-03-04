// src/features/adaptive/adaptiveEngine.ts
/**
 * TrainQ Adaptive Engine - "The Mastermind"
 * 
 * Personal Coach Experience: Proactive, Explainable, Never-Stuck
 * 
 * Features:
 * - Auto-Config: TemplateID → UserHistory → GarminBiometrics
 * - Smart Weight Calculation with Plate Rounding
 * - Ghost Labels with Recovery Context
 * - Deload Detection & Suggestions
 * - Fallback for Missing Garmin Data
 */

import { EXERCISES } from "../../data/exerciseLibrary";
import { getLastSetsForExercise } from "../../utils/trainingHistory";
import { loadWorkoutHistory } from "../../utils/workoutHistory";
import { GarminService, type GarminRecoveryData } from "../../services/garmin/api";
import type { LiveExercise, LiveSet } from "../../types/training";
import { getScopedItem, setScopedItem } from "../../utils/scopedStorage";

// ============================================================================
// Configuration & Types
// ============================================================================

export interface AdaptiveConfig {
    templateId: string;
    userId?: string;
    /** Smallest plate increment in kg (default: 1.25kg) */
    plateIncrement?: number;
}

export interface AdaptiveExercise {
    exerciseId?: string;
    name: string;
    targetSets: number;
    targetReps: number;
    targetWeight: number;
    reason: string;
    recoveryAdjustment: string;
}

export interface AdaptiveResult {
    exercises: LiveExercise[];
    recoveryScore: number;
    recoveryModifier: number;
    overloadFactor: number;
    globalReason: string;
    needsDeload: boolean;
    deloadReason?: string;
    biometricsSource: "garmin" | "fallback" | "default";
}

interface FailureHistory {
    exerciseId: string;
    consecutiveFailures: number;
    lastFailureDate: string;
}

const STORAGE_KEY_FAILURE_HISTORY = "trainq_adaptive_failure_history";
const STORAGE_KEY_GARMIN_CACHE = "trainq_garmin_recovery_cache";
const GARMIN_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// ============================================================================
// Core Calculation Functions
// ============================================================================

/**
 * Rounds weight to the nearest plate increment
 * Default: 1.25kg (standard Olympic plate)
 * Ensures no weird decimals like 61.34kg
 */
function roundToPlate(kg: number, plateIncrement = 1.25): number {
    if (!Number.isFinite(kg) || kg <= 0) return 0;

    // Round to nearest increment
    const rounded = Math.round(kg / plateIncrement) * plateIncrement;

    // Format to avoid floating point issues
    return Math.round(rounded * 100) / 100;
}

/**
 * Calculates recovery modifier based on Garmin Body Battery
 * 
 * Recovery Zones:
 * - < 40%: Recovery Focus (-5% load)
 * - 40-60%: Moderate (-2.5% load)
 * - 60-80%: Normal (0% adjustment)
 * - > 80%: Strong Day (+2.5% load)
 */
function calculateRecoveryModifier(bodyBattery: number): {
    modifier: number;
    label: string;
} {
    if (bodyBattery < 40) {
        return {
            modifier: 0.95,
            label: "Recovery Focus: -5% Load"
        };
    } else if (bodyBattery < 60) {
        return {
            modifier: 0.975,
            label: "Moderate Recovery: -2.5% Load"
        };
    } else if (bodyBattery < 80) {
        return {
            modifier: 1.0,
            label: "Normal Recovery: Baseline Load"
        };
    } else {
        return {
            modifier: 1.025,
            label: "Strong Day: +2.5% Load"
        };
    }
}

/**
 * Progressive overload factor
 * Increases weight by 2.5% when recovery is good
 */
function calculateOverloadFactor(bodyBattery: number, hasHistory: boolean): number {
    if (!hasHistory) return 1.0; // No progression on first attempt
    if (bodyBattery >= 70) return 1.025; // +2.5% when feeling good
    return 1.0; // Maintain when recovery is lower
}

/**
 * Calculates target weight using the formula:
 * TargetWeight = (LastEffectiveWeight * OverloadFactor) * RecoveryModifier
 */
function calculateTargetWeight(
    lastWeight: number,
    overloadFactor: number,
    recoveryModifier: number,
    plateIncrement: number
): number {
    const raw = lastWeight * overloadFactor * recoveryModifier;
    return roundToPlate(raw, plateIncrement);
}

// ============================================================================
// Garmin Data Management
// ============================================================================

interface GarminCache {
    data: GarminRecoveryData;
    timestamp: string;
    history: Array<{ bodyBattery: number; timestamp: string }>;
}

/**
 * Gets Garmin recovery data with fallback to 7-day average
 */
async function getRecoveryData(): Promise<{
    data: GarminRecoveryData;
    source: "garmin" | "fallback" | "default";
}> {
    try {
        // Try to get fresh Garmin data
        const garminData = await Promise.race([
            GarminService.getRecoveryStatus(),
            new Promise<null>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 5000)
            )
        ]);

        if (garminData) {
            // Cache the data
            cacheGarminData(garminData);
            return { data: garminData, source: "garmin" };
        }
    } catch (error) {
    }

    // Fallback: Use 7-day average from cache
    const cache = loadGarminCache();
    if (cache && cache.history.length > 0) {
        const recentHistory = cache.history.slice(-7); // Last 7 entries
        const avgBodyBattery = Math.round(
            recentHistory.reduce((sum, h) => sum + h.bodyBattery, 0) / recentHistory.length
        );

        const fallbackData: GarminRecoveryData = {
            bodyBattery: avgBodyBattery,
            stressScore: 50, // Neutral default
            lastSync: cache.timestamp
        };

        return { data: fallbackData, source: "fallback" };
    }

    // Ultimate fallback: Default values (RPE 7 equivalent)
    return {
        data: {
            bodyBattery: 70,
            stressScore: 40,
            lastSync: new Date().toISOString()
        },
        source: "default"
    };
}

function loadGarminCache(): GarminCache | null {
    try {
        const raw = getScopedItem(STORAGE_KEY_GARMIN_CACHE);
        if (!raw) return null;

        const cache = JSON.parse(raw) as GarminCache;
        const age = Date.now() - new Date(cache.timestamp).getTime();

        // Invalidate if too old
        if (age > GARMIN_CACHE_TTL_MS) return null;

        return cache;
    } catch {
        return null;
    }
}

function cacheGarminData(data: GarminRecoveryData): void {
    try {
        const existing = loadGarminCache();
        const history = existing?.history || [];

        // Add new entry
        history.push({
            bodyBattery: data.bodyBattery,
            timestamp: new Date().toISOString()
        });

        // Keep last 30 days
        const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const filtered = history.filter(h =>
            new Date(h.timestamp).getTime() > cutoff
        );

        const cache: GarminCache = {
            data,
            timestamp: new Date().toISOString(),
            history: filtered
        };

        setScopedItem(STORAGE_KEY_GARMIN_CACHE, JSON.stringify(cache));
    } catch (error) {
        if (import.meta.env.DEV) console.error("[AdaptiveEngine] Failed to cache Garmin data", error);
    }
}

// ============================================================================
// Deload Detection ("Never-Stuck Algorithm")
// ============================================================================

function loadFailureHistory(): Record<string, FailureHistory> {
    try {
        const raw = getScopedItem(STORAGE_KEY_FAILURE_HISTORY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveFailureHistory(history: Record<string, FailureHistory>): void {
    try {
        setScopedItem(STORAGE_KEY_FAILURE_HISTORY, JSON.stringify(history));
    } catch (error) {
        if (import.meta.env.DEV) console.error("[AdaptiveEngine] Failed to save failure history", error);
    }
}

/**
 * Checks if user needs a deload based on recent performance
 * Triggers when 3+ consecutive failures on same exercise
 */
function checkDeloadNeed(exerciseId: string): {
    needsDeload: boolean;
    reason?: string;
    consecutiveFailures: number;
} {
    const history = loadFailureHistory();
    const record = history[exerciseId];

    if (!record) {
        return { needsDeload: false, consecutiveFailures: 0 };
    }

    if (record.consecutiveFailures >= 3) {
        return {
            needsDeload: true,
            reason: `${record.consecutiveFailures} consecutive failures detected. Deload recommended: 70% load, focus on form.`,
            consecutiveFailures: record.consecutiveFailures
        };
    }

    return { needsDeload: false, consecutiveFailures: record.consecutiveFailures };
}

/**
 * Records a failure for an exercise
 * Call this from LiveTrainingPage when user can't complete target reps
 */
export function recordExerciseFailure(exerciseId: string): void {
    const history = loadFailureHistory();
    const existing = history[exerciseId];

    history[exerciseId] = {
        exerciseId,
        consecutiveFailures: (existing?.consecutiveFailures || 0) + 1,
        lastFailureDate: new Date().toISOString()
    };

    saveFailureHistory(history);
}

/**
 * Records a success for an exercise (resets failure counter)
 */
export function recordExerciseSuccess(exerciseId: string): void {
    const history = loadFailureHistory();
    delete history[exerciseId];
    saveFailureHistory(history);
}

// ============================================================================
// Template Database
// ============================================================================

interface TemplateExercise {
    id: string;
    name: string;
    defaultReps: number;
    defaultSets: number;
}

function getTemplateExercises(templateId: string): TemplateExercise[] {
    // Map template IDs to exercise lists
    const templates: Record<string, string[]> = {
        "push": [
            "Bench Press (Barbell)",
            "Overhead Press (Dumbbell)",
            "Incline Bench Press (Dumbbell)",
            "Lateral Raise (Dumbbell)",
            "Triceps Pushdown (Cable)"
        ],
        "pull": [
            "Pull-Up",
            "Barbell Row",
            "Lat Pulldown (Cable)",
            "Face Pull (Cable)",
            "Bicep Curl (Dumbbell)"
        ],
        "legs": [
            "Squat (Barbell)",
            "Romanian Deadlift (Barbell)",
            "Leg Press",
            "Leg Curl (Machine)",
            "Calf Raise (Machine)"
        ],
        "upper": [
            "Bench Press (Barbell)",
            "Barbell Row",
            "Overhead Press (Dumbbell)",
            "Pull-Up",
            "Dips"
        ],
        "lower": [
            "Squat (Barbell)",
            "Romanian Deadlift (Barbell)",
            "Bulgarian Split Squat",
            "Leg Curl (Machine)",
            "Calf Raise (Machine)"
        ]
    };

    const normalizedId = templateId.toLowerCase().replace(/[^a-z]/g, "");
    const exerciseNames = templates[normalizedId] || templates["push"];

    return exerciseNames.map(name => {
        const found = EXERCISES.find(e =>
            e.nameEn.toLowerCase().includes(name.toLowerCase().split('(')[0].trim()) ||
            e.name.toLowerCase().includes(name.toLowerCase())
        );

        return {
            id: found?.id || `custom_${name}`,
            name: found?.name || name,
            defaultReps: 10,
            defaultSets: 3
        };
    });
}

// ============================================================================
// Main Adaptive Engine
// ============================================================================

function uid(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Main adaptive workout calculation
 * Implements the complete "Mastermind" logic
 */
export async function calculateAdaptiveWorkout(
    config: AdaptiveConfig
): Promise<AdaptiveResult> {
    const plateIncrement = config.plateIncrement || 1.25;

    // 1. Get Recovery Data (with fallback)
    const { data: recoveryData, source: biometricsSource } = await getRecoveryData();
    const bodyBattery = recoveryData.bodyBattery;

    // 2. Calculate Modifiers
    const { modifier: recoveryModifier, label: recoveryLabel } =
        calculateRecoveryModifier(bodyBattery);

    // 3. Load Template
    const templateExercises = getTemplateExercises(config.templateId);

    // 4. Build Adaptive Exercises
    const exercises: LiveExercise[] = [];
    let globalNeedsDeload = false;
    let deloadReasons: string[] = [];

    for (const template of templateExercises) {
        // Check deload status
        const deloadCheck = checkDeloadNeed(template.id);
        if (deloadCheck.needsDeload) {
            globalNeedsDeload = true;
            deloadReasons.push(`${template.name}: ${deloadCheck.reason}`);
        }

        // Get exercise history
        const history = getLastSetsForExercise({
            exerciseId: template.id,
            name: template.name
        });

        let targetWeight: number;
        let targetReps = template.defaultReps;
        let reason: string;
        let hasHistory = false;

        if (history && history.sets.length > 0) {
            hasHistory = true;
            const lastSet = history.sets[history.sets.length - 1];
            const lastWeight = lastSet.weight || 20;
            const lastReps = lastSet.reps || template.defaultReps;

            // Calculate overload factor
            const overloadFactor = calculateOverloadFactor(bodyBattery, true);

            // Apply deload if needed
            if (deloadCheck.needsDeload) {
                targetWeight = roundToPlate(lastWeight * 0.7, plateIncrement);
                targetReps = lastReps;
                reason = "Deload Cycle: Focus on Form";
            } else {
                // Normal progression
                targetWeight = calculateTargetWeight(
                    lastWeight,
                    overloadFactor,
                    recoveryModifier,
                    plateIncrement
                );
                targetReps = lastReps;

                if (overloadFactor > 1.0) {
                    reason = `Progression (+2.5%) | ${recoveryLabel}`;
                } else {
                    reason = `Maintenance | ${recoveryLabel}`;
                }
            }
        } else {
            // First time: Use safe defaults
            targetWeight = roundToPlate(20, plateIncrement); // Conservative start
            targetReps = template.defaultReps;
            reason = `New Exercise | ${recoveryLabel}`;
        }

        // Create sets with ghost labels
        const sets: LiveSet[] = [];
        for (let i = 0; i < template.defaultSets; i++) {
            sets.push({
                id: uid(),
                completed: false,
                reps: targetReps,
                weight: targetWeight,
                notes: i === 0 ? reason : undefined, // Info label on first set
                setType: "normal"
            });
        }

        exercises.push({
            id: uid(),
            exerciseId: template.id,
            name: template.name,
            sets,
            restSeconds: 90
        });
    }

    // 5. Generate global reason
    let globalReason = recoveryLabel;
    if (biometricsSource === "fallback") {
        globalReason += " (using 7-day average)";
    } else if (biometricsSource === "default") {
        globalReason += " (default values - RPE 7)";
    }

    return {
        exercises,
        recoveryScore: bodyBattery,
        recoveryModifier,
        overloadFactor: calculateOverloadFactor(bodyBattery, true),
        globalReason,
        needsDeload: globalNeedsDeload,
        deloadReason: deloadReasons.length > 0 ? deloadReasons.join("\n") : undefined,
        biometricsSource
    };
}

/**
 * Stress test function for validation
 * Simulates 100 different recovery scores and logs results
 */
export function stressTestAdaptiveEngine(): void {
    if (import.meta.env.DEV) console.log("=== Adaptive Engine Stress Test ===\n");

    const testCases = Array.from({ length: 100 }, (_, i) => i);

    testCases.forEach(bodyBattery => {
        const { modifier, label } = calculateRecoveryModifier(bodyBattery);
        const overload = calculateOverloadFactor(bodyBattery, true);
        const lastWeight = 100; // Example
        const targetWeight = calculateTargetWeight(lastWeight, overload, modifier, 1.25);

        if (bodyBattery % 10 === 0 && import.meta.env.DEV) {
            console.log(
                `BB: ${bodyBattery}% | Modifier: ${modifier.toFixed(3)} | ` +
                `Overload: ${overload.toFixed(3)} | Weight: ${lastWeight}kg → ${targetWeight}kg | ` +
                `Label: ${label}`
            );
        }
    });

    if (import.meta.env.DEV) console.log("\n=== Test Complete ===");
}
