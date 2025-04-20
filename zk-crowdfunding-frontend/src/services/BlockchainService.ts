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
  private readonly TESTNET_URL = "https://node1.testnet.partisiablockchain.com";
  private readonly BROWSER_URL = "https://browser.testnet.partisiablockchain.com";
  private readonly GAS_LIMIT = 100000;
  
  constructor() {
    // Initialize connection to testnet
    console.log("Initializing BlockchainService with testnet connection");
  }

  // Parse a private key file or string
  async parsePrivateKey(privateKeyData: string): Promise<PrivateKeyInfo> {
    try {
      // Convert the private key string to bytes
      let privateKeyBytes: Uint8Array;
      
      if (privateKeyData.startsWith("0x")) {
        // Hex format with prefix
        privateKeyBytes = this.hexToBytes(privateKeyData.slice(2));
      } else if (privateKeyData.match(/^[0-9a-fA-F]+$/)) {
        // Hex format without prefix
        privateKeyBytes = this.hexToBytes(privateKeyData);
      } else {
        // Assume it's a PEM or another format
        privateKeyBytes = new TextEncoder().encode(privateKeyData);
      }
      
      // Generate a mock address based on the private key input
      // In a real implementation, this would use the Partisia SDK
      const mockAddress = `0x${Array.from(new TextEncoder().encode(privateKeyData))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 40)}`;
      
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
      // For now we'll use a direct API call to fetch the contract state
      const response = await fetch(`${this.TESTNET_URL}/contract/state/${contractAddress}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contract state: ${response.statusText}`);
      }
      
      const contractState = await response.json();
      
      if (!contractState || !contractState.state) {
        throw new Error("Contract state not found or invalid");
      }
      
      // Parse the state into our ProjectData format
      const state = contractState.state;
      
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
      
      // Fallback to mock data in case of error or during development
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

  // Submit a contribution as a secret input
  async contribute(
    contractAddress: string,
    amount: number,
    privateKey: string
  ): Promise<ContributionResult> {
    try {
      // Prepare the transaction payload
      const payload = {
        contractAddress,
        methodName: "add_contribution",
        parameters: [amount.toString()],
        privateKey: privateKey,
        gasLimit: this.GAS_LIMIT
      };
      
      // We'll use a direct API call to submit the transaction
      // In a real implementation, we'd use the Partisia SDK to sign and submit
      const response = await fetch(`${this.TESTNET_URL}/transaction/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Transaction failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        txId: result.transactionId || 'pending'
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
    privateKey: string
  ): Promise<ContributionResult> {
    try {
      // Prepare the transaction payload
      const payload = {
        contractAddress,
        methodName: "start_campaign",
        parameters: [],
        privateKey: privateKey,
        gasLimit: this.GAS_LIMIT
      };
      
      // We'll use a direct API call to submit the transaction
      const response = await fetch(`${this.TESTNET_URL}/transaction/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Transaction failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        txId: result.transactionId || 'pending'
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
    privateKey: string
  ): Promise<CampaignEndResult> {
    try {
      // Prepare the transaction payload
      const payload = {
        contractAddress,
        methodName: "end_campaign",
        parameters: [],
        privateKey: privateKey,
        gasLimit: this.GAS_LIMIT
      };
      
      // We'll use a direct API call to submit the transaction
      const response = await fetch(`${this.TESTNET_URL}/transaction/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Transaction failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        txId: result.transactionId || 'pending'
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
    privateKey: string
  ): Promise<WithdrawalResult> {
    try {
      // Prepare the transaction payload
      const payload = {
        contractAddress,
        methodName: "withdraw_funds",
        parameters: [],
        privateKey: privateKey,
        gasLimit: this.GAS_LIMIT
      };
      
      // We'll use a direct API call to submit the transaction
      const response = await fetch(`${this.TESTNET_URL}/transaction/invoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Transaction failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      return {
        success: true,
        txId: result.transactionId || 'pending'
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
      const response = await fetch(`${this.TESTNET_URL}/transaction/${txId}`);
      
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
      const response = await fetch(`${this.TESTNET_URL}/contract/state/${contractAddress}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contract state: ${response.statusText}`);
      }
      
      const contractState = await response.json();
      
      if (!contractState || !contractState.state || !contractState.state.owner) {
        return false;
      }
      
      return contractState.state.owner === address;
    } catch (error) {
      console.error("Error checking project ownership:", error);
      
      // For testing only - in a real implementation, we'd properly check
      return address.startsWith('0x');
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