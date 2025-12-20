// src/types/feedback.ts

export type FeedbackRating = 1 | 2 | 3 | 4 | 5;

export interface FeedbackData {
  rating: FeedbackRating | null;
  feedbackMessage: string; // Positives oder Verbesserung
  note: string;            // Beschreibung vom Problem / fehlenden Funktion
  name: string;
  email: string;
  page: string;            // z.B. "Dashboard", "Kalender" usw.
  createdAt: string;       // ISO-String
}
