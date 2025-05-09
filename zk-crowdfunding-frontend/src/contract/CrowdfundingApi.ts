import {
  BlockchainAddress,
  BlockchainTransactionClient,
  SentTransaction
} from "@partisiablockchain/blockchain-api-transaction-client";
import { RealZkClient, Client } from "@partisiablockchain/zk-client";
import { Buffer } from "buffer";
import { AbiBitOutput, AbiByteOutput, AbiByteInput } from "@partisiablockchain/abi-client";
import { ShardedClient } from "../client/ShardedClient";

/**
 * Custom error class for API operations
 */
export class CrowdfundingApiError extends Error {
  public readonly code: string;
  public readonly transactionId?: string;

  constructor(message: string, code: string, transactionId?: string) {
    super(message);
    this.name = 'CrowdfundingApiError';
    this.code = code;
    this.transactionId = transactionId;
  }
}

/**
 * Transaction result with additional metadata
 */
export interface TransactionResult {
  transaction: SentTransaction;
  status: 'pending' | 'success' | 'failed';
  metadata?: Record<string, any>;
}

/**
 * Allowance information
 */
export interface AllowanceInfo {
  currentAllowance: bigint;
  sufficientAllowance: boolean;
  requiredAmount: bigint;
}

/**
 * API for the crowdfunding contract.
 * Handles communication with the blockchain and ZK computations.
 */
export class CrowdfundingApi {
  private readonly transactionClient: BlockchainTransactionClient | undefined;
  private readonly zkClient: RealZkClient;
  private readonly sender: BlockchainAddress;
  private readonly baseClient: ShardedClient;
  
  // Constants for gas limits with some buffer
  private readonly TOKEN_APPROVAL_GAS = 15000;
  private readonly CONTRIBUTION_GAS = 120000;
  private readonly END_CAMPAIGN_GAS = 150000;
  private readonly WITHDRAW_FUNDS_GAS = 30000;
  private readonly VERIFY_CONTRIBUTION_GAS = 15000;
  
  // ZK scaling factor for contribution amounts
  private readonly ZK_SCALE_FACTOR = 1_000_000; // 6 decimal places
  private readonly MAX_ZK_VALUE = 2147483647; // Max i32 value
  private readonly API_URL = "https://node1.testnet.partisiablockchain.com";

  constructor(
    transactionClient: BlockchainTransactionClient | undefined,
    zkClient: RealZkClient,
    sender: BlockchainAddress,
    baseClient?: ShardedClient
  ) {
    this.transactionClient = transactionClient;
    this.zkClient = zkClient;
    this.sender = sender;
    
    // Initialize the base client if not provided
    this.baseClient = baseClient || new ShardedClient(this.API_URL, ["Shard0", "Shard1", "Shard2"]);
  }

  /**
   * Get wallet address
   * @returns The wallet address
   */
  readonly getWalletAddress = (): string => {
    return this.sender;
  };

  /**
   * Checks if a wallet is connected
   * @returns True if a wallet is connected
   */
  readonly isWalletConnected = (): boolean => {
    return this.transactionClient !== undefined;
  };

  /**
   * Validates that inputs meet ZK computation requirements
   * @param amount The floating point amount to validate
   * @throws Error if amount is invalid for ZK computation
   */
  readonly validateZkAmount = (amount: number): void => {
    if (isNaN(amount) || amount <= 0) {
      throw new CrowdfundingApiError(
        "Contribution amount must be a positive number",
        "INVALID_AMOUNT"
      );
    }
    
    const scaledAmount = Math.floor(amount * this.ZK_SCALE_FACTOR);
    if (scaledAmount <= 0) {
      throw new CrowdfundingApiError(
        "Contribution amount too small for ZK computation",
        "AMOUNT_TOO_SMALL"
      );
    }
    
    if (scaledAmount > this.MAX_ZK_VALUE) {
      throw new CrowdfundingApiError(
        `Contribution amount too large for ZK computation. Maximum is approximately ${this.MAX_ZK_VALUE / this.ZK_SCALE_FACTOR}`,
        "AMOUNT_TOO_LARGE"
      );
    }
  };

  /**
   * Check token allowance for the campaign contract
   * Due to API limitations, this is a simulated check
   * @param tokenAddress Token contract address
   * @param campaignAddress Campaign contract address
   * @param requiredAmount Amount needed for the transaction
   * @returns Allowance information
   */
  readonly getTokenAllowance = async (
    tokenAddress: string,
    campaignAddress: string,
    requiredAmount: bigint
  ): Promise<AllowanceInfo> => {
    if (!this.isWalletConnected()) {
      throw new CrowdfundingApiError(
        "Wallet not connected",
        "WALLET_NOT_CONNECTED"
      );
    }
    
    try {
      // NOTE: Since direct token allowance checking via callView is not available,
      // we'll use a more compatible approach:
      
      // Fetch the contract data for the token, if available
      const tokenContract = await this.baseClient.getContractData(tokenAddress);
      
      if (!tokenContract) {
        console.warn(`Token contract data not available for ${tokenAddress}`);
        return {
          currentAllowance: BigInt(0),
          sufficientAllowance: false,
          requiredAmount
        };
      }
      
      // For production, you would implement this by:
      // 1. Creating a custom endpoint in your backend to check allowances
      // 2. Use direct blockchain queries against the token contract storage
      // 3. Maintain a local cache of recent approvals by the user
      
      // For now, we conservatively return 0 allowance, requiring explicit approval
      return {
        currentAllowance: BigInt(0),
        sufficientAllowance: false,
        requiredAmount
      };
    } catch (error) {
      console.error("Error getting token allowance:", error);
      
      // Fallback to zero allowance
      return {
        currentAllowance: BigInt(0),
        sufficientAllowance: false,
        requiredAmount
      };
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
  ): Promise<TransactionResult> => {
    if (!this.isWalletConnected()) {
      throw new CrowdfundingApiError(
        "Wallet not connected",
        "WALLET_NOT_CONNECTED"
      );
    }
    
    if (!tokenAddress || !campaignAddress) {
      throw new CrowdfundingApiError(
        "Invalid addresses provided",
        "INVALID_ADDRESS"
      );
    }
    
    if (amount <= BigInt(0)) {
      throw new CrowdfundingApiError(
        "Amount must be greater than zero",
        "INVALID_AMOUNT"
      );
    }
  
    try {
      // Build the approve RPC buffer (shortname 0x05 for approve)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x05); // approve shortname
        
        // Fixed: Directly use Buffer for address
        _out.writeBytes(Buffer.from(campaignAddress, 'hex'));
        
        // Serialize u128 as 16 bytes in little-endian format
        const buffer = Buffer.alloc(16);
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
      const transaction = await this.transactionClient!.signAndSend({
        address: tokenAddress,
        rpc
      }, this.TOKEN_APPROVAL_GAS);
      
      return {
        transaction,
        status: 'pending',
        metadata: {
          tokenAddress,
          campaignAddress,
          amount: amount.toString(),
          type: 'approval'
        }
      };
    } catch (error) {
      console.error("Error approving tokens:", error);
      throw new CrowdfundingApiError(
        `Error approving tokens: ${error.message || error}`,
        "APPROVAL_FAILED"
      );
    }
  };

  /**
   * Build and send add contribution transaction.
   * This handles both the ZK secret input and the token transfer in one user operation
   * @param amount The contribution amount (floating point)
   * @param campaignAddress Campaign contract address
   * @param tokenAddress Token contract address
   * @returns Transaction result
   */
  readonly addContribution = async (
    amount: number,
    campaignAddress: string, 
    tokenAddress: string
  ): Promise<TransactionResult> => {
    if (!this.isWalletConnected()) {
      throw new CrowdfundingApiError(
        "Wallet not connected", 
        "WALLET_NOT_CONNECTED"
      );
    }
    
    if (!campaignAddress) {
      throw new CrowdfundingApiError(
        "Campaign address is required",
        "MISSING_CAMPAIGN_ADDRESS"
      );
    }
    
    if (!tokenAddress) {
      throw new CrowdfundingApiError(
        "Token address is required",
        "MISSING_TOKEN_ADDRESS"
      );
    }

    try {
      // Validate amount for ZK computation
      this.validateZkAmount(amount);
      
      // Convert to scaled values for different parts of the operation
      const zkAmount = Math.floor(amount * this.ZK_SCALE_FACTOR);
      const tokenAmount = BigInt(Math.floor(amount * 10**18)); // Assuming 18 decimals for token
      
      // Check token allowance first
      const allowance = await this.getTokenAllowance(
        tokenAddress,
        campaignAddress,
        tokenAmount
      );
      
      // If insufficient allowance, throw error with useful information
      if (!allowance.sufficientAllowance) {
        throw new CrowdfundingApiError(
          `Insufficient token allowance. Current: ${allowance.currentAllowance}, Required: ${allowance.requiredAmount}`,
          "INSUFFICIENT_ALLOWANCE",
          undefined
        );
      }
      
      // Create two-phase approach using a Promise that resolves when both operations succeed
      return await this.executeContribution(campaignAddress, zkAmount, tokenAmount);
    } catch (error) {
      if (error instanceof CrowdfundingApiError) {
        throw error;
      }
      console.error("Error adding contribution:", error);
      throw new CrowdfundingApiError(
        `Error adding contribution: ${error.message || error}`,
        "CONTRIBUTION_FAILED"
      );
    }
  };

 /**
 * Build and send add contribution transaction with automatic approval
 * @param amount The contribution amount (floating point)
 * @param campaignAddress Campaign contract address
 * @param tokenAddress Token contract address
 * @returns Transaction result
 */
readonly addContributionWithApproval = async (
  amount: number,
  campaignAddress: string, 
  tokenAddress: string
): Promise<{
  approvalResult?: TransactionResult,
  contributionResult: TransactionResult
}> => {
  if (!this.isWalletConnected()) {
    throw new CrowdfundingApiError(
      "Wallet not connected", 
      "WALLET_NOT_CONNECTED"
    );
  }
  
  try {
    // Validate inputs and calculate amounts
    this.validateZkAmount(amount);
    const tokenDecimals = 18; // This should match your token's actual decimals
    const tokenAmount = BigInt(Math.floor(amount * (10 ** tokenDecimals)));
    
    // Check current allowance
    const allowance = await this.getTokenAllowance(
      tokenAddress,
      campaignAddress,
      tokenAmount
    );
    
    // If insufficient allowance, first approve tokens
    let approvalResult: TransactionResult | undefined;
    if (!allowance.sufficientAllowance) {
      console.log(`Approving tokens: Required ${tokenAmount}, Current ${allowance.currentAllowance}`);
      approvalResult = await this.approveTokens(
        tokenAddress,
        campaignAddress,
        tokenAmount
      );
      
      // Wait for approval to be processed
      console.log("Waiting for approval to be processed...");
      await new Promise(resolve => setTimeout(resolve, 20000)); // Increased to 20 seconds
      
      // Important: After approval, we'll bypass the allowance check in addContribution
      // by directly calling the internal executeContribution method
      
      // Make the contribution directly
      console.log("Executing contribution after approval...");
      const zkAmount = Math.floor(amount * this.ZK_SCALE_FACTOR);
      const contributionResult = await this.executeContribution(
        campaignAddress, 
        zkAmount, 
        tokenAmount
      );
      
      return {
        approvalResult,
        contributionResult
      };
    } else {
      // Allowance is already sufficient, just make the contribution
      console.log("Allowance already sufficient, making contribution directly");
      const contributionResult = await this.addContribution(
        amount,
        campaignAddress,
        tokenAddress
      );
      
      return {
        contributionResult
      };
    }
  } catch (error) {
    console.error("Error in addContributionWithApproval:", error);
    if (error instanceof CrowdfundingApiError) {
      throw error;
    }
    throw new CrowdfundingApiError(
      `Error processing contribution with approval: ${error.message || String(error)}`,
      "CONTRIBUTION_WITH_APPROVAL_FAILED"
    );
  }
};
  
  /**
 * Execute the contribution in two coordinated transactions
 * @param campaignAddress Campaign contract address
 * @param zkAmount Amount for ZK computation
 * @param tokenAmount Amount for token transfer
 * @returns Combined transaction result
 */
readonly executeContribution = async (
  campaignAddress: string,
  zkAmount: number,
  tokenAmount: bigint
): Promise<TransactionResult> => {
  try {
    // Phase 1: Submit ZK input
    const secretInput = AbiBitOutput.serialize((_out) => {
      _out.writeI32(zkAmount);
    });
    
    // Create public RPC for add_contribution (shortname 0x40)
    const publicRpc = Buffer.from([0x40]);
    
    // Build the ZK input transaction
    const transaction = await this.zkClient.buildOnChainInputTransaction(
      this.sender,
      secretInput,
      publicRpc
    );
    
    // Send the ZK input transaction
    const zkTx = await this.transactionClient!.signAndSend(
      transaction, 
      this.CONTRIBUTION_GAS
    );
    
    // Defensive check to ensure transaction pointer exists
    if (!zkTx || !zkTx.transactionPointer) {
      throw new CrowdfundingApiError(
        "Invalid transaction response from ZK contribution",
        "INVALID_TRANSACTION_RESPONSE"
      );
    }
    
    // Store transaction details safely with null checks
    const zkTxId = zkTx.transactionPointer?.identifier || "unknown";
    const zkShardId = zkTx.transactionPointer?.destinationShardId || null;
    
    console.log("ZK transaction sent:", {
      transactionId: zkTxId,
      shardId: zkShardId,
      zkAmount
    });
    
    // Wait a brief time for the ZK transaction to be seen by the network
    // This helps coordinate the two transactions
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Phase 2: Send the token contribution transaction
    const contributeTokensRpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09); // Format indicator
      _out.writeBytes(Buffer.from("07", "hex")); // contribute_tokens shortname
      
      // Serialize u128 as 16 bytes in little-endian format
      const buffer = Buffer.alloc(16);
      const view = new DataView(buffer.buffer);
      
      // Split the bigint into 32-bit chunks
      const low32 = Number(tokenAmount & BigInt(0xffffffff));
      const mid32 = Number((tokenAmount >> BigInt(32)) & BigInt(0xffffffff));
      const high32 = Number((tokenAmount >> BigInt(64)) & BigInt(0xffffffff));
      const top32 = Number((tokenAmount >> BigInt(96)) & BigInt(0xffffffff));
      
      // Write in little-endian format
      view.setUint32(0, low32, true);
      view.setUint32(4, mid32, true);
      view.setUint32(8, high32, true);
      view.setUint32(12, top32, true);
      
      _out.writeBytes(buffer);
    });
    
    // Send the token transfer transaction
    const tokenTx = await this.transactionClient!.signAndSend({
      address: campaignAddress, // Use campaignAddress directly to avoid potential issues
      rpc: contributeTokensRpc
    }, this.CONTRIBUTION_GAS);
    
    // Defensive check for token transaction
    if (!tokenTx || !tokenTx.transactionPointer) {
      throw new CrowdfundingApiError(
        "Invalid transaction response from token contribution",
        "INVALID_TRANSACTION_RESPONSE"
      );
    }
    
    // Store transaction details safely with null checks
    const tokenTxId = tokenTx.transactionPointer?.identifier || "unknown";
    const tokenShardId = tokenTx.transactionPointer?.destinationShardId || null;
    
    console.log("Token transaction sent:", {
      transactionId: tokenTxId,
      shardId: tokenShardId,
      tokenAmount: tokenAmount.toString()
    });
    
    // Return information about both transactions to the caller with proper error handling
    return {
      transaction: zkTx,
      status: 'pending',
      metadata: {
        zkTransaction: {
          id: zkTxId,
          shard: zkShardId
        },
        tokenTransaction: {
          id: tokenTxId,
          shard: tokenShardId
        },
        zkAmount,
        tokenAmount: tokenAmount.toString()
      }
    };
  } catch (error) {
    console.error("Error in executeContribution:", error);
    
    if (error instanceof CrowdfundingApiError) {
      throw error;
    }
    
    throw new CrowdfundingApiError(
      `Error processing contribution: ${error.message || String(error)}`,
      "CONTRIBUTION_EXECUTION_FAILED"
    );
  }
};

  /**
   * Verify if the user has made a contribution to the campaign
   * @param address The campaign contract address
   * @returns Transaction result
   */
  readonly verifyContribution = async (address: string): Promise<TransactionResult> => {
    if (!this.isWalletConnected()) {
      throw new CrowdfundingApiError(
        "Wallet not connected",
        "WALLET_NOT_CONNECTED"
      );
    }
    
    if (!address) {
      throw new CrowdfundingApiError(
        "Campaign address is required",
        "MISSING_CAMPAIGN_ADDRESS"
      );
    }
    
    // Using same format as previous functions but with different shortname
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);
      _out.writeBytes(Buffer.from("06", "hex")); // Shortname 0x06 for verification
    });
    
    try {
      const transaction = await this.transactionClient!.signAndSend(
        { address, rpc }, 
        this.VERIFY_CONTRIBUTION_GAS
      );
      
      return {
        transaction,
        status: 'pending',
        metadata: {
          type: 'verification'
        }
      };
    } catch (error) {
      console.error("Error verifying contribution:", error);
      throw new CrowdfundingApiError(
        `Error verifying contribution: ${error.message || error}`,
        "VERIFICATION_FAILED"
      );
    }
  };
  
  /**
   * Build and send end campaign transaction
   * This starts the ZK computation to sum all contributions.
   * @param address The campaign contract address
   * @returns Transaction result
   */
  readonly endCampaign = async (address: string): Promise<TransactionResult> => {
    if (!this.isWalletConnected()) {
      throw new CrowdfundingApiError(
        "Wallet not connected",
        "WALLET_NOT_CONNECTED"
      );
    }
    
    if (!address) {
      throw new CrowdfundingApiError(
        "Campaign address is required",
        "MISSING_CAMPAIGN_ADDRESS"
      );
    }

    // Create the RPC for ending campaign
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);  // Format indicator
      _out.writeBytes(Buffer.from("01", "hex"));  // Action shortname (0x01)
    });

    try {
      // Send the transaction
      const transaction = await this.transactionClient!.signAndSend(
        { address, rpc }, 
        this.END_CAMPAIGN_GAS
      );
      
      return {
        transaction,
        status: 'pending',
        metadata: {
          type: 'endCampaign'
        }
      };
    } catch (error) {
      console.error("Error ending campaign:", error);
      throw new CrowdfundingApiError(
        `Error ending campaign: ${error.message || error}`,
        "END_CAMPAIGN_FAILED"
      );
    }
  };

  /**
   * Build and send withdraw funds transaction.
   * Only works if campaign was successful (target reached)
   * @param address The campaign contract address
   * @returns Transaction result
   */
  readonly withdrawFunds = async (address: string): Promise<TransactionResult> => {
    if (!this.isWalletConnected()) {
      throw new CrowdfundingApiError(
        "Wallet not connected",
        "WALLET_NOT_CONNECTED"
      );
    }
    
    if (!address) {
      throw new CrowdfundingApiError(
        "Campaign address is required",
        "MISSING_CAMPAIGN_ADDRESS"
      );
    }
    
    // Create withdraw funds RPC
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);
      _out.writeBytes(Buffer.from("04", "hex")); // Withdraw funds shortname
    });
    
    try {
      const transaction = await this.transactionClient!.signAndSend(
        { address, rpc }, 
        this.WITHDRAW_FUNDS_GAS
      );
      
      return {
        transaction,
        status: 'pending',
        metadata: {
          type: 'withdrawFunds'
        }
      };
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      throw new CrowdfundingApiError(
        `Error withdrawing funds: ${error.message || error}`,
        "WITHDRAW_FAILED"
      );
    }
  };
  
 /**
 * Check transaction status using direct API calls
 * @param transactionId Transaction ID
 * @param shardId Optional shard ID (if already known)
 * @returns Promise resolving to transaction status
 */
readonly checkTransactionStatus = async (
  transactionId: string,
  shardId?: string
): Promise<{
  status: 'pending' | 'success' | 'failed',
  finalizedBlock?: string,
  errorMessage?: string
}> => {
  if (!transactionId) {
    throw new CrowdfundingApiError(
      "Transaction ID is required",
      "MISSING_TRANSACTION_INFO"
    );
  }
  
  try {
    // Use native fetch instead of relying on ShardedClient
    const checkSingleShard = async (shard: string) => {
      try {
        // Construct URL directly
        const url = `${this.API_URL}/chain/shards/${shard}/transactions/${transactionId}?requireFinal=true`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) {
          // Not found in this shard or other error
          return null;
        }
        
        const transaction = await response.json();
        return transaction;
      } catch (error) {
        console.log(`Error checking transaction in ${shard}:`, error);
        return null;
      }
    };
    
    // If no shard specified, try all
    if (!shardId) {
      const shards = ["Shard0", "Shard1", "Shard2"];
      
      for (const shard of shards) {
        const transaction = await checkSingleShard(shard);
        
        if (transaction) {
          if (transaction.executionSucceeded) {
            return { 
              status: 'success',
              finalizedBlock: transaction.block
            };
          } else {
            return { 
              status: 'failed',
              errorMessage: transaction.failureCause?.errorMessage || 'Unknown error'
            };
          }
        }
      }
      
      // If we get here, transaction was not found on any shard
      return { status: 'pending' };
    } else {
      // Check just the specified shard
      const transaction = await checkSingleShard(shardId);
      
      if (!transaction) {
        return { status: 'pending' };
      }
      
      if (transaction.executionSucceeded) {
        return { 
          status: 'success',
          finalizedBlock: transaction.block
        };
      } else {
        return { 
          status: 'failed',
          errorMessage: transaction.failureCause?.errorMessage || 'Unknown error'
        };
      }
    }
  } catch (error) {
    console.error("Error checking transaction status:", error);
    return { status: 'pending' };
  }
};
}