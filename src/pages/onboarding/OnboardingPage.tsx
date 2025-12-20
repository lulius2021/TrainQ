// src/pages/onboarding/OnboardingPage.tsx
import React, { useState } from "react";
import { OnboardingProvider } from "../../context/OnboardingContext.tsx";
import { OnboardingProgress } from "../../components/onboarding/OnboardingProgress.tsx";

import { Step1Personal } from "./steps/Step1Personal.tsx";
import { Step2Goals } from "./steps/Step2Goals.tsx";
import { Step3TrainingSetup } from "./steps/Step3TrainingSetup.tsx";
import { Step4Obstacles } from "./steps/Step4Obstacles.tsx";
import { Step5Intro } from "./steps/Step5Intro.tsx";
import { Step6Profile } from "./steps/Step6Profile.tsx";

const TOTAL_STEPS = 6;

interface OnboardingPageProps {
  onFinished: () => void;
}

interface OnboardingInnerProps {
  onFinished: () => void;
}

const OnboardingInner: React.FC<OnboardingInnerProps> = ({ onFinished }) => {
  const [step, setStep] = useState(1);

  const next = () => setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  return (
    <div className="min-h-screen bg-[#05060A] text-white flex flex-col justify-center">
      <OnboardingProgress currentStep={step} totalSteps={TOTAL_STEPS} />

      {step === 1 && <Step1Personal onNext={next} />}
      {step === 2 && <Step2Goals onNext={next} onBack={back} />}
      {step === 3 && <Step3TrainingSetup onNext={next} onBack={back} />}
      {step === 4 && <Step4Obstacles onNext={next} onBack={back} />}
      {step === 5 && <Step5Intro onNext={next} onBack={back} />}
      {step === 6 && <Step6Profile onBack={back} onFinish={onFinished} />}
    </div>
  );
};

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onFinished }) => {
  return (
    <OnboardingProvider>
      <OnboardingInner onFinished={onFinished} />
    </OnboardingProvider>
  );
};

export default OnboardingPage;
