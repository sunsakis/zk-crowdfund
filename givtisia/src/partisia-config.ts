import {
  BlockchainTransactionClient,
  SenderAuthentication,
} from "@partisiablockchain/blockchain-api-transaction-client";
import { Client, RealZkClient } from "@partisiablockchain/zk-client";
import { ShardedClient } from "@/client/ShardedClient";

export const TESTNET_URL = "https://node1.testnet.partisiablockchain.com";
export const CLIENT = new ShardedClient(TESTNET_URL, [
  "Shard0",
  "Shard1",
  "Shard2",
]);

export type ShardId = "Shard0" | "Shard1" | "Shard2";
export const SHARD_PRIORITY: ShardId[] = ["Shard2", "Shard1", "Shard0"];

let BallotTransactionConnector:
  | {
      transactionClient: BlockchainTransactionClient;
      zkClient: RealZkClient;
      walletAddress: string;
    }
  | undefined;

export const setBallotTransactionClient = (
  contractAddress: string,
  walletAddress: string
) => {
  let transactionClient = undefined;
  let zkClient = undefined;
  if (walletAddress != undefined && contractAddress != null) {
    transactionClient = BlockchainTransactionClient.create(
      TESTNET_URL,
      walletAddress as unknown as SenderAuthentication
    );
    zkClient = RealZkClient.create(contractAddress, new Client(TESTNET_URL));
    BallotTransactionConnector = { transactionClient, zkClient, walletAddress };
    return getBallotTransactionConnector();
  }
};

export const getBallotTransactionConnector = () => {
  if (BallotTransactionConnector == undefined) {
    throw new Error("BallotTransactionConnector not set");
  }
  return BallotTransactionConnector;
};

export const setPublicTransactionClient = (walletAddress: string) => {
  const transactionClient = BlockchainTransactionClient.create(
    TESTNET_URL,
    walletAddress as unknown as SenderAuthentication
  );
  return transactionClient;
};

export const PARTISIA_CONFIG = {
  TESTNET_URL,
};
