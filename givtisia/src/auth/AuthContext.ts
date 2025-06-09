import { createContext } from "react";
import { SenderAuthentication } from "@partisiablockchain/blockchain-api-transaction-client";
import { CrowdfundAction } from "./permissions";

export type AuthMethod = "mpc" | "privateKey";

export interface AuthContextType {
  // Single source of truth for wallet connection
  isConnected: boolean;
  canSign: boolean; // Whether the current connection can sign transactions

  // Active account info
  account: SenderAuthentication | null;
  walletAddress: string | null;

  // Connection status flags
  isConnecting: boolean;
  connectError: Error | null;

  // Auth method
  authMethod: AuthMethod | null;

  // Methods
  connect: (method: AuthMethod, privateKey?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  ensureSigningCapability: () => Promise<boolean>; // Forces reconnection if needed

  // Campaign permissions
  canPerformAction: (
    action: CrowdfundAction,
    campaignId?: string
  ) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);
