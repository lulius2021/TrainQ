import { useEffect, useRef, useState } from "react";
import type { Exercise } from "../data/exerciseLibrary";
import { getExerciseImageCandidates, resolveExerciseImageSrc } from "../utils/exerciseImage";
import { loadExerciseImageUrl } from "../utils/exerciseImageStore";

export function useExerciseImage(exercise?: Exercise | null): string | null {
  const [src, setSrc] = useState<string | null>(() => resolveExerciseImageSrc(exercise));
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
        const img = new Image();
        img.onload = () => {
          if (!active) return;
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
      })
      .catch(() => {
        if (!active) return;
        setSrc(null);
      });

    return () => {
      active = false;
    };
  }, [exercise, exercise?.image?.kind, exercise?.imageSrc]);

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
