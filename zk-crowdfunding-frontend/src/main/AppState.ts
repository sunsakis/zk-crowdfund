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
let factoryAddress: string | undefined;
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

export const setFactoryAddress = (address: string) => {
  factoryAddress = address;
  updateCrowdfundingApi();
};

export const getFactoryAddress = () => {
  return factoryAddress;
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
  if (currentAccount) {
    const transactionClient = BlockchainTransactionClient.create(
      TESTNET_URL,
      currentAccount
    );
    
    let zkClient: RealZkClient | undefined;
    if (contractAddress) {
      zkClient = RealZkClient.create(contractAddress, new Client(TESTNET_URL));
    }
    
    crowdfundingApi = new CrowdfundingApi(
      transactionClient, 
      zkClient, 
      currentAccount.getAddress(), 
      factoryAddress
    );
  } else {
    crowdfundingApi = undefined;
  }
}