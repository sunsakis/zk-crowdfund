import { useState, useEffect, useCallback } from "react";
import { SHARD_PRIORITY, TESTNET_URL } from "@/partisia-config";

interface ExecutionStatus {
  success: boolean;
  finalized: boolean;
  transactionCost?: Record<string, unknown>;
  events?: unknown[];
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
}

export function useTransactionStatus(
  id: string,
  trait?: "ballot" | "collective" | "other"
) {
  const [status, setStatus] = useState<TransactionStatus>({
    isLoading: true,
    isSuccess: false,
    isError: false,
    isFinalized: false,
    error: null,
    data: null,
    contractAddress: null,
  });

  const fetchTransactionFromShard = useCallback(async (id: string) => {
    for (const shard of SHARD_PRIORITY) {
      try {
        const response = await fetch(
          `${TESTNET_URL}/chain/shards/${shard}/transactions/${id}`
        );

        if (!response.ok) continue;

        try {
          // Try to parse as JSON directly first
          const data = await response.json();
          console.log("Fetched transaction data:", data);
          if (data?.identifier === id) {
            console.log(`Found transaction in ${shard}`);
            return { data, shard };
          }
        } catch (jsonError) {
          console.debug(
            `Initial JSON parse failed for shard ${shard}:`,
            jsonError
          );
          // If JSON parsing fails, try to get text and parse manually
          const text = await response.text();
          try {
            // Clean the response text if needed
            const cleanedText = text.trim();
            const data = JSON.parse(cleanedText);
            if (data?.identifier === id) {
              console.log(`Found transaction in ${shard} (after text cleanup)`);
              return { data, shard };
            }
          } catch (e) {
            console.debug(`Failed to parse response from shard ${shard}:`, e);
            continue;
          }
        }
      } catch (e) {
        console.debug(`Failed to fetch from shard ${shard}:`, e);
        continue;
      }
    }
    return null;
  }, []);

  const fetchContractFromShards = useCallback(
    async (contractAddress: string) => {
      for (const shard of SHARD_PRIORITY) {
        try {
          const response = await fetch(
            `${TESTNET_URL}/shards/${shard}/blockchain/contracts/${contractAddress}`
          );

          if (!response.ok) continue;

          const data = await response.json();
          if (data?.serializedContract) {
            return true;
          }
        } catch (e) {
          console.debug(`Failed to fetch contract from shard ${shard}:`, e);
          continue;
        }
      }
      return false;
    },
    []
  );

  const fetchStatus = useCallback(async () => {
    if (!id) return;

    let prefix = "02";
    if (trait === "ballot") prefix = "03";
    else if (trait === "collective") prefix = "02";

    try {
      const result = await fetchTransactionFromShard(id);
      console.log("Transaction result:", result);

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

      let contractAddress: string | null = null;
      // Only look for contract address if this is a deployment
      if (executionStatus.success && trait !== "other") {
        // Contract address is derived from the transaction ID
        contractAddress = prefix + id.substring(id.length - 40);

        // Only check contract existence for deployments
        if (contractAddress) {
          const contractExists = await fetchContractFromShards(contractAddress);
          if (!contractExists) {
            setStatus((prev) => ({
              ...prev,
              isLoading: true,
              isSuccess: executionStatus.success,
              isError: false,
              isFinalized: executionStatus.finalized,
              contractAddress,
            }));
            return;
          }
        }
      }

      // Distinguish deploy vs change for isFinalized
      const isDeploy = trait === "ballot" || trait === "collective";
      const isFinalized = isDeploy
        ? executionStatus.finalized
        : executionStatus.success;

      setStatus({
        isLoading: false,
        isSuccess: executionStatus.success,
        isError: !executionStatus.success,
        isFinalized,
        error: executionStatus.success ? null : new Error("Transaction failed"),
        data: {
          identifier: data.identifier,
          executionStatus: {
            success: executionStatus.success,
            finalized: executionStatus.finalized,
            events: executionStatus.events,
            transactionCost: executionStatus.transactionCost,
          },
          content: data.content,
          isEvent: data.isEvent,
        },
        contractAddress,
      });
    } catch (error) {
      setStatus((prev) => ({
        ...prev,
        isLoading: false,
        isError: true,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [id, trait]);

  useEffect(() => {
    if (status.isFinalized || status.isError) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [status.isFinalized, status.isError, fetchStatus]);

  return status;
}
