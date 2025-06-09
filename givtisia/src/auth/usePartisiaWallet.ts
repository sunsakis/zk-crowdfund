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
  privateKey?: string;
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
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);

  // Restore connection on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const checkConnection = async () => {
      try {
        const storedData = JSON.parse(stored) as StoredConnection;

        if (storedData.authMethod === "privateKey" && storedData.privateKey) {
          // Restore private key connection
          setConnected(true);
          setAddress(storedData.address);
          setAuthMethod("privateKey");
          console.log(
            "Restored private key connection for:",
            storedData.address
          );
        } else if (storedData.authMethod === "mpc") {
          if (!sdk.connection) {
            const connectParams: ConnectParams = {
              permissions: storedData.permissions,
              dappName: storedData.dappName,
              chainId: storedData.chainId,
            };
            await connectToSDK(sdk, connectParams);
          }

          const account = sdk.connection?.account as
            | PartisiaAccount
            | undefined;
          if (account?.address) {
            setConnected(true);
            setAddress(account.address);
            setAuthMethod("mpc");
            console.log("Restored MPC connection for:", account.address);
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

        //! not comfy storing private key in local storage

        // const connectionData: StoredConnection = {
        //   address: auth.getAddress(),
        //   permissions: DEFAULT_PERMISSIONS,
        //   dappName: "Sekiva",
        //   chainId: "Partisia Blockchain Testnet",
        //   authMethod: "privateKey",
        //   privateKey, // Note: In production, encrypt this
        // };

        // localStorage.setItem(STORAGE_KEY, JSON.stringify(connectionData));
        setConnected(true);
        setAddress(auth.getAddress());
        setAuthMethod("privateKey");
        setError(null);
        console.log("Connected with private key:", auth.getAddress());
      } catch (err) {
        const error = new WalletError(
          err instanceof Error ? err.message : "Private key connection failed",
          "PRIVATE_KEY_ERROR"
        );
        setError(error);
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
        authMethod: "mpc",
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(connectionData));
      setConnected(true);
      setAddress(account.address);
      setAuthMethod("mpc");
      setError(null);
      console.log("Connected to MPC wallet:", account.address);
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
          const stored = localStorage.getItem(STORAGE_KEY);
          if (!stored) throw new Error("No private key found");
          const { privateKey } = JSON.parse(stored);

          const keyPair = CryptoUtils.privateKeyToKeypair(privateKey);
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
    [sdk, connected, address, authMethod]
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
  };
}
