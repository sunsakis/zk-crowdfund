export interface AppConfig {
  // Blockchain configuration
  blockchain: {
    rpcNodeUrl: string;
    browserUrl: string;
  };
  // Default contract address (can be loaded from env or local storage)
  contractAddress?: string;
  // Test mode for development - will use mock data when errors occur
  testMode: boolean;
}

// Try to load environment variables
const getEnvVar = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
};

// Try to load saved contract address from localStorage
const getSavedContractAddress = (): string | undefined => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('contractAddress') || undefined;
  }
  return undefined;
};

// Default configuration with testnet settings
const config: AppConfig = {
  blockchain: {
    rpcNodeUrl: getEnvVar('REACT_APP_RPC_NODE_URL') || "https://node1.testnet.partisiablockchain.com",
    browserUrl: getEnvVar('REACT_APP_BROWSER_URL') || "https://browser.testnet.partisiablockchain.com"
  },
  contractAddress: getEnvVar('CONTRACT_ADDRESS') || getSavedContractAddress() || undefined,
  testMode: getEnvVar('REACT_APP_TEST_MODE') === 'true' || false
};

// Override with settings from window.config if available (for runtime configuration)
if (typeof window !== 'undefined' && window.config) {
  if (window.config.blockchain) {
    if (window.config.blockchain.rpcNodeUrl) {
      config.blockchain.rpcNodeUrl = window.config.blockchain.rpcNodeUrl;
    }
    if (window.config.blockchain.browserUrl) {
      config.blockchain.browserUrl = window.config.blockchain.browserUrl;
    }
  }
  
  if (window.config.contractAddress !== undefined) {
    config.contractAddress = window.config.contractAddress;
  }
  
  if (window.config.testMode !== undefined) {
    config.testMode = window.config.testMode;
  }
}

export default config;

// Add TypeScript declarations for global window properties
declare global {
  interface Window {
    config?: {
      blockchain?: {
        rpcNodeUrl?: string;
        browserUrl?: string;
      };
      contractAddress?: string;
      testMode?: boolean;
    };
  }
}