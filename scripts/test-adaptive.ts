
// scripts/test-adaptive.ts
import { calculateAdaptiveWorkout } from "../src/features/adaptive/engine";
import { GarminService } from "../src/services/garmin/api";

// Mock Garmin Service to control test cases
const originalGetRecovery = GarminService.getRecoveryStatus;

async function runTest(name: string, mockBodyBattery: number, expectedFactor: number) {
    console.log(`\n--- Test: ${name} (Body Battery: ${mockBodyBattery}) ---`);

    // Override Mock
    GarminService.getRecoveryStatus = async () => ({
        bodyBattery: mockBodyBattery,
        stressScore: 20,
        sleepQuality: 80,
        lastSync: new Date().toISOString()
    });

    const result = await calculateAdaptiveWorkout({ templateId: "Push_A" });

    console.log(`Reason: ${result.reason}`);
    console.log(`Factor: ${result.reductionFactor} (Expected: ${expectedFactor})`);
    console.log(`Exercises: ${result.exercises.length}`);

    if (result.exercises.length > 0) {
        const firstSet = result.exercises[0].sets[0];
        console.log(`Sample Set (Ex 1): ${firstSet.weight}kg x ${firstSet.reps} reps`);
        console.log(`Note: ${firstSet.notes}`);
    }

    if (result.reductionFactor !== expectedFactor) {
        console.error("❌ FACTOR MISMATCH");
    } else {
        console.log("✅ Factor Correct");
    }
}

async function main() {
    await runTest("Low Recovery", 20, 0.85);
    await runTest("Mid Recovery", 45, 0.90);
    await runTest("High Recovery", 85, 1.0);

    // Restore
    GarminService.getRecoveryStatus = originalGetRecovery;
}

main().catch(console.error);
