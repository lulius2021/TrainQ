// src/features/adaptive/engine.ts

import { EXERCISES } from "../../data/exerciseLibrary";
import { getLastSetsForExercise } from "../../utils/trainingHistory";
import { GarminService } from "../../services/garmin/api";
import type { LiveWorkout, LiveExercise, LiveSet, SportType } from "../../types/training";

// ------------------------------------------------------------------
// Internal Helpers
// ------------------------------------------------------------------

function roundToPlate(kg: number): number {
    // Round to nearest 1.25kg or 0.5kg depending on magnitude?
    // Prompt says: "gerundet auf 0.5kg/1.25kg"
    // Assuming 0.5kg steps usually fine. For heavy lifts 1.25kg also works.
    // We'll use 0.5kg as base resolution.
    return Math.round(kg * 2) / 2;
}

function uid(): string {
    // Simple UID for generation (duplicate from other files basically)
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ------------------------------------------------------------------
// Core Logic
// ------------------------------------------------------------------

export interface AdaptiveConfig {
    templateId: string; // e.g. "Push_A"
    // We can default other params or fetch them
}

export interface AdaptiveResult {
    exercises: LiveExercise[];
    recoveryScore: number;
    reductionFactor: number;
    reason: string;
}

/**
 * Calculates a complete adaptive workout based on history + recovery.
 */
export async function calculateAdaptiveWorkout(config: AdaptiveConfig): Promise<AdaptiveResult> {
    // 1. Get Recovery Data
    let recoveryData = await GarminService.getRecoveryStatus().catch(() => null);

    // Fallback if no Garmin data
    const bodyBattery = recoveryData?.bodyBattery ?? 100;

    // 2. Determine Scale Factor
    // "Wenn Body Battery < 30 -> 15% Reduktion (0.85)"
    // "recovery_factor (0.8 bis 1.0)"
    let factor = 1.0;
    let reason = "Fit & Ready";

    if (bodyBattery < 30) {
        factor = 0.85;
        reason = "Recovery Low (-15%)";
    } else if (bodyBattery < 50) {
        factor = 0.90;
        reason = "Recovery Mod (-10%)";
    } else if (bodyBattery < 70) {
        factor = 0.95;
        reason = "Recovery OK (-5%)";
    } else {
        // > 70
        factor = 1.0;
        reason = "High Energy (+Progress)";
    }

    // 3. Select Template Exercises
    // Hardcoded Mapping for "Adaptive Push" / TemplateID as requested by "Auto-Fill Trigger"
    // In a real app this would come from a Template DB.
    // We assume "Push" context.
    const templateExercises = getTemplateExercises(config.templateId);

    // 4. Build Exercises with Adaptive Weights
    const exercises: LiveExercise[] = [];

    for (const tpl of templateExercises) {
        // Get History
        const history = getLastSetsForExercise({ exerciseId: tpl.id, name: tpl.name });

        // Determine Base Weights
        let targetWeight = 20; // Default fallback
        let targetReps = 10;
        let baseNote = "";

        if (history && history.sets.length > 0) {
            // Use best/last set
            const lastSet = history.sets[history.sets.length - 1];
            const w = lastSet.weight || 20;

            // "Basis: last_weight * 1.025"
            if (bodyBattery >= 70) {
                targetWeight = w * 1.025; // Progressive Overload
                baseNote = "Progression (+2.5%)";
            } else {
                targetWeight = w; // Maintenance base
                baseNote = "Maintenance";
            }

            targetReps = lastSet.reps || 10;
        } else {
            baseNote = "New Exercise";
        }

        // Apply Recovery Factor
        // "Modifier: Multipliziere mit recovery_factor"
        const finalWeight = roundToPlate(targetWeight * factor);

        // Create Sets
        const targetSetsCount = 3; // Standard volume (could be adaptive too)
        const newSets: LiveSet[] = [];

        for (let i = 0; i < targetSetsCount; i++) {
            newSets.push({
                id: uid(),
                completed: false,
                reps: targetReps,
                weight: finalWeight,
                notes: i === 0 ? `${baseNote} | ${reason}` : undefined, // Why-Label in first set note (MVP)
                setType: "normal"
            });
        }

        exercises.push({
            id: uid(),
            exerciseId: tpl.id,
            name: tpl.name,
            sets: newSets,
            restSeconds: 90, // Standard Rest
        });
    }

    return {
        exercises,
        recoveryScore: bodyBattery,
        reductionFactor: factor,
        reason
    };
}

// ------------------------------------------------------------------
// Internal Data (Mock Template Database)
// ------------------------------------------------------------------

function getTemplateExercises(templateId: string) {
    // Simple mapping based on ID. Defaults to a standard Push Day.
    // Using exercise IDs that likely exist in the Core DB or fuzzy matching.
    // For safety, we use known IDs or Names.

    // We'll fallback to finding by name in EXERCISES if ID is unknown.
    // Hardcoded for "Adaptive Push".

    const pushNames = [
        "Bench Press (Barbell)",
        "Overhead Press (Dumbbell)",
        "Incline Bench Press (Dumbbell)",
        "Lateral Raise (Dumbbell)",
        "Triceps Pushdown (Cable)"
    ];

    return pushNames.map(name => {
        // fuzzy find
        const found = EXERCISES.find(e =>
            e.nameEn.toLowerCase().includes(name.toLowerCase().split('(')[0].trim()) ||
            e.name.toLowerCase().includes(name.toLowerCase())
        );

        return {
            id: found?.id || "custom_" + name,
            name: found?.name || name
        };
    });
}
