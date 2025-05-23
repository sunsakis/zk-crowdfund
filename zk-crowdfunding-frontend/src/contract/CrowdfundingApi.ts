import {
  BlockchainAddress,
  BlockchainTransactionClient,
  SentTransaction
} from "@partisiablockchain/blockchain-api-transaction-client";
import { RealZkClient } from "@partisiablockchain/zk-client";
import { Buffer } from "buffer";
import { AbiBitOutput, AbiByteOutput, BN } from "@partisiablockchain/abi-client";
import { ShardedClient } from "../client/ShardedClient";
import { deserializeState } from '../contract/CrowdfundingGenerated';

/**
 * Convert a floating-point amount to token units with correct precision
 * @param amount The floating-point amount
 * @param decimals The number of decimal places for the token (default: 18)
 * @returns BigInt representation of the token amount
 */
function floatToTokenUnits(amount: number, decimals: number = 18): bigint {
  if (isNaN(amount) || amount < 0) {
    throw new Error("Amount must be a non-negative number");
  }
  
  // Prevent any potential floating point precision issues
  const amountStr = amount.toFixed(decimals);
  
  // Split into whole and fractional parts
  const parts = amountStr.split('.');
  const wholePart = parts[0];
  const fractionalPart = parts.length > 1 ? parts[1] : '';
  
  // Pad fractional part with zeros if needed
  const paddedFractionalPart = fractionalPart.padEnd(decimals, '0');
  
  // Combine and convert to BigInt
  const combinedStr = wholePart + paddedFractionalPart;
  
  return BigInt(combinedStr);
}

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
  private readonly END_CAMPAIGN_GAS = 150000;
  private readonly WITHDRAW_FUNDS_GAS = 30000;
  private readonly VERIFY_CONTRIBUTION_GAS = 15000;
  
  // ZK scaling factor for contribution amounts
  private readonly ZK_SCALE_FACTOR = 1_000_000; // 6 decimal places
  private readonly MAX_ZK_VALUE = 2147483647; // Max i32 value
  private readonly API_URL = "https://node1.testnet.partisiablockchain.com";
  
  // Default token decimals
  private readonly TOKEN_DECIMALS = 18;

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
    
    const scaledAmount = Math.round(amount * this.ZK_SCALE_FACTOR);
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

      
      // Conservatively return 0 allowance, requiring explicit approval
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
 const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      // Action shortname for approve is 0x05
      _out.writeU8(0x05);
      
      // Write spender address (campaign address)
      const addressBuffer = Buffer.from(
        campaignAddress.startsWith('0x') ? 
        campaignAddress.substring(2) : 
        campaignAddress, 
        'hex'
      );
      _out.writeBytes(addressBuffer);
      
      // IMPORTANT: Directly serialize the u128 amount
      const buffer = Buffer.alloc(16);
      
      // Convert to hex string for debugging
      const hexStr = amount.toString(16).padStart(32, '0');
      console.log("APPROVAL DEBUG: Amount in hex:", hexStr);
      
      // Little-endian serialization (lowest byte first)
      let tempValue = amount;
      for (let i = 0; i < 16; i++) {
        buffer[i] = Number(tempValue & BigInt(0xFF));
        tempValue = tempValue >> BigInt(8);
      }
      
      console.log("APPROVAL DEBUG: Serialized bytes:", buffer.toString('hex'));
      _out.writeBytes(buffer);
    });
    
    console.log("APPROVAL DEBUG: Final RPC:", rpc.toString('hex'));
    
    // Send the transaction
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
      const zkAmount = Math.round(amount * this.ZK_SCALE_FACTOR);
      const tokenAmount = floatToTokenUnits(amount, this.TOKEN_DECIMALS);
      
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
      
      // Execute the contribution using the calculated values
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
    
    // Convert to token units with precise handling (consistent method)
    const decimals = this.TOKEN_DECIMALS;
    // Convert to string with fixed precision to avoid floating point errors
    const amountStr = amount.toFixed(decimals);
    
    // Remove decimal point and convert to BigInt
    const parts = amountStr.split('.');
    const wholePart = parts[0];
    const fractionalPart = parts.length > 1 ? parts[1] : '';
    
    // Pad fractional part with zeros if needed
    const paddedFractionalPart = fractionalPart.padEnd(decimals, '0');
    
    // Combine and convert to BigInt
    const tokenAmount = BigInt(wholePart + paddedFractionalPart);
    
    // Convert the ZK amount for the secret contribution
    const zkAmount = Math.round(amount * this.ZK_SCALE_FACTOR);
    
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
      
      // Convert BigInt to BN for ABI compatibility
      const bnAmount = new BN(tokenAmount.toString());
      
      // Create the approval RPC using proper ABI serialization
      const approveRpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x05); // approve shortname
        
        // Write the spender address (campaign address)
        // Note: Address is expected to be a hex string without 0x prefix
        if (campaignAddress.startsWith('0x')) {
          campaignAddress = campaignAddress.substring(2);
        }
        _out.writeBytes(Buffer.from(campaignAddress, 'hex'));
        
        // Serialize the u128 amount correctly
        _out.writeUnsignedBigInteger(bnAmount, 16); // Correctly serialize as u128 (16 bytes)
      });
      
      // Send the transaction to approve tokens
      const approvalTx = await this.transactionClient!.signAndSend({
        address: tokenAddress,
        rpc: approveRpc
      }, this.TOKEN_APPROVAL_GAS);
      
      approvalResult = {
        transaction: approvalTx,
        status: 'pending',
        metadata: {
          tokenAddress,
          campaignAddress,
          amount: tokenAmount.toString(),
          type: 'approval'
        }
      };
      
      // Wait for approval to be confirmed on chain
      console.log("Waiting for approval to be processed...");
      
      // Get the approval transaction ID for logging/tracking
      const approvalTxId = approvalResult.transaction?.transactionPointer?.identifier || "unknown";
      console.log(`Approval transaction ID: ${approvalTxId}`);
      
      // Wait longer for approval to be fully confirmed on-chain 
      await new Promise(resolve => setTimeout(resolve, 20000)); // 30 seconds
      
      try {
        // Verify approval status 
        const approvalStatus = await this.checkTransactionStatus(approvalTxId);
        console.log(`Approval transaction status: ${approvalStatus.status}`);
        
        if (approvalStatus.status === 'failed') {
          throw new CrowdfundingApiError(
            `Token approval failed: ${approvalStatus.errorMessage || 'Unknown error'}`,
            "APPROVAL_FAILED",
            approvalTxId
          );
        }
      } catch (statusError) {
        console.warn("Could not verify approval status, continuing anyway:", statusError);
      }
    } else {
      console.log("Allowance already sufficient, making direct contribution");
    }
    
    // Now execute the contribution (combining ZK input and token transfer)
    console.log("Executing contribution...");
    
    // Phase 1: Submit ZK input
    const secretInput = AbiBitOutput.serialize((_out) => {
      _out.writeI32(zkAmount); // Write the ZK amount as i32
    });
    
    // Create public RPC for add_contribution (shortname 0x40)
    const publicRpc = Buffer.from([0x40]);
    
    // Build the ZK input transaction
    const zkTransaction = await this.zkClient.buildOnChainInputTransaction(
      this.sender,
      secretInput,
      publicRpc
    );
    
    // Send the ZK input transaction with increased gas
    const zkTx = await this.transactionClient!.signAndSend(
      zkTransaction, 
      200000 // Increased gas for ZK operations
    );
    
    // Store ZK transaction details safely with null checks
    const zkTxId = zkTx.transactionPointer?.identifier || "unknown";
    const zkShardId = zkTx.transactionPointer?.destinationShardId || null;
    
    console.log("ZK transaction sent:", {
      transactionId: zkTxId,
      shardId: zkShardId,
      zkAmount
    });
    
    // Wait for the ZK transaction to be processed by the network
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Phase 2: Send the token contribution transaction
    // Convert BigInt to BN for ABI compatibility
    const bnTokenAmount = new BN(tokenAmount.toString());
    
    // Create the RPC for contribute_tokens using proper ABI serialization
    const contributeTokensRpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09); // Format indicator for actions
      _out.writeBytes(Buffer.from([0x07])); // contribute_tokens shortname
      _out.writeUnsignedBigInteger(bnTokenAmount, 16); // Correctly serialize as u128 (16 bytes)
    });
    
    // Send the token transfer transaction with increased gas
    const tokenTx = await this.transactionClient!.signAndSend({
      address: campaignAddress,
      rpc: contributeTokensRpc
    }, 200000); // Increased gas for token operations
    
    // Store token transaction details safely with null checks
    const tokenTxId = tokenTx.transactionPointer?.identifier || "unknown";
    const tokenShardId = tokenTx.transactionPointer?.destinationShardId || null;
    
    console.log("Token transaction sent:", {
      transactionId: tokenTxId,
      shardId: tokenShardId,
      tokenAmount: tokenAmount.toString()
    });
    
    // Create the final contribution result
    const contributionResult: TransactionResult = {
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
    
    // Return both results
    return {
      approvalResult,
      contributionResult
    };
    
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

readonly generateRefundProof = async (address: string): Promise<TransactionResult> => {
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
  
  // Create generate_refund_proof RPC with format indicator
  const rpc = AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeU8(0x09); // Format indicator for actions
    _out.writeBytes(Buffer.from([0x06])); // generate_refund_proof shortname
  });
  
  try {
    const transaction = await this.transactionClient!.signAndSend(
      { address, rpc }, 
      200000 // Higher gas limit for ZK operations
    );
    
    return {
      transaction,
      status: 'pending',
      metadata: {
        type: 'generateRefundProof'
      }
    };
  } catch (error) {
    console.error("Error generating refund proof:", error);
    throw new CrowdfundingApiError(
      `Error generating refund proof: ${error.message || error}`,
      "REFUND_PROOF_GENERATION_FAILED"
    );
  }
};
  
  /**
   * Execute the contribution in two coordinated transactions
   * Fully compliant with Partisia blockchain binary format specifications
   * 
   * @param campaignAddress Campaign contract address
   * @param zkAmount Amount for ZK computation (scaled integer)
   * @param tokenAmount Amount for token transfer (BigInt)
   * @returns Combined transaction result
   */
  readonly executeContribution = async (
    campaignAddress: string,
    zkAmount: number,
    tokenAmount: bigint
  ): Promise<TransactionResult> => {
    try {
      console.log(`EXECUTE DEBUG: ZK amount: ${zkAmount}, Token amount: ${tokenAmount.toString()}`);
      
      // PHASE 1: Submit ZK input
      // ZK inputs use a different format than regular RPC calls
      const secretInput = AbiBitOutput.serialize((_out) => {
        _out.writeI32(zkAmount); // Write the ZK amount as i32
      });
      
      // Public RPC for ZK input uses a simple shortname format
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
        200000 // Increased gas for ZK operations
      );
      
      // Store transaction details with proper null checks
      const zkTxId = zkTx?.transactionPointer?.identifier || "unknown";
      const zkShardId = zkTx?.transactionPointer?.destinationShardId || null;
      
      console.log("ZK transaction sent:", {
        transactionId: zkTxId,
        shardId: zkShardId,
        zkAmount
      });
      
      // Wait for ZK transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // PHASE 2: Send token contribution transaction
      // Following Partisia's binary format specification
      const contributeTokensRpc = AbiByteOutput.serializeBigEndian((_out) => {
        // Format indicator in BigEndian (per Partisia docs)
        _out.writeU8(0x09);
        
        // Action shortname in BigEndian
        _out.writeBytes(Buffer.from([0x07]));
        
        // Serialize token amount in LittleEndian (per Partisia docs for numeric types)
        // Create a buffer for the 16-byte u128 value
        const buffer = Buffer.alloc(16);
        
        // Write in little-endian format (least significant byte first)
        let tempValue = tokenAmount;
        for (let i = 0; i < 16; i++) {
          buffer[i] = Number(tempValue & BigInt(0xFF));
          tempValue = tempValue >> BigInt(8);
        }
        
        console.log("Token amount serialized bytes:", buffer.toString('hex'));
        _out.writeBytes(buffer);
      });
      
      // Send the token transfer transaction
      const tokenTx = await this.transactionClient!.signAndSend({
        address: campaignAddress,
        rpc: contributeTokensRpc
      }, 200000);
      
      // Store token transaction details
      const tokenTxId = tokenTx?.transactionPointer?.identifier || "unknown";
      const tokenShardId = tokenTx?.transactionPointer?.destinationShardId || null;
      
      console.log("Token transaction sent:", {
        transactionId: tokenTxId,
        shardId: tokenShardId,
        tokenAmount: tokenAmount.toString()
      });
      
      // Return combined transaction result
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
    
    // Create verify_my_contribution RPC with format indicator
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09); // Format indicator for actions
      _out.writeBytes(Buffer.from([0x06])); // verify_my_contribution shortname
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

    // Create the RPC for ending campaign with format indicator
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);  // Format indicator for actions
      _out.writeBytes(Buffer.from([0x01]));  // Action shortname as bytes
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
    
    // Create withdraw funds RPC with format indicator
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09); // Format indicator for actions
      _out.writeBytes(Buffer.from([0x04])); // Withdraw funds shortname as bytes
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
        // Construct URL with the correct format
        const url = `${this.API_URL}/chain/shards/${shard}/transactions/${transactionId}`;
        
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
          // Check the correct properties based on the API response format
          if (transaction.executionStatus?.success) {
            return { 
              status: 'success',
              finalizedBlock: transaction.executionStatus.blockId
            };
          } else {
            return { 
              status: 'failed',
              errorMessage: transaction.executionStatus?.failure?.errorMessage || 'Unknown error'
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
      
      // Check the correct properties based on the API response format
      if (transaction.executionStatus?.success) {
        return { 
          status: 'success',
          finalizedBlock: transaction.executionStatus.blockId
        };
      } else {
        return { 
          status: 'failed',
          errorMessage: transaction.executionStatus?.failure?.errorMessage || 'Unknown error'
        };
      }
    }
  } catch (error) {
    console.error("Error checking transaction status:", error);
    return { status: 'pending' };
  }
};

  /**
   * Helper function to safely extract contract state from API response
   * @param contractData Raw contract data from API response
   * @returns Contract state data and important fields
   */
  readonly extractContractState = (contractData: any): { 
    stateBuffer: Buffer, 
    tokenAddress: string 
  } => {
    if (!contractData) {
      throw new CrowdfundingApiError(
        "Contract data is null or undefined",
        "INVALID_CONTRACT_DATA"
      );
    }
    
    if (typeof contractData !== 'object') {
      throw new CrowdfundingApiError(
        "Contract data is not an object",
        "INVALID_CONTRACT_DATA"
      );
    }
    
    if (!contractData.serializedContract) {
      throw new CrowdfundingApiError(
        "Invalid contract data: missing serializedContract",
        "INVALID_CONTRACT_DATA"
      );
    }
    
    const serializedContract = contractData.serializedContract;
    
    if (!serializedContract.openState || 
        typeof serializedContract.openState !== 'object' ||
        !serializedContract.openState.openState ||
        typeof serializedContract.openState.openState !== 'object' ||
        typeof serializedContract.openState.openState.data !== 'string') {
      throw new CrowdfundingApiError(
        "Invalid contract state format",
        "INVALID_CONTRACT_STATE_FORMAT"
      );
    }
    
    // Now we can safely access the data property
    const rawStateData = serializedContract.openState.openState.data;
    const stateBuffer = Buffer.from(rawStateData, "base64");
    
    // Import state deserializer from your generated code
    try {
      const state = deserializeState(stateBuffer);
      
      // Get token address (handling both property names for compatibility)
      const tokenAddress = (state.token_address || state.tokenAddress)?.asString();
      
      if (!tokenAddress) {
        throw new CrowdfundingApiError(
          "Contract does not have a token address configured",
          "MISSING_TOKEN_ADDRESS"
        );
      }
      
      return { stateBuffer, tokenAddress };
    } catch (error) {
      console.error("Error deserializing contract state:", error);
      throw new CrowdfundingApiError(
        `Failed to deserialize contract state: ${error.message}`,
        "STATE_DESERIALIZATION_FAILED"
      );
    }
  };
  
  /**
   * Get campaign data directly from contract
   * @param address Campaign contract address
   * @returns Promise with campaign data
   */
  readonly getCampaignData = async (address: string): Promise<any> => {
    if (!address) {
      throw new CrowdfundingApiError(
        "Campaign address is required",
        "MISSING_CAMPAIGN_ADDRESS"
      );
    }
    
    try {
      // Get contract data from the API
      const contractData = await this.baseClient.getContractData(address);
      
      if (!contractData) {
        throw new CrowdfundingApiError(
          "Failed to retrieve contract data",
          "CONTRACT_DATA_NOT_FOUND"
        );
      }
      
      // Extract and parse the state using the safe extractor
      const { stateBuffer } = this.extractContractState(contractData);
      
      // Deserialize state
      const state = deserializeState(stateBuffer);
      
      // Return relevant campaign info
      return {
        owner: state.owner.asString(),
        title: state.title,
        description: state.description,
        tokenAddress: (state.token_address || state.tokenAddress)?.asString(),
        fundingTarget: state.fundingTarget.toString(),
        status: state.status,
        totalRaised: state.totalRaised ? state.totalRaised.toString() : undefined,
        numContributors: state.numContributors,
        isSuccessful: state.isSuccessful,
      };
    } catch (error) {
      console.error("Error getting campaign data:", error);
      
      if (error instanceof CrowdfundingApiError) {
        throw error;
      }
      
      throw new CrowdfundingApiError(
        `Failed to get campaign data: ${error.message}`,
        "CAMPAIGN_DATA_FETCH_FAILED"
      );
    }
  };
}