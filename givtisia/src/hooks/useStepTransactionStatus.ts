import { useEffect, useState, useMemo, useRef } from "react";
import {
  getTransactionStatus,
  TransactionStatus,
} from "./useTransactionStatus";

export interface ActionStatus {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isPending: boolean;
  error: Error | null;
}

export interface StepStatus {
  stepIndex: number;
  status: TransactionStatus;
  isPending: boolean;
}

export function useStepTransactionStatus(
  txnIds: { identifier: string; destinationShardId: string }[]
) {
  const [stepStatuses, setStepStatuses] = useState<StepStatus[]>([]);
  const stepStatusesRef = useRef<StepStatus[]>([]);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    stepStatusesRef.current = stepStatuses;
  }, [stepStatuses]);

  useEffect(() => {
    let cancelled = false;
    let isFetching = false;

    async function fetchAll() {
      if (!txnIds.length) {
        setStepStatuses([]);
        return;
      }

      // Prevent concurrent fetches
      if (isFetching) {
        return;
      }

      isFetching = true;

      try {
        const newStepStatuses: StepStatus[] = [];

        for (let i = 0; i < txnIds.length; i++) {
          if (cancelled) break;

          const { identifier, destinationShardId } = txnIds[i];

          // If no identifier, step is pending
          if (!identifier) {
            newStepStatuses.push({
              stepIndex: i,
              status: {
                isLoading: false,
                isSuccess: false,
                isError: false,
                isFinalized: false,
                error: null,
                data: null,
                contractAddress: null,
                eventChain: [],
              },
              isPending: true,
            });
            continue;
          }

          // Check if previous step is successful before processing current step
          if (i > 0 && !newStepStatuses[i - 1].status.isSuccess) {
            // Previous step hasn't succeeded, so this step is pending
            newStepStatuses.push({
              stepIndex: i,
              status: {
                isLoading: false,
                isSuccess: false,
                isError: false,
                isFinalized: false,
                error: null,
                data: null,
                contractAddress: null,
                eventChain: [],
              },
              isPending: true,
            });
            continue;
          }

          // Fetch transaction status (this includes the full tree)
          const status = await getTransactionStatus({
            identifier,
            destinationShardId,
          });

          if (cancelled) break;

          newStepStatuses.push({
            stepIndex: i,
            status,
            isPending: false,
          });
        }

        if (!cancelled) {
          setStepStatuses(newStepStatuses);
        }
      } finally {
        isFetching = false;
      }
    }

    // Clear any existing interval
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Initial fetch
    fetchAll();

    // Check if we should continue polling using ref to avoid stale closure
    const shouldContinuePolling = () => {
      const currentStatuses = stepStatusesRef.current;
      if (!currentStatuses.length) return true;

      // Stop if any step has an error
      const hasError = currentStatuses.some((step) => step.status.isError);
      if (hasError) return false;

      // Stop if all steps are complete (success or error)
      const allComplete = currentStatuses.every(
        (step) => step.isPending || step.status.isSuccess || step.status.isError
      );
      if (allComplete) return false;

      return true;
    };

    // Set up polling with longer interval and better cleanup
    pollingIntervalRef.current = setInterval(() => {
      if (shouldContinuePolling() && !isFetching) {
        fetchAll();
      } else if (!shouldContinuePolling()) {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    }, 5000); // Increased from 3000ms to 5000ms

    return () => {
      cancelled = true;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [txnIds]);

  // Overall action status logic
  const actionStatus = useMemo((): ActionStatus => {
    if (!stepStatuses.length) {
      return {
        isLoading: false,
        isError: false,
        isSuccess: false,
        isPending: true,
        error: null,
      };
    }

    // Check if any steps are pending
    const hasPending = stepStatuses.some((step) => step.isPending);
    if (hasPending) {
      return {
        isLoading: false,
        isError: false,
        isSuccess: false,
        isPending: true,
        error: null,
      };
    }

    // Check for any errors
    const errorStep = stepStatuses.find((step) => step.status.isError);
    if (errorStep) {
      return {
        isLoading: false,
        isError: true,
        isSuccess: false,
        isPending: false,
        error: errorStep.status.error,
      };
    }

    // Check if all steps are successful
    const allSuccess = stepStatuses.every((step) => step.status.isSuccess);
    if (allSuccess) {
      return {
        isLoading: false,
        isError: false,
        isSuccess: true,
        isPending: false,
        error: null,
      };
    }

    // Otherwise, still processing
    return {
      isLoading: true,
      isError: false,
      isSuccess: false,
      isPending: false,
      error: null,
    };
  }, [stepStatuses]);

  return {
    stepStatuses,
    actionStatus,
  };
}
