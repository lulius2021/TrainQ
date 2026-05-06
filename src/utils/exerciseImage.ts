import type { Exercise } from "../data/exerciseLibrary";

function slugifyName(input: string): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// CDN base URL for exercise images (Supabase Storage public bucket).
// Falls back to local /exercises/ path for dev without the env var set.
const CDN_BASE =
  (typeof import.meta !== "undefined" &&
    (import.meta as Record<string, unknown>).env &&
    (import.meta.env as Record<string, string>).VITE_EXERCISES_CDN_URL) ||
  "/exercises";

const IMAGE_EXTS = ["webp", "png", "jpg", "jpeg"] as const;

export function getExerciseImageCandidates(exercise?: Exercise | null): string[] {
  if (!exercise) return [];
  if (exercise.image?.kind === "asset") return [exercise.image.src];
  if (exercise.image?.kind === "user") return [];
  if (exercise.imageSrc) return [exercise.imageSrc];

  const bases: string[] = [];
  if (exercise.id) bases.push(`${CDN_BASE}/${exercise.id}`);
  const slug = slugifyName(exercise.name);
  if (slug) bases.push(`${CDN_BASE}/${slug}`);
  return bases.flatMap((base) => IMAGE_EXTS.map((ext) => `${base}.${ext}`));
}

export function resolveExerciseImageSrc(exercise?: Exercise | null): string | null {
  const candidates = getExerciseImageCandidates(exercise);
  return candidates[0] ?? null;
}
