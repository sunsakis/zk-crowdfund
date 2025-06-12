import { Check, AlertCircle, Loader2 } from "lucide-react";
import { TransactionStep } from "@/hooks/useCampaignTransaction";

interface TransactionStepperProps {
  steps: TransactionStep[];
}

export function TransactionStepper({ steps }: TransactionStepperProps) {
  // Find the first pending step to determine which steps should be shown as completed
  const firstPendingIndex = steps.findIndex(
    (step) => step.status === "pending"
  );
  const hasError = steps.some((step) => step.status === "error");

  return (
    <div className="w-full space-y-4">
      {steps.map((step, index) => {
        // Determine the effective status:
        // - If there's an error, all steps after the error are pending
        // - If no error, steps before first pending are success, first pending is pending, rest are pending
        let effectiveStatus = step.status;
        if (!hasError) {
          if (firstPendingIndex === -1) {
            // All steps are either success or error
            effectiveStatus = step.status;
          } else if (index < firstPendingIndex) {
            effectiveStatus = "success";
          } else if (index === firstPendingIndex) {
            effectiveStatus = "pending";
          } else {
            effectiveStatus = "pending";
          }
        } else {
          const errorIndex = steps.findIndex((s) => s.status === "error");
          if (index < errorIndex) {
            effectiveStatus = "success";
          } else if (index === errorIndex) {
            effectiveStatus = "error";
          } else {
            effectiveStatus = "pending";
          }
        }

        return (
          <div
            key={index}
            className={`flex items-center gap-4 p-3 rounded-lg border ${
              effectiveStatus === "error"
                ? "bg-red-50 border-red-200"
                : effectiveStatus === "success"
                  ? "bg-green-50 border-green-200"
                  : "bg-gray-50 border-gray-200"
            }`}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                effectiveStatus === "error"
                  ? "bg-red-100 text-red-600"
                  : effectiveStatus === "success"
                    ? "bg-green-100 text-green-600"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {effectiveStatus === "pending" && index === firstPendingIndex && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {effectiveStatus === "success" && <Check className="w-4 h-4" />}
              {effectiveStatus === "error" && (
                <AlertCircle className="w-4 h-4" />
              )}
              {effectiveStatus === "pending" && index !== firstPendingIndex && (
                <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
              )}
            </div>

            <div className="flex-grow min-w-0">
              <div className="flex items-center justify-between">
                <p
                  className={`text-sm font-medium ${
                    effectiveStatus === "error"
                      ? "text-red-700"
                      : effectiveStatus === "success"
                        ? "text-green-700"
                        : "text-gray-700"
                  }`}
                >
                  {step.label}
                </p>
                {step.transactionPointer && (
                  <a
                    href={`https://browser.testnet.partisiablockchain.com/transactions/${step.transactionPointer.identifier}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    View txn
                  </a>
                )}
              </div>
              {step.error && (
                <p className="mt-1 text-xs text-red-600">
                  {step.error.message}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
