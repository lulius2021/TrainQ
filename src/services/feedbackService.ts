// src/services/feedbackService.ts

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const emailjsConfig = {
  SERVICE_ID,
  TEMPLATE_ID,
  PUBLIC_KEY,
};
