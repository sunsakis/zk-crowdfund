// This file is auto-generated from an abi-file using AbiCodegen.
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
  
  export enum CampaignStatus {
    Setup = 0,
    Active = 1,
    Computing = 2,
    Completed = 3,
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
      const owner: BlockchainAddress = _input.readAddress();
      const title: string = _input.readString();
      const description: string = _input.readString();
      const fundingTarget: number = _input.readU32();
      const deadline: number = _input.readU64().toNumber();
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
        deadline, 
        status, 
        totalRaised, 
        numContributors, 
        isSuccessful 
      };
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
    deadline: number;
    status: CampaignStatus;
    totalRaised: Option<number>;
    numContributors: Option<number>;
    isSuccessful: boolean;
  }
  
  export function initialize(title: string, description: string, fundingTarget: number, deadline: BN): Buffer {
    return AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
      _out.writeString(title);
      _out.writeString(description);
      _out.writeU32(fundingTarget);
      _out.writeU64(deadline);
    });
  }
  
  export function startCampaign(): Buffer {
    return AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("010000000f", "hex"));
    });
  }
  
  export function endCampaign(): Buffer {
    return AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("020000000f", "hex"));
    });
  }
  
  export function withdrawFunds(): Buffer {
    return AbiByteOutput.serializeBigEndian((_out) => {
      _out.writeBytes(Buffer.from("030000000f", "hex"));
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
    if (Buffer.isBuffer(state)) {
      const input = AbiByteInput.createLittleEndian(state);
      return new CrowdfundingContract(client, address).deserializeContractState(input);
    } else {
      const input = AbiByteInput.createLittleEndian(state.bytes);
      return new CrowdfundingContract(state.client, state.address).deserializeContractState(input);
    }
  }