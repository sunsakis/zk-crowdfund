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
   * Get wallet address
   * @returns The wallet address
   */
  readonly getWalletAddress = (): string => {
    return this.sender;
  };

  /**
   * Check token allowance for the campaign contract
   * @param tokenAddress Token contract address
   * @param ownerAddress Owner address (usually the connected wallet)
   * @param spenderAddress Spender address (campaign contract)
   * @returns Current allowance as BigInt
   */
  readonly getTokenAllowance = async (
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint> => {
    try {
      // For now, return 0 to ensure approval is always needed
      // In a production app, you'd query the token contract
      console.log("Checking allowance (simulated):", ownerAddress, spenderAddress);
      return BigInt(0);
    } catch (error) {
      console.error("Error getting token allowance:", error);
      return BigInt(0);
    }
  };

  /**
   * Approve tokens to be spent by the campaign contract
   * @param tokenAddress Token contract address
   * @param campaignAddress Campaign contract address
   * @param amount Amount to approve
   * @returns Transaction result
   */
  readonly approveTokens = async (
    tokenAddress: string,
    campaignAddress: string,
    amount: bigint
  ) => {
    if (!this.transactionClient) {
      throw new Error("Wallet not connected");
    }

    try {
      console.log(`Approving ${amount} tokens for campaign ${campaignAddress}`);

      // Build the approve RPC buffer (shortname 0x05 for approve)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x05); // approve shortname
        
        // Instead of using BlockchainAddress.fromString, we'll write the address directly
        _out.writeBytes(Buffer.from(campaignAddress, 'hex'));
        
        // Convert BigInt to bytes and write it as a byte array
        // For u128, we need 16 bytes
        const buffer = Buffer.alloc(16);
        
        // Write the amount as little-endian bytes
        for (let i = 0; i < 16; i++) {
          buffer[i] = Number((amount >> BigInt(i * 8)) & BigInt(0xff));
        }
        
        _out.writeBytes(buffer);
      });

      // Send the transaction to approve tokens
      return this.transactionClient.signAndSend({
        address: tokenAddress,
        rpc
      }, 10000); // 10,000 gas
    } catch (error) {
      console.error("Error approving tokens:", error);
      throw error;
    }
  };

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
      _out.writeBytes(Buffer.from("06", "hex"));  // Shortname 0x06 for verification
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
   * Transfer tokens to the campaign (separate from ZK input)
   * @param address Campaign contract address
   * @param amount Contribution amount
   * @returns Transaction result
   */
  readonly contributeTokens = async (address: string, amount: number) => {
    if (!address) {
      throw new Error("No contract address provided");
    }
    
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    
    // Create RPC for contribute_tokens (shortname 0x03)
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x03); // contribute_tokens shortname
      
      // Convert number to bytes for u128
      const buffer = Buffer.alloc(16);
      const bigIntAmount = BigInt(amount);
      
      // Write the amount as little-endian bytes
      for (let i = 0; i < 16; i++) {
        buffer[i] = Number((bigIntAmount >> BigInt(i * 8)) & BigInt(0xff));
      }
      
      _out.writeBytes(buffer);
    });
  
    // Send the transaction
    return this.transactionClient.signAndSend({
      address,
      rpc
    }, 100000); // 100,000 gas
  }

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
      _out.writeBytes(Buffer.from("04", "hex"));
    });
    
    return this.transactionClient.signAndSend({ address, rpc }, 20_000);
  };
}