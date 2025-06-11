import { useState, useEffect, useCallback } from "react";
import { TESTNET_URL, ShardId } from "@/partisia-config";

interface ExecutionStatus {
  success: boolean;
  finalized: boolean;
  transactionCost?: Record<string, unknown>;
  events?: Array<{
    identifier: string;
    destinationShardId: ShardId;
  }>;
  failure?: {
    errorMessage: string;
    stackTrace?: string;
  };
}

interface TransactionData {
  identifier: string;
  executionStatus?: ExecutionStatus;
  content?: string;
  isEvent?: boolean;
  [key: string]: unknown;
}

export interface TransactionStatus {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isFinalized: boolean;
  error: Error | null;
  data: TransactionData | null;
  contractAddress: string | null;
  eventChain: TransactionData[];
}

// --- Pure utility functions ---

async function fetchTransactionFromShard(id: string, shard: ShardId) {
  try {
    const response = await fetch(
      `${TESTNET_URL}/chain/shards/${shard}/transactions/${id}`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.identifier === id) return { data, shard };
    return null;
  } catch {
    return null;
  }
}

const parseErrorMessage = (errorMessage: string) => {
  if (errorMessage.includes("Index 2 out of bounds for length 2")) {
    return "Please get ETH SEPOLIA tokens and bridge them to Partisia";
  }
  return errorMessage;
};

async function checkEventChain(
  events: ExecutionStatus["events"] = [],
  currentChain: TransactionData[] = [],
  depth: number = 0
): Promise<{ chain: TransactionData[]; error: Error | null }> {
  if (!events?.length) return { chain: currentChain, error: null };
  for (const event of events) {
    const result = await fetchTransactionFromShard(
      event.identifier,
      event.destinationShardId
    );
    if (!result) continue;
    const { data } = result;
    const executionStatus = data.executionStatus as ExecutionStatus;
    if (executionStatus?.failure) {
      console.log(
        `[checkEventChain] Error found at depth ${depth}:`,
        executionStatus.failure.errorMessage,
        event.identifier,
        event.destinationShardId
      );
      return {
        chain: [...currentChain, data],
        error: new Error(
          `${parseErrorMessage(executionStatus.failure.errorMessage)}`
        ),
      };
    }
    const updatedChain = [...currentChain, data];
    if (executionStatus?.events?.length) {
      const { chain, error } = await checkEventChain(
        executionStatus.events,
        updatedChain,
        depth + 1
      );
      if (error) return { chain, error };
      currentChain = chain;
    } else {
      currentChain = updatedChain;
    }
  }
  return { chain: currentChain, error: null };
}

// --- Pure async status fetcher ---
export async function getTransactionStatus({
  identifier,
  destinationShardId,
}: {
  identifier: string;
  destinationShardId: string;
}): Promise<TransactionStatus> {
  // Default status
  const defaultStatus: TransactionStatus = {
    isLoading: true,
    isSuccess: false,
    isError: false,
    isFinalized: false,
    error: null,
    data: null,
    contractAddress: null,
    eventChain: [],
  };
  if (!identifier) return defaultStatus;
  try {
    let result = null;
    result = await fetchTransactionFromShard(
      identifier,
      destinationShardId as ShardId
    );
    if (!result) {
      return { ...defaultStatus, isLoading: true };
    }
    const { data } = result;
    const executionStatus = data.executionStatus;
    if (!executionStatus) {
      return { ...defaultStatus, isLoading: true };
    }
    // Check for immediate failure
    if (executionStatus.failure) {
      const errorObj = new Error(
        `${executionStatus.failure.errorMessage}${
          executionStatus.failure.stackTrace
            ? `\n${executionStatus.failure.stackTrace}`
            : ""
        }`
      );
      console.log(`[getTransactionStatus] Immediate failure:`, errorObj);
      return {
        isLoading: false,
        isSuccess: false,
        isError: true,
        isFinalized: true,
        error: errorObj,
        data,
        contractAddress: null,
        eventChain: [data],
      };
    }

    const { chain, error } = await checkEventChain(executionStatus.events, [
      data,
    ]);

    if (error) {
      return {
        isLoading: false,
        isSuccess: false,
        isError: true,
        isFinalized: executionStatus.finalized,
        error,
        data,
        contractAddress: null,
        eventChain: chain,
      };
    }

    let contractAddress: string | null = null;
    if (executionStatus.success) {
      contractAddress = identifier.substring(identifier.length - 40);
    }
    // All steps must be successful and finalized
    const allStepsSuccessful = chain.every(
      (tx) =>
        tx.executionStatus &&
        tx.executionStatus.success &&
        tx.executionStatus.finalized
    );

    const isSuccess = allStepsSuccessful;
    const isError = !allStepsSuccessful || !!error;
    const statusObj = {
      isLoading: false,
      isSuccess,
      isError,
      isFinalized: allStepsSuccessful,
      error: error || null,
      data,
      contractAddress,
      eventChain: chain,
    };
    console.log(`[getTransactionStatus] Final status:`, statusObj);
    return statusObj;
  } catch (error) {
    const errObj = error instanceof Error ? error : new Error(String(error));
    console.log(`[getTransactionStatus] Exception:`, errObj);
    return {
      ...defaultStatus,
      isLoading: false,
      isError: true,
      error: errObj,
    };
  }
}

// --- Main hook ---

export function useTransactionStatus({
  identifier,
  destinationShardId,
}: {
  identifier: string;
  destinationShardId: string;
}) {
  const [status, setStatus] = useState<TransactionStatus>({
    isLoading: true,
    isSuccess: false,
    isError: false,
    isFinalized: false,
    error: null,
    data: null,
    contractAddress: null,
    eventChain: [],
  });

  // Reset status when transaction ID changes
  useEffect(() => {
    setStatus({
      isLoading: true,
      isSuccess: false,
      isError: false,
      isFinalized: false,
      error: null,
      data: null,
      contractAddress: null,
      eventChain: [],
    });
  }, [identifier, destinationShardId]);

  const fetchStatus = useCallback(async () => {
    if (!identifier) return;
    try {
      let result = null;
      result = await fetchTransactionFromShard(
        identifier,
        destinationShardId as ShardId
      );
      if (!result) {
        setStatus((prev) => ({
          ...prev,
          isLoading: true,
          isSuccess: false,
          isError: false,
          isFinalized: false,
        }));
        return;
      }
      const { data } = result;
      const executionStatus = data.executionStatus;
      if (!executionStatus) {
        setStatus((prev) => ({
          ...prev,
          isLoading: true,
          isSuccess: false,
          isError: false,
          isFinalized: false,
        }));
        return;
      }
      // Check for immediate failure
      if (executionStatus.failure) {
        setStatus({
          isLoading: false,
          isSuccess: false,
          isError: true,
          isFinalized: true,
          error: new Error(
            `${executionStatus.failure.errorMessage}${
              executionStatus.failure.stackTrace
                ? `\n${executionStatus.failure.stackTrace}`
                : ""
            }`
          ),
          data,
          contractAddress: null,
          eventChain: [data],
        });
        return;
      }
      // Check event chain recursively
      const { chain, error } = await checkEventChain(executionStatus.events, [
        data,
      ]);

      // If there's an error in the event chain, return early with error status
      if (error) {
        setStatus({
          isLoading: false,
          isSuccess: false,
          isError: true,
          isFinalized: executionStatus.finalized,
          error,
          data,
          contractAddress: null,
          eventChain: chain,
        });
        return;
      }

      let contractAddress: string | null = null;
      if (executionStatus.success) {
        contractAddress = identifier.substring(identifier.length - 40);
      }
      // All steps must be successful and finalized
      const allStepsSuccessful = chain.every(
        (tx) =>
          tx.executionStatus &&
          tx.executionStatus.success &&
          tx.executionStatus.finalized
      );

      const isSuccess = allStepsSuccessful;
      const isError = !allStepsSuccessful || !!error;
      const statusObj = {
        isLoading: false,
        isSuccess,
        isError,
        isFinalized: allStepsSuccessful,
        error: error || null,
        data,
        contractAddress,
        eventChain: chain,
      };
      setStatus(statusObj);
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [identifier, destinationShardId]);

  useEffect(() => {
    if (status.isFinalized || status.isError) return;
    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, [status.isFinalized, status.isError, fetchStatus]);

  return status;
}
