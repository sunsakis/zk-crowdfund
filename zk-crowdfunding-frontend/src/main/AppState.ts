import { Client, RealZkClient } from "@partisiablockchain/zk-client";
import { ShardedClient } from "./client/ShardedClient";
import { CrowdfundingApi } from "./contract/CrowdfundingApi";
import {
  BlockchainTransactionClient,
  SenderAuthentication,
} from "@partisiablockchain/blockchain-api-transaction-client";
import config from "./config";

export const TESTNET_URL = config.blockchain.rpcNodeUrl || "https://node1.testnet.partisiablockchain.com";

export const CLIENT = new ShardedClient(TESTNET_URL, ["Shard0", "Shard1", "Shard2"]);

let contractAddress: string | undefined;
let factoryAddress: string | undefined;
let currentAccount: SenderAuthentication | undefined;
let crowdfundingApi: CrowdfundingApi | undefined;

export const setAccount = (account: SenderAuthentication | undefined) => {
  currentAccount = account;
  setCrowdfundingApi();
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
  setCrowdfundingApi();
};

export const getFactoryAddress = () => {
  return factoryAddress;
};

export const setCrowdfundingApi = () => {
  let transactionClient = undefined;
  let zkClient = undefined;
  if (currentAccount != undefined && contractAddress != null) {
    transactionClient = BlockchainTransactionClient.create(
      TESTNET_URL,
      currentAccount
    );
    zkClient = RealZkClient.create(contractAddress, new Client(TESTNET_URL));
    crowdfundingApi = new CrowdfundingApi(transactionClient, zkClient, currentAccount.getAddress(), factoryAddress);
  }
};

export const getCrowdfundingApi = () => {
  return crowdfundingApi;
};

export const getContractAddress = () => {
  return contractAddress;
};

export const setContractAddress = (address: string) => {
  contractAddress = address;
  setCrowdfundingApi();
};

// Initialize contract addresses from saved values if available
if (typeof window !== 'undefined' && window.localStorage) {
  const savedCampaignAddress = localStorage.getItem('contractAddress');
  const savedFactoryAddress = localStorage.getItem('factoryAddress');
  
  if (savedCampaignAddress) {
    contractAddress = savedCampaignAddress;
  } else if (config.defaultCampaignAddress) {
    contractAddress = config.defaultCampaignAddress;
  }
  
  if (savedFactoryAddress) {
    factoryAddress = savedFactoryAddress;
  } else if (config.factoryAddress) {
    factoryAddress = config.factoryAddress;
  }
}