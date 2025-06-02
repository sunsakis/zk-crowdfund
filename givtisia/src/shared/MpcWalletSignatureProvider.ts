import {
  SenderAuthentication,
  Signature,
} from "@partisiablockchain/blockchain-api-transaction-client";
import PartisiaSdk from "partisia-sdk";

/**
 * Initializes a connection to the Partisia Blockchain MPC wallet.
 *
 * This leverages the Partisia SDK to establish a secure end-to-end encrypted
 * channel between the dApp and the wallet.
 *
 * @returns A SenderAuthentication object that can be used for transactions
 */
export const connectMpcWallet = async (): Promise<SenderAuthentication> => {
  const partisiaSdk = new PartisiaSdk();

  // Configure connection parameters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const connectParams: any = {
    permissions: ["sign"],
    dappName: "Sekiva",
    chainId: "Partisia Blockchain Testnet",
  };

  try {
    console.log("Connecting to Partisia wallet...");

    // Connect to the wallet
    await partisiaSdk.connect(connectParams);
    console.log("Connect result:", partisiaSdk);

    const connection = partisiaSdk.connection;
    if (!connection) {
      throw new Error("Unable to establish connection to MPC wallet");
    }

    console.log("Connected to wallet, account:", connection.account);

    // Create a SenderAuthentication object for transaction signing
    return {
      getAddress: () => connection.account.address,
      sign: async (transactionPayload: Buffer): Promise<Signature> => {
        // Ask the MPC wallet to sign the transaction
        const res = await partisiaSdk.signMessage({
          payload: transactionPayload.toString("hex"),
          payloadType: "hex",
          dontBroadcast: true,
        });
        return res.signature;
      },
    };
  } catch (error) {
    // The SDK already provides generic errors, but we can make them
    // more friendly for our specific dApp context
    if (error instanceof Error) {
      if (error.message === "Extension not Found") {
        throw new Error(
          "Partisia Wallet Extension not found. Please install it to continue."
        );
      } else if (
        error.message === "user closed confirm window" ||
        error.message === "user rejected"
      ) {
        throw new Error("Wallet connection was cancelled by user.");
      }

      // For all other errors, just pass them through
      throw error;
    }

    throw new Error("Unknown error connecting to wallet");
  }
};
