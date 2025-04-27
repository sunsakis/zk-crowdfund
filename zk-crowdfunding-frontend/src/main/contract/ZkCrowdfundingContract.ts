// zk-crowdfunding-frontend/src/contract/ZkCrowdfundingContract.ts
import { BlockchainAddress } from "@partisiablockchain/abi-client";

// Campaign status enum that matches the updated contract's enum (without Setup)
export enum CampaignStatus {
  Active = 0,
  Computing = 1,
  Completed = 2
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
  static statusToString(status: CampaignStatus): 'Active' | 'Computing' | 'Completed' {
    switch (status) {
      case CampaignStatus.Active:
        return 'Active';
      case CampaignStatus.Computing:
        return 'Computing';
      case CampaignStatus.Completed:
        return 'Completed';
      default:
        return 'Active';
    }
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