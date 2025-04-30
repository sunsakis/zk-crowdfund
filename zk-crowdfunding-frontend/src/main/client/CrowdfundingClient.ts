import { 
  BlockchainAddress, 
  AbiByteInput,
  AbiBitOutput
} from '@partisiablockchain/abi-client';
import { 
  BlockchainTransactionClient
} from '@partisiablockchain/blockchain-api-transaction-client';
import { RealZkClient, Client, CryptoUtils } from '@partisiablockchain/zk-client';
import { Buffer } from 'buffer';
import { getRequest } from '../client/BaseClient';

// Campaign status enum matching the contract
export enum CampaignStatus {
  ACTIVE = 0,
  COMPUTING = 1,
  COMPLETED = 2
}

export interface CampaignData {
  address: string;
  owner: string;
  title: string;
  description: string;
  fundingTarget: number;
  status: CampaignStatus;
  totalRaised?: number;
  numContributors?: number;
  isSuccessful: boolean;
  deadline?: number;
}

// Contract interface to match what's returned by the API
interface ContractCore {
  type: string;
  address: string;
  jarHash: string;
  storageLength: number;
  abi: string;
}

// ContractData extends ContractCore with serialized state
interface ContractData<T> extends ContractCore {
  serializedContract: T;
}

// ZK Contract specific structures
interface ZkVariable {
  id: number;
  information: { data: string };
  owner: string;
  transaction: string;
}

interface ZkContractData {
  engines: { engines: any[] };
  openState: { openState: { data: string } };
  variables: Array<{ key: number; value: ZkVariable }>;
}

export class CrowdfundingClient {
  private readonly nodeUrl: string = "https://node1.testnet.partisiablockchain.com";
  private readonly browserUrl: string = "https://browser.testnet.partisiablockchain.com";
  private readonly client: Client;
  private transactionClient?: BlockchainTransactionClient;
  private zkClient?: RealZkClient;
  private walletAddress?: string;
  private keyPair?: any;
  
  constructor() {
    // Initialize client for contract interaction
    this.client = new Client(this.nodeUrl);
  }
  
  /**
   * Connect wallet using private key
   */
  public async connectWallet(privateKey: string): Promise<string> {
    try {
      // Initialize key pair from private key
      this.keyPair = CryptoUtils.privateKeyToKeypair(privateKey);
      
      // Get address from key pair
      this.walletAddress = CryptoUtils.keyPairToAccountAddress(this.keyPair);
      
      // Create blockchain client for transactions
      const auth = {
        getAddress: () => this.walletAddress!,
        sign: async (transactionPayload: Buffer, chainId: string): Promise<string> => {
          // Hash the transaction payload and chain ID
          const hash = CryptoUtils.hashBuffers([
            transactionPayload,
            Buffer.from(chainId)
          ]);
          
          // Sign the hash
          const signature = this.keyPair!.sign(hash);
          
          // Format the signature
          return CryptoUtils.signatureToBuffer(signature).toString('hex');
        }
      };
      
      this.transactionClient = BlockchainTransactionClient.create(this.nodeUrl, auth);
      
      return this.walletAddress;
    } catch (error) {
      console.error("Error connecting wallet:", error);
      throw new Error(`Failed to connect wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Set the campaign contract address and initialize ZK client
   */
  public setCampaignAddress(contractAddress: string): boolean {
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
   * Get contract data using the helper function
   */
  private async getContractData<T>(address: string, withState = true): Promise<ContractData<T> | undefined> {
    const query = "?requireContractState=" + withState;
    return getRequest<ContractData<T>>(this.nodeUrl + "/blockchain/contracts/" + address + query);
  }
  
  /**
   * Get campaign data from contract
   */
  public async getCampaignData(contractAddress: string): Promise<CampaignData> {
    try {
      // Make sure we have a valid address format
      if (!contractAddress || contractAddress.length !== 42 || !/^[0-9a-fA-F]+$/.test(contractAddress)) {
        throw new Error("Invalid contract address format");
      }

      console.log(`Fetching contract data for address: ${contractAddress}`);
      
      // Fetch contract data
      const contractData = await this.getContractData<ZkContractData>(contractAddress, true);
      
      // Debug output to see what we're getting
      console.log("Contract data received:", contractData ? "yes" : "no");
      
      if (!contractData) {
        throw new Error("Failed to fetch contract data");
      }
      
      if (!contractData.serializedContract?.openState?.openState?.data) {
        console.error("Missing state data in contract:", contractData);
        throw new Error("Contract state data not found");
      }
      
      // Get state buffer from base64 string
      const stateBase64 = contractData.serializedContract.openState.openState.data;
      const stateBuffer = Buffer.from(stateBase64, 'base64');
      
      console.log(`State buffer length: ${stateBuffer.length} bytes`);
      
      // Count the number of secret variables (contributions)
      const variables = contractData.serializedContract.variables || [];
      const numContributors = variables.length;
      
      console.log(`Found ${numContributors} variables/contributions`);
      
      // Create an input reader for the buffer
      const input = AbiByteInput.createLittleEndian(stateBuffer);
      
      try {
        // Read state fields according to the contract structure
        const owner = input.readAddress();
        const title = input.readString();
        const description = input.readString();
        const fundingTarget = input.readU32();
        const status = input.readU8(); // Campaign status enum
        
        let totalRaised = undefined;
        if (input.readBoolean()) {
          totalRaised = input.readU32();
        }
        
        let stateNumContributors = undefined;
        if (input.readBoolean()) {
          stateNumContributors = input.readU32();
        }
        
        const isSuccessful = input.readBoolean();
        
        console.log("Successfully parsed contract state");
        
        return {
          address: contractAddress,
          owner: owner.asString(),
          title,
          description,
          fundingTarget,
          status: status as CampaignStatus,
          totalRaised,
          numContributors: stateNumContributors || numContributors,
          isSuccessful
        };
      } catch (parseError) {
        console.error("Error parsing contract state:", parseError);
        throw new Error(`Failed to parse contract state: ${parseError.message}. This might not be a ZK Crowdfunding contract.`);
      }
    } catch (error) {
      console.error("Error fetching campaign data:", error);
      throw new Error(`Failed to get campaign data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Add contribution (ZK secret input)
   */
  public async addContribution(amount: number, contractAddress: string): Promise<any> {
    if (!this.transactionClient || !this.walletAddress) {
      throw new Error("Wallet not connected");
    }
    
    if (!this.zkClient) {
      const success = this.setCampaignAddress(contractAddress);
      if (!success) {
        throw new Error("Failed to initialize ZK client for contract");
      }
    }
    
    try {
      // Create secret input for contribution amount
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
      
      // Return transaction result
      return result;
    } catch (error) {
      console.error("Error adding contribution:", error);
      throw new Error(`Failed to add contribution: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * End campaign - triggers the ZK computation
   */
  public async endCampaign(contractAddress: string): Promise<any> {
    if (!this.transactionClient || !this.walletAddress) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // Create RPC for end_campaign (shortname 0x01)
      const rpc = Buffer.from([0x01]);
      
      // Send the transaction with higher gas limit for ZK operations
      return await this.transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 200000);
    } catch (error) {
      console.error("Error ending campaign:", error);
      throw new Error(`Failed to end campaign: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Withdraw funds after successful campaign
   */
  public async withdrawFunds(contractAddress: string): Promise<any> {
    if (!this.transactionClient || !this.walletAddress) {
      throw new Error("Wallet not connected");
    }
    
    try {
      // Create RPC for withdraw_funds (shortname 0x02)
      const rpc = Buffer.from([0x02]);
      
      // Send the transaction
      return await this.transactionClient.signAndSend({
        address: contractAddress,
        rpc
      }, 100000);
    } catch (error) {
      console.error("Error withdrawing funds:", error);
      throw new Error(`Failed to withdraw funds: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get transaction URL for browser
   */
  public getTransactionUrl(txId: string): string {
    return `${this.browserUrl}/transactions/${txId}`;
  }
  
  /**
   * Get contract URL for browser
   */
  public getContractUrl(address: string): string {
    return `${this.browserUrl}/contracts/${address}`;
  }
  
  /**
   * Check if the connected wallet is the campaign owner
   */
  public isOwner(ownerAddress: string): boolean {
    if (!this.walletAddress) return false;
    return ownerAddress.toLowerCase() === this.walletAddress.toLowerCase();
  }
  
  /**
   * Disconnect wallet
   */
  public disconnect(): void {
    this.walletAddress = undefined;
    this.keyPair = undefined;
    this.transactionClient = undefined;
    this.zkClient = undefined;
  }
}