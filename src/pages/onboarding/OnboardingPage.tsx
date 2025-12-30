// src/pages/onboarding/OnboardingPage.tsx
import React, { useCallback, useMemo, useState } from "react";
import { useOnboarding } from "../../context/OnboardingContext.tsx";
import { OnboardingProgress } from "../../components/onboarding/OnboardingProgress.tsx";

import { Step1Personal } from "./steps/Step1Personal.tsx";
import { Step2Goals } from "./steps/Step2Goals.tsx";
import { Step3TrainingSetup } from "./steps/Step3TrainingSetup.tsx";
import { Step4Obstacles } from "./steps/Step4Obstacles.tsx";
import { Step5Profile } from "./steps/Step5Profile.tsx";

const TOTAL_STEPS = 5;

interface OnboardingPageProps {
  onFinished: () => void;
}

const clampStep = (n: number) => Math.max(1, Math.min(TOTAL_STEPS, n));

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onFinished }) => {
  const [step, setStep] = useState(1);

  // ✅ zentraler Completion-Pfad (Single Source of Truth)
  const { complete } = useOnboarding();

  const next = useCallback(() => setStep((s) => clampStep(s + 1)), []);
  const back = useCallback(() => setStep((s) => clampStep(s - 1)), []);

  const finish = useCallback(() => {
    complete();
    onFinished();
  }, [complete, onFinished]);

  const progress = useMemo(() => ({ currentStep: step, totalSteps: TOTAL_STEPS }), [step]);

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-center"
      style={{ color: "var(--text)", background: "transparent" }}
    >
      <OnboardingProgress currentStep={progress.currentStep} totalSteps={progress.totalSteps} />

      {step === 1 && <Step1Personal onNext={next} />}
      {step === 2 && <Step2Goals onNext={next} onBack={back} />}
      {step === 3 && <Step3TrainingSetup onNext={next} onBack={back} />}
      {step === 4 && <Step4Obstacles onNext={next} onBack={back} />}
      {step === 5 && <Step5Profile onBack={back} onFinish={finish} />}
    </div>
  );
};

export default OnboardingPage;