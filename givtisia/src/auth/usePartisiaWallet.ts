import { useState, useEffect, useCallback } from "react";
import PartisiaSdk from "partisia-sdk";

const STORAGE_KEY = "partisia_sdk_connection";

// SDK types are not exported, so we define our own
type PermissionType = string; // SDK accepts any string for permissions

interface StoredConnection {
  address: string;
  permissions: PermissionType[];
  dappName: string;
  chainId: string;
}

interface PartisiaAccount {
  address: string;
  signMessage: (params: { payload: string; payloadType: string }) => Promise<{
    signature: string;
    digest: string;
    trxHash: string;
    isFinalOnChain: boolean;
  }>;
}

// SDK types are not exported, so we define our own
interface ConnectParams {
  permissions: string[];
  dappName: string;
  chainId: string;
}

export class WalletError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "WalletError";
  }
}

// SDK accepts these permissions but types are not exported
const DEFAULT_PERMISSIONS = ["sign"] as PermissionType[];

// Type assertion for SDK connect since types are not exported
const connectToSDK = async (sdk: PartisiaSdk, params: ConnectParams) => {
  // @ts-expect-error SDK types are not exported but we know this works
  await sdk.connect(params);
};

export function usePartisiaWallet() {
  const [sdk] = useState(() => new PartisiaSdk());
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<WalletError | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Restore connection on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const checkConnection = async () => {
      try {
        if (!sdk.connection) {
          const storedData = JSON.parse(stored) as StoredConnection;
          const connectParams: ConnectParams = {
            permissions: storedData.permissions,
            dappName: storedData.dappName,
            chainId: storedData.chainId,
          };
          await connectToSDK(sdk, connectParams);
        }

        const account = sdk.connection?.account as PartisiaAccount | undefined;
        if (account?.address) {
          setConnected(true);
          setAddress(account.address);
          console.log("Restored connection for:", account.address);
        } else {
          throw new WalletError("Invalid connection", "INVALID_CONNECTION");
        }
      } catch (err) {
        console.error("Failed to restore connection:", err);
        localStorage.removeItem(STORAGE_KEY);
        setConnected(false);
        setAddress(null);
        setError(
          err instanceof WalletError
            ? err
            : new WalletError("Failed to restore connection", "RESTORE_ERROR")
        );
      }
    };

    checkConnection();
  }, [sdk]);

  const connect = useCallback(async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setError(null);

    try {
      const connectParams: ConnectParams = {
        permissions: DEFAULT_PERMISSIONS,
        dappName: "Sekiva",
        chainId: "Partisia Blockchain Testnet",
      };
      await connectToSDK(sdk, connectParams);

      const account = sdk.connection?.account as PartisiaAccount | undefined;
      if (!account?.address) {
        throw new WalletError(
          "No account address after connection",
          "NO_ACCOUNT"
        );
      }

      const connectionData: StoredConnection = {
        address: account.address,
        permissions: DEFAULT_PERMISSIONS,
        dappName: "Sekiva",
        chainId: "Partisia Blockchain Testnet",
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(connectionData));
      setConnected(true);
      setAddress(account.address);
      setError(null);
      console.log("Connected to wallet:", account.address);
    } catch (err) {
      const error =
        err instanceof WalletError
          ? err
          : new WalletError(
              err instanceof Error ? err.message : "Connection failed",
              "CONNECT_ERROR"
            );
      setError(error);
      localStorage.removeItem(STORAGE_KEY);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [sdk, isConnecting]);

  const disconnect = useCallback(async () => {
    try {
      // SDK doesn't have disconnect, just clear state
      setConnected(false);
      setAddress(null);
      setError(null);
      localStorage.removeItem(STORAGE_KEY);
      console.log("Wallet disconnected");
    } catch (err) {
      console.error("Error during disconnect:", err);
    }
  }, []);

  const signMessage = useCallback(
    async (message: string) => {
      if (!connected || !sdk.connection?.account) {
        throw new WalletError("Wallet not connected", "NOT_CONNECTED");
      }

      try {
        const result = await sdk.signMessage({
          payload: message,
          payloadType: "hex",
          dontBroadcast: true,
        });
        return result;
      } catch (err) {
        throw new WalletError(
          err instanceof Error ? err.message : "Failed to sign message",
          "SIGN_ERROR"
        );
      }
    },
    [sdk, connected]
  );

  return {
    sdk,
    connected,
    address,
    error,
    isConnecting,
    connect,
    disconnect,
    signMessage,
  };
}
