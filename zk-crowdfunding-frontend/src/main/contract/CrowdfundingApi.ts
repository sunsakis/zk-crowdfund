import {
  BlockchainAddress,
  BlockchainTransactionClient
} from "@partisiablockchain/blockchain-api-transaction-client";

import { RealZkClient } from "@partisiablockchain/zk-client";
import { Buffer } from "buffer";
import { AbiBitOutput, AbiByteOutput } from "@partisiablockchain/abi-client";

/**
 * API for the crowdfunding contract.
 * This implementation exactly matches the format used in average-salary.
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
   * Verify if the user has made a contribution to the campaign
   * @param address The contract address
   */
  readonly verifyContribution = async (address: string) => {
    if (!address) {
      throw new Error("No contract address provided");
    }
    
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    
    // Using same format as previous functions but with different shortname
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);
      _out.writeBytes(Buffer.from("04", "hex"));  // Shortname 0x04 for verification
    });
    
    try {
      const result = await this.transactionClient.signAndSend({ address, rpc }, 10_000);
      return result;
    } catch (error) {
      console.error("Error verifying contribution:", error);
      throw error;
    }
  };

  /**
   * Build and send add contribution secret input transaction.
   * @param amount the contribution amount to input
   */
  readonly addContribution = async (amount: number) => {
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }

    // Create secret input builder for the contribution amount
    const secretInput = AbiBitOutput.serialize((_out) => {
      _out.writeI32(amount);
    });
    
    // Create public RPC for add_contribution (shortname 0x40)
    const publicRpc = Buffer.from([0x40]);
    
    try {
      // Build the ZK input transaction
      const transaction = await this.zkClient.buildOnChainInputTransaction(
        this.sender,
        secretInput,
        publicRpc
      );
      
      // Send the transaction
      return this.transactionClient.signAndSend(transaction, 100_000);
    } catch (error) {
      console.error("Error adding contribution:", error);
      throw error;
    }
  };

  /**
   * Build and send end campaign transaction
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

    // Create the RPC for ending campaign with EXACT same format as average-salary example
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);  // This is a format indicator used in average-salary
      _out.writeBytes(Buffer.from("01", "hex"));  // The action shortname (0x01)
    });

    try {
      console.log("Ending campaign with properly serialized RPC:", Buffer.from(rpc).toString('hex'));
      
      // Send the transaction with proper format
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
    
    // Using same format as endCampaign with different shortname
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);
      _out.writeBytes(Buffer.from("02", "hex"));
    });
    
    return this.transactionClient.signAndSend({ address, rpc }, 20_000);
  };
}