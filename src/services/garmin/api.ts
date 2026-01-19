// src/services/garmin/api.ts

export interface GarminRecoveryData {
    bodyBattery: number; // 0-100
    stressScore: number; // 0-100
    sleepQuality?: number; // 0-100
    lastSync?: string;
}

/**
 * Garmin Service for Recovery Data
 * 
 * Current: Mock implementation with realistic variability
 * Future: Real API integration via Backend or Capacitor Plugin
 * 
 * Features:
 * - Simulates realistic Body Battery values
 * - Supports timeout simulation for fallback testing
 * - Provides consistent data structure for adaptive engine
 */
export const GarminService = {
    /**
     * Retrieves current recovery status from Garmin
     * Returns null on failure (triggers fallback in adaptive engine)
     */
    getRecoveryStatus: async (): Promise<GarminRecoveryData | null> => {
        // Simulate network latency (200-500ms)
        const latency = 200 + Math.random() * 300;
        await new Promise((resolve) => setTimeout(resolve, latency));

        // Simulate occasional API failures (5% chance)
        if (Math.random() < 0.05) {
            console.warn("[GarminService] Simulated API failure");
            return null;
        }

        // Generate realistic mock data
        // Body Battery typically varies throughout the day
        const hour = new Date().getHours();
        let baseBattery = 70;

        // Morning: higher (70-90)
        if (hour >= 6 && hour < 12) {
            baseBattery = 75 + Math.random() * 15;
        }
        // Afternoon: moderate (60-80)
        else if (hour >= 12 && hour < 18) {
            baseBattery = 65 + Math.random() * 15;
        }
        // Evening: lower (50-70)
        else if (hour >= 18 && hour < 22) {
            baseBattery = 55 + Math.random() * 15;
        }
        // Night: recovering (40-60)
        else {
            baseBattery = 45 + Math.random() * 15;
        }

        const bodyBattery = Math.round(Math.max(0, Math.min(100, baseBattery)));

        // Stress inversely correlates with body battery
        const stressScore = Math.round(Math.max(0, Math.min(100, 100 - bodyBattery + (Math.random() * 20 - 10))));

        // Sleep quality affects morning battery
        const sleepQuality = hour >= 6 && hour < 12
            ? Math.round(60 + Math.random() * 30)
            : undefined;

        return {
            bodyBattery,
            stressScore,
            sleepQuality,
            lastSync: new Date().toISOString(),
        };
    },

    /**
     * Test helper: Force a specific body battery value
     * Use for testing different recovery scenarios
     */
    _mockBodyBattery: null as number | null,

    /**
     * Test helper: Simulate timeout
     */
    _simulateTimeout: false,
};
