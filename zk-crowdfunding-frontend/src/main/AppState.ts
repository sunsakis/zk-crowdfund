import { Client, RealZkClient } from "@partisiablockchain/zk-client";
import { ShardedClient } from "./client/ShardedClient";
import { CrowdfundingApi } from "./contract/CrowdfundingApi";
import {
  BlockchainTransactionClient,
  SenderAuthentication,
} from "@partisiablockchain/blockchain-api-transaction-client";

export const TESTNET_URL = "https://node1.testnet.partisiablockchain.com";
export const CLIENT = new ShardedClient(TESTNET_URL, ["Shard0", "Shard1", "Shard2"]);

let contractAddress: string | undefined;
let currentAccount: SenderAuthentication | undefined;
let crowdfundingApi: CrowdfundingApi | undefined;

export const setAccount = (account: SenderAuthentication | undefined) => {
  currentAccount = account;
  updateCrowdfundingApi();
};

export const resetAccount = () => {
  currentAccount = undefined;
  crowdfundingApi = undefined;
};

export const isConnected = () => {
  return currentAccount != null;
};

export const setContractAddress = (address: string) => {
  contractAddress = address;
  updateCrowdfundingApi();
};

export const getContractAddress = () => {
  return contractAddress;
};

export const getCrowdfundingApi = () => {
  return crowdfundingApi;
};

function updateCrowdfundingApi() {
  if (currentAccount && contractAddress) {
    try {
      const transactionClient = BlockchainTransactionClient.create(
        TESTNET_URL,
        currentAccount
      );
      
      const zkClient = RealZkClient.create(contractAddress, new Client(TESTNET_URL));
      
      crowdfundingApi = new CrowdfundingApi(
        transactionClient, 
        zkClient, 
        currentAccount.getAddress()
      );
    } catch (error) {
      console.error("Error updating crowdfunding API:", error);
      crowdfundingApi = undefined;
    }
  } else {
    crowdfundingApi = undefined;
  }
}