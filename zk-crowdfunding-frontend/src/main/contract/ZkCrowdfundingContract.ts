// zk-crowdfunding-frontend/src/contract/ZkCrowdfundingContract.ts
import { BlockchainAddress } from "@partisiablockchain/abi-client";

// Campaign status enum that matches the contract's enum
export enum CampaignStatus {
  Setup = 0,
  Active = 1,
  Computing = 2,
  Completed = 3
}

// Contract state interface based on the smart contract design
export interface CrowdfundingState {
  owner: BlockchainAddress;
  title: string;
  description: string;
  fundingTarget: number;
  deadline: number;
  status: CampaignStatus;
  totalRaised: number | null;
  numContributors: number | null;
  isSuccessful: boolean;
}

/**
 * Helper class for the ZK Crowdfunding contract
 * Simplified to avoid compatibility issues
 */
export class ZkCrowdfundingContract {
  /**
   * Converts the contract status enum value to the string representation
   */
  static statusToString(status: CampaignStatus): 'Setup' | 'Active' | 'Computing' | 'Completed' {
    switch (status) {
      case CampaignStatus.Setup:
        return 'Setup';
      case CampaignStatus.Active:
        return 'Active';
      case CampaignStatus.Computing:
        return 'Computing';
      case CampaignStatus.Completed:
        return 'Completed';
      default:
        return 'Setup';
    }
  }
  
  /**
   * Create an RPC payload for start_campaign
   */
  static startCampaignRpc(): Buffer {
    // Simple placeholder - in real implementation would use proper encoding
    return Buffer.from([0x01]);
  }
  
  /**
   * Create an RPC payload for end_campaign
   */
  static endCampaignRpc(): Buffer {
    return Buffer.from([0x02]);
  }
  
  /**
   * Create an RPC payload for withdraw_funds
   */
  static withdrawFundsRpc(): Buffer {
    return Buffer.from([0x03]);
  }
  
  /**
   * Create an RPC payload for add_contribution
   */
  static addContributionRpc(): Buffer {
    return Buffer.from([0x40]);
  }
}