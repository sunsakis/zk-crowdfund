// Fixed CrowdfundingApi.ts

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
   * Export transaction client for debugging
   */
  getTransactionClient() {
    return this.transactionClient;
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
    
    // Create the public RPC - this is the key change!
    // Just use a simple buffer with the shortname
    const publicRpc = Buffer.from([0x40]);
    
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
   * End campaign - FIXED VERSION
   */
  readonly endCampaign = async (address: string) => {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    console.log(`Ending campaign at address: ${address}`);
    
    // IMPORTANT: This is the critical change - use a simple Buffer with just the shortname
    const rpc = Buffer.from([0x01]);
    
    console.log("RPC payload (hex):", rpc.toString('hex'));
    
    try {
      return await this.transactionClient.signAndSend({
        address,
        rpc
      }, 100_000); // Higher gas limit for ZK operations
    } catch (error) {
      console.error("Error ending campaign:", error);
      console.error("Error details:", error);
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
    
    // Similar change here - use simple Buffer
    const rpc = Buffer.from([0x02]);
    
    return this.transactionClient.signAndSend({ address, rpc }, 20_000);
  };
}