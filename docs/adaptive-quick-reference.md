# Adaptive Engine - Quick Reference

## 🚀 Quick Start

```typescript
import { calculateAdaptiveWorkout } from "@/features/adaptive/adaptiveEngine";

// Generate adaptive workout
const result = await calculateAdaptiveWorkout({
  templateId: "push", // "push" | "pull" | "legs" | "upper" | "lower"
  userId: "user123",
  plateIncrement: 1.25 // Optional, default: 1.25kg
});

// Use result.exercises in LiveTrainingPage
startLiveWorkout({
  title: "Adaptive Push",
  sport: "Gym",
  initialExercises: result.exercises
});
```

## 📊 Result Structure

```typescript
interface AdaptiveResult {
  exercises: LiveExercise[];      // Pre-filled with weights/reps
  recoveryScore: number;           // 0-100 (Body Battery)
  recoveryModifier: number;        // 0.95-1.025
  overloadFactor: number;          // 1.0 or 1.025
  globalReason: string;            // "Strong Day: +2.5% Load"
  needsDeload: boolean;            // Deload recommended?
  deloadReason?: string;           // Why deload is needed
  biometricsSource: string;        // "garmin" | "fallback" | "default"
}
```

## 🎯 Recovery Zones

| Body Battery | Modifier | Label | Icon |
|--------------|----------|-------|------|
| < 40% | 0.95 | Recovery Focus: -5% Load | 🔴 |
| 40-60% | 0.975 | Moderate Recovery: -2.5% Load | 🟡 |
| 60-80% | 1.0 | Normal Recovery: Baseline Load | 🔵 |
| > 80% | 1.025 | Strong Day: +2.5% Load | 🟢 |

## 🔄 Performance Tracking

```typescript
import { recordExerciseSuccess, recordExerciseFailure } from "@/features/adaptive/adaptiveEngine";

// After completing a set
if (actualReps >= targetReps) {
  recordExerciseSuccess(exerciseId);
} else {
  recordExerciseFailure(exerciseId); // Triggers deload after 3 failures
}
```

## 🧪 Testing

```typescript
// Stress test (logs 100 scenarios)
import { stressTestAdaptiveEngine } from "@/features/adaptive/adaptiveEngine";
stressTestAdaptiveEngine();

// Visual test page
// Navigate to: /adaptive-test
```

## 📐 Weight Calculation

```
TargetWeight = (LastWeight × OverloadFactor) × RecoveryModifier

Examples:
- Last: 100kg, BB: 85% → 100 × 1.025 × 1.025 = 105kg
- Last: 100kg, BB: 35% → 100 × 1.0 × 0.95 = 95kg
- Last: 100kg, BB: 65% → 100 × 1.025 × 1.0 = 102.5kg
```

## 🔧 Configuration

```typescript
// Default plate increment
plateIncrement: 1.25 // Standard Olympic plate

// Custom increment
plateIncrement: 2.5  // For heavier lifts
plateIncrement: 0.5  // For precise adjustments
```

## ⚠️ Deload Protocol

- **Trigger**: 3 consecutive failures on same exercise
- **Action**: Reduce weight to 70% of last
- **Duration**: 1 week (user-controlled)
- **Focus**: Form and technique
- **Reset**: Automatic on success

## 🔄 Fallback System

1. **Primary**: Garmin API (5s timeout)
2. **Fallback**: 7-day average from cache
3. **Default**: RPE 7 (Body Battery = 70%)

## 📱 UI Components

```typescript
import { AdaptiveInfoBadge } from "@/components/adaptive/AdaptiveInfoBadge";

<AdaptiveInfoBadge
  reason={result.globalReason}
  recoveryScore={result.recoveryScore}
  isDeload={result.needsDeload}
  details={result.deloadReason}
/>
```

## 🎨 Templates

| ID | Exercises |
|----|-----------|
| push | Bench Press, OHP, Incline Press, Lateral Raise, Triceps |
| pull | Pull-Up, Barbell Row, Lat Pulldown, Face Pull, Bicep Curl |
| legs | Squat, RDL, Leg Press, Leg Curl, Calf Raise |
| upper | Bench Press, Barbell Row, OHP, Pull-Up, Dips |
| lower | Squat, RDL, Bulgarian Split Squat, Leg Curl, Calf Raise |

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Weights too high | Check history data, verify recovery score |
| Weights too low | Ensure progressive overload is enabled (BB > 70%) |
| Deload not triggering | Call `recordExerciseFailure()` 3 times |
| Always using fallback | Check Garmin service, network connectivity |
| No history | First-time users get 20kg defaults |

## 📚 Files

- **Engine**: `src/features/adaptive/adaptiveEngine.ts`
- **Hook**: `src/hooks/useAdaptiveWorkout.ts`
- **UI**: `src/components/adaptive/AdaptiveInfoBadge.tsx`
- **Test**: `src/pages/AdaptiveTestPage.tsx`
- **Docs**: `docs/adaptive-engine.md`

## 💡 Pro Tips

1. **Always check `biometricsSource`** - shows data quality
2. **Use deload warnings** - prevent overtraining
3. **Round to practical plates** - easier to load bar
4. **Cache Garmin data** - faster subsequent loads
5. **Test with stress test** - validate calculations

## 🎯 Integration Checklist

- [ ] Import `calculateAdaptiveWorkout`
- [ ] Call with template ID
- [ ] Handle loading state
- [ ] Display recovery info
- [ ] Use pre-filled exercises
- [ ] Record performance
- [ ] Show deload warnings
- [ ] Test fallback scenarios

## 📞 Support

- **Documentation**: `docs/adaptive-engine.md`
- **Test Page**: `/adaptive-test`
- **Code**: `src/features/adaptive/adaptiveEngine.ts`
