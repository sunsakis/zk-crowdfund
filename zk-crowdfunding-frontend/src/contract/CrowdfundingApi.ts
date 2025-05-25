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
 * Convert a human-readable amount to raw token units
 * Frontend: 0.000001 (displayed) -> 1 (raw token unit) -> 1e18 wei (for transfers)
 * @param displayAmount The display amount (e.g., 0.000001)
 * @returns Raw token units (e.g., 1)
 */
function displayAmountToTokenUnits(displayAmount: number): number {
  if (isNaN(displayAmount) || displayAmount < 0) {
    throw new Error("Amount must be a non-negative number");
  }
  
  // Convert display amount to raw token units
  // Display: 0.000001 -> Raw: 1
  // Display: 1.0 -> Raw: 1,000,000
  const tokenUnits = Math.round(displayAmount * 1_000_000);
  
  return tokenUnits;
}

/**
 * Convert raw token units to wei for blockchain transfers
 * @param tokenUnits Raw token units
 * @returns Wei amount as BigInt
 */
function tokenUnitsToWei(tokenUnits: number): bigint {
  const wei = BigInt(tokenUnits) * BigInt("1000000000000");
  return wei;
}

/**
 * Convert raw token units to display amount
 * @param tokenUnits Raw token units
 * @returns Display amount
 */
function tokenUnitsToDisplayAmount(tokenUnits: number): number {
  return tokenUnits / 1_000_000;
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
  private readonly sender: string;
  private readonly baseClient: ShardedClient;
  
  // Constants for gas limits with some buffer
  private readonly TOKEN_APPROVAL_GAS = 15000;
  private readonly END_CAMPAIGN_GAS = 150000;
  private readonly WITHDRAW_FUNDS_GAS = 30000;
  
  // Constants for amount limits (in raw token units)
  private readonly MAX_TOKEN_UNITS = 2147483647; // Max u32 value
  private readonly MIN_TOKEN_UNITS = 1; // Minimum 1 token unit
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
   * Validates that inputs meet computation requirements
   * @param displayAmount The display amount to validate (e.g., 0.000001)
   * @throws Error if amount is invalid
   */
  readonly validateAmount = (displayAmount: number): void => {
    if (isNaN(displayAmount) || displayAmount <= 0) {
      throw new CrowdfundingApiError(
        "Contribution amount must be a positive number",
        "INVALID_AMOUNT"
      );
    }
    
    const tokenUnits = displayAmountToTokenUnits(displayAmount);
    
    if (tokenUnits < this.MIN_TOKEN_UNITS) {
      throw new CrowdfundingApiError(
        `Contribution amount too small. Minimum is ${tokenUnitsToDisplayAmount(this.MIN_TOKEN_UNITS)}`,
        "AMOUNT_TOO_SMALL"
      );
    }
    
    if (tokenUnits > this.MAX_TOKEN_UNITS) {
      throw new CrowdfundingApiError(
        `Contribution amount too large. Maximum is ${tokenUnitsToDisplayAmount(this.MAX_TOKEN_UNITS)}`,
        "AMOUNT_TOO_LARGE"
      );
    }
  };

  /**
   * Check token allowance for the campaign contract
   * Due to API limitations, this is a simulated check
   * @param tokenAddress Token contract address
   * @param campaignAddress Campaign contract address
   * @param requiredAmount Amount needed for the transaction (in wei)
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
   * @param amount Amount to approve (in wei)
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
        
        // Serialize the u128 amount (wei)
        const bnAmount = new BN(amount.toString());
        _out.writeUnsignedBigInteger(bnAmount, 16); // 16 bytes for u128
      });
      
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
   * @param displayAmount The contribution amount (e.g., 0.000001)
   * @param campaignAddress Campaign contract address
   * @param tokenAddress Token contract address
   * @returns Transaction result
   */
  readonly addContribution = async (
    displayAmount: number,
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
      // Validate amount
      this.validateAmount(displayAmount);
      
      // Convert display amount to internal representations
      const tokenUnits = displayAmountToTokenUnits(displayAmount);
      const weiAmount = tokenUnitsToWei(tokenUnits);
      
      console.log(`Converting amounts: Display=${displayAmount} -> TokenUnits=${tokenUnits} -> Wei=${weiAmount.toString()}`);
      
      // Check token allowance first
      const allowance = await this.getTokenAllowance(
        tokenAddress,
        campaignAddress,
        weiAmount
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
      return await this.executeContribution(campaignAddress, tokenUnits, weiAmount);
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
   * Enhanced contribution flow with proper ZK transaction verification and contract-level error detection
   */
  readonly addContributionWithApproval = async (
    displayAmount: number,
    campaignAddress: string, 
    tokenAddress: string
  ): Promise<{
    approvalResult?: TransactionResult,
    contributionResult: TransactionResult
  }> => {
    
    console.log(`=== CONTRIBUTION FLOW DEBUG ===`);
    console.log(`Display amount: ${displayAmount}`);
    console.log(`Campaign address: ${campaignAddress}`);
    console.log(`Token address: ${tokenAddress}`);
    console.log(`Wallet address: ${this.getWalletAddress()}`);
    
    if (!this.isWalletConnected()) {
      throw new CrowdfundingApiError(
        "Wallet not connected", 
        "WALLET_NOT_CONNECTED"
      );
    }
    
    try {
      // Step 1: Calculate amounts
      this.validateAmount(displayAmount);
      const tokenUnits = displayAmountToTokenUnits(displayAmount);
      const weiAmount = tokenUnitsToWei(tokenUnits);
      
      console.log(`Converted amounts: ${displayAmount} -> ${tokenUnits} token units -> ${weiAmount} wei`);
      
      // Step 2: Handle token approval if needed
      console.log(`\n=== TOKEN APPROVAL PHASE ===`);
      const allowance = await this.getTokenAllowance(tokenAddress, campaignAddress, weiAmount);
      
      let approvalResult: TransactionResult | undefined;
      if (!allowance.sufficientAllowance) {
        console.log(`Approving ${weiAmount} wei tokens...`);
        approvalResult = await this.approveTokens(tokenAddress, campaignAddress, weiAmount);
        const approvalTxId = approvalResult.transaction.transactionPointer?.identifier || "unknown";
        
        console.log(`Approval transaction sent: ${approvalTxId}`);
        
        // Wait for approval with timeout
        const approvalConfirmed = await this.waitForTransactionConfirmation(
          approvalTxId, undefined, 60, "Token approval"
        );
        
        if (!approvalConfirmed) {
          throw new CrowdfundingApiError("Token approval timeout", "APPROVAL_TIMEOUT");
        }
        
        console.log(`✅ Token approval confirmed`);
      } else {
        console.log(`✅ Token allowance already sufficient`);
      }
      
      // Step 3: Submit ZK input transaction
      console.log(`\n=== ZK INPUT PHASE ===`);
      
      const secretInput = AbiBitOutput.serialize((_out) => {
        _out.writeU32(tokenUnits);
      });
      
      const publicRpc = Buffer.from([0x40]);
      
      console.log(`Building ZK transaction with ${tokenUnits} token units...`);
      
      const zkTransaction = await this.zkClient.buildOnChainInputTransaction(
        this.sender,
        secretInput,
        publicRpc
      );
      
      console.log(`Sending ZK transaction...`);
      const zkTx = await this.transactionClient!.signAndSend(zkTransaction, 200000);
      
      const zkTxId = zkTx.transactionPointer?.identifier || "unknown";
      const zkShardId = zkTx.transactionPointer?.destinationShardId || "unknown";
      
      console.log(`ZK transaction sent: ${zkTxId} (shard: ${zkShardId})`);
      
      // Step 4: Wait for ZK transaction confirmation with extended timeout
      console.log(`\n=== WAITING FOR ZK CONFIRMATION ===`);
      const zkConfirmed = await this.waitForTransactionConfirmation(
        zkTxId, zkShardId, 120, "ZK contribution"
      );
      
      if (!zkConfirmed) {
        throw new CrowdfundingApiError(
          `ZK transaction failed - transaction ${zkTxId} not confirmed`,
          "ZK_FAILED"
        );
      }
      
      console.log(`✅ ZK transaction confirmed`);
      
      // Step 5: Wait additional time for ZK state propagation
      console.log(`\n=== WAITING FOR ZK STATE PROPAGATION ===`);
      console.log(`Waiting 30 seconds for ZK state to propagate across all nodes...`);
      await new Promise(resolve => setTimeout(resolve, 30000)); // Increased to 30 seconds
      
      // Step 6: Submit token transfer transaction
      console.log(`\n=== TOKEN TRANSFER PHASE ===`);
      
      const contributeTokensRpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09);
        _out.writeBytes(Buffer.from([0x07]));
        _out.writeU32(tokenUnits);
      });
      
      console.log(`Sending token transfer transaction with ${tokenUnits} token units...`);
      
      const tokenTx = await this.transactionClient!.signAndSend({
        address: campaignAddress,
        rpc: contributeTokensRpc
      }, 200000);
      
      const tokenTxId = tokenTx.transactionPointer?.identifier || "unknown";
      const tokenShardId = tokenTx.transactionPointer?.destinationShardId || "unknown";
      
      console.log(`Token transaction sent: ${tokenTxId} (shard: ${tokenShardId})`);
      
      // Step 7: Wait for token transaction confirmation - THIS IS CRITICAL
      console.log(`\n=== WAITING FOR TOKEN CONFIRMATION ===`);
      const tokenConfirmed = await this.waitForTransactionConfirmation(
        tokenTxId, tokenShardId, 60, "Token transfer"
      );
      
      // Step 8: Determine overall success based on BOTH transactions
      let overallSuccess = false;
      let finalStatus: 'success' | 'failed' | 'pending' = 'pending';
      
      if (zkConfirmed && tokenConfirmed) {
        console.log(`✅ Both transactions confirmed - contribution successful`);
        overallSuccess = true;
        finalStatus = 'success';
      } else if (zkConfirmed && !tokenConfirmed) {
        console.log(`❌ ZK confirmed but token transfer failed - contribution failed`);
        overallSuccess = false;
        finalStatus = 'failed';
      } else {
        console.log(`❌ ZK transaction failed - contribution failed`);
        overallSuccess = false;
        finalStatus = 'failed';
      }
      
      console.log(`\n=== CONTRIBUTION RESULT: ${finalStatus.toUpperCase()} ===`);
      
      const contributionResult: TransactionResult = {
        transaction: zkTx, // Keep ZK transaction as primary for UI display
        status: finalStatus,
        metadata: {
          zkTransaction: { id: zkTxId, shard: zkShardId, confirmed: zkConfirmed },
          tokenTransaction: { id: tokenTxId, shard: tokenShardId, confirmed: tokenConfirmed },
          tokenUnits,
          weiAmount: weiAmount.toString(),
          displayAmount,
          overallSuccess,
          // Add specific error context for failed token transfers
          ...(zkConfirmed && !tokenConfirmed && {
            failureReason: "Token transfer failed after successful ZK input",
            failedTransaction: tokenTxId
          })
        }
      };
      
      return {
        approvalResult,
        contributionResult
      };
      
    } catch (error) {
      console.error(`\n=== CONTRIBUTION FAILED ===`);
      console.error("Error details:", error);
      
      if (error instanceof CrowdfundingApiError) {
        throw error;
      }
      
      throw new CrowdfundingApiError(
        `Contribution failed: ${error.message}`,
        "CONTRIBUTION_FLOW_FAILED"
      );
    }
  };

  /**
   * Execute the contribution in two coordinated transactions
   * @param campaignAddress Campaign contract address
   * @param tokenUnits Amount in raw token units
   * @param weiAmount Amount in wei for transfers
   * @returns Combined transaction result
   */
  readonly executeContribution = async (
    campaignAddress: string,
    tokenUnits: number,
    weiAmount: bigint
  ): Promise<TransactionResult> => {
    try {
      console.log(`EXECUTE DEBUG: TokenUnits: ${tokenUnits}, Wei amount: ${weiAmount.toString()}`);
      
      // PHASE 1: Submit ZK input (using raw token units)
      const secretInput = AbiBitOutput.serialize((_out) => {
        _out.writeU32(tokenUnits); // Raw token units for ZK computation
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
        tokenUnits: tokenUnits
      });
      
      // Wait for ZK transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 8000));
      
      // PHASE 2: Send token contribution transaction (using raw token units)
      const contributeTokensRpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09); // Format indicator for actions
        _out.writeBytes(Buffer.from([0x07])); // contribute_tokens shortname
        _out.writeU32(tokenUnits); // Raw token units (contract converts to wei internally)
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
        tokenUnits: tokenUnits
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
          tokenUnits: tokenUnits,
          weiAmount: weiAmount.toString()
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
   * Enhanced wait method that properly reports transaction failures
   */
  private async waitForTransactionConfirmation(
    txId: string,
    shardId: string | undefined,
    timeoutSeconds: number,
    transactionType: string
  ): Promise<boolean> {
    
    const maxAttempts = Math.floor(timeoutSeconds / 3);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const status = await this.checkTransactionStatus(txId, shardId);
        
        if (status.status === 'success') {
          console.log(`✅ ${transactionType} confirmed after ${attempt * 3}s`);
          return true;
        } else if (status.status === 'failed') {
          console.log(`❌ ${transactionType} failed: ${status.errorMessage}`);
          // Don't throw here - let the caller handle the failure
          return false;
        }
        
        if (attempt % 5 === 0) {
          console.log(`⏳ ${transactionType} still pending... (${attempt * 3}s / ${timeoutSeconds}s)`);
        }
        
      } catch (error) {
        console.log(`⚠️ Error checking ${transactionType} status:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log(`❌ ${transactionType} timeout after ${timeoutSeconds}s`);
    return false;
  }

  /**
   * Check if an event contains contract-level error information
   * This is the key method that detects contract failures
   */
  private async checkEventForContractError(event: any): Promise<string | null> {
    try {
      if (!event.identifier) {
        return null;
      }
      
      console.log("Checking event for contract errors:", event.identifier);
      
      // Try to fetch the event details
      const eventShards = ["Shard0", "Shard1", "Shard2"];
      
      for (const shard of eventShards) {
        try {
          const eventUrl = `${this.API_URL}/chain/shards/${shard}/transactions/${event.identifier}`;
          const response = await fetch(eventUrl);
          
          if (response.ok) {
            const eventData = await response.json();
            
            // Check if this event indicates a contract failure
            if (eventData.executionStatus?.success === false) {
              return "Contract execution failed";
            }
            
            // Check event content for error messages
            if (eventData.content) {
              try {
                const decoded = atob(eventData.content);
                
                // Look for common error patterns
                if (decoded.includes('Trap: Early exit') || 
                    decoded.includes('assertion') || 
                    decoded.includes('failed:')) {
                  
                  // Try to extract the actual error message
                  const lines = decoded.split('\n');
                  for (const line of lines) {
                    if (line.includes('assertion') && line.includes('failed:')) {
                      // Extract the assertion failure message
                      const match = line.match(/assertion.*failed:\s*(.+)/);
                      if (match) {
                        return match[1].trim();
                      }
                    }
                    if (line.includes('Trap: Early exit') && line.includes(':')) {
                      // Extract early exit message
                      const parts = line.split(':');
                      if (parts.length >= 4) {
                        return parts.slice(3).join(':').trim();
                      }
                    }
                  }
                  
                  // If we can't parse the specific message, return a general error
                  return "Contract assertion failed";
                }
              } catch (decodeError) {
                console.log("Could not decode event content");
              }
            }
            
            break; // Found the event, stop searching other shards
          }
        } catch (fetchError) {
          // Continue to next shard
          continue;
        }
      }
      
      return null; // No error found
    } catch (error) {
      console.error("Error checking event for contract error:", error);
      return null;
    }
  }

  /**
   * Parse transaction result from API response with enhanced contract-level error detection
   * @param transaction Raw transaction data from API
   * @returns Parsed transaction status
   */
  private async parseTransactionResult(transaction: any): Promise<{
    status: 'pending' | 'success' | 'failed',
    finalizedBlock?: string,
    errorMessage?: string
  }> {
    try {
      // Check if we have executionStatus
      if (!transaction.executionStatus) {
        return { status: 'pending' };
      }
      
      const execStatus = transaction.executionStatus;
      
      // Check if finalized
      if (!execStatus.finalized) {
        return { status: 'pending' };
      }
      
      // Even if blockchain-level success is true, we need to check for contract failures
      if (execStatus.success === true) {
        
        // Check if there are events that might contain error information
        if (execStatus.events && execStatus.events.length > 0) {
          console.log("Checking events for contract-level errors...");
          
          // Check each event for contract failures
          for (const event of execStatus.events) {
            try {
              const contractError = await this.checkEventForContractError(event);
              if (contractError) {
                console.log("❌ Contract-level failure detected in event:", contractError);
                return {
                  status: 'failed',
                  errorMessage: contractError
                };
              }
            } catch (error) {
              console.log("Could not check event for errors:", error);
              // Don't fail the whole check if we can't read one event
            }
          }
        }
        
        // If no contract errors found in events, it's truly successful
        console.log("✅ Both blockchain and contract execution successful");
        return { 
          status: 'success',
          finalizedBlock: execStatus.blockId
        };
        
      } else if (execStatus.success === false) {
        // Blockchain-level failure
        console.log("❌ Blockchain-level failure");
        
        let errorMessage = 'Transaction execution failed';
        if (execStatus.failure && execStatus.failure.errorMessage) {
          errorMessage = execStatus.failure.errorMessage;
        }
        
        return { 
          status: 'failed',
          errorMessage: errorMessage
        };
      } else {
        // success field is null/undefined - still processing
        return { status: 'pending' };
      }
    } catch (error) {
      console.error("Error parsing transaction result:", error);
      return { 
        status: 'failed',
        errorMessage: `Error parsing transaction result: ${error.message}`
      };
    }
  }
  
  /**
   * Enhanced checkTransactionStatus that properly detects contract failures
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
            return await this.parseTransactionResult(transaction);
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
        
        return await this.parseTransactionResult(transaction);
      }
    } catch (error) {
      console.error("Error checking transaction status:", error);
      return { status: 'pending' };
    }
  };

  /**
   * Helper function to safely extract contract state with proper type checking
   * @param contractData Raw contract data from API response
   * @returns Buffer containing state data or throws with detailed error
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
      
      // Convert raw token units to display amounts for the API response
      return {
        owner: state.owner.asString(),
        title: state.title,
        description: state.description,
        tokenAddress: (state.token_address || state.tokenAddress)?.asString(),
        fundingTarget: typeof state.fundingTarget === 'number' ? 
          tokenUnitsToDisplayAmount(state.fundingTarget) : 
          tokenUnitsToDisplayAmount(Number(state.fundingTarget)),
        status: state.status,
        totalRaised: state.totalRaised ? 
          tokenUnitsToDisplayAmount(typeof state.totalRaised === 'number' ? 
            state.totalRaised : 
            Number(state.totalRaised)) : 
          undefined,
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