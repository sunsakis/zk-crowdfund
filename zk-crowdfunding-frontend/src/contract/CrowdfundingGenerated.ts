// This file is auto-generated from an abi-file using AbiCodegen.
// Some parts have been manually modified to work with the application.
/* eslint-disable */
// @ts-nocheck
// noinspection ES6UnusedImports
import {
  AbiBitInput,
  AbiBitOutput,
  AbiByteInput,
  AbiByteOutput,
  AbiInput,
  AbiOutput,
  AvlTreeMap,
  BlockchainAddress,
  BlockchainPublicKey,
  BlockchainStateClient,
  BlsPublicKey,
  BlsSignature,
  BN,
  Hash,
  Signature,
  StateWithClient,
  SecretInputBuilder,
} from "@partisiablockchain/abi-client";

type Option<K> = K | undefined;

// CampaignStatus enum - This needs to be exported directly for compatibility with existing code
export enum CampaignStatus {
  Active = 0,
  Computing = 1,
  Completed = 2,
}

// The internal discriminant enum - matches the auto-generated version
export enum CampaignStatusD {
  Active = 0,
  Computing = 1,
  Completed = 2,
}

// CampaignStatus type definitions from auto-generated code
export type CampaignStatusType =
  | CampaignStatusActive
  | CampaignStatusComputing
  | CampaignStatusCompleted;

export interface CampaignStatusActive {
  discriminant: CampaignStatusD.Active;
}

export interface CampaignStatusComputing {
  discriminant: CampaignStatusD.Computing;
}

export interface CampaignStatusCompleted {
  discriminant: CampaignStatusD.Completed;
}

export class CrowdfundingGenerated {
  private readonly _client: BlockchainStateClient | undefined;
  private readonly _address: BlockchainAddress | undefined;
  
  public constructor(
    client: BlockchainStateClient | undefined,
    address: BlockchainAddress | undefined
  ) {
    this._address = address;
    this._client = client;
  }
  
  public deserializeContractState(_input: AbiInput): ContractState {
    try {
      // Parse fields from the input
      const owner: BlockchainAddress = _input.readAddress();
      const title: string = _input.readString();
      const description: string = _input.readString();
      
      // Read token address
      let tokenAddress: BlockchainAddress;
      try {
        tokenAddress = _input.readAddress();
      } catch (error) {
        console.warn("Could not read token_address, using default empty address");
        tokenAddress = new BlockchainAddress(Buffer.alloc(21));
      }
      
      // Read funding target - support both BN and number formats
      let fundingTarget: BN | number;
      try {
        fundingTarget = _input.readUnsignedBigInteger(16);
      } catch (error) {
        console.warn("Could not read funding target as BN, trying as u32");
        fundingTarget = _input.readU32();
      }
      
      // Read status - support both discriminant object and direct enum value
      let status: CampaignStatus;
      try {
        const statusObject = this.deserializeCampaignStatus(_input);
        status = statusObject.discriminant;
      } catch (error) {
        console.warn("Could not read status as discriminant object, trying as u8");
        status = _input.readU8();
      }
      
      // Read total raised
      let totalRaised: Option<BN | number> = undefined;
      const totalRaised_isSome = _input.readBoolean();
      if (totalRaised_isSome) {
        try {
          const totalRaised_option: BN = _input.readUnsignedBigInteger(16);
          totalRaised = totalRaised_option;
        } catch (error) {
          console.warn("Could not read totalRaised as BN, trying as u32");
          const totalRaised_option: number = _input.readU32();
          totalRaised = totalRaised_option;
        }
      }
      
      // Read number of contributors
      let numContributors: Option<number> = undefined;
      const numContributors_isSome = _input.readBoolean();
      if (numContributors_isSome) {
        const numContributors_option: number = _input.readU32();
        numContributors = numContributors_option;
      }
      
      // Read success flag
      const isSuccessful: boolean = _input.readBoolean();
      
      // Read contributions map if it exists
      let contributions: AvlTreeMap<BlockchainAddress, BN> | undefined;
      try {
        const contributions_treeId = _input.readI32();
        contributions = new AvlTreeMap(
          contributions_treeId,
          this._client,
          this._address,
          (contributions_key) => AbiByteOutput.serializeLittleEndian((contributions_out) => {
            contributions_out.writeAddress(contributions_key);
          }),
          (contributions_bytes) => {
            const contributions_input = AbiByteInput.createLittleEndian(contributions_bytes);
            const contributions_key: BlockchainAddress = contributions_input.readAddress();
            return contributions_key;
          },
          (contributions_bytes) => {
            const contributions_input = AbiByteInput.createLittleEndian(contributions_bytes);
            const contributions_value: BN = contributions_input.readUnsignedBigInteger(16);
            return contributions_value;
          }
        );
      } catch (error) {
        console.warn("Could not read contributions map, it might not exist in this contract version");
      }
      
      // Return the state object with renamed token_address field for compatibility
      return { 
        owner, 
        title, 
        description,
        tokenAddress,   // For auto-generated format
        token_address: tokenAddress, // For manual format compatibility
        fundingTarget, 
        status, 
        totalRaised, 
        numContributors, 
        isSuccessful,
        contributions
      };
    } catch (error) {
      console.error("Error in deserializeContractState:", error);
      throw error;
    }
  }
  
  public deserializeCampaignStatus(_input: AbiInput): CampaignStatusType {
    const discriminant = _input.readU8();
    if (discriminant === 0) {
      return this.deserializeCampaignStatusActive(_input);
    } else if (discriminant === 1) {
      return this.deserializeCampaignStatusComputing(_input);
    } else if (discriminant === 2) {
      return this.deserializeCampaignStatusCompleted(_input);
    }
    throw new Error("Unknown discriminant: " + discriminant);
  }
  
  public deserializeCampaignStatusActive(_input: AbiInput): CampaignStatusActive {
    return { discriminant: CampaignStatusD.Active };
  }
  
  public deserializeCampaignStatusComputing(_input: AbiInput): CampaignStatusComputing {
    return { discriminant: CampaignStatusD.Computing };
  }
  
  public deserializeCampaignStatusCompleted(_input: AbiInput): CampaignStatusCompleted {
    return { discriminant: CampaignStatusD.Completed };
  }
  
  public async getState(): Promise<ContractState> {
    try {
      const bytes = await this._client?.getContractStateBinary(this._address!);
      if (bytes === undefined) {
        throw new Error("Unable to get state bytes");
      }
      const input = AbiByteInput.createLittleEndian(bytes);
      return this.deserializeContractState(input);
    } catch (error) {
      console.error("Error in getState:", error);
      throw error;
    }
  }
}

export interface ContractState {
  owner: BlockchainAddress;
  title: string;
  description: string;
  tokenAddress: BlockchainAddress;        // Auto-generated field name
  token_address: BlockchainAddress;       // Manual version field name
  fundingTarget: BN | number;             // Support both formats
  status: CampaignStatus;                 // Use the simple enum
  totalRaised: Option<BN | number>;       // Support both formats
  numContributors: Option<number>;
  isSuccessful: boolean;
  contributions?: AvlTreeMap<BlockchainAddress, BN>; // Optional for compatibility
}

export function initialize(
  title: string, 
  description: string, 
  tokenAddress: BlockchainAddress, 
  fundingTarget: BN | number
): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
    _out.writeString(title);
    _out.writeString(description);
    _out.writeAddress(tokenAddress);
    
    // Handle both number and BN formats
    if (typeof fundingTarget === 'number') {
      _out.writeU32(fundingTarget);
    } else {
      _out.writeUnsignedBigInteger(fundingTarget, 16);
    }
  });
}

export function endCampaign(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeU8(0x09);
    _out.writeBytes(Buffer.from("01", "hex"));
  });
}

export function withdrawFunds(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeU8(0x09);
    _out.writeBytes(Buffer.from("04", "hex"));
  });
}

export function claimRefund(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeU8(0x09);
    _out.writeBytes(Buffer.from("06", "hex"));
  });
}

export function verifyMyContribution(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeU8(0x09);
    _out.writeBytes(Buffer.from("06", "hex"));
  });
}

export function contributeTokens(amount: BN | number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeU8(0x09);
    _out.writeBytes(Buffer.from("07", "hex"));
    
    // Handle both number and BN formats
    if (typeof amount === 'number') {
      _out.writeU32(amount);
    } else {
      _out.writeUnsignedBigInteger(amount, 16);
    }
  });
}

export function addContribution(): SecretInputBuilder<number> {
  const _publicRpc: Buffer = AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("40", "hex"));
  });
  
  const _secretInput = (secret_input_lambda: number): any => {
    return AbiBitOutput.serialize((_out) => {
      _out.writeI32(secret_input_lambda);
    });
  };
  
  return new SecretInputBuilder<number>(_publicRpc, _secretInput);
}

export function deserializeState(state: StateWithClient): ContractState;
export function deserializeState(bytes: Buffer): ContractState;
export function deserializeState(
  bytes: Buffer,
  client: BlockchainStateClient,
  address: BlockchainAddress
): ContractState;
export function deserializeState(
  state: Buffer | StateWithClient,
  client?: BlockchainStateClient,
  address?: BlockchainAddress
): ContractState {
  try {
    if (Buffer.isBuffer(state)) {
      const input = AbiByteInput.createLittleEndian(state);
      return new CrowdfundingGenerated(client, address).deserializeContractState(input);
    } else if (state && 'bytes' in state) {
      const input = AbiByteInput.createLittleEndian(state.bytes);
      return new CrowdfundingGenerated(
        state.client,
        state.address
      ).deserializeContractState(input);
    } else {
      throw new Error("Invalid state object passed to deserializeState");
    }
  } catch (error) {
    console.error("Error deserializing state:", error);
    throw new Error(`Failed to deserialize state: ${error.message}`);
  }
}