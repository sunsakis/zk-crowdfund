import {
  BlockchainAddress,
  BlockchainTransactionClient
} from "@partisiablockchain/blockchain-api-transaction-client";

import { RealZkClient } from "@partisiablockchain/zk-client";
import { Buffer } from "buffer";
import { AbiBitOutput, AbiByteOutput } from "@partisiablockchain/abi-client";

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
   * Add contribution to campaign (ZK input)
   */
  readonly addContribution = async (amount: number) => {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }

    if (!this.zkClient) {
      throw new Error("ZK client not initialized");
    }

    console.log(`Adding contribution of ${amount}`);
    
    // Create the secret input for the amount
    const secretInput = AbiBitOutput.serialize((_out) => {
      _out.writeI32(amount);
    });
    
    // Create the public RPC
    const publicRpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("40", "hex"));
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
   */
  readonly endCampaign = async (address: string) => {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    console.log(`Ending campaign at address: ${address}`);
    
    // Create RPC payload with the end_campaign shortname
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("01", "hex"));
    });
    
    try {
      return await this.transactionClient.signAndSend({
        address,
        rpc
      }, 100_000); // Higher gas limit for ZK operations
    } catch (error) {
      console.error("Error ending campaign:", error);
      throw error;
    }
  };

  /**
   * Withdraw funds
   */
  readonly withdrawFunds = async (address: string) => {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("02", "hex"));
    });
    
    return this.transactionClient.signAndSend({ address, rpc }, 20_000);
  };
}