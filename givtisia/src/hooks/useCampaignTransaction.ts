import { useState, useCallback } from "react";
import { TESTNET_URL, SHARD_PRIORITY, ShardId } from "@/partisia-config";
import {
  BlockchainTransactionClient,
  SentTransaction,
} from "@partisiablockchain/blockchain-api-transaction-client";
import { Client, RealZkClient } from "@partisiablockchain/zk-client";
import { BlockchainAddress } from "@partisiablockchain/abi-client";
import { CompactBitArray } from "@secata-public/bitmanipulation-ts";
import { useAuth } from "@/auth/useAuth";
import { WalletError } from "@/auth/usePartisiaWallet";
import { deserializeState } from "@/contracts/CrowdfundGenerated";
import { CrowdfundAction, checkPermission } from "@/auth/permissions";

export interface TransactionPointer {
  identifier: string;
  destinationShardId: string;
}

export interface TransactionStep {
  label: string;
  status: "pending" | "success" | "error";
  transactionPointer?: TransactionPointer;
  error?: Error;
}

export interface TransactionResult {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  transactionPointer: TransactionPointer | null;
  steps?: TransactionStep[];
}

export interface SecretInputTransaction {
  type: "secret";
  address: string;
  secretInput: CompactBitArray;
  publicRpc: Buffer;
  gasCost?: number;
}

export interface RegularTransaction {
  type: "regular";
  address: string;
  rpc: Buffer;
  gasCost?: number;
}

export type Transaction = SecretInputTransaction | RegularTransaction;

const fetchContractFromShard = async (id: string, shard: ShardId) => {
  const response = await fetch(
    `${TESTNET_URL}/shards/${shard}/blockchain/contracts/${id}`
  ).then((res) => res.json());

  if (!response?.serializedContract?.openState?.openState?.data) {
    throw new Error(`No contract data from ${shard}`);
  }

  const stateBuffer = Buffer.from(
    response.serializedContract.openState.openState.data,
    "base64"
  );
  return deserializeState(stateBuffer);
};

const getContractState = async (id: string) => {
  let lastError: Error | null = null;

  for (const shard of SHARD_PRIORITY) {
    try {
      return await fetchContractFromShard(id, shard);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (shard === SHARD_PRIORITY[SHARD_PRIORITY.length - 1]) {
        throw lastError;
      }
      continue;
    }
  }
  throw lastError;
};

export function useCampaignTransaction() {
  const { account, isConnected } = useAuth();
  const [result, setResult] = useState<TransactionResult>({
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null,
    transactionPointer: null,
  });

  const requiresWalletConnection = useCallback(() => {
    if (!account) return true;
    return !isConnected;
  }, [account, isConnected]);

  const sendCampaignTransaction = useCallback(
    async (campaignId: string, action: CrowdfundAction, tx: Transaction) => {
      if (!account) {
        throw new WalletError("Wallet not connected", "NOT_CONNECTED");
      }

      if (!isConnected) {
        throw new WalletError(
          "Please reconnect your wallet to perform transactions",
          "NOT_CONNECTED"
        );
      }

      setResult((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Check permissions first
        const state = await getContractState(campaignId);
        const userAddress = BlockchainAddress.fromString(account.getAddress());

        if (!checkPermission(action, state, userAddress)) {
          throw new Error(`Not authorized to ${action}`);
        }

        // Create transaction client with account from auth
        const txClient = BlockchainTransactionClient.create(
          TESTNET_URL,
          account
        );

        let txn: SentTransaction;

        if (tx.type === "secret") {
          // Handle secret input transaction (ZK)
          const zkClient = RealZkClient.create(
            tx.address,
            new Client(TESTNET_URL)
          );
          const transaction = await zkClient.buildOnChainInputTransaction(
            account.getAddress(),
            tx.secretInput,
            tx.publicRpc
          );
          txn = await txClient.signAndSend(transaction, tx.gasCost || 100_000);
        } else {
          // Handle regular transaction
          txn = await txClient.signAndSend(
            { address: tx.address, rpc: tx.rpc },
            tx.gasCost || 100_000
          );
        }

        console.log("Transaction sent:", txn);

        // Wait for spawned events
        await txClient.waitForSpawnedEvents(txn);

        if (!txn.transactionPointer) {
          throw new WalletError(
            "No transaction pointer returned",
            "NO_POINTER"
          );
        }

        const pointer: TransactionPointer = {
          identifier: txn.transactionPointer.identifier,
          destinationShardId:
            txn.transactionPointer.destinationShardId.toString(),
        };

        setResult({
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null,
          transactionPointer: pointer,
        });

        return pointer;
      } catch (err) {
        const error =
          err instanceof WalletError
            ? err
            : new WalletError(
                err instanceof Error ? err.message : String(err),
                "TRANSACTION_ERROR"
              );
        setResult({
          isLoading: false,
          isSuccess: false,
          isError: true,
          error,
          transactionPointer: null,
        });
        throw error;
      }
    },
    [account, isConnected]
  );

  return {
    ...result,
    sendCampaignTransaction,
    requiresWalletConnection,
  };
}
