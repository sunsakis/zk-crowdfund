interface Config {
  // Registry contract address - this contract tracks all deployed campaigns
  // (referred to as factory address for backward compatibility)
  factoryAddress: string;
  
  // Individual campaign contract address (optional)
  // This can be pre-populated with a specific campaign to view
  defaultCampaignAddress?: string;
  
  blockchain: {
    rpcNodeUrl: string;
    browserUrl: string;
  };
  
  // Enable test mode for development
  testMode: boolean;
}

const config: Config = {
  // The registry contract address - this should always be set
  // This contract maintains a list of all deployed campaigns
  factoryAddress: process.env.REACT_APP_FACTORY_ADDRESS || '',
  
  // Optional: A default campaign to load when the app starts
  defaultCampaignAddress: process.env.REACT_APP_DEFAULT_CAMPAIGN_ADDRESS,
  
  blockchain: {
    rpcNodeUrl: process.env.REACT_APP_RPC_NODE_URL || "https://node1.testnet.partisiablockchain.com",
    browserUrl: process.env.REACT_APP_BROWSER_URL || "https://browser.testnet.partisiablockchain.com"
  },
  
  // Enable test mode for development
  testMode: process.env.REACT_APP_TEST_MODE === 'true' || false
};

// In browser environment, load config from window.config if available
if (typeof window !== 'undefined' && window.config) {
  if (window.config.factoryAddress) {
    config.factoryAddress = window.config.factoryAddress;
  }
  if (window.config.defaultCampaignAddress) {
    config.defaultCampaignAddress = window.config.defaultCampaignAddress;
  }
  if (window.config.blockchain) {
    if (window.config.blockchain.rpcNodeUrl) {
      config.blockchain.rpcNodeUrl = window.config.blockchain.rpcNodeUrl;
    }
    if (window.config.blockchain.browserUrl) {
      config.blockchain.browserUrl = window.config.blockchain.browserUrl;
    }
  }
  if (window.config.testMode !== undefined) {
    config.testMode = window.config.testMode;
  }
}

export default config;