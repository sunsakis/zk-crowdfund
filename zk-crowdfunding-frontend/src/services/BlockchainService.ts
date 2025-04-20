import config from '../config';

// Type definitions
export interface ProjectData {
  title: string;
  description: string;
  fundingTarget: number;
  deadline: number;
  status: 'Setup' | 'Active' | 'Computing' | 'Completed';
  totalRaised: number | null;
  numContributors: number | null;
  isSuccessful: boolean | null;
}

export interface ContributionResult {
  success: boolean;
  txId?: string;
  error?: string;
}

export interface CampaignEndResult {
  success: boolean;
  txId?: string;
  totalRaised?: number;
  isSuccessful?: boolean;
  error?: string;
}

export interface WithdrawalResult {
  success: boolean;
  txId?: string;
  error?: string;
}

export interface PrivateKeyInfo {
  key: Uint8Array;
  address: string;
}

class BlockchainService {
  private readonly API_BASE_URL: string;
  private readonly BROWSER_URL: string;
  private readonly GAS_LIMIT = 500000; // Increased gas limit for zk operations
  
  constructor() {
    // Initialize connection to testnet
    this.API_BASE_URL = config.blockchain?.rpcNodeUrl || "https://node1.testnet.partisiablockchain.com";
    this.BROWSER_URL = config.blockchain?.browserUrl || "https://browser.testnet.partisiablockchain.com";
    console.log("Initializing BlockchainService with connection to:", this.API_BASE_URL);
  }

  // Parse a private key file or string
  async parsePrivateKey(privateKeyData: string): Promise<PrivateKeyInfo> {
    try {
      // For demo purposes, we'll just use a simple hash of the key as the address
      const encoder = new TextEncoder();
      const privateKeyBytes = encoder.encode(privateKeyData);
      
      // Generate a mock address based on the private key input
      const mockAddress = `0x${Array.from(privateKeyBytes.slice(0, 20))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')}`;
      
      return {
        key: privateKeyBytes,
        address: mockAddress
      };
    } catch (error) {
      console.error("Error parsing private key:", error);
      throw new Error("Invalid private key format");
    }
  }

  // Get contract state and parse it into project data
  async getProject(contractAddress: string): Promise<ProjectData> {
    try {
      // Using fetch directly to get contract state
      const response = await fetch(`${this.API_BASE_URL}/contract/${contractAddress}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contract: ${response.statusText}`);
      }
      
      const contractData = await response.json();
      
      if (!contractData || !contractData.state) {
        throw new Error("Contract state not found");
      }
      
      // Parse the state into our ProjectData format
      const state = contractData.state;
      
      return {
        title: state.title || "",
        description: state.description || "",
        fundingTarget: parseInt(state.funding_target) || 0,
        deadline: parseInt(state.deadline) || 0,
        status: this.parseStatus(state.status),
        totalRaised: state.total_raised !== undefined ? parseInt(state.total_raised) : null,
        numContributors: state.num_contributors !== undefined ? parseInt(state.num_contributors) : null,
        isSuccessful: state.is_successful !== undefined ? !!state.is_successful : null
      };
    } catch (error) {
      console.error("Error fetching project data:", error);
      
      // Fallback to mock data during development
      if (config.testMode) {
        console.log("Using mock data due to error or test mode");
        return {
          title: "Privacy-Preserving Research Project",
          description: "Funding research on advanced privacy techniques in blockchain applications",
          fundingTarget: 1000,
          deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
          status: 'Active',
          totalRaised: null,
          numContributors: 5,
          isSuccessful: null
        };
      }
      
      throw new Error("Failed to fetch project details from blockchain");
    }
  }
  
  // Parse status from contract state to our enum format
  private parseStatus(statusObj: any): 'Setup' | 'Active' | 'Computing' | 'Completed' {
    if (statusObj && Object.keys(statusObj).length > 0) {
      const statusKey = Object.keys(statusObj)[0];
      switch (statusKey.toLowerCase()) {
        case "setup": return "Setup";
        case "active": return "Active";
        case "computing": return "Computing";
        case "completed": return "Completed";
        default: return "Setup";
      }
    }
    return "Setup";
  }

  // Submit a contribution as a secret input - using direct API call
  async contribute(
    contractAddress: string,
    amount: number,
    privateKeyStr: string
  ): Promise<ContributionResult> {
    try {
      // For real implementation, we'd use the SDK
      // However, as the SDK has compatibility issues, we'll use a direct API call approach
      
      // Get the address from the private key
      const keyInfo = await this.parsePrivateKey(privateKeyStr);
      
      // Prepare the function call data
      const callData = {
        contractAddress: contractAddress,
        functionName: "add_contribution",
        parameters: [amount.toString()],
        gas: this.GAS_LIMIT,
        privateKey: privateKeyStr // Note: In a real implementation, we'd use a proper signing mechanism
      };
      
      console.log("Contribution call data:", JSON.stringify(callData, null, 2));
      
      if (config.testMode) {
        // In test mode, simulate a successful transaction
        console.log("Test mode: Simulating successful contribution transaction");
        return { 
          success: true,
          txId: `tx_${Date.now().toString(36)}`
        };
      }
      
      // Send the transaction request
      const response = await fetch(`${this.API_BASE_URL}/transaction/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(callData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit transaction: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log("Contribution transaction result:", result);
      return { 
        success: true,
        txId: result.transactionId || result.txId || `pending_${Date.now()}`
      };
    } catch (error) {
      console.error("Error submitting contribution:", error);
      return { 
        success: false, 
        error: `Failed to submit contribution: ${error instanceof Error ? error.message : "Unknown error"}` 
      };
    }
  }

  // Start the campaign (move from Setup to Active)
  async startCampaign(
    contractAddress: string,
    privateKeyStr: string
  ): Promise<ContributionResult> {
    try {
      // Get the address from the private key
      const keyInfo = await this.parsePrivateKey(privateKeyStr);
      
      // Prepare the function call data
      const callData = {
        contractAddress: contractAddress,
        functionName: "start_campaign",
        parameters: [],
        gas: this.GAS_LIMIT,
        privateKey: privateKeyStr 
      };
      
      console.log("Start campaign call data:", JSON.stringify(callData, null, 2));
      
      if (config.testMode) {
        // In test mode, simulate a successful transaction
        console.log("Test mode: Simulating successful start campaign transaction");
        return { 
          success: true,
          txId: `tx_${Date.now().toString(36)}`
        };
      }
      
      // Send the transaction request
      const response = await fetch(`${this.API_BASE_URL}/transaction/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(callData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit transaction: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log("Start campaign transaction result:", result);
      return { 
        success: true,
        txId: result.transactionId || result.txId || `pending_${Date.now()}`
      };
    } catch (error) {
      console.error("Error starting campaign:", error);
      return { 
        success: false, 
        error: `Failed to start campaign: ${error instanceof Error ? error.message : "Unknown error"}` 
      };
    }
  }

  // End the campaign and start computation
  async endCampaign(
    contractAddress: string,
    privateKeyStr: string
  ): Promise<CampaignEndResult> {
    try {
      // Get the address from the private key
      const keyInfo = await this.parsePrivateKey(privateKeyStr);
      
      // Prepare the function call data
      const callData = {
        contractAddress: contractAddress,
        functionName: "end_campaign",
        parameters: [],
        gas: this.GAS_LIMIT,
        privateKey: privateKeyStr 
      };
      
      console.log("End campaign call data:", JSON.stringify(callData, null, 2));
      
      if (config.testMode) {
        // In test mode, simulate a successful transaction
        console.log("Test mode: Simulating successful end campaign transaction");
        return { 
          success: true,
          txId: `tx_${Date.now().toString(36)}`
        };
      }
      
      // Send the transaction request
      const response = await fetch(`${this.API_BASE_URL}/transaction/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(callData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit transaction: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log("End campaign transaction result:", result);
      return { 
        success: true,
        txId: result.transactionId || result.txId || `pending_${Date.now()}`
      };
    } catch (error) {
      console.error("Error ending campaign:", error);
      return { 
        success: false, 
        error: `Failed to end campaign: ${error instanceof Error ? error.message : "Unknown error"}` 
      };
    }
  }

  // Withdraw funds (for project owner)
  async withdrawFunds(
    contractAddress: string,
    privateKeyStr: string
  ): Promise<WithdrawalResult> {
    try {
      // Get the address from the private key
      const keyInfo = await this.parsePrivateKey(privateKeyStr);
      
      // Prepare the function call data
      const callData = {
        contractAddress: contractAddress,
        functionName: "withdraw_funds",
        parameters: [],
        gas: this.GAS_LIMIT,
        privateKey: privateKeyStr
      };
      
      console.log("Withdraw funds call data:", JSON.stringify(callData, null, 2));
      
      if (config.testMode) {
        // In test mode, simulate a successful transaction
        console.log("Test mode: Simulating successful withdraw funds transaction");
        return { 
          success: true,
          txId: `tx_${Date.now().toString(36)}`
        };
      }
      
      // Send the transaction request
      const response = await fetch(`${this.API_BASE_URL}/transaction/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(callData)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to submit transaction: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      console.log("Withdraw funds transaction result:", result);
      return { 
        success: true,
        txId: result.transactionId || result.txId || `pending_${Date.now()}`
      };
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      return { 
        success: false, 
        error: `Failed to withdraw funds: ${error instanceof Error ? error.message : "Unknown error"}` 
      };
    }
  }

  // Check the status of a transaction
  async checkTransactionStatus(txId: string): Promise<any> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/transaction/${txId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transaction: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error("Error checking transaction status:", error);
      return null;
    }
  }

  // Check if an address is the project owner
  async isProjectOwner(
    contractAddress: string,
    address: string
  ): Promise<boolean> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/contract/${contractAddress}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contract: ${response.statusText}`);
      }
      
      const contractData = await response.json();
      
      if (!contractData || !contractData.state || !contractData.state.owner) {
        return false;
      }
      
      return contractData.state.owner === address;
    } catch (error) {
      console.error("Error checking project ownership:", error);
      
      // For testing only
      if (config.testMode) {
        return address.startsWith('0x');
      }
      
      return false;
    }
  }

  // Helper functions for hex conversion
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(Math.floor(hex.length / 2));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export default new BlockchainService();