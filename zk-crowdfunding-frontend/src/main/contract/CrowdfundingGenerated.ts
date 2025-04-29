// zk-crowdfunding-frontend/src/main/contract/CrowdfundingGenerated.ts
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

// CampaignStatus enum
export enum CampaignStatus {
  Active = 0,
  Computing = 1,
  Completed = 2,
}

export class CrowdfundingContract {
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
      const owner: BlockchainAddress = _input.readAddress();
      const title: string = _input.readString();
      const description: string = _input.readString();
      const fundingTarget: number = _input.readU32();
      const status: CampaignStatus = _input.readU8();
      
      let totalRaised: Option<number> = undefined;
      const totalRaised_isSome = _input.readBoolean();
      if (totalRaised_isSome) {
        const totalRaised_option: number = _input.readU32();
        totalRaised = totalRaised_option;
      }
      
      let numContributors: Option<number> = undefined;
      const numContributors_isSome = _input.readBoolean();
      if (numContributors_isSome) {
        const numContributors_option: number = _input.readU32();
        numContributors = numContributors_option;
      }
      
      const isSuccessful: boolean = _input.readBoolean();
      
      return { 
        owner, 
        title, 
        description, 
        fundingTarget, 
        status, 
        totalRaised, 
        numContributors, 
        isSuccessful 
      };
    } catch (error) {
      console.error("Error in deserializeContractState:", error);
      throw error;
    }
  }
  
  public async getState(): Promise<ContractState> {
    const bytes = await this._client?.getContractStateBinary(this._address!);
    if (bytes === undefined) {
      throw new Error("Unable to get state bytes");
    }
    const input = AbiByteInput.createLittleEndian(bytes);
    return this.deserializeContractState(input);
  }
}

export interface ContractState {
  owner: BlockchainAddress;
  title: string;
  description: string;
  fundingTarget: number;
  status: CampaignStatus;
  totalRaised: Option<number>;
  numContributors: Option<number>;
  isSuccessful: boolean;
}

export function initialize(title: string, description: string, fundingTarget: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
    _out.writeString(title);
    _out.writeString(description);
    _out.writeU32(fundingTarget);
  });
}

export function endCampaign(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("01", "hex"));
  });
}

export function withdrawFunds(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("02", "hex"));
  });
}

export function addContribution(): SecretInputBuilder<number> {
  const _publicRpc: Buffer = AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("40", "hex"));
  });
  const _secretInput = (secret_input_lambda: number): CompactBitArray =>
    AbiBitOutput.serialize((_out) => {
      _out.writeI32(secret_input_lambda);
    });
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
      return new CrowdfundingContract(client, address).deserializeContractState(input);
    } else if (state && 'bytes' in state) {
      const input = AbiByteInput.createLittleEndian(state.bytes);
      return new CrowdfundingContract(state.client, state.address).deserializeContractState(input);
    } else {
      throw new Error("Invalid state object passed to deserializeState");
    }
  } catch (error) {
    console.error("Error deserializing state:", error);
    throw new Error(`Failed to deserialize state: ${error.message}`);
  }
}