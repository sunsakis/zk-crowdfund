import {
  BlockchainAddress,
  BlockchainTransactionClient
} from "@partisiablockchain/blockchain-api-transaction-client";

import { RealZkClient } from "@partisiablockchain/zk-client";
import { Buffer } from "buffer";
import { AbiBitOutput, AbiByteOutput } from "@partisiablockchain/abi-client";

/**
 * API for the crowdfunding contract.
 * Handles communication with the blockchain and ZK computations.
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
        
        // Write the address as bytes
        _out.writeBytes(Buffer.from(campaignAddress, 'hex'));
        
        // Convert BigInt to a 16-byte buffer for u128
        const buffer = Buffer.alloc(16);
        
        // Use DataView for better endianness control
        const view = new DataView(buffer.buffer);
        
        // Split the bigint into 32-bit chunks
        const low32 = Number(amount & BigInt(0xffffffff));
        const mid32 = Number((amount >> BigInt(32)) & BigInt(0xffffffff));
        const high32 = Number((amount >> BigInt(64)) & BigInt(0xffffffff));
        const top32 = Number((amount >> BigInt(96)) & BigInt(0xffffffff));
        
        // Write in little-endian format
        view.setUint32(0, low32, true);
        view.setUint32(4, mid32, true);
        view.setUint32(8, high32, true);
        view.setUint32(12, top32, true);
        
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
 * @param zkAmount the contribution amount to input for ZK computation (i32 compatible)
 * @param tokenAmount the full token amount to transfer (BigInt)
 */
readonly addContribution = async (zkAmount: number, tokenAmount: bigint) => {
  if (this.transactionClient === undefined) {
    throw new Error("No account logged in");
  }

  // For ZK computation, we must use a value that fits in i32 (-2^31 to 2^31-1)
  // We validate this on the frontend side
  const secretInput = AbiBitOutput.serialize((_out) => {
    // Write the ZK-scaled amount as i32
    _out.writeI32(zkAmount);
  });
  
  // Create public RPC for add_contribution (shortname 0x40)
  const publicRpc = Buffer.from([0x40]);
  
  try {
    console.log("Building ZK transaction with scaled amount:", zkAmount);
    
    // Build the ZK input transaction
    const transaction = await this.zkClient.buildOnChainInputTransaction(
      this.sender,
      secretInput,
      publicRpc
    );
    
    // Send the ZK input transaction
    const zkTx = await this.transactionClient.signAndSend(transaction, 100_000);
    
    console.log("ZK input transaction sent:", zkTx);
    
    // Now also send the token transfer transaction
    console.log(`Sending contribute_tokens transaction with full token amount: ${tokenAmount}`);
    
    // Create the RPC for contributeTokens
    const contributeTokensRpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09); // Format indicator
      _out.writeBytes(Buffer.from("07", "hex")); // contribute_tokens shortname
      
      // Convert BigInt to a 16-byte buffer for u128
      const buffer = Buffer.alloc(16);
      
      // Use DataView for better endianness control
      const view = new DataView(buffer.buffer);
      
      // Split the bigint into 32-bit chunks
      const low32 = Number(tokenAmount & BigInt(0xffffffff));
      const mid32 = Number((tokenAmount >> BigInt(32)) & BigInt(0xffffffff));
      const high32 = Number((tokenAmount >> BigInt(64)) & BigInt(0xffffffff));
      const top32 = Number((tokenAmount >> BigInt(96)) & BigInt(0xffffffff));
      
      // Write in little-endian format - THIS IS CRITICAL
      view.setUint32(0, low32, true);
      view.setUint32(4, mid32, true);
      view.setUint32(8, high32, true);
      view.setUint32(12, top32, true);
      
      _out.writeBytes(buffer);
    });
    
    // Send the token transfer transaction
    const tokenTx = await this.transactionClient.signAndSend({
      address: transaction.address,
      rpc: contributeTokensRpc
    }, 100000);
    
    console.log("Token transfer transaction sent:", tokenTx);
    
    // Return the ZK transaction for the frontend to track
    return zkTx;
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

    // Create the RPC for ending campaign
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);  // Format indicator
      _out.writeBytes(Buffer.from("01", "hex"));  // The action shortname (0x01)
    });

    try {
      console.log("Ending campaign with properly serialized RPC:", Buffer.from(rpc).toString('hex'));
      
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
    
    // Using same format as endCampaign with different shortname
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);
      _out.writeBytes(Buffer.from("04", "hex"));
    });
    
    return this.transactionClient.signAndSend({ address, rpc }, 20_000);
  };
}