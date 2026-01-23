import React from "react";
import type { WorkoutShareModel, WorkoutShareExercise } from "../../../utils/share/mapWorkoutToShareModel";
import BrandMark from "../BrandMark";

// Helper for strict array safety within view
const safeArray = <T,>(arr: T[] | undefined | null | unknown): T[] => {
  if (!arr) return [];
  if (Array.isArray(arr)) return arr;
  return [];
};

type Props = {
  model: WorkoutShareModel;
  locale: "de" | "en";
};

function formatDuration(totalSec?: number): string {
  const sec = Math.max(0, Math.round(totalSec ?? 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function formatVolume(vol?: number): string {
  if (!vol || vol <= 0) return "0 kg";
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}t`;
  return `${Math.round(vol)} kg`;
}

export default function ResultCardStory({ model, locale }: Props) {
  // Safe Date Access
  const dateLabel = model.dateLabel;
  const durationLabel = formatDuration(model.durationSec ?? 0);
  const volumeLabel = formatVolume(model.totalVolumeKg ?? 0);
  const prsCount = model.highlights?.prsCount ?? 0;

  // Safe List Access
  const allExercises = safeArray<WorkoutShareExercise>(model.exercises);
  const visibleExercises = allExercises.slice(0, 6);
  const remainingCount = Math.max(0, allExercises.length - 6);

  // Layout Constants (for 1080x1920 canvas)
  const CANVAS_W = 1080;
  // const CANVAS_H = 1920; 
  const CARD_W = 920;
  // Card height will hug content, but we center it.

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(145deg, #0f1216 0%, #000000 100%)",
        position: "relative",
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Background Decorative Elements */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '120%',
        height: '60%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.15) 0%, rgba(0,0,0,0) 70%)',
        pointerEvents: 'none'
      }} />

      {/* The Compact Card */}
      <div
        style={{
          width: CARD_W,
          background: "linear-gradient(180deg, rgba(28,28,30,1) 0%, rgba(10,10,10,1) 100%)",
          borderRadius: 48,
          border: "2px solid rgba(255,255,255,0.08)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          padding: "50px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 40,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div>
          <div style={{
            fontSize: 52,
            fontWeight: 800,
            color: "#FFFFFF",
            lineHeight: 1.1,
            marginBottom: 8
          }}>
            {model.title || "Workout"}
          </div>
          <div style={{
            fontSize: 24,
            fontWeight: 500,
            color: "rgba(235,235,245,0.5)",
            textTransform: 'uppercase',
            letterSpacing: 1
          }}>
            {dateLabel}
          </div>
        </div>

        {/* Stats Row */}
        <div style={{ display: "flex", gap: 16 }}>
          {/* Duration */}
          <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 24, padding: "24px 0", textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#FFF" }}>{durationLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>{locale === "de" ? "Dauer" : "Duration"}</div>
          </div>
          {/* Volume */}
          <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 24, padding: "24px 0", textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: "#FFF" }}>{volumeLabel}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>{locale === "de" ? "Volumen" : "Volume"}</div>
          </div>
          {/* PRs (only if > 0, else Sets) */}
          {prsCount > 0 ? (
            <div style={{ flex: 1, background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", borderRadius: 24, padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#fbbf24" }}>{prsCount} 🏆</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: "rgba(253,230,138,0.8)" }}>PRs</div>
            </div>
          ) : (
            <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 24, padding: "24px 0", textAlign: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 700, color: "#FFF" }}>{model.setsCount}</div>
              <div style={{ fontSize: 18, fontWeight: 500, color: "rgba(255,255,255,0.4)" }}>{locale === "de" ? "Sätze" : "Sets"}</div>
            </div>
          )}
        </div>

        {/* Exercises List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {visibleExercises.map((ex, i) => {
            const setLen = safeArray(ex.bestSet ? [1] : []).length > 0 ? 1 : 0; // fallback logic
            const tags = safeArray(ex.tags);
            // We actually want "4x" based on number of sets
            // In mapWorkoutToShareModel, we don't expose sets count per exercise directly as a number, we have to calculate or look at bestSet or assume something. 
            // Ah, mapShareModel does not export 'sets' array on the exercise object! It exports 'bestSet', 'volume', 'tags'. 
            // Wait, I need access to sets count. 
            // I will add 'setsCount' to the input model in mapWorkoutToShareModel if strictly needed, BUT:
            // I should not change the model here if I can avoid it. 
            // Let's check `WorkoutShareExercise`... it has `volume`, `tags`, `imageSrc`, `bestSet`.
            // It does NOT have sets count efficiently.
            // However, I can probably infer it from tags or just use a generic bullet if stats missing.
            // Actually, let's just use a bullet point or check if I can quick-fix the model. 
            // STEP 1 said: "safeArray(data.exercises).map(...)" but did not demand schema change.
            // I will use a simple dot • or number index if count missing.
            // Actually, let's just output the name clearly.
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', fontSize: 28, gap: 16 }}>
                <div style={{
                  color: '#3b82f6',
                  fontWeight: 700,
                  minWidth: 40,
                  textAlign: 'right'
                }}>
                  •
                </div>
                <div style={{ color: '#FFF', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
                  {ex.name}
                </div>
              </div>
            );
          })}

          {remainingCount > 0 && (
            <div style={{
              marginTop: 8,
              textAlign: 'center',
              fontSize: 24,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.4)'
            }}>
              + {remainingCount} {locale === 'de' ? 'weitere Übungen' : 'more exercises'}
            </div>
          )}

          {allExercises.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', padding: '20px 0', fontSize: 24 }}>
              {locale === 'de' ? 'Keine Übungen' : 'No exercises'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 20,
          paddingTop: 30,
          borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BrandMark size="sm" variant="light" />
            <span style={{ fontSize: 22, fontWeight: 700, color: '#FFF', letterSpacing: -0.5 }}>TrainQ</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
            @Output
          </div>
        </div>

      </div>
    </div>
  );
}
