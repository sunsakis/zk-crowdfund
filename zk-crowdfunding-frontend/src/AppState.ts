import { Client, RealZkClient } from "@partisiablockchain/zk-client";
import { ShardedClient } from "./client/ShardedClient";
import { CrowdfundingApi } from "./contract/CrowdfundingApi";
import {
  BlockchainTransactionClient,
  SenderAuthentication
} from "@partisiablockchain/blockchain-api-transaction-client";

// Constants
export const TESTNET_URL = "https://node1.testnet.partisiablockchain.com";
export const CLIENT = new ShardedClient(TESTNET_URL, ["Shard0", "Shard1", "Shard2"]);

// State variables
let contractAddress: string | undefined;
let currentAccount: SenderAuthentication | undefined;
let crowdfundingApi: CrowdfundingApi | undefined;
let walletType: 'privateKey' | 'mpc' | 'metamask' | undefined;

// Event handling for state changes
// You can use a simple event system for vanilla TypeScript
type StateChangeListener = () => void;
const stateChangeListeners: StateChangeListener[] = [];

/**
 * Subscribe to state changes
 * @param listener Function to call when state changes
 */
export function subscribeToStateChanges(listener: StateChangeListener): void {
  stateChangeListeners.push(listener);
}

/**
 * Unsubscribe from state changes
 * @param listener Function to remove from listeners
 */
export function unsubscribeFromStateChanges(listener: StateChangeListener): void {
  const index = stateChangeListeners.indexOf(listener);
  if (index !== -1) {
    stateChangeListeners.splice(index, 1);
  }
}

/**
 * Notify all listeners of state change
 */
function notifyStateChange(): void {
  for (const listener of stateChangeListeners) {
    try {
      listener();
    } catch (error) {
      console.error("Error in state change listener:", error);
    }
  }
}

/**
 * Set the current account
 * @param account The authenticated sender
 * @param type The wallet type used
 */
export const setAccount = (account: SenderAuthentication | undefined, type?: 'privateKey' | 'mpc' | 'metamask'): void => {
  currentAccount = account;
  walletType = type;
  updateCrowdfundingApi();
  notifyStateChange();
};

/**
 * Reset the current account (logout)
 */
export const resetAccount = (): void => {
  currentAccount = undefined;
  crowdfundingApi = undefined;
  walletType = undefined;
  notifyStateChange();
};

/**
 * Check if a wallet is connected
 * @returns true if connected, false otherwise
 */
export const isConnected = (): boolean => {
  return currentAccount != null;
};

/**
 * Get the type of the connected wallet
 * @returns The wallet type or undefined if not connected
 */
export const getWalletType = (): 'privateKey' | 'mpc' | 'metamask' | undefined => {
  return walletType;
};

/**
 * Get the current account address
 * @returns The address or undefined if not connected
 */
export const getAccountAddress = (): string | undefined => {
  return currentAccount?.getAddress();
};

/**
 * Set the contract address
 * @param address The contract address
 */
export const setContractAddress = (address: string): void => {
  contractAddress = address;
  updateCrowdfundingApi();
  notifyStateChange();
};

/**
 * Get the contract address
 * @returns The contract address or undefined
 */
export const getContractAddress = (): string | undefined => {
  return contractAddress;
};

/**
 * Get the crowdfunding API
 * @returns The API instance or undefined
 */
export const getCrowdfundingApi = (): CrowdfundingApi | undefined => {
  return crowdfundingApi;
};

/**
 * Update the crowdfunding API based on current state
 */
function updateCrowdfundingApi(): void {
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
  
  notifyStateChange();
}