export interface AppConfig {
  // Blockchain configuration
  blockchain: {
    rpcNodeUrl: string;
    browserUrl: string;
  };
  // Project defaults (can be overridden)
  projectDefaults: {
    title: string;
    description: string;
    fundingTarget: number;
    deadline: number;
  };
}

// Default configuration with testnet settings
const config: AppConfig = {
  blockchain: {
    rpcNodeUrl: "https://node1.testnet.partisiablockchain.com",
    browserUrl: "https://browser.testnet.partisiablockchain.com"
  },
  projectDefaults: {
    title: "Privacy-Preserving Research Project",
    description: "Funding research on advanced privacy techniques in blockchain applications",
    fundingTarget: 1000,
    deadline: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days from now
  }
};

export default config;