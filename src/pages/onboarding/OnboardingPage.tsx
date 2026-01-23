import React, { useState } from "react";
import { useOnboarding } from "../../context/OnboardingContext";
import { useAuth } from "../../hooks/useAuth";
import { getSupabaseClient } from "../../lib/supabaseClient";

import { StepPersona } from "./steps/StepPersona";
import { StepTime } from "./steps/StepTime";
import { StepFitness } from "./steps/StepFitness";
import { LoadingScreen } from "../../components/ui/LoadingScreen";

interface OnboardingPageProps {
  onFinished: () => void;
}

const OnboardingPage: React.FC<OnboardingPageProps> = ({ onFinished }) => {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const { complete, data } = useOnboarding();
  const { user } = useAuth();

  const next = () => setStep(s => s + 1);
  const back = () => setStep(s => Math.max(1, s - 1));

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      if (user?.id) {
        const client = getSupabaseClient();
        if (client) {
          console.log("Saving profile to Supabase...", {
            id: user.id,
            persona: data.personal.persona,
            time_budget: data.training.timeBudget,
            fitness_level: data.personal.fitnessLevel
          });

          const { error } = await client
            .from('profiles')
            .upsert({
              id: user.id,
              persona: data.personal.persona,
              time_budget: data.training.timeBudget,
              fitness_level: data.personal.fitnessLevel,
              onboarding_completed: true,
              updated_at: new Date().toISOString()
            });

          if (error) {
            console.error("Failed to save profile:", error);
          } else {
            console.log("Profile saved successfully.");
          }
        }
      }

      complete();
      onFinished();
    } catch (e) {
      console.error("Onboarding finish error:", e);
      complete();
      onFinished();
    } finally {
      setIsSaving(false);
    }
  };

  if (isSaving) {
    return <LoadingScreen />;
  }

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#0f172a] via-[#0a0e17] to-black text-white overflow-hidden absolute inset-0 z-50">
      {/* Background Gradient Layer for subtle depth */}
      <div className="absolute inset-0 bg-gradient-radial from-blue-900/10 to-transparent pointer-events-none" />

      {step === 1 && <StepPersona onNext={next} />}
      {step === 2 && <StepTime onNext={next} onBack={back} />}
      {step === 3 && <StepFitness onBack={back} onFinish={handleFinish} />}
    </div>
  );
};

export default OnboardingPage;