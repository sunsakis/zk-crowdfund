// src/CrowdfundingClient.ts
import { 
  BlockchainAddress, 
  AbiByteInput
} from '@partisiablockchain/abi-client';
import { 
  BlockchainTransactionClient,
  ChainControllerApi,
  Configuration
} from '@partisiablockchain/blockchain-api-transaction-client';
import { RealZkClient, Client, CryptoUtils } from '@partisiablockchain/zk-client';
import { Buffer } from 'buffer';
import { AbiBitOutput } from '@partisiablockchain/abi-client';

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
  fundingTarget: number;
  deadline: number;
  status: CampaignStatus;
  totalRaised?: number;
  numContributors?: number;
  isSuccessful: boolean;
}

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
   */
  setCampaignAddress(contractAddress: string) {
    if (!contractAddress) return;
    
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
      const fundingTarget = input.readU32();
      const deadline = input.readU64().toNumber();
      const status = input.readU8();
      
      let totalRaised = undefined;
      if (input.readBoolean()) {
        totalRaised = input.readU32();
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
   * Add contribution (ZK secret input)
   */
  async addContribution(contractAddress: string, amount: number): Promise<string> {
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
      const result = await this.transactionClient.signAndSend(transaction, 100000);
      
      return result.transactionPointer.identifier;
    } catch (error) {
      console.error("Error adding contribution:", error);
      throw new Error(`Failed to add contribution: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * End campaign - triggers the ZK computation
   */
  async endCampaign(contractAddress: string): Promise<string> {
    if (!this.transactionClient || !this.walletAddress) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // Create RPC for end_campaign (shortname 0x02)
      const rpc = Buffer.from([0x02]);
      
      // Send the transaction
      const result = await this.transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 50000); // Higher gas limit for ZK operations
      
      return result.transactionPointer.identifier;
    } catch (error) {
      console.error("Error ending campaign:", error);
      throw new Error(`Failed to end campaign: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Withdraw funds after successful campaign
   */
  async withdrawFunds(contractAddress: string): Promise<string> {
    if (!this.transactionClient || !this.walletAddress) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // Create RPC for withdraw_funds (shortname 0x03)
      const rpc = Buffer.from([0x03]);
      
      // Send the transaction
      const result = await this.transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 20000);
      
      return result.transactionPointer.identifier;
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      throw new Error(`Failed to withdraw funds: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Check if the connected wallet is the campaign owner
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
   * Wait for transaction to be confirmed
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