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
import { useMemo, useState } from "react";
import {
  TransactionStep,
  TransactionPointer,
  useCampaignTransaction,
} from "./useCampaignTransaction";
import {
  AbiBitOutput,
  AbiByteOutput,
  BlockchainAddress,
  BN,
} from "@partisiablockchain/abi-client";
import { BlockchainTransactionClient } from "@partisiablockchain/blockchain-api-transaction-client";

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

  const approveTokens = async (
    tokenAddress: string,
    spenderAddress: string,
    amount: number
  ) => {
    if (!account) throw new Error("Wallet not connected");

    const txClient = BlockchainTransactionClient.create(TESTNET_URL, account);
    const approveRpc = AbiByteOutput.serializeBigEndian((out) => {
      out.writeU8(0x03); // approve shortname
      out.writeAddress(BlockchainAddress.fromString(spenderAddress));
      out.writeUnsignedBigInteger(new BN(amount.toString()), 16);
    });

    const txn = await txClient.signAndSend(
      { address: tokenAddress, rpc: approveRpc },
      100_000
    );

    if (!txn.transactionPointer) {
      throw new Error("No transaction pointer returned");
    }

    return {
      identifier: txn.transactionPointer.identifier,
      destinationShardId: txn.transactionPointer.destinationShardId.toString(),
    };
  };

  const getTokenAllowance = async (
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ) => {
    const response = await fetch(
      `${TESTNET_URL}/shards/Shard0/blockchain/contracts/${tokenAddress}`
    ).then((res) => res.json());

    if (!response?.serializedContract?.allowed) {
      throw new Error("Failed to get token allowances");
    }

    const allowance = getAllowance(response, ownerAddress, spenderAddress);

    return allowance ? BigInt(allowance) : BigInt(0);
  };

  const contributeWithApproval = async (params: {
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
      await approveTokens(tokenAddress, crowdfundingAddress, Number(weiAmount));
    }

    // Now do the contribution
    const rpc = contributeTokens(amount);
    return sendCampaignTransaction(crowdfundingAddress, "contribute_tokens", {
      type: "regular",
      address: crowdfundingAddress,
      rpc,
      gasCost: 100_000,
    });
  };

  const contributeSecretWithApproval = async (params: {
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
      await approveTokens(tokenAddress, crowdfundingAddress, Number(weiAmount));
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
      gasCost: 100_000,
    });
  };

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
        gasCost: 100_000,
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
        gasCost: 100_000,
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
        gasCost: 100_000,
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
        gasCost: 100_000,
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
    }),
    [
      contributeMutation,
      contributeSecretMutation,
      endCampaignMutation,
      withdrawFundsMutation,
      getTokenAllowance,
      contributeWithApproval,
      contributeSecretWithApproval,
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
  const [steps, setSteps] = useState<TransactionStep[]>([
    { label: "Approving token transfer", status: "pending" },
    { label: "Generating zero-knowledge proof", status: "pending" },
    { label: "Submitting contribution", status: "pending" },
  ]);

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

      try {
        // Step 1: Token approval
        setSteps((prev) =>
          prev.map((step, i) =>
            i === 0 ? { ...step, status: "pending" } : step
          )
        );

        // Get current allowance first
        const currentAllowance = await crowdfundingContract.getTokenAllowance(
          tokenAddress,
          account.getAddress(),
          crowdfundingAddress
        );

        const weiAmount = BigInt(amount);
        if (currentAllowance < weiAmount) {
          // Need approval
          const approvalTxn = await crowdfundingContract.contributeWithApproval(
            {
              crowdfundingAddress,
              amount,
              tokenAddress,
            }
          );

          setSteps((prev) =>
            prev.map((step, i) =>
              i === 0
                ? {
                    ...step,
                    status: "success",
                    transactionPointer: approvalTxn,
                  }
                : step
            )
          );
        } else {
          // Skip approval step if already approved
          setSteps((prev) =>
            prev.map((step, i) =>
              i === 0 ? { ...step, status: "success" } : step
            )
          );
        }

        // Step 2: ZK contribution
        setSteps((prev) =>
          prev.map((step, i) =>
            i === 1 ? { ...step, status: "pending" } : step
          )
        );

        const txn = await crowdfundingContract.contributeSecretWithApproval({
          crowdfundingAddress,
          amount,
          tokenAddress,
        });

        setSteps((prev) =>
          prev.map((step, i) =>
            i === 2
              ? { ...step, status: "success", transactionPointer: txn }
              : step
          )
        );

        return { ...txn, steps };
      } catch (error) {
        // Find the first pending step and mark it as error
        const errorIndex = steps.findIndex((step) => step.status === "pending");
        if (errorIndex !== -1) {
          setSteps((prev) =>
            prev.map((step, i) =>
              i === errorIndex
                ? { ...step, status: "error", error: error as Error }
                : step
            )
          );
        }
        // Return a failed result instead of throwing
        return {
          identifier: "",
          destinationShardId: "",
          steps,
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
  const crowdfundingContract = useCrowdfundingContract();
  const queryClient = useQueryClient();
  const { requiresWalletConnection } = useCampaignTransaction();

  const mutation = useMutation({
    mutationFn: async (crowdfundingAddress: string) => {
      const txn = await crowdfundingContract.endCampaign(crowdfundingAddress);
      return txn;
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
  const crowdfundingContract = useCrowdfundingContract();
  const queryClient = useQueryClient();
  const { requiresWalletConnection } = useCampaignTransaction();

  const mutation = useMutation({
    mutationFn: async (crowdfundingAddress: string) => {
      const txn = await crowdfundingContract.withdrawFunds(crowdfundingAddress);
      return txn;
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

type AllowanceEntry = { key: string; value: { value: string } };
type AllowedEntry = { key: string; value: { allowances: AllowanceEntry[] } };

function getAllowance(
  json: { serializedContract: { allowed: AllowedEntry[] } },
  owner: string,
  spender: string
): string | null {
  const ownerEntry = json.serializedContract.allowed.find(
    (entry) => entry.key.toLowerCase() === owner.toLowerCase()
  );
  if (!ownerEntry) return null;
  const spenderEntry = ownerEntry.value.allowances.find(
    (entry) => entry.key.toLowerCase() === spender.toLowerCase()
  );
  return spenderEntry ? spenderEntry.value.value : null;
}
