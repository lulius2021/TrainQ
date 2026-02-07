import { useEffect, useRef, useState } from "react";
import type { Exercise } from "../data/exerciseLibrary";
import { getExerciseImageCandidates, resolveExerciseImageSrc } from "../utils/exerciseImage";
import { loadExerciseImageUrl } from "../utils/exerciseImageStore";

const resolvedImageCache = new Map<string, string>();

export function useExerciseImage(exercise?: Exercise | null): string | null {
  const [src, setSrc] = useState<string | null>(() => {
    if (!exercise) return null;
    if (resolvedImageCache.has(exercise.id)) {
      return resolvedImageCache.get(exercise.id) || null;
    }
    // Optimistic: try first candidate immediately to avoid flicker if it exists
    // But this might flash broken image if it doesn't exist. 
    // Safer to wait for resolution unless cached.
    return null;
  });

  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!exercise) {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setSrc(null);
      return;
    }

    // Check cache again in effect (if another component resolved it since render)
    if (resolvedImageCache.has(exercise.id)) {
      const cached = resolvedImageCache.get(exercise.id) || null;
      if (cached !== src) setSrc(cached);
      // If cached is user-blob, we might need to handle objectURL? 
      // Typically we don't cache blob URLs globally as they might be revoked.
      // But here we're caching primarily string paths.
      // For user images, we might rely on loadExerciseImageUrl logic.
      if (exercise.image?.kind !== "user") return;
    }

    if (!exercise.image || exercise.image.kind !== "user") {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      const candidates = getExerciseImageCandidates(exercise);
      if (!candidates.length) {
        setSrc(null);
        return;
      }

      let active = true;
      let idx = 0;

      const tryNext = () => {
        if (!active) return;
        const next = candidates[idx++];
        if (!next) {
          setSrc(null);
          return;
        }

        // Cache check for specific candidate? Not really feasible unless we cache *result*.

        const img = new Image();
        img.onload = () => {
          if (!active) return;
          resolvedImageCache.set(exercise.id, next); // Cache the working URL
          setSrc(next);
        };
        img.onerror = tryNext;
        img.src = next;
      };

      tryNext();
      return () => {
        active = false;
      };
    }

    // User Image Logic
    const userRefId = exercise.image.refId;
    let active = true;
    loadExerciseImageUrl(userRefId)
      .then((url) => {
        if (!active) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url || null;
        setSrc(url || null);
        // Note: We don't cache blob URLs in the global map because they are session-specific and managed by cleanup
      })
      .catch(() => {
        if (!active) return;
        setSrc(null);
      });

    return () => {
      active = false;
    };
  }, [exercise?.id, exercise?.image?.kind, exercise?.imageSrc]); // Use primitive deps

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  return src;
}
