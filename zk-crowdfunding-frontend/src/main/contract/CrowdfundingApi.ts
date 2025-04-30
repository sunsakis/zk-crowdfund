import {
  BlockchainAddress,
  BlockchainTransactionClient
} from "@partisiablockchain/blockchain-api-transaction-client";

import { RealZkClient } from "@partisiablockchain/zk-client";
import { Buffer } from "buffer";
import { addContribution, endCampaign, withdrawFunds } from "./CrowdfundingGenerated";

/**
 * API for the crowdfunding contract.
 * This implementation uses the ABI-generated functions for proper RPC serialization.
 */
export class CrowdfundingApi {
  private readonly transactionClient: BlockchainTransactionClient | undefined;
  private readonly zkClient: RealZkClient;
  private readonly sender: BlockchainAddress;

  constructor(
    transactionClient: BlockchainTransactionClient | undefined,
    zkClient: RealZkClient,
    sender: BlockchainAddress
  ) {
    this.transactionClient = transactionClient;
    this.zkClient = zkClient;
    this.sender = sender;
  }

  /**
   * Build and send add contribution secret input transaction.
   * @param amount the contribution amount to input
   */
  readonly addContribution = async (amount: number) => {
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }

    try {
      // Use the ABI-generated function to create secret input
      const secretInputBuilder = addContribution();
      const secretInput = secretInputBuilder.secretInput(amount);
      
      // Build the ZK input transaction
      const transaction = await this.zkClient.buildOnChainInputTransaction(
        this.sender,
        secretInput.secretInput,
        secretInput.publicRpc
      );
      
      // Send the transaction
      return this.transactionClient.signAndSend(transaction, 100_000);
    } catch (error) {
      console.error("Error adding contribution:", error);
      throw error;
    }
  };

  /**
   * Build and send end campaign transaction.
   * This starts the ZK computation to sum all contributions.
   * @param address The contract address
   */
  readonly endCampaign = async (address: string) => {
    if (!address) {
      throw new Error("No contract address provided");
    }

    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }

    try {
      // Use the ABI-generated function to create the RPC
      const rpc = endCampaign();
      
      console.log("Ending campaign with proper RPC:", Buffer.from(rpc).toString('hex'));
      
      // Send the transaction
      return this.transactionClient.signAndSend({ 
        address, 
        rpc 
      }, 100_000);
    } catch (error) {
      console.error("Error ending campaign:", error);
      throw error;
    }
  };

  /**
   * Build and send withdraw funds transaction.
   * Only works if campaign was successful (target reached)
   * @param address The contract address
   */
  readonly withdrawFunds = async (address: string) => {
    if (!address) {
      throw new Error("No contract address provided");
    }
    
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    
    try {
      // Use the ABI-generated function to create the RPC
      const rpc = withdrawFunds();
      
      return this.transactionClient.signAndSend({ 
        address, 
        rpc 
      }, 20_000);
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      throw error;
    }
  };
}