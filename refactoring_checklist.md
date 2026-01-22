# Refactoring Checklist

## Global Changes
- [x] Updated `tailwind.config.js` with Apple-grade tokens (brand colors, surface, blur).
- [x] Fixed `MainLayout.tsx` padding (Safe Area + 96px).
- [x] Moved `TabKey` type to `src/types/index.ts` to prevent circular dependencies.
- [x] Refactored `AppRouter.tsx` with clean routing guards to prevent Error #310 loops.

## Components Created
- [x] `src/components/ui/AppCard.tsx` (Glassmorphism, rounded-2xl).
- [x] `src/components/ui/AppButton.tsx` (Apple style variants).
- [x] `src/components/ui/PageHeader.tsx` (Collapsing Large Title style).

## Pages Refactored
- [x] `src/pages/Dashboard.tsx`
  - Replaced hardcoded divs with `AppCard`.
  - Implemented `PageHeader`.
  - Fixed action buttons position.
- [x] `src/pages/SettingPage.tsx`
  - Replaced layouts with `PageHeader` and `AppCard`.
  - Removed redundant padding.

## To Do / Verification
- [ ] Verify `Onboarding.tsx` uses consistent design (Not fully refactored in this pass, checking needed).
- [ ] Verify `AdaptiveTestPage.tsx` uses consistent design.
- [ ] Check iOS SafeArea behavior in simulator/device.
