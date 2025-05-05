import { 
  AbiByteInput, 
  AbiByteOutput, 
  AbiBitOutput,
  BlockchainAddress
} from '@partisiablockchain/abi-client';
import { 
  BlockchainTransactionClient,
  ChainControllerApi,
  Configuration,
  SentTransaction
} from '@partisiablockchain/blockchain-api-transaction-client';
import { CryptoUtils, RealZkClient, Client } from '@partisiablockchain/zk-client';
import { Buffer } from 'buffer';
import { deserializeState } from './contract/CrowdfundingGenerated';

// Campaign status enum matching the contract
export enum CampaignStatus {
  Active = 0,
  Computing = 1,
  Completed = 2
}

export interface CampaignData {
  owner: string;
  title: string;
  description: string;
  tokenAddress?: string;
  fundingTarget: number;
  status: CampaignStatus;
  totalRaised?: number;
  numContributors?: number;
  isSuccessful: boolean;
}

/**
 * Client for interacting with the ZK Crowdfunding contract
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
  setCampaignAddress(contractAddress: string): boolean {
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
      
      // Use our generated deserializer
      const state = deserializeState(stateBuffer);
      
      return {
        owner: state.owner.asString(),
        title: state.title,
        description: state.description,
        tokenAddress: state.token_address?.asString(),
        fundingTarget: state.fundingTarget,
        status: state.status,
        totalRaised: state.totalRaised,
        numContributors: state.numContributors,
        isSuccessful: state.isSuccessful
      };
    } catch (error) {
      console.error("Error fetching campaign data:", error);
      throw new Error(`Failed to get campaign data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Add contribution as a secret input
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
   * @param contractAddress The campaign contract address
   * @returns Transaction result
   */
  async endCampaign(contractAddress: string): Promise<SentTransaction> {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    try {
      // Create RPC for end_campaign (shortname 0x01)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09); // Format indicator
        _out.writeBytes(Buffer.from("01", "hex")); // Action shortname
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
      // Create RPC for withdraw_funds (shortname 0x04)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09); // Format indicator
        _out.writeBytes(Buffer.from("04", "hex")); // Action shortname
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
   * Verify contributor without revealing contribution amount
   * @param contractAddress The campaign contract address
   * @returns Transaction result
   */
  async verifyContribution(contractAddress: string): Promise<SentTransaction> {
    if (!this.transactionClient) {
      throw new Error("No account logged in");
    }
    
    try {
      // Create RPC for verify_my_contribution (shortname 0x06)
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
        _out.writeU8(0x09); // Format indicator
        _out.writeBytes(Buffer.from("06", "hex")); // Action shortname
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