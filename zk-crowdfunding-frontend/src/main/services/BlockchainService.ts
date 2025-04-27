import { ChainControllerApi, Configuration } from "@partisiablockchain/blockchain-api-transaction-client";
import { Buffer } from "buffer";
import config from '../config';

// Project data structure for individual campaigns
export interface ProjectData {
  title: string;
  description: string;
  fundingTarget: number;
  deadline: number; // timestamp
  status: 'Setup' | 'Active' | 'Computing' | 'Completed';
  totalRaised: number | null;
  numContributors: number | null;
  isSuccessful: boolean | null;
}

// Campaign info structure from factory
export interface CampaignInfo {
  address: string;
  owner: string;
  title: string;
  description: string;
  creation_time: number;
  target: number;
  deadline: number;
}

// Campaign creation parameters
export interface CreateCampaignParams {
  title: string;
  description: string;
  category: string;
  image_url?: string;
  funding_target: number;
  deadline: number;
}

// Response types for various actions
export interface ContributionResult {
  success: boolean;
  txId?: string;
  error?: string;
}

export interface WalletInfo {
  address: string;
}

class BlockchainService {
  private client: ChainControllerApi;
  private factoryAddress: string;
  private currentCampaignAddress?: string;
  private currentWallet?: WalletInfo;
  
  constructor() {
    this.client = new ChainControllerApi(
      new Configuration({ basePath: config.blockchain.rpcNodeUrl })
    );
    
    // Set the factory address from config - this is the main contract for the dApp
    this.factoryAddress = config.factoryAddress;
    if (!this.factoryAddress) {
      console.warn('Factory address not set in config. Campaign creation will not be available.');
    }
  }

  // Set the currently selected campaign address
  setCurrentCampaignAddress(address: string) {
    this.currentCampaignAddress = address;
  }

  getCurrentCampaignAddress(): string | undefined {
    return this.currentCampaignAddress;
  }

  // Connect wallet (simplified for MVP)
  async connectWallet(privateKey: string): Promise<WalletInfo> {
    // In a real implementation, this would properly sign transactions
    // For MVP, we're just using a simplified approach
    this.currentWallet = {
      address: `0x${privateKey.substring(0, 8)}...`
    };
    return this.currentWallet;
  }

  // Create a new campaign through the factory contract
  async createCampaign(params: CreateCampaignParams): Promise<ContributionResult> {
    if (!this.factoryAddress) {
      return { success: false, error: 'Factory address not configured' };
    }

    if (!this.currentWallet) {
      return { success: false, error: 'Wallet not connected' };
    }

    try {
      // In a real implementation, this would properly serialize the parameters
      // and sign/send the transaction to the factory contract
      const rpc = this.buildCreateCampaignRpc(params);
      
      // Simulate transaction sending to factory contract
      const txId = `tx_${Date.now().toString(36)}`;
      
      // In reality, we'd send the transaction to the factory contract
      console.log(`Creating campaign via factory at ${this.factoryAddress}`);
      
      return {
        success: true,
        txId: txId
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  // Get user's campaigns from the factory contract
  async getMyCampaigns(): Promise<CampaignInfo[]> {
    if (!this.factoryAddress) {
      console.warn('Factory address not configured');
      return [];
    }

    if (!this.currentWallet) {
      return [];
    }

    // In a real implementation, this would call the factory contract
    // to get campaigns owned by the current user
    console.log(`Getting campaigns from factory at ${this.factoryAddress} for user ${this.currentWallet.address}`);
    
    return [
      {
        address: '0x1234...5678',
        owner: this.currentWallet.address,
        title: 'Sample Campaign',
        description: 'This is a test campaign',
        creation_time: Date.now() - 86400000, // 1 day ago
        target: 1000,
        deadline: Date.now() + 86400000 * 7 // 7 days from now
      }
    ];
  }

  // Get all campaigns from the factory contract
  async getAllCampaigns(): Promise<CampaignInfo[]> {
    if (!this.factoryAddress) {
      console.warn('Factory address not configured');
      return [];
    }

    // In a real implementation, this would call the factory contract
    // to get all campaigns
    console.log(`Getting all campaigns from factory at ${this.factoryAddress}`);
    
    return [
      {
        address: '0x1234...5678',
        owner: '0xabcd...efgh',
        title: 'Community Project',
        description: 'Funding for local community center',
        creation_time: Date.now() - 86400000 * 2, // 2 days ago
        target: 5000,
        deadline: Date.now() + 86400000 * 14 // 14 days from now
      },
      {
        address: '0x9876...5432',
        owner: '0xijkl...mnop',
        title: 'Tech Innovation Fund',
        description: 'Supporting new technology startups',
        creation_time: Date.now() - 86400000 * 5, // 5 days ago
        target: 10000,
        deadline: Date.now() + 86400000 * 30 // 30 days from now
      }
    ];
  }

  // Get project data for a specific campaign contract
  async getProject(campaignAddress: string): Promise<ProjectData> {
    console.log(`Getting project data for campaign at ${campaignAddress}`);
    
    // In a real implementation, this would fetch data from the specific campaign contract
    return {
      title: "Demo Project",
      description: "This is a demo project",
      fundingTarget: 1000,
      deadline: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days from now
      status: 'Active',
      totalRaised: null,
      numContributors: 5,
      isSuccessful: null
    };
  }

  // Campaign-specific actions (these operate on individual campaign contracts)
  async contribute(amount: number): Promise<ContributionResult> {
    if (!this.currentCampaignAddress) {
      return { success: false, error: 'No campaign selected' };
    }

    console.log(`Contributing ${amount} to campaign at ${this.currentCampaignAddress}`);
    return { success: true, txId: 'tx_contrib123' };
  }

  async startCampaign(): Promise<ContributionResult> {
    if (!this.currentCampaignAddress) {
      return { success: false, error: 'No campaign selected' };
    }

    console.log(`Starting campaign at ${this.currentCampaignAddress}`);
    return { success: true, txId: 'tx_start123' };
  }

  async endCampaign(): Promise<ContributionResult> {
    if (!this.currentCampaignAddress) {
      return { success: false, error: 'No campaign selected' };
    }

    console.log(`Ending campaign at ${this.currentCampaignAddress}`);
    return { success: true, txId: 'tx_end123' };
  }

  async withdrawFunds(): Promise<ContributionResult> {
    if (!this.currentCampaignAddress) {
      return { success: false, error: 'No campaign selected' };
    }

    console.log(`Withdrawing funds from campaign at ${this.currentCampaignAddress}`);
    return { success: true, txId: 'tx_withdraw123' };
  }

  async isProjectOwner(): Promise<boolean> {
    if (!this.currentCampaignAddress || !this.currentWallet) {
      return false;
    }

    // In a real implementation, this would check if the current wallet
    // is the owner of the current campaign
    return true;
  }

  // Build RPC for creating a campaign (sent to factory contract)
  private buildCreateCampaignRpc(params: CreateCampaignParams): Buffer {
    // In a real implementation, this would properly serialize the parameters
    // according to the factory contract ABI
    const data = {
      title: params.title,
      description: params.description,
      category: params.category,
      image_url: params.image_url || null,
      funding_target: params.funding_target,
      deadline: params.deadline
    };

    // This is simplified - in reality, we'd use proper ABI encoding
    return Buffer.from(JSON.stringify(data));
  }
}

export default new BlockchainService();