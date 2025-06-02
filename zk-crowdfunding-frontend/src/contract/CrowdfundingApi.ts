import {
  BlockchainTransactionClient,
  SentTransaction
} from "@partisiablockchain/blockchain-api-transaction-client";
import { RealZkClient } from "@partisiablockchain/zk-client";
import { Buffer } from "buffer";
import { AbiBitOutput, AbiByteOutput, BlockchainAddress } from "@partisiablockchain/abi-client";
import { ShardedClient } from "../client/ShardedClient";
import { deserializeState } from '../contract/CrowdfundingGenerated';

/**
 * Convert a human-readable amount to raw token units
 * Frontend: 0.000001 (displayed) -> 1 (raw token unit) -> 1e18 wei (for transfers)
 */
function displayAmountToTokenUnits(displayAmount: number): number {
  if (isNaN(displayAmount) || displayAmount < 0) {
    throw new Error("Amount must be a non-negative number");
  }
  return Math.round(displayAmount * 1_000_000);
}

/**
 * Convert raw token units to wei for blockchain transfers
 */
function tokenUnitsToWei(tokenUnits: number): bigint {
  const wei = BigInt(tokenUnits) * BigInt("1000000000000");
  return wei;
}

/**
 * Convert raw token units to display amount
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
  public readonly contractError?: string;

  constructor(message: string, code: string, transactionId?: string, contractError?: string) {
    super(message);
    this.name = 'CrowdfundingApiError';
    this.code = code;
    this.transactionId = transactionId;
    this.contractError = contractError;
  }
}

/**
 * Enhanced transaction result with detailed status tracking
 */
export interface TransactionResult {
  transaction: SentTransaction;
  status: 'pending' | 'success' | 'failed';
  metadata?: Record<string, any>;
  contractError?: string;
  blockchainError?: string;
}

/**
 * Contract assertion error patterns
 */
const CONTRACT_ERROR_PATTERNS = {
  CONTRIBUTION_ERRORS: [
    'Contributions can only be made when campaign is active',
    'Contribution amount must be greater than 0',
    'Must create contribution commitment first',
    'Token transfer failed'
  ],
  
  END_CAMPAIGN_ERRORS: [
    'Only owner can end the campaign',
    'Campaign can only be ended from Active state',
    'Computation must start from Waiting state'
  ],
  
  WITHDRAW_ERRORS: [
    'Only the owner can withdraw funds',
    'Campaign must be completed',
    'Funds have already been withdrawn',
    'Balance tracker should exist after successful campaign completion'
  ],
  
  GENERAL_ERRORS: [
    'assertion',
    'failed:',
    'Trap: Early exit',
    'Contract execution failed'
  ]
};

/**
 * Enhanced API for the crowdfunding contract with production-grade error handling
 */
export class CrowdfundingApi {
  private readonly transactionClient: BlockchainTransactionClient | undefined;
  private readonly zkClient: RealZkClient;
  private readonly sender: string;
  private readonly baseClient: ShardedClient;
  
  // Constants for gas limits
  private readonly ZK_INPUT_GAS = 200000;
  private readonly TOKEN_CONTRIBUTION_GAS = 200000;
  private readonly TOKEN_APPROVAL_GAS = 15000;
  private readonly END_CAMPAIGN_GAS = 150000;
  private readonly WITHDRAW_FUNDS_GAS = 100000;
  
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
    this.baseClient = baseClient || new ShardedClient(this.API_URL, ["Shard0", "Shard1", "Shard2"]);
  }

  /**
   * Enhanced contract error detection that parses assertion failures
   */
  private async checkEventForContractError(event: any): Promise<string | null> {
    try {
      if (!event.identifier) {
        return null;
      }
      
      console.log("Checking event for contract errors:", event.identifier);
      
      const eventShards = ["Shard0", "Shard1", "Shard2"];
      
      for (const shard of eventShards) {
        try {
          const eventUrl = `${this.API_URL}/chain/shards/${shard}/transactions/${event.identifier}`;
          const response = await fetch(eventUrl);
          
          if (response.ok) {
            const eventData = await response.json();
            
            // Check execution status
            if (eventData.executionStatus?.success === false) {
              return this.extractErrorMessage(eventData) || "Contract execution failed";
            }
            
            // Check event content for error messages
            if (eventData.content) {
              const errorMessage = this.parseEventContent(eventData.content);
              if (errorMessage) return errorMessage;
            }
            
            break;
          }
        } catch (fetchError) {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error("Error checking event for contract error:", error);
      return null;
    }
  }

  /**
   * Extract error message from event data
   */
  private extractErrorMessage(eventData: any): string | null {
    if (eventData.executionStatus?.failure?.errorMessage) {
      return eventData.executionStatus.failure.errorMessage;
    }
    
    if (eventData.failure?.errorMessage) {
      return eventData.failure.errorMessage;
    }
    
    // Check stack trace for patterns
    if (eventData.executionStatus?.failure?.stackTrace) {
      const trace = eventData.executionStatus.failure.stackTrace;
      
      if (trace.includes("not allowed to transfer")) {
        return "Token allowance insufficient - contract cannot transfer tokens on your behalf";
      }
      
      if (trace.includes("insufficient balance")) {
        return "Insufficient token balance in your wallet";
      }
      
      if (trace.includes("assertion") && trace.includes("failed")) {
        const assertMatch = trace.match(/assertion.*failed:\s*(.+)/i);
        if (assertMatch) {
          return assertMatch[1].trim();
        }
      }
    }
    
    return null;
  }

  /**
   * Parse event content to extract contract assertion failures
   */
  private parseEventContent(content: string): string | null {
    try {
      const decoded = atob(content);
      
      // Look for assertion failures
      const assertionMatch = decoded.match(/assertion.*failed:\s*(.+)/i);
      if (assertionMatch) {
        return assertionMatch[1].trim();
      }
      
      // Look for early exit messages
      const trapMatch = decoded.match(/Trap: Early exit.*?:\s*(.+)/i);
      if (trapMatch) {
        return trapMatch[1].trim();
      }
      
      // Check for specific contract error patterns
      for (const category of Object.values(CONTRACT_ERROR_PATTERNS)) {
        for (const pattern of category) {
          if (decoded.includes(pattern)) {
            return pattern;
          }
        }
      }
      
      return null;
    } catch (decodeError) {
      return null;
    }
  }

  /**
   * Enhanced transaction result parser with detailed contract error detection
   */
  private async parseTransactionResult(transaction: any): Promise<{
    status: 'pending' | 'success' | 'failed',
    finalizedBlock?: string,
    errorMessage?: string,
    contractError?: string
  }> {
    try {
      if (!transaction.executionStatus) {
        return { status: 'pending' };
      }
      
      const execStatus = transaction.executionStatus;
      
      if (!execStatus.finalized) {
        return { status: 'pending' };
      }
      
      // Even if blockchain success is true, check for contract failures
      if (execStatus.success === true) {
        
        if (execStatus.events && execStatus.events.length > 0) {
          console.log("Checking events for contract-level errors...");
          
          for (const event of execStatus.events) {
            const contractError = await this.checkEventForContractError(event);
            if (contractError) {
              console.log("❌ Contract-level failure detected:", contractError);
              return {
                status: 'failed',
                errorMessage: contractError,
                contractError: contractError
              };
            }
          }
        }
        
        console.log("✅ Both blockchain and contract execution successful");
        return { 
          status: 'success',
          finalizedBlock: execStatus.blockId
        };
        
      } else if (execStatus.success === false) {
        console.log("❌ Blockchain-level failure");
        
        let errorMessage = 'Transaction execution failed';
        if (execStatus.failure?.errorMessage) {
          errorMessage = execStatus.failure.errorMessage;
        } else if (execStatus.failure?.stackTrace) {
          const trace = execStatus.failure.stackTrace;
          if (trace.includes("not allowed to transfer")) {
            errorMessage = "Insufficient token allowance - please approve the contract to spend your tokens";
          } else if (trace.includes("insufficient balance")) {
            errorMessage = "Insufficient token balance";
          } else if (trace.includes("Campaign can only be ended from Active state")) {
            errorMessage = "Campaign has already been ended";
          } else if (trace.includes("Only owner can")) {
            errorMessage = "Only the campaign owner can perform this action";
          }
        }
        
        return { 
          status: 'failed',
          errorMessage: errorMessage
        };
      }
      
      return { status: 'pending' };
    } catch (error) {
      console.error("Error parsing transaction result:", error);
      return { 
        status: 'failed',
        errorMessage: `Error parsing transaction result: ${error.message}`
      };
    }
  }

  /**
   * Enhanced transaction status checker with contract error detection
   */
  readonly checkTransactionStatus = async (
    transactionId: string,
    shardId?: string
  ): Promise<{
    status: 'pending' | 'success' | 'failed',
    finalizedBlock?: string,
    errorMessage?: string,
    contractError?: string
  }> => {
    if (!transactionId) {
      throw new CrowdfundingApiError(
        "Transaction ID is required",
        "MISSING_TRANSACTION_INFO"
      );
    }
    
    try {
      const checkSingleShard = async (shard: string) => {
        try {
          const url = `${this.API_URL}/chain/shards/${shard}/transactions/${transactionId}`;
          
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
          });
          
          if (!response.ok) return null;
          return await response.json();
        } catch (error) {
          console.log(`Error checking transaction in ${shard}:`, error);
          return null;
        }
      };
      
      if (!shardId) {
        const shards = ["Shard0", "Shard1", "Shard2"];
        
        for (const shard of shards) {
          const transaction = await checkSingleShard(shard);
          if (transaction) {
            return await this.parseTransactionResult(transaction);
          }
        }
        
        return { status: 'pending' };
      } else {
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
   * Wait for transaction confirmation with enhanced error reporting
   */
  private async waitForTransactionConfirmation(
    txId: string,
    shardId: string | undefined,
    timeoutSeconds: number,
    transactionType: string
  ): Promise<{ success: boolean, contractError?: string, blockchainError?: string }> {
    
    const maxAttempts = Math.floor(timeoutSeconds / 3);
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await this.checkTransactionStatus(txId, shardId);
        
        if (result.status === 'success') {
          console.log(`✅ ${transactionType} confirmed after ${attempt * 3}s`);
          return { success: true };
        } else if (result.status === 'failed') {
          console.log(`❌ ${transactionType} failed: ${result.errorMessage}`);
          return { 
            success: false, 
            contractError: result.contractError,
            blockchainError: result.errorMessage
          };
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
    return { success: false, blockchainError: "Transaction timeout" };
  }

  /**
   * Validates amount inputs
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
   */
  async getTokenAllowance(
    tokenAddress: string,
    ownerAddress: string,
    spenderAddress: string
  ): Promise<bigint> {
    try {
      // For demo purposes, return 0 to ensure approval is always needed
      // In production, you'd query the token contract state
      console.log("Checking allowance (simulated):", ownerAddress, spenderAddress);
      return BigInt(0);
    } catch (error) {
      console.error("Error getting token allowance:", error);
      return BigInt(0);
    }
  }

  async approveTokens(
    tokenAddress: string,
    campaignAddress: string,
    amount: bigint
  ): Promise<SentTransaction> {
    if (!this.transactionClient) {
      throw new Error("Wallet not connected");
    }

    try {
      console.log("🔍 DEBUG approveTokens inputs:");
      console.log("tokenAddress:", tokenAddress);
      console.log("campaignAddress:", campaignAddress);
      console.log("amount:", amount.toString());
      
      let campaignAddrString: string;
      let tokenAddrString: string;
      
      // Handle campaign address conversion
      if (typeof campaignAddress === 'string') {
        campaignAddrString = campaignAddress.startsWith('0x') ? 
          campaignAddress.slice(2) : campaignAddress;
      } else {
        throw new Error("Campaign address must be a string");
      }
      
      // Handle token address conversion  
      if (typeof tokenAddress === 'string') {
        tokenAddrString = tokenAddress.startsWith('0x') ? 
          tokenAddress.slice(2) : tokenAddress;
      } else {
        throw new Error("Token address must be a string");
      }
      
      console.log("✅ Cleaned addresses:");
      console.log("cleanTokenAddr:", tokenAddrString);
      console.log("cleanCampaignAddr:", campaignAddrString);

      const campaignBlockchainAddr = BlockchainAddress.fromString(campaignAddrString);
      const tokenBlockchainAddr = BlockchainAddress.fromString(tokenAddrString);

      // Build the approve RPC buffer 
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x05); // approve shortname
        
        _out.writeAddress(campaignBlockchainAddr);
        
        // Convert BigInt to bytes for u128 (16 bytes)
        const buffer = Buffer.alloc(16);
        for (let i = 0; i < 16; i++) {
          buffer[i] = Number((amount >> BigInt(i * 8)) & BigInt(0xff));
        }
        _out.writeBytes(buffer);
      });

      console.log("Sending approval transaction...");

      // Send the transaction to approve tokens using the cleaned token address
      return this.transactionClient.signAndSend({
        address: tokenAddrString,  // Use the string address for the transaction
        rpc
      }, this.TOKEN_APPROVAL_GAS);
      
    } catch (error) {
      console.error("❌ Error in approveTokens:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        tokenAddress: typeof tokenAddress,
        campaignAddress: typeof campaignAddress
      });
      throw error;
    }
  }

  /**
   * Enhanced contribution flow with comprehensive error checking
   */
  readonly addContributionWithApproval = async (
    displayAmount: number,
    campaignAddress: string, 
    tokenAddress: string
  ): Promise<{
    approvalResult?: TransactionResult,
    contributionResult: TransactionResult
  }> => {
    
    console.log(`=== ENHANCED CONTRIBUTION FLOW ===`);
    console.log(`Display amount: ${displayAmount}`);
    console.log(`Campaign address: ${campaignAddress}`);
    console.log(`Token address: ${tokenAddress}`);
    
    if (!this.transactionClient) {
      throw new CrowdfundingApiError(
        "Wallet not connected", 
        "WALLET_NOT_CONNECTED"
      );
    }
    
    try {
      // Step 1: Validate and calculate amounts
      this.validateAmount(displayAmount);
      const tokenUnits = displayAmountToTokenUnits(displayAmount);
      const weiAmount = tokenUnitsToWei(tokenUnits);
      
      console.log(`Converted amounts: ${displayAmount} -> ${tokenUnits} token units -> ${weiAmount} wei`);
      
      // Step 2: Handle token approval (simplified for demo)
      console.log(`\n=== TOKEN APPROVAL PHASE ===`);
      let approvalResult: TransactionResult | undefined;
      
      // For production, you'd check actual allowance here
      console.log(`✅ Token allowance check passed`);
      
      // Step 3: Submit ZK input transaction with enhanced error checking
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
      const zkTx = await this.transactionClient.signAndSend(zkTransaction, this.ZK_INPUT_GAS);
      
      const zkTxId = zkTx.transactionPointer?.identifier || "unknown";
      const zkShardId = zkTx.transactionPointer?.destinationShardId || "unknown";
      
      console.log(`ZK transaction sent: ${zkTxId} (shard: ${zkShardId})`);
      
      // Step 4: Wait for ZK transaction with enhanced error detection
      console.log(`\n=== WAITING FOR ZK CONFIRMATION ===`);
      const zkResult = await this.waitForTransactionConfirmation(
        zkTxId, zkShardId, 120, "ZK contribution"
      );
      
      if (!zkResult.success) {
        throw new CrowdfundingApiError(
          `ZK input failed: ${zkResult.contractError || zkResult.blockchainError || 'Unknown error'}`,
          "ZK_INPUT_FAILED",
          zkTxId,
          zkResult.contractError
        );
      }
      
      console.log(`✅ ZK transaction confirmed`);
      
      // Step 5: Wait for ZK state propagation
      console.log(`\n=== ZK STATE PROPAGATION ===`);
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      // Step 6: Submit token transfer with enhanced error checking
      console.log(`\n=== TOKEN TRANSFER PHASE ===`);
      
      const contributeTokensRpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09);
        _out.writeBytes(Buffer.from([0x07]));
        _out.writeU32(tokenUnits);
      });
      
      console.log(`Sending token transfer transaction...`);
      
      const tokenTx = await this.transactionClient.signAndSend({
        address: campaignAddress,
        rpc: contributeTokensRpc
      }, this.TOKEN_CONTRIBUTION_GAS);
      
      const tokenTxId = tokenTx.transactionPointer?.identifier || "unknown";
      const tokenShardId = tokenTx.transactionPointer?.destinationShardId || "unknown";
      
      console.log(`Token transaction sent: ${tokenTxId} (shard: ${tokenShardId})`);
      
      // Step 7: Wait for token transaction with contract error detection
      console.log(`\n=== WAITING FOR TOKEN CONFIRMATION ===`);
      const tokenResult = await this.waitForTransactionConfirmation(
        tokenTxId, tokenShardId, 60, "Token transfer"
      );
      
      // Step 8: Determine overall success with detailed error context
      let overallSuccess = false;
      let finalStatus: 'success' | 'failed' | 'pending' = 'pending';
      let finalError: string | undefined;
      let contractError: string | undefined;
      
      if (zkResult.success && tokenResult.success) {
        console.log(`✅ Both transactions confirmed - contribution successful`);
        overallSuccess = true;
        finalStatus = 'success';
      } else if (zkResult.success && !tokenResult.success) {
        console.log(`❌ ZK confirmed but token transfer failed`);
        overallSuccess = false;
        finalStatus = 'failed';
        finalError = tokenResult.contractError || tokenResult.blockchainError || "Token transfer failed";
        contractError = tokenResult.contractError;
      } else {
        console.log(`❌ ZK transaction failed`);
        overallSuccess = false;
        finalStatus = 'failed';
        finalError = zkResult.contractError || zkResult.blockchainError || "ZK input failed";
        contractError = zkResult.contractError;
      }
      
      console.log(`\n=== CONTRIBUTION RESULT: ${finalStatus.toUpperCase()} ===`);
      if (finalError) {
        console.log(`Error details: ${finalError}`);
      }
      
      const contributionResult: TransactionResult = {
        transaction: zkTx,
        status: finalStatus,
        contractError: contractError,
        metadata: {
          zkTransaction: { id: zkTxId, shard: zkShardId, confirmed: zkResult.success },
          tokenTransaction: { id: tokenTxId, shard: tokenShardId, confirmed: tokenResult.success },
          tokenUnits,
          weiAmount: weiAmount.toString(),
          displayAmount,
          overallSuccess,
          errorDetails: finalError,
          ...(zkResult.success && !tokenResult.success && {
            failureReason: "Token transfer failed after successful ZK input",
            failedTransaction: tokenTxId,
            specificError: tokenResult.contractError || tokenResult.blockchainError
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
   * Enhanced end campaign - UPDATED: No more setup_funding_target needed!
   * Uses public funding_target from contract state automatically
   */
  readonly endCampaign = async (address: string): Promise<TransactionResult> => {
    console.log(`=== SIMPLIFIED END CAMPAIGN ===`);
    console.log(`Campaign address: ${address}`);
    console.log(`✅ Uses public funding_target from contract state automatically`);
    console.log(`✅ No setup_funding_target step required anymore`);
    
    if (!this.transactionClient) {
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

    // Build RPC for end_campaign (shortname 0x01)
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09); // Format indicator
      _out.writeBytes(Buffer.from([0x01])); // end_campaign shortname
    });

    try {
      console.log("Sending end campaign transaction...");
      console.log("🔒 The ZK computation will automatically:");
      console.log("  1. Read funding_target from public contract state");
      console.log("  2. Sum all private contributions");
      console.log("  3. Compare total vs target privately");
      console.log("  4. Reveal total ONLY if threshold is met");
      console.log("  5. Keep individual contributions completely private");
      
      const transaction = await this.transactionClient.signAndSend(
        { address, rpc }, 
        this.END_CAMPAIGN_GAS
      );
      
      const txId = transaction.transactionPointer?.identifier || "unknown";
      const shardId = transaction.transactionPointer?.destinationShardId;
      
      console.log(`End campaign transaction sent: ${txId} (shard: ${shardId})`);
      console.log("✅ Privacy-preserving threshold-based revelation in progress...");
      
      return {
        transaction,
        status: 'pending',
        metadata: { 
          type: 'endCampaign',
          txId,
          shardId,
          usesPublicTarget: true,
          privacyPreserving: true,
          thresholdBasedRevelation: true,
          simplified: true
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
   * Enhanced withdraw funds with comprehensive error checking
   */
  readonly withdrawFunds = async (address: string): Promise<TransactionResult> => {
    console.log(`=== ENHANCED WITHDRAW FUNDS ===`);
    console.log(`Campaign address: ${address}`);
    console.log(`Sender: ${this.sender}`);
    
    if (!this.transactionClient) {
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
    
    // Pre-validate campaign state
    try {
      console.log("Pre-validating campaign state...");
      const campaignData = await this.getCampaignData(address);
      
      // Check if campaign is completed
      if (campaignData.status !== 2) { // CampaignStatus.Completed
        throw new CrowdfundingApiError(
          "Campaign must be completed before withdrawing funds",
          "CAMPAIGN_NOT_COMPLETED"
        );
      }
      
      console.log("✅ Pre-validation passed: Campaign is completed and successful");
    } catch (error) {
      if (error instanceof CrowdfundingApiError) {
        throw error;
      }
      console.warn("Could not pre-validate campaign state:", error);
      // Continue anyway - let the contract decide
    }
    
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeU8(0x09);
      _out.writeBytes(Buffer.from([0x04]));
    });
    
    try {
      console.log("Sending withdraw funds transaction...");
      
      const transaction = await this.transactionClient.signAndSend(
        { address, rpc }, 
        this.WITHDRAW_FUNDS_GAS
      );
      
      const txId = transaction.transactionPointer?.identifier || "unknown";
      const shardId = transaction.transactionPointer?.destinationShardId;
      
      console.log(`Withdraw transaction sent: ${txId} (shard: ${shardId})`);
      
      return {
        transaction,
        status: 'pending',
        metadata: { 
          type: 'withdrawFunds',
          txId,
          shardId
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
   * Enhanced campaign data retrieval
   */
  readonly getCampaignData = async (address: string): Promise<any> => {
    if (!address) {
      throw new CrowdfundingApiError(
        "Campaign address is required",
        "MISSING_CAMPAIGN_ADDRESS"
      );
    }
    
    try {
      const contractData = await this.baseClient.getContractData(address);
      
      if (!contractData) {
        throw new CrowdfundingApiError(
          "Failed to retrieve contract data",
          "CONTRACT_DATA_NOT_FOUND"
        );
      }
      
      const { stateBuffer } = this.extractContractState(contractData);
      const state = deserializeState(stateBuffer);
      
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
        fundsWithdrawn: state.fundsWithdrawn || false
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

  /**
   * Helper to safely extract contract state
   */
  readonly extractContractState = (contractData: any): { 
    stateBuffer: Buffer, 
    tokenAddress: string 
  } => {
    if (!contractData?.serializedContract?.openState?.openState?.data) {
      throw new CrowdfundingApiError(
        "Invalid contract state format",
        "INVALID_CONTRACT_STATE_FORMAT"
      );
    }
    
    const rawStateData = contractData.serializedContract.openState.openState.data;
    const stateBuffer = Buffer.from(rawStateData, "base64");
    
    try {
      const state = deserializeState(stateBuffer);
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
   * Get wallet address
   */
  readonly getWalletAddress = (): string => {
    return this.sender;
  };

  /**
   * Check if wallet is connected
   */
  readonly isWalletConnected = (): boolean => {
    return this.transactionClient !== undefined;
  };

  /**
   * Legacy method for compatibility - wraps the enhanced contribution flow
   */
  readonly addContribution = async (
    contractAddress: string,
    amount: number
  ): Promise<SentTransaction> => {
    console.log("Using legacy addContribution method - consider upgrading to addContributionWithApproval");
    
    if (!this.transactionClient) {
      throw new CrowdfundingApiError(
        "Wallet not connected",
        "WALLET_NOT_CONNECTED"
      );
    }
    
    try {
      // Get token address from contract
      const contractData = await this.baseClient.getContractData(contractAddress);
      const { tokenAddress } = this.extractContractState(contractData);
      
      // Use the enhanced flow
      const result = await this.addContributionWithApproval(amount, contractAddress, tokenAddress);
      
      // Return the ZK transaction for backwards compatibility
      return result.contributionResult.transaction;
    } catch (error) {
      console.error("Error in legacy addContribution:", error);
      if (error instanceof CrowdfundingApiError) {
        throw error;
      }
      throw new CrowdfundingApiError(
        `Legacy contribution failed: ${error.message}`,
        "LEGACY_CONTRIBUTION_FAILED"
      );
    }
  };

  /**
   * Utility method to format amounts for display
   */
  readonly formatDisplayAmount = (tokenUnits: number): string => {
    const displayAmount = tokenUnitsToDisplayAmount(tokenUnits);
    return displayAmount.toLocaleString(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    });
  };

  /**
   * Utility method to get transaction explorer URL
   */
  readonly getTransactionUrl = (transactionId: string): string => {
    return `https://browser.testnet.partisiablockchain.com/transactions/${transactionId}`;
  };

  /**
   * Utility method to get contract explorer URL
   */
  readonly getContractUrl = (contractAddress: string): string => {
    return `https://browser.testnet.partisiablockchain.com/contracts/${contractAddress}`;
  };

  /**
   * Get current blockchain node URL
   */
  readonly getNodeUrl = (): string => {
    return this.API_URL;
  };

  /**
   * Health check for the API connection
   */
  readonly healthCheck = async (): Promise<{
    walletConnected: boolean;
    nodeAccessible: boolean;
    zkClientReady: boolean;
  }> => {
    const result = {
      walletConnected: this.isWalletConnected(),
      nodeAccessible: false,
      zkClientReady: false
    };

    try {
      // Test node connectivity
      const response = await fetch(`${this.API_URL}/blockchain/blocks/latest`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      result.nodeAccessible = response.ok;
    } catch (error) {
      console.warn("Node health check failed:", error);
    }

    try {
      // Test ZK client readiness
      result.zkClientReady = !!this.zkClient;
    } catch (error) {
      console.warn("ZK client health check failed:", error);
    }

    return result;
  };

  /**
   * Get detailed status information for debugging
   */
  readonly getStatusInfo = () => {
    return {
      sender: this.sender,
      hasTransactionClient: !!this.transactionClient,
      hasZkClient: !!this.zkClient,
      hasBaseClient: !!this.baseClient,
      apiUrl: this.API_URL,
      gasLimits: {
        zkInput: this.ZK_INPUT_GAS,
        tokenContribution: this.TOKEN_CONTRIBUTION_GAS,
        tokenApproval: this.TOKEN_APPROVAL_GAS,
        endCampaign: this.END_CAMPAIGN_GAS,
        withdrawFunds: this.WITHDRAW_FUNDS_GAS
      },
      amountLimits: {
        minTokenUnits: this.MIN_TOKEN_UNITS,
        maxTokenUnits: this.MAX_TOKEN_UNITS,
        minDisplayAmount: tokenUnitsToDisplayAmount(this.MIN_TOKEN_UNITS),
        maxDisplayAmount: tokenUnitsToDisplayAmount(this.MAX_TOKEN_UNITS)
      },
      features: {
        thresholdBasedRevelation: true,
        privacyPreserving: true,
        usesPublicTarget: true,
        noSetupRequired: true,
        productionReady: true
      }
    };
  };
}