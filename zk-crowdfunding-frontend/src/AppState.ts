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
  
  console.log("Account set:", {
    address: account?.getAddress(),
    walletType: type
  });
  
  updateCrowdfundingApi();
  notifyStateChange();
};

/**
 * Reset the current account (logout)
 */
export const resetAccount = (): void => {
  console.log("Resetting account");
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
 * Get the current account authentication object
 * @returns The SenderAuthentication object or undefined if not connected
 */
export const getCurrentAccount = (): SenderAuthentication | undefined => {
  return currentAccount;
};

/**
 * Set the contract address
 * @param address The contract address
 */
export const setContractAddress = (address: string): void => {
  console.log("Setting contract address:", address);
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
 * Get the current node URL
 * @returns The current blockchain node URL
 */
export const getCurrentNodeUrl = (): string => {
  return currentNodeUrl;
};

/**
 * Update the crowdfunding API based on current state
 */
function updateCrowdfundingApi(): void {
  if (currentAccount && contractAddress) {
    try {
      console.log(`Creating transaction client with node URL: ${currentNodeUrl}`);
      console.log(`Wallet type: ${walletType}`);
      console.log(`Contract address: ${contractAddress}`);
      
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
        currentAccount.getAddress(),
        CLIENT // Pass the ShardedClient instance
      );
      
      console.log("Crowdfunding API initialized successfully");
    } catch (error) {
      console.error("Error updating crowdfunding API:", error);
      crowdfundingApi = undefined;
    }
  } else {
    console.log("Cannot create API - missing account or contract address", {
      hasAccount: !!currentAccount,
      hasContract: !!contractAddress
    });
    crowdfundingApi = undefined;
  }
  
  notifyStateChange();
}

/**
 * Retry connection with different node if current one fails
 * @returns Promise resolving to success status
 */
export const retryConnection = async (): Promise<boolean> => {
  const isCurrentNodeWorking = await checkNodeConnectivity();
  
  if (!isCurrentNodeWorking) {
    console.log("Current node not working, switching to fallback");
    switchToFallbackNode();
    
    // Check if fallback node works
    const isFallbackWorking = await checkNodeConnectivity();
    return isFallbackWorking;
  }
  
  return true;
};

/**
 * Get connection status information
 * @returns Object with connection details
 */
export const getConnectionStatus = () => {
  return {
    isConnected: isConnected(),
    walletType: getWalletType(),
    address: getAccountAddress(),
    nodeUrl: getCurrentNodeUrl(),
    hasContract: !!contractAddress,
    hasApi: !!crowdfundingApi
  };
};

/**
 * Validate wallet connection and API availability
 * @returns Object with validation results
 */
export const validateConnection = () => {
  const status = getConnectionStatus();
  
  return {
    ...status,
    canInteract: status.isConnected && status.hasContract && status.hasApi,
    missingComponents: [
      !status.isConnected && 'wallet connection',
      !status.hasContract && 'contract address',
      !status.hasApi && 'API initialization'
    ].filter(Boolean)
  };
};