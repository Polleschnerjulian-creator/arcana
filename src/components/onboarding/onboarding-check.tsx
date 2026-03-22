"use client";

import { useState, useEffect } from "react";
import { OnboardingWizard } from "./onboarding-wizard";

export function OnboardingCheck({ isEmpty }: { isEmpty: boolean }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isEmpty && !localStorage.getItem("arcana-onboarding-done")) {
      setShow(true);
    }
  }, [isEmpty]);

  if (!show) return null;

  return (
    <OnboardingWizard
      onComplete={() => {
        localStorage.setItem("arcana-onboarding-done", "true");
        setShow(false);
      }}
    />
  );
}
