// src/services/ContractService.ts
import { 
  BlockchainAddress, 
  AbiByteOutput, 
  AbiBitOutput 
} from '@partisiablockchain/abi-client';
import { 
  BlockchainTransactionClient,
  ChainControllerApi,
  Configuration,
  SenderAuthentication
} from '@partisiablockchain/blockchain-api-transaction-client';
import { RealZkClient, Client, CryptoUtils } from '@partisiablockchain/zk-client';
import { Buffer } from 'buffer';

// Make sure these match your contract's enum values
export enum CampaignStatus {
  Active = 0,
  Computing = 1,
  Completed = 2
}

export interface ProjectData {
  owner: string;
  title: string;
  description: string;
  fundingTarget: number;
  deadline: number;
  status: CampaignStatus;
  totalRaised: number | null;
  numContributors: number | null;
  isSuccessful: boolean | null;
}

export interface TransactionResult {
  success: boolean;
  txId?: string;
  error?: string;
}

class ContractService {
  private readonly testnetUrl = "https://node1.testnet.partisiablockchain.com";
  private chainApi: ChainControllerApi;
  private client: Client;
  private transactionClient?: BlockchainTransactionClient;
  private zkClient?: RealZkClient;
  private walletAddress?: string;
  private keyPair?: any;
  private contractAddress?: string;
  
  constructor() {
    this.chainApi = new ChainControllerApi(
      new Configuration({ basePath: this.testnetUrl })
    );
    this.client = new Client(this.testnetUrl);
  }
  
  // Set the current contract address
  setContractAddress(address: string) {
    this.contractAddress = address;
    
    // Create ZK client for this contract
    if (address) {
      this.zkClient = RealZkClient.create(address, this.client);
    }
  }
  
  // Get the current contract address
  getContractAddress(): string | undefined {
    return this.contractAddress;
  }
  
  // Expose the transaction client for debugging
  getTransactionClient(): BlockchainTransactionClient | undefined {
    return this.transactionClient;
  }
  
  // Connect wallet using private key
  async connectWallet(privateKey: string): Promise<string> {
    try {
      // Initialize key pair from private key
      this.keyPair = CryptoUtils.privateKeyToKeypair(privateKey);
      
      // Get address from key pair
      this.walletAddress = CryptoUtils.keyPairToAccountAddress(this.keyPair);
      
      // Create blockchain client for transactions
      const auth: SenderAuthentication = {
        getAddress: () => this.walletAddress!,
        sign: async (transactionPayload: Buffer, chainId: string): Promise<string> => {
          // Create signature with the private key
          const hash = require('hash.js').sha256().update(Buffer.concat([
            transactionPayload,
            Buffer.from(chainId)
          ])).digest();
          
          const signature = this.keyPair!.sign(hash);
          
          // Format signature
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
  
  // Get project details
  async getProject(address?: string): Promise<ProjectData> {
    const contractAddress = address || this.contractAddress;
    
    if (!contractAddress) {
      throw new Error("No contract address provided");
    }
    
    try {
      // Get contract state
      const response = await this.chainApi.getContractState(contractAddress, true);
      
      if (!response?.data?.serializedContract?.openState?.openState?.data) {
        throw new Error("Contract data not found");
      }
      
      // Parse contract state
      const stateBuffer = Buffer.from(
        response.data.serializedContract.openState.openState.data, 
        'base64'
      );
      
      // Count contributors from variables
      const variables = response.data.serializedContract.variables || [];
      const contributorCount = variables.filter(v => {
        try {
          if (v.value && v.value.information && v.value.information.data) {
            return Buffer.from(v.value.information.data, 'base64').readUInt8() === 0;
          }
          return false;
        } catch (error) {
          return false;
        }
      }).length;
      
      // Read state with ABI
      const input = new AbiBitInput(stateBuffer);
      
      // Read fields in same order as in contract.rs
      const owner = input.readAddress();
      const title = input.readString();
      const description = input.readString();
      const fundingTarget = input.readU32();
      const status = input.readU8();
      
      let totalRaised = null;
      if (input.readBoolean()) {
        totalRaised = input.readU32();
      }
      
      let numContributors = null;
      if (input.readBoolean()) {
        numContributors = input.readU32();
      } else {
        numContributors = contributorCount;
      }
      
      // Read is_successful if in Completed state
      const isSuccessful = status === CampaignStatus.Completed ? input.readBoolean() : null;
      
      return {
        owner: owner.asString(),
        title,
        description,
        fundingTarget,
        deadline: Date.now() + 86400000, // Mock deadline 1 day from now
        status,
        totalRaised,
        numContributors,
        isSuccessful
      };
    } catch (error) {
      console.error("Error getting project data:", error);
      throw new Error(`Failed to get project data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // Check if current wallet is the owner
  async isProjectOwner(address?: string): Promise<boolean> {
    if (!this.walletAddress) {
      return false;
    }
    
    try {
      const projectData = await this.getProject(address);
      return projectData.owner.toLowerCase() === this.walletAddress.toLowerCase();
    } catch (error) {
      console.error("Error checking owner:", error);
      return false;
    }
  }
  
  // Make a contribution (ZK input)
  async contribute(amount: number): Promise<TransactionResult> {
    if (!this.transactionClient || !this.walletAddress) {
      return { success: false, error: "Wallet not connected" };
    }
    
    if (!this.contractAddress) {
      return { success: false, error: "No contract address set" };
    }
    
    if (!this.zkClient) {
      this.zkClient = RealZkClient.create(this.contractAddress, this.client);
    }
    
    try {
      // Create secret input
      const secretInput = AbiBitOutput.serialize((_out) => {
        _out.writeI32(amount);
      });
      
      // Create RPC for add_contribution (shortname 0x40)
      const publicRpc = Buffer.from([0x40]);
      
      // Build ZK transaction
      const transaction = await this.zkClient.buildOnChainInputTransaction(
        BlockchainAddress.fromString(this.walletAddress),
        secretInput,
        publicRpc
      );
      
      // Send transaction
      const result = await this.transactionClient.signAndSend(transaction, 100000);
      
      return {
        success: true,
        txId: result.transactionPointer.identifier
      };
    } catch (error) {
      console.error("Error making contribution:", error);
      return {
        success: false,
        error: `Failed to contribute: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  // End campaign
  async endCampaign(): Promise<TransactionResult> {
    if (!this.transactionClient || !this.walletAddress) {
      return { success: false, error: "Wallet not connected" };
    }
    
    if (!this.contractAddress) {
      return { success: false, error: "No contract address set" };
    }
    
    try {
      // Debug info
      console.log("Starting end campaign transaction");
      console.log("Contract address:", this.contractAddress);
      console.log("Wallet address:", this.walletAddress);
      
      // Create RPC - try the simplest version first (just the shortname)
      const rpc = Buffer.from([0x01]);
      
      console.log("RPC payload:", rpc.toString('hex'), "length:", rpc.length);
      
      // Send transaction
      console.log("Sending transaction...");
      const result = await this.transactionClient.signAndSend({
        address: this.contractAddress,
        rpc
      }, 200000); // Use higher gas limit for ZK operations
      
      console.log("Transaction sent successfully:", result);
      
      return {
        success: true,
        txId: result.transactionPointer.identifier
      };
    } catch (error) {
      console.error("Error ending campaign:", error);
      console.error("Error details:", error instanceof Error ? error.stack : "Unknown error");
      
      return {
        success: false,
        error: `Failed to end campaign: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  // Withdraw funds
  async withdrawFunds(): Promise<TransactionResult> {
    if (!this.transactionClient || !this.walletAddress) {
      return { success: false, error: "Wallet not connected" };
    }
    
    if (!this.contractAddress) {
      return { success: false, error: "No contract address set" };
    }
    
    try {
      // Create RPC for withdraw_funds (shortname 0x02)
      const rpc = Buffer.from([0x02]);
      
      // Send transaction
      const result = await this.transactionClient.signAndSend({
        address: this.contractAddress,
        rpc
      }, 20000);
      
      return {
        success: true,
        txId: result.transactionPointer.identifier
      };
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      return {
        success: false,
        error: `Failed to withdraw funds: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export default new ContractService();