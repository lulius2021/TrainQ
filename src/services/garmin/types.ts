export interface GarminConnectionStatus {
  connected: boolean;
  garminUserId: string | null;
  lastSyncAt: string | null;
}

export interface GarminDailyMetrics {
  calendarDate: string;
  steps: number;
  distanceMeters: number;
  activeCalories: number;
  totalCalories: number;
  restingHeartRate: number;
  maxHeartRate: number;
  avgStressLevel: number;
  bodyBatteryHigh: number;
  bodyBatteryLow: number;
  floorsClimbed: number;
  intensityMinutes: number;
}

export interface GarminSleepSummary {
  calendarDate: string;
  sleepStart: string;
  sleepEnd: string;
  totalSleepSeconds: number;
  deepSleepSeconds: number;
  lightSleepSeconds: number;
  remSleepSeconds: number;
  awakeSeconds: number;
  sleepScore: number;
}

export interface GarminActivity {
  garminActivityId: string;
  activityType: string;
  startTime: string;
  durationSeconds: number;
  distanceMeters: number;
  calories: number;
  avgHeartRate: number;
  maxHeartRate: number;
}
