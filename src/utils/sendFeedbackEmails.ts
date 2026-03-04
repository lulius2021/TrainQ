// src/utils/sendFeedbackEmail.ts

import emailjs from "@emailjs/browser";
import type { FeedbackData } from "../types/feedback";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID as string;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string;

export async function sendFeedbackEmail(data: FeedbackData): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    if (import.meta.env.DEV) console.error(
      "EmailJS ist nicht konfiguriert. Prüfe .env: VITE_EMAILJS_SERVICE_ID / TEMPLATE_ID / PUBLIC_KEY"
    );
    throw new Error("Email-Konfiguration fehlt");
  }

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      rating: data.rating ?? "keine Angabe",
      feedback_message: data.feedbackMessage || "-",
      note: data.note || "-",
      name: data.name || "Anonym",
      email: data.email || "-",
      page: data.page,
      created_at: data.createdAt,
    },
    PUBLIC_KEY
  );
}
