import { ReactNode, useCallback } from "react";
import { AuthContext, AuthMethod } from "./AuthContext";
import { SenderAuthentication } from "@partisiablockchain/blockchain-api-transaction-client";
import { BlockchainAddress } from "@partisiablockchain/abi-client";
import { checkPermission, CrowdfundAction } from "./permissions";
import { usePartisiaWallet } from "./usePartisiaWallet";
import { deserializeState } from "@/contracts/CrowdfundGenerated";
import { TESTNET_URL } from "@/partisia-config";
import { PbcClient } from "@/client/PbcClient";

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    connected,
    address,
    error: connectError,
    isConnecting,
    authMethod,
    connect: connectWallet,
    disconnect: disconnectWallet,
    signMessage,
  } = usePartisiaWallet();

  const isConnected = connected && address !== null;

  // Create SenderAuthentication from SDK or private key
  const account: SenderAuthentication | null = isConnected
    ? {
        getAddress: () => address!,
        sign: async (transactionPayload: Buffer) => {
          const res = await signMessage(transactionPayload.toString("hex"));
          return res.signature;
        },
      }
    : null;

  const connect = useCallback(
    async (method: AuthMethod, privateKey?: string) => {
      await connectWallet(method, privateKey);
    },
    [connectWallet]
  );

  const disconnect = useCallback(async () => {
    await disconnectWallet();
  }, [disconnectWallet]);

  const ensureSigningCapability = useCallback(async (): Promise<boolean> => {
    if (connected) return true;
    try {
      await connect("mpc"); // Default to MPC for auto-reconnection
      return true;
    } catch {
      return false;
    }
  }, [connected, connect]);

  const canPerformAction = useCallback(
    async (action: CrowdfundAction, campaignId?: string): Promise<boolean> => {
      if (!isConnected || !address || !campaignId) return false;

      try {
        const client = new PbcClient(TESTNET_URL);
        const contractData = await client.getContractData(campaignId);
        if (!contractData || !("state" in contractData)) {
          throw new Error("Invalid contract data");
        }
        const state = deserializeState(contractData.state as Buffer);
        const userAddress = BlockchainAddress.fromString(address);
        return checkPermission(action, state, userAddress);
      } catch (error) {
        console.error("[Auth] Permission check failed:", error);
        return false;
      }
    },
    [isConnected, address]
  );

  return (
    <AuthContext.Provider
      value={{
        isConnected,
        canSign: isConnected,
        account,
        walletAddress: address,
        isConnecting,
        connectError,
        authMethod,
        connect,
        disconnect,
        ensureSigningCapability,
        canPerformAction,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
