import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  ExternalLink,
  Lollipop,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  TransactionResult as BaseTransactionResult,
  TransactionStep,
} from "@/hooks/useCampaignTransaction";
import { TransactionStepper } from "./TransactionStepper";
import { TESTNET_URL } from "@/partisia-config";
import { TransactionStatus } from "@/hooks/useTransactionStatus";
import { useStepTransactionStatus } from "@/hooks/useStepTransactionStatus";

interface StepTransactionDialogProps {
  transactionResult: TransactionResult;
  campaignId: string;
  onClose?: () => void;
}

// Extend TransactionResult to allow allTransactionPointers
type TransactionResult = BaseTransactionResult & {
  allTransactionPointers?: { identifier: string; destinationShardId: string }[];
};

const EventChainDisplay = ({
  eventChain,
}: {
  eventChain: TransactionStatus["eventChain"];
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show if there are errors in the chain
  const errorsInChain = eventChain.filter(
    (event) => event.executionStatus?.failure
  );

  if (!errorsInChain.length) return null;

  return (
    <div className="w-full space-y-2 mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full p-2 text-left hover:bg-gray-50 rounded-md transition-colors"
      >
        <h4 className="text-sm font-semibold text-red-700">
          Errors in Transaction Chain ({errorsInChain.length})
        </h4>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-red-700" />
        ) : (
          <ChevronDown className="w-4 h-4 text-red-700" />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-2 max-w-md">
          {errorsInChain.map((event) => (
            <div
              key={event.identifier}
              className="p-3 bg-red-50 rounded-md border border-red-200"
            >
              <div className="flex items-center justify-between mb-2">
                <code className="text-xs font-mono bg-red-100 px-1.5 py-0.5 rounded text-red-800">
                  {event.identifier.substring(0, 8)}...
                  {event.identifier.substring(event.identifier.length - 8)}
                </code>
                <a
                  href={`${TESTNET_URL.replace("node1", "browser")}/transactions/${event.identifier}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs font-medium text-red-700 hover:text-red-900"
                >
                  view <ExternalLink className="w-3 h-3 ml-0.5" />
                </a>
              </div>
              {event.executionStatus?.failure && (
                <div>
                  <p className="text-xs text-red-600 font-medium">Error:</p>
                  <p className="text-xs text-red-600 mt-1">
                    {event.executionStatus.failure.errorMessage}
                  </p>
                  {event.executionStatus.failure.stackTrace && (
                    <>
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        Stack Trace:
                      </p>
                      <pre className="text-xs text-red-500 mt-1 whitespace-pre-wrap max-h-40 overflow-auto max-w-full">
                        {event.executionStatus.failure.stackTrace}
                      </pre>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const TransactionIdDisplay = ({
  transactionPointer,
  explorerUrl,
}: {
  transactionPointer: { identifier: string } | null;
  explorerUrl: string;
}) => {
  if (!transactionPointer) return null;

  return (
    <div className="w-full flex items-center justify-between mt-1 p-2 bg-gray-50 rounded-md border border-gray-200">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-500 font-medium">
          Transaction ID:
        </span>
        <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
          {transactionPointer.identifier.substring(0, 8)}...
          {transactionPointer.identifier.substring(
            transactionPointer.identifier.length - 8
          )}
        </code>
      </div>
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
      >
        view <ExternalLink className="w-3 h-3 ml-0.5" />
      </a>
    </div>
  );
};

export function StepTransactionDialog({
  transactionResult,
  campaignId,
  onClose,
}: StepTransactionDialogProps) {
  const [open, setOpen] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const lastTransactionId = useRef<string | null>(null);
  const [persistedSteps, setPersistedSteps] = useState<TransactionStep[]>([]);

  const transactionIds = useMemo(
    () =>
      transactionResult.allTransactionPointers ||
      (transactionResult.transactionPointer
        ? [
            {
              identifier: transactionResult.transactionPointer.identifier,
              destinationShardId:
                transactionResult.transactionPointer.destinationShardId,
            },
          ]
        : []),
    [
      transactionResult.allTransactionPointers,
      transactionResult.transactionPointer,
    ]
  );

  // Use useStepTxnStatus for transaction status tracking
  const stepStatuses = useStepTransactionStatus(
    transactionIds as { identifier: string; destinationShardId: string }[]
  );

  // Use action status for overall state, individual step statuses for detailed tracking
  const overallStatus = stepStatuses.actionStatus;
  const individualStepStatuses = stepStatuses.stepStatuses;

  // Check if all steps are actually completed (both transaction status and UI steps)
  const allStepsCompleted = useMemo(() => {
    if (!transactionIds[0]?.identifier) return false;
    if (individualStepStatuses.length !== transactionIds.length) return false;

    const allTxnsSuccessful = individualStepStatuses.every(
      (s) => s.status.isSuccess
    );
    const allPersistedStepsCompleted =
      persistedSteps.length > 0 &&
      persistedSteps.every((step) => step.status === "success");

    return persistedSteps.length === 0
      ? allTxnsSuccessful
      : allTxnsSuccessful && allPersistedStepsCompleted;
  }, [individualStepStatuses, persistedSteps, transactionIds.length]);

  // Override the overall status to use our custom completion check
  const effectiveStatus = useMemo(() => {
    if (!overallStatus) return null;
    // Guard: if not all statuses are present, force loading
    if (individualStepStatuses.length !== transactionIds.length) {
      return {
        ...overallStatus,
        isLoading: true,
        isSuccess: false,
        isError: false,
      };
    }
    // If there's an error, keep the error state
    if (overallStatus.isError) {
      return overallStatus;
    }

    // Check if any individual step has an error
    const hasStepError = individualStepStatuses.some((s) => s.status.isError);
    if (hasStepError) {
      const firstError = individualStepStatuses.find((s) => s.status.isError);
      return {
        ...overallStatus,
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: firstError?.status.error || new Error("Transaction step failed"),
      };
    }
    // If all steps are completed, show success
    if (allStepsCompleted) {
      return {
        ...overallStatus,
        isLoading: false,
        isSuccess: true,
        isError: false,
      };
    }
    // Otherwise, keep loading state
    return {
      ...overallStatus,
      isLoading: true,
      isSuccess: false,
      isError: false,
    };
  }, [
    overallStatus,
    allStepsCompleted,
    individualStepStatuses,
    transactionIds.length,
  ]);

  useEffect(() => {
    if (effectiveStatus?.isSuccess) {
      setShowConfetti(true);
    }
  }, [effectiveStatus?.isSuccess]);

  // Helper to get event chain from step statuses
  const getEventChain = () => {
    // Get event chain from the first step that has one
    return (
      individualStepStatuses.find((s) => s.status.eventChain?.length)?.status
        .eventChain || []
    );
  };

  // Helper to get detailed step information for error reporting
  const getStepErrorDetails = () => {
    if (transactionIds.length <= 1) return [];

    return individualStepStatuses
      .map((status, index) => ({
        stepIndex: index,
        status,
        hasError: status.status.isError,
        error: status.status.error,
      }))
      .filter((step) => step.hasError);
  };

  // Reset state when a new transaction starts
  useEffect(() => {
    const currentTxId = transactionResult.transactionPointer?.identifier;
    if (currentTxId && currentTxId !== lastTransactionId.current) {
      lastTransactionId.current = currentTxId;
      setOpen(true);
      setShowConfetti(false);
      // Only reset steps if this is a completely new transaction
      if (!transactionResult.steps) {
        setPersistedSteps([]);
      }
    }
  }, [transactionResult.transactionPointer?.identifier]);

  // Always sync persisted steps to latest steps if provided
  useEffect(() => {
    if (transactionResult.steps) {
      setPersistedSteps(transactionResult.steps);
    }
  }, [transactionResult.steps]);

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  const getProgressPercentage = () => {
    if (effectiveStatus?.isLoading) return 40;
    if (effectiveStatus?.isSuccess) return 100;
    if (effectiveStatus?.isError) return 100;
    return 20;
  };

  const transactionExplorerUrl = transactionResult.transactionPointer
    ? `${TESTNET_URL.replace("node1", "browser")}/transactions/${transactionResult.transactionPointer.identifier}`
    : "";
  const campaignExplorerUrl = `${TESTNET_URL.replace("node1", "browser")}/contracts/${campaignId}?tab=state`;

  // Find the first error step if any
  const errorStep = transactionResult.steps?.find(
    (step) => step.status === "error"
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen && effectiveStatus?.isLoading) {
          return;
        }
        setOpen(newOpen);
        if (!newOpen) onClose?.();
      }}
    >
      <DialogContent
        className="sm:max-w-[480px] border-2 border-black rounded-lg p-0 overflow-x-hidden overflow-y-auto transition-all duration-300 shadow-xl"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="border-b border-gray-200 p-4">
          <DialogTitle className="text-xl font-bold">
            Processing Transaction
          </DialogTitle>
        </DialogHeader>

        <div
          className={`h-1.5 transition-all duration-700 ease-in-out ${
            effectiveStatus?.isError
              ? "bg-red-500"
              : effectiveStatus?.isSuccess
                ? "bg-green-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${getProgressPercentage()}%` }}
        />

        <div className="flex flex-col items-center pb-6 px-5 space-y-6 pt-4">
          {/* Always show persisted steps */}
          {persistedSteps.length > 0 && (
            <div className="w-full">
              <TransactionStepper steps={persistedSteps} />
            </div>
          )}

          {/* Show final transaction status below steps */}
          <div className="w-full border-t border-gray-200 pt-4">
            {effectiveStatus?.isError ? (
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="relative flex items-center justify-center w-20 h-20 bg-red-50 rounded-full">
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
                <p className="text-center text-lg font-medium">
                  {errorStep
                    ? "Transaction step failed"
                    : "There was an error processing your transaction"}
                </p>
                <div className="w-full bg-red-50 p-4 rounded-md border border-red-200">
                  <p className="text-sm text-red-600">
                    {errorStep ? (
                      <>
                        <span className="font-medium">{errorStep.label}:</span>{" "}
                        {errorStep.error?.message || "Unknown error"}
                      </>
                    ) : (
                      effectiveStatus.error?.message || "Unknown error"
                    )}
                  </p>
                  {transactionIds.length > 1 && (
                    <div className="mt-2">
                      <p className="text-xs text-red-600 font-medium">
                        Step Details:
                      </p>
                      {getStepErrorDetails().map((stepDetail) => (
                        <div
                          key={stepDetail.stepIndex}
                          className="mt-1 text-xs text-red-600"
                        >
                          <span className="font-medium">
                            Step {stepDetail.stepIndex + 1}:
                          </span>{" "}
                          {stepDetail.error?.message || "Unknown error"}
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-red-500 mt-2">
                    Try again or contact support if this persists
                  </p>
                </div>
                <TransactionIdDisplay
                  transactionPointer={transactionResult.transactionPointer}
                  explorerUrl={transactionExplorerUrl}
                />
                <EventChainDisplay eventChain={getEventChain()} />
              </div>
            ) : effectiveStatus?.isSuccess ? (
              <div className="flex flex-col items-center space-y-4 w-full">
                {showConfetti && !effectiveStatus.isError && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="confetti-container" aria-hidden="true" />
                  </div>
                )}
                <h4 className="text-7xl font-bold animate-bounce">🎉</h4>
                <p className="text-center text-xl font-medium leading-tight">
                  Your transaction has been processed!
                </p>

                <div className="w-full border-t border-gray-200 pt-4 mt-2">
                  <h4 className="text-sm font-semibold mb-2">
                    Transaction Details
                  </h4>
                  <TransactionIdDisplay
                    transactionPointer={transactionResult.transactionPointer}
                    explorerUrl={transactionExplorerUrl}
                  />

                  <div className="w-full flex items-center justify-between mt-3 p-2 bg-green-50 rounded-md border border-green-200">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-green-700 font-medium">
                        Campaign Address:
                      </span>
                      <code className="text-xs font-mono bg-green-100 px-1.5 py-0.5 rounded text-green-800">
                        {campaignId.substring(0, 8)}...
                        {campaignId.substring(campaignId.length - 8)}
                      </code>
                    </div>
                    <a
                      href={campaignExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-medium text-green-700 hover:text-green-900"
                    >
                      view <ExternalLink className="w-3 h-3 ml-0.5" />
                    </a>
                  </div>

                  <EventChainDisplay eventChain={getEventChain()} />
                </div>
              </div>
            ) : effectiveStatus?.isLoading ? (
              <div className="flex flex-col items-center space-y-4 w-full">
                <div className="flex items-center justify-center w-24 h-24">
                  <Lollipop className="h-16 w-16 text-yellow-400 animate-spin" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-center text-lg font-medium">
                    Processing transaction
                  </p>
                  <p className="text-sm text-gray-500">
                    This may take a few moments...
                  </p>
                </div>
                <TransactionIdDisplay
                  transactionPointer={transactionResult.transactionPointer}
                  explorerUrl={transactionExplorerUrl}
                />
                <EventChainDisplay eventChain={getEventChain()} />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col w-full space-y-4 mt-2">
            <Button
              variant="default"
              onClick={handleClose}
              className={`w-full py-5 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                effectiveStatus?.isError
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-black hover:bg-stone-800"
              }`}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
