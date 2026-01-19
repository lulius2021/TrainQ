# QA Audit Report: Onboarding Connectivity Fix

## 1. System-Audit Findings

### 1.1 Column Name Mismatches
Scan of `profiles` table vs `src/components/Onboarding.tsx` revealed:
- **Discrepancy 1**: Code used `goal` (state) while DB expects `persona`.
- **Discrepancy 2**: Code used `available_time_per_week` while DB expects `time_budget`.
- **Typing**: Code sent a `number` for time, while DB `time_budget` is `text`.

### 1.2 Logic Audit (The "Loop" Cause)
The mismatch in column names caused the Supabase `update` call to fail.
- The `catch` block (or `if (error)`) handled the failure by logging it and setting `loading(false)`.
- **Result**: The user remained on the Onboarding screen, and the button reset from "Speichere..." to "Los geht's".
- **Fix**: Corrected column names and data types in `src/components/Onboarding.tsx`.

### 1.3 Connectivity & Race Conditions
- **State Sync**: `AuthContext.tsx` correctly manually updates local state via `completeOnboardingLocal()` immediately after DB success. This bypasses the latency of `onAuthStateChange` (which does not trigger on table updates).
- **Race Condition**: The `await client.from('profiles').update(...)` ensures the DB is updated before the redirect. The subsequent `window.location.href = '/dashboard'` forces a fresh app load, ensuring strict consistency with the server state.

### 1.4 Database Constraint Check
- Verified `profiles` table has no `CHECK` constraints on `time_budget`.
- The column type is `text`, so it accepts strings like "360" (derived from 120 * 3) without issue.

## 2. Applied Fixes

### src/components/Onboarding.tsx
- **Map `persona`**: Linked to `goal` state.
- **Map `time_budget`**: Linked to `weeklyMinutes` (casted to String).
- **Validation**: Ensured payload matches Supabase schema exactly to prevent RLS/Schema errors.

## 3. Verification Steps
1. **User Action**: Complete Onboarding flow (Goal -> Time -> Fitness).
2. **System Action**: Frontend sends `UPDATE profiles SET persona=..., time_budget=..., ...`.
3. **Success**: Supabase returns no error -> `completeOnboardingLocal()` sets React state -> Hard Redirect to `/dashboard`.
4. **Persistency**: Reloading the app triggers `syncSessionToUser` which now fetches `onboarding_completed: true` from DB.

**Status**: ✅ FIXED. Onboarding loop closed. Redirect path verified.
