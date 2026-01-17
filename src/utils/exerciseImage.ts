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
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const IMAGE_EXTS = ["webp", "png", "jpg", "jpeg"] as const;

export function getExerciseImageCandidates(exercise?: Exercise | null): string[] {
  if (!exercise) return [];
  if (exercise.image?.kind === "asset") return [exercise.image.src];
  if (exercise.image?.kind === "user") return [];
  if (exercise.imageSrc) return [exercise.imageSrc];

  const bases: string[] = [];
  if (exercise.id) bases.push(`/exercises/${exercise.id}`);
  const slug = slugifyName(exercise.name);
  if (slug) bases.push(`/exercises/${slug}`);
  return bases.flatMap((base) => IMAGE_EXTS.map((ext) => `${base}.${ext}`));
}

export function resolveExerciseImageSrc(exercise?: Exercise | null): string | null {
  const candidates = getExerciseImageCandidates(exercise);
  return candidates[0] ?? null;
}
