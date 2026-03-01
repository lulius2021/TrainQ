// src/hooks/useCountdown.ts
import { useEffect, useState } from "react";

/**
 * useCountdown
 * - Übergib eine Endzeit als ISO-String
 * - Der Hook berechnet jede Sekunde die verbleibende Zeit
 * - Wenn abgelaufen -> 0
 */

export function useCountdown(endTimeIso: string | null) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!endTimeIso) {
      setRemaining(0);
      return;
    }

    const d = new Date(endTimeIso);
    const end = d.getTime();
    if (isNaN(end)) {
      setRemaining(0);
      return;
    }

    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((end - now) / 1000));
      setRemaining(diff);
    };

    update(); // direkt einmal berechnen

    const interval = setInterval(update, 1000);

    return () => clearInterval(interval);
  }, [endTimeIso]);

  return remaining; // Sekunden
}
