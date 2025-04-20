import * as abi from "@partisiablockchain/abi-client";
import * as zkClient from "@partisiablockchain/zk-client";
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
  private client: any; // Using any for now due to type issues
  private readonly GAS_LIMIT = 100000;
  
  constructor() {
    // Initialize the client with testnet connection info
    this.client = new zkClient.BlockchainApiClient(config.blockchain.rpcNodeUrl);
    console.log("BlockchainService initialized with:", config.blockchain.rpcNodeUrl);
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
      
      // Create a signer from the private key
      const signer = new zkClient.PartisiaSigner(privateKeyBytes);
      const address = await signer.getAddress();
      
      return {
        key: privateKeyBytes,
        address
      };
    } catch (error) {
      console.error("Error parsing private key:", error);
      throw new Error("Invalid private key format");
    }
  }

  // Get contract state and parse it into project data
  async getProject(contractAddress: string): Promise<ProjectData> {
    try {
      const contractState = await this.client.getContractState(contractAddress);
      
      if (!contractState || !contractState.state) {
        throw new Error("Contract state not found");
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

  // Submit a contribution as a secret input
  async contribute(
    contractAddress: string,
    amount: number,
    privateKey: string
  ): Promise<ContributionResult> {
    try {
      const keyInfo = await this.parsePrivateKey(privateKey);
      const signer = new zkClient.PartisiaSigner(keyInfo.key);
      
      // Build transaction
      const tx = await zkClient.TransactionBuilder.buildContractCallTransaction({
        contractAddress,
        methodName: "add_contribution",
        params: [amount.toString()],
        gasLimit: this.GAS_LIMIT
      });
      
      // Sign transaction
      const signedTx = await signer.signTransaction(tx);
      
      // Send transaction
      const txId = await this.client.sendTransaction(signedTx);
      
      console.log("Contribution transaction sent:", txId);
      return { success: true, txId };
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
      const keyInfo = await this.parsePrivateKey(privateKey);
      const signer = new zkClient.PartisiaSigner(keyInfo.key);
      
      // Build transaction
      const tx = await zkClient.TransactionBuilder.buildContractCallTransaction({
        contractAddress,
        methodName: "start_campaign",
        params: [],
        gasLimit: this.GAS_LIMIT
      });
      
      // Sign transaction
      const signedTx = await signer.signTransaction(tx);
      
      // Send transaction
      const txId = await this.client.sendTransaction(signedTx);
      
      console.log("Start campaign transaction sent:", txId);
      return { success: true, txId };
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
      const keyInfo = await this.parsePrivateKey(privateKey);
      const signer = new zkClient.PartisiaSigner(keyInfo.key);
      
      // Build transaction
      const tx = await zkClient.TransactionBuilder.buildContractCallTransaction({
        contractAddress,
        methodName: "end_campaign",
        params: [],
        gasLimit: this.GAS_LIMIT
      });
      
      // Sign transaction
      const signedTx = await signer.signTransaction(tx);
      
      // Send transaction
      const txId = await this.client.sendTransaction(signedTx);
      
      console.log("End campaign transaction sent:", txId);
      
      // The actual results will be available after the computation completes
      return { success: true, txId };
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
      const keyInfo = await this.parsePrivateKey(privateKey);
      const signer = new zkClient.PartisiaSigner(keyInfo.key);
      
      // Build transaction
      const tx = await zkClient.TransactionBuilder.buildContractCallTransaction({
        contractAddress,
        methodName: "withdraw_funds",
        params: [],
        gasLimit: this.GAS_LIMIT
      });
      
      // Sign transaction
      const signedTx = await signer.signTransaction(tx);
      
      // Send transaction
      const txId = await this.client.sendTransaction(signedTx);
      
      console.log("Withdraw funds transaction sent:", txId);
      return { success: true, txId };
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
      const receipt = await this.client.getTransactionReceipt(txId);
      return receipt;
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
      const contractState = await this.client.getContractState(contractAddress);
      
      if (!contractState || !contractState.state || !contractState.state.owner) {
        return false;
      }
      
      return contractState.state.owner === address;
    } catch (error) {
      console.error("Error checking project ownership:", error);
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