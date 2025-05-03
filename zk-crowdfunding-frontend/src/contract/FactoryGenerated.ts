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
export class FactoryGenerated {
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
    const admin: BlockchainAddress = _input.readAddress();
    const campaigns_vecLength = _input.readI32();
    const campaigns: CampaignInfo[] = [];
    for (let campaigns_i = 0; campaigns_i < campaigns_vecLength; campaigns_i++) {
      const campaigns_elem: CampaignInfo = this.deserializeCampaignInfo(_input);
      campaigns.push(campaigns_elem);
    }
    return { admin, campaigns };
  }
  public deserializeCampaignInfo(_input: AbiInput): CampaignInfo {
    const address: BlockchainAddress = _input.readAddress();
    const owner: BlockchainAddress = _input.readAddress();
    const title: string = _input.readString();
    const description: string = _input.readString();
    const creationTime: BN = _input.readU64();
    const target: number = _input.readU32();
    const deadline: BN = _input.readU64();
    return { address, owner, title, description, creationTime, target, deadline };
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
  admin: BlockchainAddress;
  campaigns: CampaignInfo[];
}

export interface CampaignInfo {
  address: BlockchainAddress;
  owner: BlockchainAddress;
  title: string;
  description: string;
  creationTime: BN;
  target: number;
  deadline: BN;
}

export interface CreateCampaignParams {
  title: string;
  description: string;
  category: string;
  imageUrl: Option<string>;
  fundingTarget: number;
  deadline: BN;
}
function serializeCreateCampaignParams(_out: AbiOutput, _value: CreateCampaignParams): void {
  const { title, description, category, imageUrl, fundingTarget, deadline } = _value;
  _out.writeString(title);
  _out.writeString(description);
  _out.writeString(category);
  _out.writeBoolean(imageUrl !== undefined);
  if (imageUrl !== undefined) {
    _out.writeString(imageUrl);
  }
  _out.writeU32(fundingTarget);
  _out.writeU64(deadline);
}

export function initialize(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
  });
}

export function getCampaigns(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("01", "hex"));
  });
}

export function getMyCampaigns(): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("02", "hex"));
  });
}

export function getCampaignByAddress(address: BlockchainAddress): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("03", "hex"));
    _out.writeAddress(address);
  });
}

export function createCampaign(params: CreateCampaignParams): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("cbd8b8c802", "hex"));
    serializeCreateCampaignParams(_out, params);
  });
}

export function registerCampaign(campaignAddress: BlockchainAddress, owner: BlockchainAddress, index: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("fba986d10f", "hex"));
    _out.writeAddress(campaignAddress);
    _out.writeAddress(owner);
    _out.writeU32(index);
  });
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
    return new FactoryGenerated(client, address).deserializeContractState(input);
  } else {
    const input = AbiByteInput.createLittleEndian(state.bytes);
    return new FactoryGenerated(
      state.client,
      state.address
    ).deserializeContractState(input);
  }
}

