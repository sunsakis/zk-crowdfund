import { Client, RealZkClient } from "@partisiablockchain/zk-client";
import { ShardedClient } from "./client/ShardedClient";
import { CrowdfundingApi } from "./contract/CrowdfundingApi";
import {
  BlockchainTransactionClient,
  SenderAuthentication
} from "@partisiablockchain/blockchain-api-transaction-client";

// Constants with primary and fallback nodes
export const TESTNET_URL_PRIMARY = "https://node1.testnet.partisiablockchain.com";
export const TESTNET_URL_FALLBACK = "https://node2.testnet.partisiablockchain.com";

// Start with primary node
let currentNodeUrl = TESTNET_URL_PRIMARY;
export const CLIENT = new ShardedClient(currentNodeUrl, ["Shard0", "Shard1", "Shard2"]);

// State variables
let contractAddress: string | undefined;
let currentAccount: SenderAuthentication | undefined;
let crowdfundingApi: CrowdfundingApi | undefined;
let walletType: 'privateKey' | 'mpc' | 'metamask' | undefined;

// Event handling for state changes
type StateChangeListener = () => void;
const stateChangeListeners: StateChangeListener[] = [];

/**
 * Check if blockchain node is accessible
 * @returns Promise resolving to true if node is accessible, false otherwise
 */
export const checkNodeConnectivity = async (): Promise<boolean> => {
  try {
    console.log(`Checking connectivity to node: ${currentNodeUrl}`);
    const testUrl = `${currentNodeUrl}/blockchain/blocks/latest`;
    
    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      // Short timeout to detect connectivity issues faster
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      console.log("Blockchain node is accessible");
      return true;
    } else {
      console.error(`Node connectivity check failed: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.error("Failed to connect to blockchain node:", error);
    return false;
  }
};

/**
 * Switch to fallback node
 * @returns The new ShardedClient instance
 */
export const switchToFallbackNode = (): ShardedClient => {
  // If already on fallback, switch back to primary
  if (currentNodeUrl === TESTNET_URL_FALLBACK) {
    currentNodeUrl = TESTNET_URL_PRIMARY;
  } else {
    currentNodeUrl = TESTNET_URL_FALLBACK;
  }
  
  console.log(`Switching to node: ${currentNodeUrl}`);
  
  // Create new client with updated URL
  const newClient = new ShardedClient(currentNodeUrl, ["Shard0", "Shard1", "Shard2"]);
  
  // Replace global CLIENT reference
  (global as any).CLIENT = newClient;
  
  // Update API if wallet is connected and contract is set
  if (currentAccount && contractAddress) {
    updateCrowdfundingApi();
  }
  
  console.log(`Switched to node: ${currentNodeUrl}`);
  return newClient;
};

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
      console.log(`Creating transaction client with node URL: ${currentNodeUrl}`);
      
      // Create transaction client with current node URL
      const transactionClient = BlockchainTransactionClient.create(
        currentNodeUrl,
        currentAccount
      );
      
      // Create ZK client with contract address
      const zkClient = RealZkClient.create(contractAddress, new Client(currentNodeUrl));
      
      // Create API instance
      crowdfundingApi = new CrowdfundingApi(
        transactionClient, 
        zkClient, 
        currentAccount.getAddress()
      );
      
      console.log("Crowdfunding API initialized successfully");
    } catch (error) {
      console.error("Error updating crowdfunding API:", error);
      crowdfundingApi = undefined;
    }
  } else {
    crowdfundingApi = undefined;
  }
  
  notifyStateChange();
}