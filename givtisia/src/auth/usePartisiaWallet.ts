import { useState, useEffect, useCallback } from "react";
import PartisiaSdk from "partisia-sdk";
import { connectPrivateKey } from "@/shared/PrivateKeySignatureProvider";
import { AuthMethod } from "./AuthContext";
import { CryptoUtils } from "@/client/CryptoUtils";

const STORAGE_KEY = "partisia_sdk_connection";

// SDK types are not exported, so we define our own
type PermissionType = string;

interface StoredConnection {
  address: string;
  permissions: PermissionType[];
  dappName: string;
  chainId: string;
  authMethod: AuthMethod;
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

// Add at the top, after PartisiaAccount interface
type WalletAccount = {
  getAddress: () => string;
  sign: (transactionPayload: Buffer) => Promise<string>;
};

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
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);
  const [currentPrivateKey, setCurrentPrivateKey] = useState<string | null>(
    null
  );
  const [account, setAccount] = useState<WalletAccount | null>(null); // Unified account object

  // Restore connection on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const checkConnection = async () => {
      try {
        const storedData = JSON.parse(stored) as StoredConnection;

        if (storedData.authMethod === "privateKey") {
          // Private key connections are not restored for security reasons
          // User must reconnect with private key each session
          console.log("Private key connection not restored - security feature");
          localStorage.removeItem(STORAGE_KEY);
          return;
        } else if (storedData.authMethod === "mpc") {
          if (!sdk.connection) {
            const connectParams: ConnectParams = {
              permissions: storedData.permissions,
              dappName: storedData.dappName,
              chainId: storedData.chainId,
            };
            await connectToSDK(sdk, connectParams);
          }

          const accountObj = sdk.connection?.account as
            | PartisiaAccount
            | undefined;
          if (accountObj?.address) {
            setConnected(true);
            setAddress(accountObj.address);
            setAuthMethod("mpc");
            setAccount({
              getAddress: () => accountObj.address,
              sign: async (transactionPayload: Buffer) => {
                const res = await sdk.signMessage({
                  payload: transactionPayload.toString("hex"),
                  payloadType: "hex",
                  dontBroadcast: true,
                });
                return res.signature;
              },
            });
            console.log("Restored MPC connection for:", accountObj.address);
          } else {
            throw new WalletError("Invalid connection", "INVALID_CONNECTION");
          }
        } else {
          throw new WalletError("Invalid auth method", "INVALID_AUTH_METHOD");
        }
      } catch (err) {
        console.error("Failed to restore connection:", err);
        localStorage.removeItem(STORAGE_KEY);
        setConnected(false);
        setAddress(null);
        setAuthMethod(null);
        setCurrentPrivateKey(null);
        setAccount(null);
        setError(
          err instanceof WalletError
            ? err
            : new WalletError("Failed to restore connection", "RESTORE_ERROR")
        );
      }
    };

    checkConnection();
  }, [sdk]);

  const connectWithPrivateKey = useCallback(
    async (privateKey: string) => {
      if (isConnecting) return;
      setIsConnecting(true);
      setError(null);

      try {
        const keyPair = CryptoUtils.privateKeyToKeypair(privateKey);
        const sender = CryptoUtils.keyPairToAccountAddress(keyPair);
        const auth = await connectPrivateKey(sender, keyPair);

        // Store connection metadata only (no private key for security)
        const connectionData: StoredConnection = {
          address: auth.getAddress(),
          permissions: DEFAULT_PERMISSIONS,
          dappName: "Sekiva",
          chainId: "Partisia Blockchain Testnet",
          authMethod: "privateKey",
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(connectionData));
        setConnected(true);
        setAddress(auth.getAddress());
        setAuthMethod("privateKey");
        setCurrentPrivateKey(privateKey);
        setAccount({
          getAddress: () => auth.getAddress(),
          sign: async (transactionPayload: Buffer) => {
            return await auth.sign(
              transactionPayload,
              "Partisia Blockchain Testnet"
            );
          },
        });
        setError(null);
        console.log("Connected with private key:", auth.getAddress());
      } catch (err) {
        const error = new WalletError(
          err instanceof Error ? err.message : "Private key connection failed",
          "PRIVATE_KEY_ERROR"
        );
        setError(error);
        setAccount(null);
        throw error;
      } finally {
        setIsConnecting(false);
      }
    },
    [isConnecting]
  );

  const connectWithMPC = useCallback(async () => {
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

      const accountObj = sdk.connection?.account as PartisiaAccount | undefined;
      if (!accountObj?.address) {
        throw new WalletError(
          "No account address after connection",
          "NO_ACCOUNT"
        );
      }

      const connectionData: StoredConnection = {
        address: accountObj.address,
        permissions: DEFAULT_PERMISSIONS,
        dappName: "Sekiva",
        chainId: "Partisia Blockchain Testnet",
        authMethod: "mpc",
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(connectionData));
      setConnected(true);
      setAddress(accountObj.address);
      setAuthMethod("mpc");
      setAccount({
        getAddress: () => accountObj.address,
        sign: async (transactionPayload: Buffer) => {
          const res = await sdk.signMessage({
            payload: transactionPayload.toString("hex"),
            payloadType: "hex",
            dontBroadcast: true,
          });
          return res.signature;
        },
      });
      setError(null);
      console.log("Connected to MPC wallet:", accountObj.address);
    } catch (err) {
      const error =
        err instanceof WalletError
          ? err
          : new WalletError(
              err instanceof Error ? err.message : "Connection failed",
              "CONNECT_ERROR"
            );
      setError(error);
      setAccount(null);
      localStorage.removeItem(STORAGE_KEY);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  }, [sdk, isConnecting]);

  const connect = useCallback(
    async (method: AuthMethod, privateKey?: string) => {
      if (method === "privateKey" && privateKey) {
        return connectWithPrivateKey(privateKey);
      } else if (method === "mpc") {
        return connectWithMPC();
      } else {
        throw new WalletError(
          "Invalid auth method or missing private key",
          "INVALID_AUTH_METHOD"
        );
      }
    },
    [connectWithPrivateKey, connectWithMPC]
  );

  const disconnect = useCallback(async () => {
    try {
      // SDK doesn't have disconnect, just clear state
      setConnected(false);
      setAddress(null);
      setError(null);
      setAuthMethod(null);
      setCurrentPrivateKey(null);
      setAccount(null);
      localStorage.removeItem(STORAGE_KEY);
      console.log("Wallet disconnected");
    } catch (err) {
      console.error("Error during disconnect:", err);
    }
  }, []);

  const signMessage = useCallback(
    async (message: string) => {
      if (!connected || !address) {
        throw new WalletError("Wallet not connected", "NOT_CONNECTED");
      }

      try {
        if (authMethod === "privateKey") {
          if (!currentPrivateKey) {
            throw new WalletError("No private key available", "NO_PRIVATE_KEY");
          }

          const keyPair = CryptoUtils.privateKeyToKeypair(currentPrivateKey);
          const sender = CryptoUtils.keyPairToAccountAddress(keyPair);
          const auth = await connectPrivateKey(sender, keyPair);
          return {
            signature: await auth.sign(
              Buffer.from(message, "hex"),
              "Partisia Blockchain Testnet"
            ),
            digest: message,
            trxHash: "",
            isFinalOnChain: false,
          };
        } else {
          // MPC wallet signing
          if (!sdk.connection?.account) {
            throw new WalletError(
              "MPC wallet not connected",
              "MPC_NOT_CONNECTED"
            );
          }
          const result = await sdk.signMessage({
            payload: message,
            payloadType: "hex",
            dontBroadcast: true,
          });
          return result;
        }
      } catch (err) {
        throw new WalletError(
          err instanceof Error ? err.message : "Failed to sign message",
          "SIGN_ERROR"
        );
      }
    },
    [sdk, connected, address, authMethod, currentPrivateKey]
  );

  return {
    sdk,
    connected,
    address,
    error,
    isConnecting,
    authMethod,
    connect,
    disconnect,
    signMessage,
    account, // Expose the unified account object
  };
}
