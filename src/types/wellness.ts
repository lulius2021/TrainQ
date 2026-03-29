// Wellness & Recovery types

export type WellnessEntry = {
  date: string; // YYYY-MM-DD
  wellbeingScore: number; // 1–10
  sleepHours?: number;
  sleepQuality?: number; // 1–10
  createdAt: string;
};

export type TrainingStatus =
  | "Productive"
  | "Peaking"
  | "Recovery"
  | "Overreaching"
  | "Detraining"
  | "Unknown";

export type TrainingLoadSnapshot = {
  date: string;
  ctl: number; // Chronic Training Load (42-day EWMA)
  atl: number; // Acute Training Load (7-day EWMA)
  tsb: number; // Training Stress Balance = CTL – ATL
  acwr: number; // ATL / CTL
  status: TrainingStatus;
  hasEnoughData: boolean; // false when < 14 days of history
};

export type DeloadScoreFactor = {
  key: string;
  label: string;
  points: number;
  applies: boolean;
  detail?: string;
};

export type DeloadScoreResult = {
  score: number; // 0–100
  level: "none" | "recommended" | "urgent";
  factors: DeloadScoreFactor[];
  snapshot: TrainingLoadSnapshot;
  wellbeing?: number; // today's wellbeing score (1–10)
  hasEnoughHistory: boolean;
};

export type DeloadHistoryEntry = {
  id: string;
  startDate: string;
  endDate: string;
  triggerScore: number;
  triggerReasons: string[];
  deloadType: "leicht" | "mittel" | "intensiv";
  prePerformance?: number;
  postPerformance?: number;
  userFeedback?: number; // 1–10
  createdAt: string;
};
