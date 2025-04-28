/*
 * Crowdfunding API for interaction with both factory and campaign contracts
 */
import {
  BlockchainAddress,
  BlockchainTransactionClient
} from "@partisiablockchain/blockchain-api-transaction-client";

import { RealZkClient } from "@partisiablockchain/zk-client";
import { Buffer } from "buffer";
import { AbiBitOutput, AbiByteOutput } from "@partisiablockchain/abi-client"; // Fixed import for AbiByteOutput

export interface CrowdfundingBasicState {
  owner: BlockchainAddress;
  title: string;
  description: string;
  fundingTarget: number;
  deadline: number;
  status: number; // CampaignStatus enum value
  totalRaised: number | undefined;
  numContributors: number | undefined;
  isSuccessful: boolean;
}

/**
 * API for the crowdfunding contract and factory.
 */
export class CrowdfundingApi {
  private readonly transactionClient: BlockchainTransactionClient | undefined;
  private readonly zkClient: RealZkClient | undefined;
  private readonly sender: BlockchainAddress;
  private readonly factoryAddress: string | undefined;

  constructor(
    transactionClient: BlockchainTransactionClient | undefined,
    zkClient: RealZkClient | undefined,
    sender: BlockchainAddress,
    factoryAddress?: string
  ) {
    this.transactionClient = transactionClient;
    this.zkClient = zkClient;
    this.sender = sender;
    this.factoryAddress = factoryAddress;
  }

  /**
   * Register a deployed campaign with the factory
   */
  readonly registerCampaign = async (campaignAddress: string) => {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    if (!this.factoryAddress) {
      throw new Error("Factory address not set");
    }

    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      // Action shortname for register_campaign from FactoryGenerated
      _out.writeBytes(Buffer.from("fba986d10f", "hex"));
      
      // Campaign address parameter
      _out.writeBytes(Buffer.from(campaignAddress.replace("0x", ""), "hex"));
      
      // Owner address parameter (sender)
      const ownerAddressHex = this.sender.asString();
      _out.writeBytes(Buffer.from(ownerAddressHex, "hex"));
      
      // Index parameter - set to 0 for automatic assignment
      _out.writeU32(0);
    });
    
    return this.transactionClient.signAndSend({ address: this.factoryAddress, rpc }, 100_000);
  };

  /**
   * Get campaigns from the factory
   */
  readonly getCampaigns = async () => {
    if (!this.factoryAddress) {
      throw new Error("Factory address not set");
    }

    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      // Action shortname for get_campaigns from FactoryGenerated
      _out.writeBytes(Buffer.from("01", "hex"));
    });

    // For RPC read operations, we need to use a different approach
    // This is just a placeholder for a proper implementation
    return [];
  };

  /**
   * Start a campaign
   */
  readonly startCampaign = async (campaignAddress: string) => {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      // Action bytes for start_campaign (based on contract)
      _out.writeBytes(Buffer.from("010000000f", "hex"));
    });
    
    return this.transactionClient.signAndSend({ address: campaignAddress, rpc }, 20_000);
  };

  /**
   * Add contribution to campaign (ZK input)
   * 
   * @param campaignAddress - The address of the campaign contract
   * @param amount - The contribution amount
   * @returns Promise with transaction result
   */
  readonly addContribution = async (campaignAddress: string, amount: number) => {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }

    // Check if zkClient exists for this campaign
    if (!this.zkClient) {
      throw new Error("ZK client not available. Please reconnect your wallet or refresh the page.");
    }

    console.log(`Adding contribution of ${amount} to ${campaignAddress}`);
    
    // Create the public RPC (action shortname from the contract)
    const publicRpc = Buffer.from([0x40]); // shortname 0x40 for add_contribution
    
    // Create the secret input for the amount
    const secretInput = AbiBitOutput.serialize((_out) => {
      _out.writeI32(amount);
    });
    
    try {
      // Build the ZK transaction
      const transaction = await this.zkClient.buildOnChainInputTransaction(
        this.sender,
        secretInput,
        publicRpc
      );
      
      // Sign and send the transaction
      return await this.transactionClient.signAndSend(transaction, 100_000);
    } catch (error) {
      console.error("Error creating ZK transaction:", error);
      throw new Error(`Failed to create contribution: ${error.message || error}`);
    }
  };

/**
 * End campaign
 * This function creates an RPC payload to end the crowdfunding campaign
 * The payload matches the shortname format defined in the contract
 */
readonly endCampaign = async (campaignAddress: string) => {
  if (!this.transactionClient) {
    throw new Error("No account logged in");
  }
  
  console.log(`Attempting to end campaign at address: ${campaignAddress}`);
  
  // Create RPC payload with just the action shortname (0x02)
  // This format matches the contract's expected format for zk=true actions
  const rpc = Buffer.from([0x02]);
  
  console.log("Sending end_campaign transaction with simplified RPC payload");
  
  try {
    // Use higher gas limit for ZK operations
    return await this.transactionClient.signAndSend({
      address: campaignAddress,
      rpc
    }, 50_000); // Increased gas to handle ZK operations
  } catch (error) {
    console.error("Error ending campaign:", error);
    throw error;
  }
}

  /**
   * Withdraw funds
   */
  readonly withdrawFunds = async (campaignAddress: string) => {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("030000000f", "hex"));
    });
    
    return this.transactionClient.signAndSend({ address: campaignAddress, rpc }, 20_000);
  };
}