import { useState, useEffect, useCallback } from "react";
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
import { TransactionResult } from "@/hooks/useCampaignTransaction";
import { TESTNET_URL } from "@/partisia-config";
import { TransactionStatus } from "@/hooks/useTransactionStatus";

interface TransactionDialogProps {
  transactionResult: TransactionResult;
  campaignId: string;
  onClose?: () => void;
  status?: TransactionStatus;
}

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

export function TransactionDialog({
  transactionResult,
  campaignId,
  onClose,
  status,
}: TransactionDialogProps) {
  const [open, setOpen] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (transactionResult.isSuccess) {
      setShowConfetti(true);
    }
  }, [transactionResult.isSuccess]);

  const getProgressPercentage = () => {
    if (transactionResult.isLoading) return 40;
    if (transactionResult.isSuccess) return 100;
    if (transactionResult.isError) return 100;
    return 20;
  };

  const transactionExplorerUrl = transactionResult.transactionPointer
    ? `${TESTNET_URL.replace("node1", "browser")}/transactions/${transactionResult.transactionPointer.identifier}`
    : "";
  const campaignExplorerUrl = `${TESTNET_URL.replace("node1", "browser")}/contracts/${campaignId}?tab=state`;

  const TransactionIdDisplay = () => {
    if (!transactionResult.transactionPointer) return null;
    return (
      <div className="w-full flex items-center justify-between mt-1 p-2 bg-gray-50 rounded-md border border-gray-200">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">
            Transaction ID:
          </span>
          <code className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
            {transactionResult.transactionPointer.identifier.substring(0, 8)}...
            {transactionResult.transactionPointer.identifier.substring(
              transactionResult.transactionPointer.identifier.length - 8
            )}
          </code>
        </div>
        <a
          href={transactionExplorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          view <ExternalLink className="w-3 h-3 ml-0.5" />
        </a>
      </div>
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen && transactionResult.isLoading) {
          return;
        }
        setOpen(newOpen);
        if (!newOpen) {
          onClose?.();
        }
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
            transactionResult.isError
              ? "bg-red-500"
              : transactionResult.isSuccess
                ? "bg-green-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${getProgressPercentage()}%` }}
        />

        <div className="flex flex-col items-center pb-6 px-5 space-y-6 pt-4">
          {transactionResult.isError ? (
            <div className="flex flex-col items-center space-y-4 w-full">
              <div className="relative flex items-center justify-center w-20 h-20 bg-red-50 rounded-full">
                <AlertCircle className="h-10 w-10 text-red-500" />
              </div>
              <p className="text-center text-lg font-medium">
                There was an error processing your transaction
              </p>
              <div className="w-full bg-red-50 p-4 rounded-md border border-red-200">
                <p className="text-sm text-red-600">
                  {transactionResult.error?.message || "Unknown error"}
                </p>
                <p className="text-xs text-red-500 mt-2">
                  Try again or contact support if this persists
                </p>
              </div>
              <TransactionIdDisplay />
              <EventChainDisplay eventChain={status?.eventChain || []} />
            </div>
          ) : transactionResult.isSuccess ? (
            <div className="flex flex-col items-center space-y-4 w-full">
              {showConfetti && !transactionResult.isError && (
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
                <TransactionIdDisplay />

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

                <EventChainDisplay eventChain={status?.eventChain || []} />
              </div>
            </div>
          ) : transactionResult.isLoading ? (
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
              <TransactionIdDisplay />
              <EventChainDisplay eventChain={status?.eventChain || []} />
            </div>
          ) : null}

          <div className="flex flex-col w-full space-y-4 mt-2">
            <Button
              variant="default"
              onClick={handleClose}
              className={`w-full py-5 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${
                transactionResult.isError
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
