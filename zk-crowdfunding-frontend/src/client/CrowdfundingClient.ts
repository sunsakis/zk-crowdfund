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
import { deserializeState } from '../contract/CrowdfundingGenerated';

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
 * Check token allowance for the campaign contract
 * @param tokenAddress Token contract address
 * @param ownerAddress Owner address (usually the connected wallet)
 * @param spenderAddress Spender address (campaign contract)
 * @returns Current allowance as BigInt
 */
async getTokenAllowance(
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string
): Promise<bigint> {
  try {
      // For now, return 0 to ensure approval is always needed
      // In a production app, you'd query the token contract
      console.log("Checking allowance (simulated):", ownerAddress, spenderAddress);
      return BigInt(0);
  } catch (error) {
      console.error("Error getting token allowance:", error);
      return BigInt(0);
  }
}

/**
* Approve tokens to be spent by the campaign contract
* @param tokenAddress Token contract address
* @param campaignAddress Campaign contract address
* @param amount Amount to approve
* @returns Transaction result
*/
async approveTokens(
  tokenAddress: string,
  campaignAddress: string,
  amount: bigint
): Promise<SentTransaction> {
  if (!this.transactionClient) {
      throw new Error("Wallet not connected");
  }

  try {
      console.log(`Approving ${amount} tokens for campaign ${campaignAddress}`);

      // Build the approve RPC buffer 
      // For large numbers, we need to handle the serialization differently
      const rpc = AbiByteOutput.serializeBigEndian((_out) => {
          _out.writeU8(0x05); 
          _out.writeAddress(BlockchainAddress.fromString(campaignAddress));
          
          // Convert BigInt to bytes and write it as a byte array
          // For u128, we need 16 bytes
          const buffer = Buffer.alloc(16);
          
          // Write the amount as little-endian bytes
          // This might need adjustment based on your exact protocol
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
}

/**
* Transfer tokens to the campaign (separate from ZK input)
* @param contractAddress Campaign contract address
* @param amount Contribution amount
* @returns Transaction result
*/
async contributeTokens(
  contractAddress: string, 
  amount: number
): Promise<SentTransaction> {
  if (!this.transactionClient) {
      throw new Error("Wallet not connected");
  }

  try {
      console.log(`Contributing ${amount} tokens to campaign ${contractAddress}`);

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
          address: contractAddress,
          rpc
      }, 100000); // 100,000 gas
  } catch (error) {
      console.error("Error contributing tokens:", error);
      throw error;
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
    // Calculate the ZK amount with scaling factor
    const ZK_SCALE_FACTOR = 1_000_000; // 6 decimal places
    const zkAmount = Math.floor(amount * ZK_SCALE_FACTOR);
    
    console.log(`Adding contribution of ${amount} (scaled to ZK amount: ${zkAmount})`);
    
    const secretInput = AbiBitOutput.serialize((_out) => {
      _out.writeI32(zkAmount);
    });
    
    console.log("Secret input created successfully");
    
    // Create public RPC for add_contribution (shortname 0x40)
    const publicRpc = Buffer.from([0x40]);
    
    // Build the ZK input transaction
    const transaction = await this.zkClient!.buildOnChainInputTransaction(
      this.walletAddress,
      secretInput, // Pass the CompactBitArray directly
      publicRpc
    );
    
    console.log("ZK transaction built successfully");
    
    // Send the transaction with increased gas
    return this.transactionClient.signAndSend(transaction, 200000); // Increased to 200,000 gas
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
}