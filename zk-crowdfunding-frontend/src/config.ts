export interface AppConfig {
  // Blockchain configuration
  blockchain: {
    rpcNodeUrl: string;
    browserUrl: string;
  };
  // Default contract address (can be loaded from JSON or env)
  contractAddress?: string;
}

// Try to load JSON config file
let jsonConfig: any = {};
try {
  jsonConfig = require('./config.json');
} catch (e) {
  // Config file might not exist, which is fine
  console.log('No config.json file found, using default settings');
}

// Default configuration with testnet settings
const config: AppConfig = {
  blockchain: {
    rpcNodeUrl: jsonConfig.blockchain?.rpcNodeUrl || "https://node1.testnet.partisiablockchain.com",
    browserUrl: jsonConfig.blockchain?.browserUrl || "https://browser.testnet.partisiablockchain.com"
  },
  contractAddress: jsonConfig.contractAddress || ""
};

export default config;