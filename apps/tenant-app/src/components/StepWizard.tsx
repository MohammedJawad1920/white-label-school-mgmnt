import React from "react";

interface Step {
  label: string;
  description?: string;
}

interface StepWizardProps {
  steps: Step[];
  currentStep: number; // 0-indexed
}

export function StepWizard({ steps, currentStep }: StepWizardProps) {
  return (
    <nav aria-label="Progress" className="flex items-center space-x-2">
      {steps.map((step, index) => {
        const isComplete = index < currentStep;
        const isCurrent = index === currentStep;
        return (
          <React.Fragment key={step.label}>
            {index > 0 && (
              <div
                className={`h-px flex-1 ${isComplete || isCurrent ? "bg-indigo-600" : "bg-gray-200"}`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium
                  ${isComplete ? "bg-indigo-600 text-white" : isCurrent ? "border-2 border-indigo-600 text-indigo-600" : "border-2 border-gray-300 text-gray-400"}`}
              >
                {isComplete ? "✓" : index + 1}
              </div>
              <span
                className={`mt-1 text-xs ${isCurrent ? "font-semibold text-indigo-600" : isComplete ? "text-gray-700" : "text-gray-400"}`}
              >
                {step.label}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
