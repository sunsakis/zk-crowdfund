import { useState, useEffect, useCallback } from "react";
import { SHARD_PRIORITY, TESTNET_URL, ShardId } from "@/partisia-config";

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

const fetchTransactionFromShard = async (id: string, shard: ShardId) => {
  try {
    console.log(`Fetching transaction ${id} from shard ${shard}...`);
    const response = await fetch(
      `${TESTNET_URL}/chain/shards/${shard}/transactions/${id}`
    );

    if (!response.ok) {
      console.log(`No transaction found in shard ${shard}`);
      return null;
    }

    const data = await response.json();
    if (data?.identifier === id) {
      console.log(`Found transaction in ${shard}`, {
        id,
        hasEvents: !!data.executionStatus?.events?.length,
        eventCount: data.executionStatus?.events?.length || 0,
        success: data.executionStatus?.success,
        failure: !!data.executionStatus?.failure,
        events: data.executionStatus?.events,
      });
      return { data, shard };
    }
    return null;
  } catch (e) {
    console.debug(`Failed to fetch transaction from shard ${shard}:`, e);
    return null;
  }
};

const checkEventChain = async (
  events: ExecutionStatus["events"] = [],
  currentChain: TransactionData[] = [],
  depth: number = 0
): Promise<{ chain: TransactionData[]; error: Error | null }> => {
  if (!events?.length) {
    console.log(`Reached end of event chain at depth ${depth}`);
    return { chain: currentChain, error: null };
  }

  console.log(`Checking ${events.length} events at depth ${depth}...`);

  for (const event of events) {
    console.log(`Processing event at depth ${depth}:`, {
      id: event.identifier,
      shard: event.destinationShardId,
    });

    const result = await fetchTransactionFromShard(
      event.identifier,
      event.destinationShardId
    );
    if (!result) {
      console.log(
        `Could not find event transaction ${event.identifier} in shard ${event.destinationShardId}`
      );
      continue;
    }

    const { data } = result;
    const executionStatus = data.executionStatus as ExecutionStatus;

    // If we find a failure, stop checking and return error
    if (executionStatus?.failure) {
      console.log(`Found failure in event chain at depth ${depth}:`, {
        id: event.identifier,
        message: executionStatus.failure.errorMessage,
      });
      return {
        chain: [...currentChain, data],
        error: new Error(`${executionStatus.failure.errorMessage}`),
      };
    }

    // Add this transaction to the chain
    const updatedChain = [...currentChain, data];

    // If this transaction has events, recursively check them
    if (executionStatus?.events?.length) {
      console.log(
        `Found ${executionStatus.events.length} nested events at depth ${depth}`
      );
      const { chain, error } = await checkEventChain(
        executionStatus.events,
        updatedChain,
        depth + 1
      );

      if (error) {
        console.log(`Error in nested event chain at depth ${depth}:`, error);
        return { chain, error };
      }

      // Update our chain with the nested events
      currentChain = chain;
    } else {
      console.log(`No nested events found at depth ${depth}`);
      currentChain = updatedChain;
    }
  }

  console.log(
    `Completed checking events at depth ${depth}, chain length: ${currentChain.length}`
  );
  return { chain: currentChain, error: null };
};

export function useTransactionStatus(id: string) {
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
  }, [id]);

  const fetchStatus = useCallback(async () => {
    if (!id) return;

    try {
      console.log(`Starting transaction status check for ${id}`);

      // Try each shard until we find the transaction
      let result = null;
      for (const shard of SHARD_PRIORITY) {
        result = await fetchTransactionFromShard(id, shard);
        if (result) break;
      }

      if (!result) {
        console.log(`Transaction ${id} not found in any shard`);
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
        console.log(`No execution status for transaction ${id}`);
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
        console.log(
          `Found immediate failure for transaction ${id}:`,
          executionStatus.failure
        );
        setStatus({
          isLoading: false,
          isSuccess: false,
          isError: true,
          isFinalized: true,
          error: new Error(
            `${executionStatus.failure.message}${
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

      console.log(`Checking event chain for transaction ${id}`);
      // Check event chain recursively
      const { chain, error } = await checkEventChain(executionStatus.events, [
        data,
      ]);

      let contractAddress: string | null = null;
      if (executionStatus.success) {
        contractAddress = id.substring(id.length - 40);
      }

      console.log(`Transaction ${id} status update:`, {
        success: !error && executionStatus.success,
        error: !!error,
        finalized: executionStatus.finalized,
        chainLength: chain.length,
      });

      setStatus({
        isLoading: false,
        isSuccess: !error && executionStatus.success,
        isError: !!error || !executionStatus.success,
        isFinalized: executionStatus.finalized,
        error,
        data,
        contractAddress,
        eventChain: chain,
      });
    } catch (error) {
      console.error(`Error checking transaction ${id}:`, error);
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [id]);

  useEffect(() => {
    if (status.isFinalized || status.isError) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [status.isFinalized, status.isError, fetchStatus]);

  return status;
}
