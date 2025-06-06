import { useAuth } from "@/auth/useAuth";
import { TESTNET_URL, SHARD_PRIORITY, ShardId } from "@/partisia-config";
import {
  ContractState,
  deserializeState,
  contributeTokens,
  endCampaign,
  withdrawFunds,
} from "@/contracts/CrowdfundGenerated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import {
  TransactionStep,
  TransactionPointer,
  useCampaignTransaction,
} from "./useCampaignTransaction";
import {
  AbiBitOutput,
  AbiByteOutput,
  BlockchainAddress,
} from "@partisiablockchain/abi-client";
import { BlockchainTransactionClient } from "@partisiablockchain/blockchain-api-transaction-client";

// Gas constants for campaign transactions
const TOKEN_APPROVAL_GAS = 15000;
const TOKEN_CONTRIBUTION_GAS = 200000;
const END_CAMPAIGN_GAS = 150000;
const WITHDRAW_FUNDS_GAS = 100000;

export type Crowdfunding = ContractState & {
  lastUpdated: number;
  shardId: ShardId;
};

// Helper functions for token unit conversion
export function tokenUnitsToDisplayAmount(tokenUnits: number): number {
  return tokenUnits / 1_000_000;
}

export function displayAmountToTokenUnits(displayAmount: number): number {
  return Math.round(displayAmount * 1_000_000);
}

const fetchCrowdfundingFromShard = async (
  id: string,
  shard: ShardId
): Promise<Crowdfunding> => {
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
  const state = deserializeState(stateBuffer);
  return { ...state, lastUpdated: Date.now(), shardId: shard };
};

export const getCrowdfundingState = async (
  id: string
): Promise<Crowdfunding> => {
  let lastError: Error | null = null;

  for (const shard of SHARD_PRIORITY) {
    try {
      const crowdfunding = await fetchCrowdfundingFromShard(id, shard);
      return crowdfunding;
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

export function useCrowdfundingContract() {
  const { account } = useAuth();
  const { sendCampaignTransaction } = useCampaignTransaction();
  const queryClient = useQueryClient();

  const approveTokens = useCallback(
    async (tokenAddress: string, campaignAddress: string, amount: bigint) => {
      if (!account) throw new Error("Wallet not connected");

      // Clean addresses
      const cleanTokenAddr = tokenAddress.startsWith("0x")
        ? tokenAddress.slice(2)
        : tokenAddress;
      const cleanCampaignAddr = campaignAddress.startsWith("0x")
        ? campaignAddress.slice(2)
        : campaignAddress;

      const campaignBlockchainAddr =
        BlockchainAddress.fromString(cleanCampaignAddr);

      // Build the approve RPC buffer
      const approveRpc = AbiByteOutput.serializeBigEndian((out) => {
        out.writeU8(0x05); // approve shortname
        out.writeAddress(campaignBlockchainAddr);

        // Convert BigInt to bytes for u128 (16 bytes)
        const buffer = Buffer.alloc(16);
        for (let i = 0; i < 16; i++) {
          buffer[i] = Number((amount >> BigInt(i * 8)) & BigInt(0xff));
        }
        out.writeBytes(buffer);
      });

      const txClient = BlockchainTransactionClient.create(TESTNET_URL, account);

      const txn = await txClient.signAndSend(
        { address: cleanTokenAddr, rpc: approveRpc },
        TOKEN_APPROVAL_GAS
      );

      if (!txn.transactionPointer) {
        throw new Error("No transaction pointer returned");
      }

      return {
        identifier: txn.transactionPointer.identifier,
        destinationShardId:
          txn.transactionPointer.destinationShardId.toString(),
      };
    },
    [account]
  );

  const getTokenAllowance = useCallback(
    async (
      tokenAddress: string,
      ownerAddress: string,
      spenderAddress: string
    ) => {
      console.log(
        "getTokenAllowance",
        tokenAddress,
        ownerAddress,
        spenderAddress
      );

      return BigInt(0);
      // const response = await fetch(
      //   `${TESTNET_URL}/shards/Shard0/blockchain/contracts/${tokenAddress}`
      // ).then((res) => res.json());

      // if (!response?.serializedContract?.allowed) {
      //   throw new Error("Failed to get token allowances");
      // }

      // const allowance = getAllowance(response, ownerAddress, spenderAddress);

      // return allowance ? BigInt(allowance) : BigInt(0);
    },
    [TESTNET_URL]
  );

  const contributeWithApproval = useCallback(
    async (params: {
      crowdfundingAddress: string;
      amount: number;
      tokenAddress: string;
    }) => {
      const { crowdfundingAddress, amount, tokenAddress } = params;
      if (!account) throw new Error("Wallet not connected");

      // Check current allowance
      const currentAllowance = await getTokenAllowance(
        tokenAddress,
        account.getAddress(),
        crowdfundingAddress
      );

      const weiAmount = BigInt(amount);
      if (currentAllowance < weiAmount) {
        // Need approval
        await approveTokens(tokenAddress, crowdfundingAddress, weiAmount);
      }

      // Now do the contribution
      const rpc = contributeTokens(amount);
      return sendCampaignTransaction(crowdfundingAddress, "contribute_tokens", {
        type: "regular",
        address: crowdfundingAddress,
        rpc,
        gasCost: TOKEN_CONTRIBUTION_GAS,
      });
    },
    [account, getTokenAllowance, sendCampaignTransaction]
  );

  const contributeSecretWithApproval = useCallback(
    async (params: {
      crowdfundingAddress: string;
      amount: number;
      tokenAddress: string;
    }) => {
      const { crowdfundingAddress, amount, tokenAddress } = params;
      if (!account) throw new Error("Wallet not connected");

      // Check current allowance
      const currentAllowance = await getTokenAllowance(
        tokenAddress,
        account.getAddress(),
        crowdfundingAddress
      );

      const weiAmount = BigInt(amount);
      if (currentAllowance < weiAmount) {
        // Need approval
        await approveTokens(tokenAddress, crowdfundingAddress, weiAmount);
      }

      // Now do the secret contribution
      const secretInputData = AbiBitOutput.serialize((_out) => {
        _out.writeU32(amount);
      });

      return sendCampaignTransaction(crowdfundingAddress, "contribute_tokens", {
        type: "secret",
        address: crowdfundingAddress,
        secretInput: secretInputData,
        publicRpc: Buffer.from("40", "hex"),
        gasCost: TOKEN_CONTRIBUTION_GAS,
      });
    },
    [account, getTokenAllowance, sendCampaignTransaction]
  );

  const contributeMutation = useMutation({
    mutationFn: async ({
      crowdfundingAddress,
      amount,
    }: {
      crowdfundingAddress: string;
      amount: number; // Raw token units
    }) => {
      if (!account) throw new Error("Wallet not connected");
      const rpc = contributeTokens(amount);
      return sendCampaignTransaction(crowdfundingAddress, "contribute_tokens", {
        type: "regular",
        address: crowdfundingAddress,
        rpc,
        gasCost: TOKEN_CONTRIBUTION_GAS,
      });
    },
    onSuccess: (_, { crowdfundingAddress }) => {
      queryClient.invalidateQueries({
        queryKey: ["crowdfunding", crowdfundingAddress],
      });
    },
  });

  const contributeSecretMutation = useMutation({
    mutationFn: async ({
      crowdfundingAddress,
      amount,
    }: {
      crowdfundingAddress: string;
      amount: number; // Raw token units
    }) => {
      if (!account) throw new Error("Wallet not connected");

      const secretInputData = AbiBitOutput.serialize((_out) => {
        _out.writeU32(amount);
      });

      return sendCampaignTransaction(crowdfundingAddress, "contribute_tokens", {
        type: "secret",
        address: crowdfundingAddress,
        secretInput: secretInputData,
        publicRpc: Buffer.from("40", "hex"),
        gasCost: TOKEN_CONTRIBUTION_GAS,
      });
    },
    onSuccess: (_, { crowdfundingAddress }) => {
      queryClient.invalidateQueries({
        queryKey: ["crowdfunding", crowdfundingAddress],
      });
    },
  });

  const endCampaignMutation = useMutation({
    mutationFn: async (crowdfundingAddress: string) => {
      if (!account) throw new Error("Wallet not connected");
      const rpc = endCampaign();
      return sendCampaignTransaction(crowdfundingAddress, "end_campaign", {
        type: "regular",
        address: crowdfundingAddress,
        rpc,
        gasCost: END_CAMPAIGN_GAS,
      });
    },
    onSuccess: (_, crowdfundingAddress) => {
      queryClient.invalidateQueries({
        queryKey: ["crowdfunding", crowdfundingAddress],
      });
    },
  });

  const withdrawFundsMutation = useMutation({
    mutationFn: async (crowdfundingAddress: string) => {
      if (!account) throw new Error("Wallet not connected");
      const rpc = withdrawFunds();
      return sendCampaignTransaction(crowdfundingAddress, "withdraw_funds", {
        type: "regular",
        address: crowdfundingAddress,
        rpc,
        gasCost: WITHDRAW_FUNDS_GAS,
      });
    },
    onSuccess: (_, crowdfundingAddress) => {
      queryClient.invalidateQueries({
        queryKey: ["crowdfunding", crowdfundingAddress],
      });
    },
  });

  return useMemo(
    () => ({
      getState: getCrowdfundingState,
      contribute: (crowdfundingAddress: string, amount: number) =>
        contributeMutation.mutateAsync({ crowdfundingAddress, amount }),
      contributeSecret: (crowdfundingAddress: string, amount: number) =>
        contributeSecretMutation.mutateAsync({ crowdfundingAddress, amount }),
      contributeWithApproval,
      contributeSecretWithApproval,
      endCampaign: (crowdfundingAddress: string) =>
        endCampaignMutation.mutateAsync(crowdfundingAddress),
      withdrawFunds: (crowdfundingAddress: string) =>
        withdrawFundsMutation.mutateAsync(crowdfundingAddress),
      getTokenAllowance,
      approveTokens,
      sendCampaignTransaction,
    }),
    [
      contributeMutation,
      contributeSecretMutation,
      endCampaignMutation,
      withdrawFundsMutation,
      getTokenAllowance,
      contributeWithApproval,
      contributeSecretWithApproval,
      approveTokens,
      sendCampaignTransaction,
    ]
  );
}

// React Query mutation hooks that use the base hook
export function useContribute() {
  const crowdfundingContract = useCrowdfundingContract();
  const queryClient = useQueryClient();
  const { requiresWalletConnection } = useCampaignTransaction();

  const mutation = useMutation({
    mutationFn: async ({
      crowdfundingAddress,
      amount,
      tokenAddress,
    }: {
      crowdfundingAddress: string;
      amount: number;
      tokenAddress: string;
    }): Promise<TransactionResult> => {
      try {
        const txn = await crowdfundingContract.contributeWithApproval({
          crowdfundingAddress,
          amount,
          tokenAddress,
        });
        return txn;
      } catch (error) {
        return {
          identifier: "",
          destinationShardId: "",
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["crowdfunding", variables.crowdfundingAddress],
      });
    },
  });

  return {
    ...mutation,
    requiresWalletConnection,
  };
}

// Add at the top with other types
type TransactionResult = TransactionPointer & {
  steps?: TransactionStep[];
  error?: Error;
};

export function useContributeSecret() {
  const crowdfundingContract = useCrowdfundingContract();
  const queryClient = useQueryClient();
  const { requiresWalletConnection } = useCampaignTransaction();
  const { account } = useAuth();
  const [steps, setSteps] = useState<TransactionStep[]>([]);

  const mutation = useMutation({
    mutationFn: async ({
      crowdfundingAddress,
      amount,
      tokenAddress,
    }: {
      crowdfundingAddress: string;
      amount: number;
      tokenAddress: string;
    }): Promise<TransactionResult> => {
      if (!account) throw new Error("Wallet not connected");

      // Use a local variable to track steps
      let currentSteps: TransactionStep[] = [
        { label: "Approving token transfer", status: "pending" },
        { label: "Generating zero-knowledge proof", status: "pending" },
        { label: "Transferring tokens", status: "pending" },
        { label: "Submitting contribution", status: "pending" },
      ];
      setSteps(currentSteps);

      try {
        // Step 1: Token approval
        // (pending already set)
        const currentAllowance = await crowdfundingContract.getTokenAllowance(
          tokenAddress,
          account.getAddress(),
          crowdfundingAddress
        );
        const weiAmount = BigInt(amount);
        if (currentAllowance < weiAmount) {
          const approvalTxn = await crowdfundingContract.approveTokens(
            tokenAddress,
            crowdfundingAddress,
            weiAmount
          );
          currentSteps = currentSteps.map((step, i) =>
            i === 0
              ? { ...step, status: "success", transactionPointer: approvalTxn }
              : step
          );
          setSteps(currentSteps);
        } else {
          currentSteps = currentSteps.map((step, i) =>
            i === 0 ? { ...step, status: "success" } : step
          );
          setSteps(currentSteps);
        }

        // Step 2: ZK commitment (generate and submit secret input)
        currentSteps = currentSteps.map((step, i) =>
          i === 1 ? { ...step, status: "pending" } : step
        );
        setSteps(currentSteps);

        const secretInputData = AbiBitOutput.serialize((_out) => {
          _out.writeU32(amount);
        });

        const zkTxn = await crowdfundingContract.sendCampaignTransaction(
          crowdfundingAddress,
          "contribute_tokens",
          {
            type: "secret",
            address: crowdfundingAddress,
            secretInput: secretInputData,
            publicRpc: Buffer.from("40", "hex"),
            gasCost: TOKEN_CONTRIBUTION_GAS,
          }
        );

        currentSteps = currentSteps.map((step, i) =>
          i === 1
            ? {
                ...step,
                status: "success",
                transactionPointer: zkTxn,
              }
            : step
        );
        setSteps(currentSteps);

        // Wait for ZK state propagation (30 seconds)
        currentSteps = currentSteps.map((step, i) =>
          i === 2
            ? {
                ...step,
                status: "pending",
                label: "Waiting for ZK state propagation...",
              }
            : step
        );
        setSteps(currentSteps);
        await new Promise((resolve) => setTimeout(resolve, 30000));

        // Step 3: Token transfer
        currentSteps = currentSteps.map((step, i) =>
          i === 2
            ? { ...step, status: "pending", label: "Transferring tokens" }
            : step
        );
        setSteps(currentSteps);

        const tokenTransferRpc = AbiByteOutput.serializeBigEndian((_out) => {
          _out.writeU8(0x09); // transfer shortname
          _out.writeBytes(Buffer.from([0x07])); // token transfer type
          _out.writeU32(amount);
        });

        const tokenTransferTxn =
          await crowdfundingContract.sendCampaignTransaction(
            crowdfundingAddress,
            "contribute_tokens",
            {
              type: "regular",
              address: crowdfundingAddress,
              rpc: tokenTransferRpc,
              gasCost: TOKEN_CONTRIBUTION_GAS,
            }
          );

        currentSteps = currentSteps.map((step, i) =>
          i === 2
            ? {
                ...step,
                status: "success",
                transactionPointer: tokenTransferTxn,
              }
            : step
        );
        setSteps(currentSteps);

        // Step 4: Submit contribution (if needed, just mark as success)
        currentSteps = currentSteps.map((step, i) =>
          i === 3 ? { ...step, status: "success" } : step
        );
        setSteps(currentSteps);

        return { ...tokenTransferTxn, steps: currentSteps };
      } catch (error) {
        // Find the first pending step and mark it as error
        const errorIndex = currentSteps.findIndex(
          (step) => step.status === "pending"
        );
        if (errorIndex !== -1) {
          currentSteps = currentSteps.map((step, i) =>
            i === errorIndex
              ? { ...step, status: "error", error: error as Error }
              : step
          );
          setSteps(currentSteps);
        }
        return {
          identifier: "",
          destinationShardId: "",
          steps: currentSteps,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["crowdfunding", variables.crowdfundingAddress],
      });
    },
  });

  return {
    ...mutation,
    requiresWalletConnection,
    steps,
  };
}

export function useEndCampaign() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const { requiresWalletConnection } = useCampaignTransaction();

  const mutation = useMutation({
    mutationFn: async (crowdfundingAddress: string) => {
      if (!account) throw new Error("Wallet not connected");
      if (!crowdfundingAddress) throw new Error("Campaign address is required");

      // Build RPC for end_campaign (shortname 0x01)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09); // Format indicator
        _out.writeBytes(Buffer.from([0x01])); // end_campaign shortname
      });

      const txClient = BlockchainTransactionClient.create(TESTNET_URL, account);
      try {
        const transaction = await txClient.signAndSend(
          { address: crowdfundingAddress, rpc },
          END_CAMPAIGN_GAS
        );
        const txId = transaction.transactionPointer?.identifier || "unknown";
        const shardId = transaction.transactionPointer?.destinationShardId;
        return {
          ...transaction.transactionPointer,
          status: "pending",
          metadata: {
            type: "endCampaign",
            txId,
            shardId,
            usesPublicTarget: true,
            privacyPreserving: true,
            thresholdBasedRevelation: true,
            simplified: true,
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Error ending campaign: ${error.message}`);
        } else {
          throw new Error(`Error ending campaign: ${String(error)}`);
        }
      }
    },
    onSuccess: (_, crowdfundingAddress) => {
      queryClient.invalidateQueries({
        queryKey: ["crowdfunding", crowdfundingAddress],
      });
    },
  });

  return {
    ...mutation,
    requiresWalletConnection,
  };
}

export function useWithdrawFunds() {
  const { account } = useAuth();
  const queryClient = useQueryClient();
  const { requiresWalletConnection } = useCampaignTransaction();

  const mutation = useMutation({
    mutationFn: async (crowdfundingAddress: string) => {
      if (!account) throw new Error("Wallet not connected");
      if (!crowdfundingAddress) throw new Error("Campaign address is required");

      // Build RPC for withdraw_funds (shortname 0x04)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09);
        _out.writeBytes(Buffer.from([0x04]));
      });

      const txClient = BlockchainTransactionClient.create(TESTNET_URL, account);
      try {
        const transaction = await txClient.signAndSend(
          { address: crowdfundingAddress, rpc },
          WITHDRAW_FUNDS_GAS
        );
        const txId = transaction.transactionPointer?.identifier || "unknown";
        const shardId = transaction.transactionPointer?.destinationShardId;
        return {
          ...transaction.transactionPointer,
          status: "pending",
          metadata: {
            type: "withdrawFunds",
            txId,
            shardId,
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`Error withdrawing funds: ${error.message}`);
        } else {
          throw new Error(`Error withdrawing funds: ${String(error)}`);
        }
      }
    },
    onSuccess: (_, crowdfundingAddress) => {
      queryClient.invalidateQueries({
        queryKey: ["crowdfunding", crowdfundingAddress],
      });
    },
  });

  return {
    ...mutation,
    requiresWalletConnection,
  };
}

// type AllowanceEntry = { key: string; value: { value: string } };
// type AllowedEntry = { key: string; value: { allowances: AllowanceEntry[] } };

// function getAllowance(
//   json: { serializedContract: { allowed: AllowedEntry[] } },
//   owner: string,
//   spender: string
// ): string | null {
//   const ownerEntry = json.serializedContract.allowed.find(
//     (entry) => entry.key.toLowerCase() === owner.toLowerCase()
//   );
//   if (!ownerEntry) return null;
//   const spenderEntry = ownerEntry.value.allowances.find(
//     (entry) => entry.key.toLowerCase() === spender.toLowerCase()
//   );
//   return spenderEntry ? spenderEntry.value.value : null;
// }
