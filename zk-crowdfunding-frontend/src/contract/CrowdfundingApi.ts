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
 * Correctly serializes a u128 value for Partisia blockchain contracts
 * Uses little-endian format to match Rust's u128 deserialization
 * 
 * @param value The BigInt value to serialize
 * @returns Buffer with correctly serialized u128
 */
function serializeU128ForPartisiaContract(value: bigint): Buffer {
  // Ensure the value is valid
  if (value < 0n || value > BigInt("0xffffffffffffffffffffffffffffffff")) {
    throw new Error(`Value out of range for u128: ${value}`);
  }
  
  console.log("SERIALIZE DEBUG: Serializing BigInt value:", value.toString());
  console.log("SERIALIZE DEBUG: Hex representation:", "0x" + value.toString(16));
  
  // Create 16-byte buffer for u128
  const buffer = Buffer.alloc(16);
  
  // Convert to bytes - little-endian (LSB first)
  for (let i = 0; i < 16; i++) {
    buffer[i] = Number((value >> BigInt(i * 8)) & BigInt(0xFF));
  }
  
  console.log("SERIALIZE DEBUG: Bytes (hex):", buffer.toString('hex'));
  console.log("SERIALIZE DEBUG: Bytes (array):", [...buffer].map(b => "0x" + b.toString(16).padStart(2, '0')));
  
  return buffer;
}

/**
 * Converts a floating-point amount to token units with precise handling
 * @param amount The amount as a floating-point number
 * @param decimals The number of decimal places for the token
 * @returns BigInt representation of the token amount
 */
function floatToTokenUnits(amount: number, decimals: number): bigint {
  if (isNaN(amount) || amount < 0) {
    throw new Error("Amount must be a non-negative number");
  }
  
  // Convert to string with fixed precision to avoid floating point errors
  const amountStr = amount.toFixed(decimals);
  
  // Remove decimal point and convert to BigInt
  const parts = amountStr.split('.');
  const wholePart = parts[0];
  const fractionalPart = parts.length > 1 ? parts[1] : '';
  
  // Pad fractional part with zeros if needed
  const paddedFractionalPart = fractionalPart.padEnd(decimals, '0');
  
  // Combine and convert to BigInt
  const result = BigInt(wholePart + paddedFractionalPart);
  
  console.log("AMOUNT DEBUG: Using token decimals:", decimals);
  console.log("AMOUNT DEBUG: Amount entered:", amount);
  console.log("AMOUNT DEBUG: Precise string conversion:", amountStr, "->", wholePart + paddedFractionalPart);
  console.log("AMOUNT DEBUG: Token amount (" + decimals + " decimals):", result.toString());
  
  return result;
}

/**
 * Creates the RPC buffer for the approve action
 * @param spenderAddress The address to approve (campaign contract)
 * @param amount The token amount to approve as BigInt
 * @returns Buffer containing the correctly serialized RPC call
 */
function createApproveRpc(spenderAddress: string, amount: bigint): Buffer {
  console.log("APPROVAL DEBUG: Approving exact amount:", amount.toString());
  console.log("APPROVAL DEBUG: For campaign contract:", spenderAddress);
  
  return AbiByteOutput.serializeBigEndian((_out) => {
    // Write the action shortname for approve (0x05)
    _out.writeU8(0x05);
    
    // Write the spender address (campaign address)
    // Note: Address is expected to be a hex string without 0x prefix
    if (spenderAddress.startsWith('0x')) {
      spenderAddress = spenderAddress.substring(2);
    }
    _out.writeBytes(Buffer.from(spenderAddress, 'hex'));
    
    // Serialize the u128 amount correctly using our helper
    const amountBuffer = serializeU128ForPartisiaContract(amount);
    
    console.log("APPROVAL DEBUG: Serialized amount (hex):", [...amountBuffer].map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Logging for debugging - we'll just log the components separately
    console.log("APPROVAL DEBUG: Action shortname: 0x05");
    console.log("APPROVAL DEBUG: Spender address:", spenderAddress);
    console.log("APPROVAL DEBUG: Serialized amount:", amountBuffer.toString('hex'));
    
    _out.writeBytes(amountBuffer);
  });
}

/**
 * Creates the RPC buffer for the contribute_tokens action
 * @param amount The token amount to contribute as BigInt
 * @returns Buffer containing the correctly serialized RPC call
 */
function createContributeTokensRpc(amount: bigint): Buffer {
  console.log("CONTRIBUTE DEBUG: Creating RPC for amount:", amount.toString());
  console.log("CONTRIBUTE DEBUG: Hex representation:", "0x" + amount.toString(16));
  
  return AbiByteOutput.serializeBigEndian((_out) => {
    // Use format indicator + shortname format for action calls
    _out.writeU8(0x09); // Format indicator for actions
    _out.writeBytes(Buffer.from([0x07])); // Action shortname as bytes
    
    // Serialize the u128 amount correctly
    const amountBuffer = serializeU128ForPartisiaContract(amount);
    
    // Logging for debugging
    console.log("CONTRIBUTE DEBUG: Using format: 0x09 + shortname (0x07)");
    console.log("CONTRIBUTE DEBUG: Serialized amount:", amountBuffer.toString('hex'));
    
    _out.writeBytes(amountBuffer);
  });
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
  private readonly CONTRIBUTION_GAS = 200000;
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
    
    console.log("AMOUNT DEBUG: ZK amount:", scaledAmount);
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
      // Since direct token allowance checking is not available,
      // we'll simulate it by querying the user's balance
      
      // Get the user's balance
      const userAddress = this.sender;
      const accountData = await this.baseClient.getAccountData(userAddress);
      
      // Simulate a balance check
      const userBalance = BigInt(accountData?.nonce || 0) + BigInt("9990000000000000");
      console.log("BALANCE DEBUG: User balance:", userBalance.toString());
      console.log("BALANCE DEBUG: Contribution amount:", requiredAmount.toString());
      console.log("BALANCE DEBUG: Has sufficient funds:", userBalance >= requiredAmount);
      
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
      // Create the RPC for token approval using our helper
      const rpc = createApproveRpc(campaignAddress, amount);

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
    
    // Convert to token units with precise handling
    const tokenAmount = floatToTokenUnits(amount, this.TOKEN_DECIMALS);
    
    // Convert the ZK amount using the same consistent method
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
      approvalResult = await this.approveTokens(
        tokenAddress,
        campaignAddress,
        tokenAmount
      );
      
      // Wait for approval to be confirmed on chain
      console.log("Waiting for approval to be processed...");
      
      // Get the approval transaction ID for logging/tracking
      const approvalTxId = approvalResult.transaction?.transactionPointer?.identifier || "unknown";
      console.log(`Approval transaction ID: ${approvalTxId}`);
      
      // Wait longer for approval to be fully confirmed on-chain 
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
      
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
      
      // Make the contribution directly
      console.log("Executing contribution after approval...");
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
      console.log("Allowance already sufficient, making direct contribution");
      
      // Execute the contribution using the calculated values
      const contributionResult = await this.executeContribution(
        campaignAddress, 
        zkAmount, 
        tokenAmount
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
    console.log(`EXECUTE DEBUG: ZK amount: ${zkAmount}, Token amount: ${tokenAmount.toString()}`);
    
    // Phase 1: Submit ZK input
    const secretInput = AbiBitOutput.serialize((_out) => {
      _out.writeI32(zkAmount); // Write the ZK amount as i32
    });
    
    // Create public RPC for add_contribution (shortname 0x40)
    const publicRpc = Buffer.from([0x40]);
    
    // Build the ZK input transaction
    const transaction = await this.zkClient.buildOnChainInputTransaction(
      this.sender,
      secretInput,
      publicRpc
    );
    
    // Send the ZK input transaction with increased gas
    const zkTx = await this.transactionClient!.signAndSend(
      transaction, 
      200000 // Increased gas for ZK operations
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
    
    // Wait for the ZK transaction to be processed by the network
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Phase 2: Send the token contribution transaction
    // Create the RPC for contribute_tokens using our helper function
    const contributeTokensRpc = createContributeTokensRpc(tokenAmount);
    
    // Send the token transfer transaction with increased gas
    const tokenTx = await this.transactionClient!.signAndSend({
      address: campaignAddress,
      rpc: contributeTokensRpc
    }, 200000); // Increased gas for token operations
    
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
}};