/*
 * Crowdfunding API for interaction with both factory and campaign contracts
 */
import {
  BlockchainAddress,
  BlockchainTransactionClient,
  AbiByteOutput
} from "@partisiablockchain/blockchain-api-transaction-client";

import { RealZkClient } from "@partisiablockchain/zk-client";
import { CLIENT } from "../AppState";
import { Buffer } from "buffer";

export enum CampaignStatus {
  SETUP = 0,
  ACTIVE = 1, 
  COMPUTING = 2,
  COMPLETED = 3,
}

export interface CrowdfundingBasicState {
  owner: BlockchainAddress;
  title: string;
  description: string;
  fundingTarget: number;
  deadline: number;
  status: CampaignStatus;
  totalRaised: number | undefined;
  numContributors: number | undefined;
  isSuccessful: boolean;
}

export interface CampaignInfo {
  address: string;
  owner: string;
  title: string;
  description: string;
  creation_time: number;
  target: number;
  deadline: number;
}

/**
 * API for the crowdfunding contract and registry.
 */
export class CrowdfundingApi {
  private readonly transactionClient: BlockchainTransactionClient | undefined;
  private readonly zkClient: RealZkClient;
  readonly sender: BlockchainAddress;
  private readonly factoryAddress: string | undefined;

  constructor(
    transactionClient: BlockchainTransactionClient | undefined,
    zkClient: RealZkClient,
    sender: BlockchainAddress,
    factoryAddress?: string
  ) {
    this.transactionClient = transactionClient;
    this.zkClient = zkClient;
    this.sender = sender;
    this.factoryAddress = factoryAddress;
  }

  /**
   * Register a manually deployed campaign with the factory/registry
   */
  readonly registerCampaign = async (campaignAddress: string) => {
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    if (this.factoryAddress === undefined) {
      throw new Error("Factory/registry address not set");
    }

    // Build the register campaign RPC using proper ABI encoding
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      // Action selector for register_campaign
      _out.writeU8(9); // Action selector for actions
      _out.writeU8(1); // Discriminant for register_campaign (based on ordering in contract)
      
      // Campaign address parameter
      _out.writeBytes(Buffer.from(campaignAddress, "hex"));
      
      // Owner address - use the asString() method instead of toBuffer()
      const ownerAddressHex = this.sender.asString().replace('00', ''); // Remove '00' prefix if present
      _out.writeBytes(Buffer.from(ownerAddressHex, "hex"));
      
      // Index parameter - set to 0 for automatic assignment
      _out.writeU32(0);
    });
    
    // Send transaction to the factory/registry contract
    return this.transactionClient.signAndSend({ address: this.factoryAddress, rpc }, 100_000);
  };

  /**
   * Get all campaigns from the factory/registry
   */
  readonly getAllCampaigns = async (): Promise<CampaignInfo[]> => {
    if (this.factoryAddress === undefined) {
      throw new Error("Factory/registry address not set");
    }

    try {
      // Prepare RPC call for get_campaigns action
      const getRpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(9); // Action selector
        _out.writeU8(2); // Discriminant for get_campaigns (0x01 as defined in contract)
      });

      // Create a pseudo-sender for this read-only operation
      const pseudoSender = BlockchainAddress.fromString("0000000000000000000000000000000000000000");
      
      // Send the transaction to get campaigns
      const result = await this.transactionClient?.signAndSend(
        { address: this.factoryAddress, rpc: getRpc }, 
        20_000
      );

      // For now, we'll return an empty array since we need to wait for the transaction to execute
      // In a real implementation, you'd need to listen for the transaction result
      return [];
    } catch (error) {
      console.error("Error getting all campaigns:", error);
      return [];
    }
  };

  /**
   * Build and send add contribution secret input transaction.
   */
  readonly addContribution = async (amount: number) => {
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }

    // Build the RPC for add_contribution
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x40); // Shortname for add_contribution
    });

    const secretInput = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeI32(amount);
    });

    const transaction = await this.zkClient.buildOnChainInputTransaction(
      this.sender,
      secretInput,
      rpc
    );

    return this.transactionClient.signAndSend(transaction, 100_000);
  };

  /**
   * Build and send start campaign transaction
   */
  readonly startCampaign = async (campaignAddress: string) => {
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x01); // Shortname for start_campaign
    });
    
    return this.transactionClient.signAndSend({ address: campaignAddress, rpc }, 20_000);
  };

  /**
   * Build and send end campaign transaction
   */
  readonly endCampaign = async (campaignAddress: string) => {
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x02); // Shortname for end_campaign
    });
    
    return this.transactionClient.signAndSend({ address: campaignAddress, rpc }, 20_000);
  };

  /**
   * Build and send withdraw funds transaction
   */
  readonly withdrawFunds = async (campaignAddress: string) => {
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x03); // Shortname for withdraw_funds
    });
    
    return this.transactionClient.signAndSend({ address: campaignAddress, rpc }, 20_000);
  };
}