/*
 * Crowdfunding API for interaction with both factory and campaign contracts
 */
import {
  BlockchainAddress,
  BlockchainTransactionClient,
  AbiByteOutput
} from "@partisiablockchain/blockchain-api-transaction-client";

import { RealZkClient } from "@partisiablockchain/zk-client";
import { Buffer } from "buffer";

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
   */
  readonly addContribution = async (campaignAddress: string, amount: number) => {
    if (!this.transactionClient || !this.zkClient) {
      throw new Error("No account logged in or ZK client not available");
    }

    // Public RPC for add_contribution
    const publicRpc = Buffer.from([0x40]); // Shortname from contract
    
    // Secret input
    const secretInput = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeI32(amount);
    });

    const transaction = await this.zkClient.buildOnChainInputTransaction(
      this.sender,
      secretInput,
      publicRpc
    );

    return this.transactionClient.signAndSend(transaction, 100_000);
  };

  /**
   * End campaign
   */
  readonly endCampaign = async (campaignAddress: string) => {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("020000000f", "hex"));
    });
    
    return this.transactionClient.signAndSend({ address: campaignAddress, rpc }, 20_000);
  };

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