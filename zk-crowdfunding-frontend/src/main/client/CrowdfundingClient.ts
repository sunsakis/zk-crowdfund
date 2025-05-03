import { 
  BlockchainAddress, 
  AbiByteInput, 
  AbiByteOutput
} from '@partisiablockchain/abi-client';
import { 
  BlockchainTransactionClient,
  ChainControllerApi,
  Configuration,
  SentTransaction
} from '@partisiablockchain/blockchain-api-transaction-client';
import { RealZkClient, Client, CryptoUtils } from '@partisiablockchain/zk-client';
import { Buffer } from 'buffer';
import { AbiBitOutput } from '@partisiablockchain/abi-client';

// Campaign status enum matching the contract
export enum CampaignStatus {
  Setup = 0,
  Active = 1,
  Computing = 2,
  Completed = 3
}

export interface CampaignData {
  owner: string;
  title: string;
  description: string;
  tokenAddress: string;
  fundingTarget: bigint;
  deadline: number;
  status: CampaignStatus;
  totalRaised?: bigint;
  numContributors?: number;
  isSuccessful: boolean;
}

export interface TokenInfo {
  name: string;
  symbol: string;
  decimals: number;
  balance?: bigint;
  allowance?: bigint;
}

/**
 * Client for interacting with the ZK Crowdfunding contract with token support
 */
export class CrowdfundingClient {
  private readonly testnetUrl = "https://node1.testnet.partisiablockchain.com";
  private chainApi: ChainControllerApi;
  private client: Client;
  private transactionClient?: BlockchainTransactionClient;
  private zkClient?: RealZkClient;
  private walletAddress?: string;
  private keyPair?: any;
  
  constructor() {
    this.chainApi = new ChainControllerApi(
      new Configuration({ basePath: this.testnetUrl })
    );
    this.client = new Client(this.testnetUrl);
  }
  
  /**
   * Connect wallet using private key
   * @param privateKey The private key as a hex string
   * @returns The wallet address
   */
  async connectWallet(privateKey: string): Promise<string> {
    try {
      // Initialize key pair from private key
      this.keyPair = CryptoUtils.privateKeyToKeypair(privateKey);
      
      // Get address from key pair
      this.walletAddress = CryptoUtils.keyPairToAccountAddress(this.keyPair);
      
      // Create blockchain client for transactions
      const auth = {
        getAddress: () => this.walletAddress!,
        sign: async (transactionPayload: Buffer, chainId: string): Promise<string> => {
          // Create a hash of the transaction payload and chain ID
          const combinedBuffer = Buffer.concat([
            transactionPayload,
            Buffer.from(chainId)
          ]);
          
          // Use hash.js for hashing
          const hash = require('hash.js').sha256().update(combinedBuffer).digest();
          
          // Sign the hash
          const signature = this.keyPair!.sign(hash);
          
          // Format the signature with recovery parameter
          const r = signature.r.toArrayLike(Buffer, 'be', 32);
          const s = signature.s.toArrayLike(Buffer, 'be', 32);
          const recovery = Buffer.from([signature.recoveryParam || 0]);
          
          return Buffer.concat([recovery, r, s]).toString('hex');
        }
      };
      
      this.transactionClient = BlockchainTransactionClient.create(this.testnetUrl, auth);
      
      return this.walletAddress;
    } catch (error) {
      console.error("Error connecting wallet:", error);
      throw new Error(`Failed to connect wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Set the campaign contract address and initialize ZK client
   * @param contractAddress The campaign contract address
   * @returns true if successful, false otherwise
   */
  setCampaignAddress(contractAddress: string) {
    if (!contractAddress) return false;
    
    try {
      // Create ZK client for this contract
      this.zkClient = RealZkClient.create(contractAddress, this.client);
      return true;
    } catch (error) {
      console.error("Error setting campaign address:", error);
      return false;
    }
  }
  
  /**
   * Get campaign data from contract
   * @param contractAddress The campaign contract address
   * @returns Campaign data
   */
  async getCampaignData(contractAddress: string): Promise<CampaignData> {
    try {
      // Use the chain API to get contract state
      const response = await this.chainApi.getContractState(contractAddress, true);
      
      if (!response?.data?.serializedContract?.openState?.openState?.data) {
        throw new Error("Contract data not found");
      }
      
      const stateBuffer = Buffer.from(
        response.data.serializedContract.openState.openState.data, 
        'base64'
      );
      
      // Create an input reader for the buffer
      const input = AbiByteInput.createLittleEndian(stateBuffer);
      
      // Read state fields according to the contract structure
      const owner = input.readAddress();
      const title = input.readString();
      const description = input.readString();
      const tokenAddress = input.readAddress();
      const fundingTarget = input.readU128();
      const deadline = input.readU64().toNumber();
      const status = input.readU8();
      
      let totalRaised = undefined;
      if (input.readBoolean()) {
        totalRaised = input.readU128();
      }
      
      let numContributors = undefined;
      if (input.readBoolean()) {
        numContributors = input.readU32();
      }
      
      const isSuccessful = input.readBoolean();
      
      return {
        owner: owner.asString(),
        title,
        description,
        tokenAddress: tokenAddress.asString(),
        fundingTarget,
        deadline,
        status: status as CampaignStatus,
        totalRaised,
        numContributors,
        isSuccessful
      };
    } catch (error) {
      console.error("Error fetching campaign data:", error);
      throw new Error(`Failed to get campaign data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get token information including name, symbol, decimals
   * @param tokenAddress The token contract address
   * @returns Token information
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo> {
    try {
      // Use the chain API to get contract state
      const response = await this.chainApi.getContractState(tokenAddress, true);
      
      if (!response?.data?.serializedContract?.openState?.openState?.data) {
        throw new Error("Token contract data not found");
      }
      
      const stateBuffer = Buffer.from(
        response.data.serializedContract.openState.openState.data, 
        'base64'
      );
      
      // Create an input reader for the buffer
      const input = AbiByteInput.createLittleEndian(stateBuffer);
      
      // Read token fields according to MPC-20 standard
      const name = input.readString();
      const symbol = input.readString();
      const decimals = input.readU8();
      
      // Create token info object
      const tokenInfo: TokenInfo = {
        name,
        symbol,
        decimals
      };
      
      // If wallet is connected, try to get balance and allowance
      if (this.walletAddress) {
        try {
          // Get balance - this requires navigating the contract's state structure
          // which could vary between token implementations
          // This is a simplified version and may need adjustment based on
          // specific token contract implementation
          tokenInfo.balance = await this.getTokenBalance(tokenAddress, this.walletAddress);
        } catch (error) {
          console.warn("Could not get token balance", error);
        }
      }
      
      return tokenInfo;
    } catch (error) {
      console.error("Error fetching token info:", error);
      throw new Error(`Failed to get token info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get token balance for an address
   * @param tokenAddress The token contract address
   * @param walletAddress The wallet address to check
   * @returns The token balance
   */
  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<bigint> {
    try {
      // This would typically call a view function on the token contract
      // Since Partisia may not support direct view functions, we might
      // need to parse the contract state to find the balance
      // This is a placeholder implementation
      
      // In a production environment, you would implement a function to
      // search the token contract's state for the balance of a specific address
      
      // For now, returning a dummy value
      return BigInt(0);
    } catch (error) {
      console.error("Error getting token balance:", error);
      throw error;
    }
  }
  
  /**
   * Get allowance for a spender
   * @param tokenAddress The token contract address
   * @param owner The token owner address
   * @param spender The address allowed to spend tokens
   * @returns The allowance amount
   */
  async getTokenAllowance(
    tokenAddress: string, 
    owner: string, 
    spender: string
  ): Promise<bigint> {
    try {
      // Similar to getTokenBalance, this would need to parse the contract state
      // to find the allowance
      // This is a placeholder implementation
      
      // In a production environment, you would implement a function to
      // search the token contract's state for the allowance
      
      // For now, returning a dummy value
      return BigInt(0);
    } catch (error) {
      console.error("Error getting token allowance:", error);
      throw error;
    }
  }
  
  /**
   * Create a new crowdfunding campaign
   * @param title Campaign title
   * @param description Campaign description
   * @param tokenAddress Address of the token contract
   * @param fundingTarget Target amount of tokens to raise
   * @param deadline Campaign deadline in milliseconds
   * @returns Transaction result
   */
  async createCampaign(
    title: string,
    description: string,
    tokenAddress: string,
    fundingTarget: bigint,
    deadline: number
  ): Promise<SentTransaction> {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    try {
      // Create initialization buffer with campaign parameters
      const initBuffer = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeBytes(Buffer.from("ffffffff0f", "hex")); // Init function prefix
        _out.writeString(title);
        _out.writeString(description);
        _out.writeAddress(BlockchainAddress.fromString(tokenAddress));
        _out.writeU128(fundingTarget);
        _out.writeU64(BigInt(deadline));
      });
      
      // You would need the bytecode of the compiled contract
      // This is a placeholder for the actual deployment process
      throw new Error("Contract deployment not implemented in this client");
      
      // In a real implementation, you would:
      // 1. Get the compiled contract bytecode
      // 2. Send a deploy transaction with the bytecode and initialization buffer
      // 3. Return the transaction result
    } catch (error) {
      console.error("Error creating campaign:", error);
      throw error;
    }
  }
  
  /**
   * Start the campaign (transition from Setup to Active)
   * Only the owner can call this function
   * @param contractAddress The campaign contract address
   * @returns Transaction result
   */
  async startCampaign(contractAddress: string): Promise<SentTransaction> {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    try {
      // Create RPC for start_campaign (shortname 0x01)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09);
        _out.writeBytes(Buffer.from("01", "hex"));
      });
      
      // Send the transaction
      return this.transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 20000); // 20,000 gas
    } catch (error) {
      console.error("Error starting campaign:", error);
      throw error;
    }
  }
  
  /**
   * Approve tokens to be spent by the crowdfunding contract
   * This must be done before contributing
   * @param tokenAddress The token contract address
   * @param campaignAddress The campaign contract address
   * @param amount The amount to approve
   * @returns Transaction result
   */
  async approveTokens(
    tokenAddress: string, 
    campaignAddress: string, 
    amount: bigint
  ): Promise<SentTransaction> {
    if (!this.transactionClient || !this.walletAddress) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // Build the approve RPC buffer (shortname 0x05 for approve)
      let buffer = Buffer.alloc(1 + 21 + 16);
      
      // Add shortname (0x05 for approve)
      buffer[0] = 0x05;
      
      // Add campaign address (21 bytes)
      const campaignAddressObj = BlockchainAddress.fromString(campaignAddress);
      Buffer.from(campaignAddressObj.asBytes()).copy(buffer, 1);
      
      // Add amount as u128 (16 bytes, little-endian)
      const amountBuffer = Buffer.alloc(16);
      let tempBigInt = amount;
      for (let i = 0; i < 16; i++) {
        amountBuffer[i] = Number(tempBigInt & BigInt(0xFF));
        tempBigInt = tempBigInt >> BigInt(8);
      }
      amountBuffer.copy(buffer, 1 + 21);
      
      // Send the transaction to approve tokens
      return this.transactionClient.signAndSend({
        address: tokenAddress,
        rpc: buffer
      }, 10000); // 10,000 gas
    } catch (error) {
      console.error("Error approving tokens:", error);
      throw error;
    }
  }
  
  /**
   * Add contribution as a secret input
   * This also transfers tokens from the contributor to the contract
   * User must have approved tokens first
   * @param contractAddress The campaign contract address
   * @param amount The contribution amount
   * @returns Transaction result
   */
  async addContribution(contractAddress: string, amount: number): Promise<SentTransaction> {
    if (!this.transactionClient || !this.walletAddress) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.zkClient) {
      this.setCampaignAddress(contractAddress);
    }
    
    try {
      // Create secret input with the contribution amount
      const secretInput = AbiBitOutput.serialize((_out) => {
        _out.writeI32(amount);
      });
      
      // Create public RPC for add_contribution (shortname 0x40)
      const publicRpc = Buffer.from([0x40]);
      
      // Build the ZK input transaction
      const transaction = await this.zkClient!.buildOnChainInputTransaction(
        BlockchainAddress.fromString(this.walletAddress),
        secretInput,
        publicRpc
      );
      
      // Send the transaction
      return this.transactionClient.signAndSend(transaction, 100000); // 100,000 gas
    } catch (error) {
      console.error("Error adding contribution:", error);
      throw error;
    }
  }
  
  /**
   * End campaign and compute results
   * Can be called by anyone after the deadline, or by the owner anytime
   * @param contractAddress The campaign contract address
   * @returns Transaction result
   */
  async endCampaign(contractAddress: string): Promise<SentTransaction> {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    try {
      // Create RPC for end_campaign (shortname 0x02)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09);
        _out.writeBytes(Buffer.from("02", "hex"));
      });
      
      // Send the transaction
      return this.transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 100000); // 100,000 gas
    } catch (error) {
      console.error("Error ending campaign:", error);
      throw error;
    }
  }
  
  /**
   * Withdraw funds after successful campaign
   * Only the owner can call this
   * @param contractAddress The campaign contract address
   * @returns Transaction result
   */
  async withdrawFunds(contractAddress: string): Promise<SentTransaction> {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    try {
      // Create RPC for withdraw_funds (shortname 0x03)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09);
        _out.writeBytes(Buffer.from("03", "hex"));
      });
      
      // Send the transaction
      return this.transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 30000); // 30,000 gas
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      throw error;
    }
  }
  
  /**
   * Claim refund if campaign failed
   * Only contributors can claim refunds
   * @param contractAddress The campaign contract address
   * @returns Transaction result
   */
  async claimRefund(contractAddress: string): Promise<SentTransaction> {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    try {
      // Create RPC for claim_refund (shortname 0x04)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09);
        _out.writeBytes(Buffer.from("04", "hex"));
      });
      
      // Send the transaction
      return this.transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 30000); // 30,000 gas
    } catch (error) {
      console.error("Error claiming refund:", error);
      throw error;
    }
  }
  
  /**
   * Verify contributor without revealing contribution amount
   * @param contractAddress The campaign contract address
   * @returns Transaction result
   */
  async verifyContribution(contractAddress: string): Promise<SentTransaction> {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    try {
      // Create RPC for verify_my_contribution (shortname 0x05)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09);
        _out.writeBytes(Buffer.from("05", "hex"));
      });
      
      // Send the transaction
      return this.transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 10000); // 10,000 gas
    } catch (error) {
      console.error("Error verifying contribution:", error);
      throw error;
    }
  }
  
  /**
   * Check if the connected wallet is the campaign owner
   * @param contractAddress The campaign contract address
   * @returns true if owner, false otherwise
   */
  async isOwner(contractAddress: string): Promise<boolean> {
    if (!this.walletAddress) return false;
    
    try {
      const campaign = await this.getCampaignData(contractAddress);
      return campaign.owner.toLowerCase() === this.walletAddress.toLowerCase();
    } catch (error) {
      console.error("Error checking owner:", error);
      return false;
    }
  }
  
  /**
   * Get the current connected wallet address
   * @returns The wallet address or undefined if not connected
   */
  getWalletAddress(): string | undefined {
    return this.walletAddress;
  }
  
  /**
   * Check if a wallet is connected
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return !!this.walletAddress && !!this.transactionClient;
  }
  
  /**
   * Disconnect the wallet
   */
  disconnect(): void {
    this.walletAddress = undefined;
    this.keyPair = undefined;
    this.transactionClient = undefined;
  }
  
  /**
   * Format token amount for display based on decimals
   * @param amount The raw token amount
   * @param decimals The token decimals
   * @returns Formatted amount string
   */
  formatTokenAmount(amount: bigint, decimals: number): string {
    const divisor = BigInt(10) ** BigInt(decimals);
    const integerPart = amount / divisor;
    const fractionalPart = amount % divisor;
    
    // Convert fractional part to string and pad with leading zeros
    let fractionalStr = fractionalPart.toString();
    fractionalStr = fractionalStr.padStart(decimals, '0');
    
    // Trim trailing zeros
    fractionalStr = fractionalStr.replace(/0+$/, '');
    
    if (fractionalStr === '') {
      return integerPart.toString();
    } else {
      return `${integerPart}.${fractionalStr}`;
    }
  }
  
  /**
   * Parse token amount from string based on decimals
   * @param amountStr The amount string
   * @param decimals The token decimals
   * @returns Raw token amount
   */
  parseTokenAmount(amountStr: string, decimals: number): bigint {
    const parts = amountStr.split('.');
    const integerPart = BigInt(parts[0] || '0');
    let fractionalPart = BigInt(0);
    
    if (parts.length > 1 && parts[1]) {
      // Limit to max decimals
      const fractionalStr = parts[1].slice(0, decimals).padEnd(decimals, '0');
      fractionalPart = BigInt(fractionalStr);
    }
    
    const multiplier = BigInt(10) ** BigInt(decimals);
    return (integerPart * multiplier) + fractionalPart;
  }
  
  /**
   * Wait for transaction to be confirmed
   * @param txId The transaction ID
   * @param maxAttempts Maximum number of attempts
   * @returns true if successful, false if failed
   */
  async waitForTransaction(txId: string, maxAttempts = 30): Promise<boolean> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        // Get transaction status
        const response = await this.chainApi.getTransactionStatus(txId);
        
        if (response.data?.finalized) {
          return response.data.executionSucceeded || false;
        }
      } catch (error) {
        console.log(`Waiting for transaction ${txId}...`);
      }
      
      // Wait 2 seconds before trying again
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
    
    throw new Error('Transaction timeout');
  }
}