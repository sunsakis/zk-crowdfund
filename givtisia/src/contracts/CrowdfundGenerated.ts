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
import { CompactBitArray } from "@secata-public/bitmanipulation-ts";

type Option<K> = K | undefined;
export class CrowdfundGenerated {
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
    const tokenAddress: BlockchainAddress = _input.readAddress();
    const fundingTarget: number = _input.readU32();
    const status: CampaignStatus = this.deserializeCampaignStatus(_input);
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
    const fundsWithdrawn: boolean = _input.readBoolean();
    let balanceTrackerId: Option<SecretVarId> = undefined;
    const balanceTrackerId_isSome = _input.readBoolean();
    if (balanceTrackerId_isSome) {
      const balanceTrackerId_option: SecretVarId = this.deserializeSecretVarId(_input);
      balanceTrackerId = balanceTrackerId_option;
    }
    return { owner, title, description, tokenAddress, fundingTarget, status, totalRaised, numContributors, isSuccessful, fundsWithdrawn, balanceTrackerId };
  }
  public deserializeCampaignStatus(_input: AbiInput): CampaignStatus {
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
    return { discriminant: CampaignStatusD.Active,  };
  }
  public deserializeCampaignStatusComputing(_input: AbiInput): CampaignStatusComputing {
    return { discriminant: CampaignStatusD.Computing,  };
  }
  public deserializeCampaignStatusCompleted(_input: AbiInput): CampaignStatusCompleted {
    return { discriminant: CampaignStatusD.Completed,  };
  }
  public deserializeSecretVarId(_input: AbiInput): SecretVarId {
    const rawId: number = _input.readU32();
    return { rawId };
  }
  public async getState(): Promise<ContractState> {
    const bytes = await this._client?.getContractStateBinary(this._address!);
    if (bytes === undefined) {
      throw new Error("Unable to get state bytes");
    }
    const input = AbiByteInput.createLittleEndian(bytes);
    return this.deserializeContractState(input);
  }

  public deserializeEndCampaignAction(_input: AbiInput): EndCampaignAction {
    return { discriminant: "end_campaign",  };
  }

  public deserializeWithdrawFundsAction(_input: AbiInput): WithdrawFundsAction {
    return { discriminant: "withdraw_funds",  };
  }

  public deserializeContributeTokensAction(_input: AbiInput): ContributeTokensAction {
    const amount: number = _input.readU32();
    return { discriminant: "contribute_tokens", amount };
  }

  public deserializeContributeCallbackCallback(_input: AbiInput): ContributeCallbackCallback {
    const Amount: number = _input.readU32();
    return { discriminant: "contribute_callback", Amount };
  }

  public deserializeInitializeInit(_input: AbiInput): InitializeInit {
    const title: string = _input.readString();
    const description: string = _input.readString();
    const tokenAddress: BlockchainAddress = _input.readAddress();
    const fundingTarget: number = _input.readU32();
    return { discriminant: "initialize", title, description, tokenAddress, fundingTarget };
  }

}
export interface ContractState {
  owner: BlockchainAddress;
  title: string;
  description: string;
  tokenAddress: BlockchainAddress;
  fundingTarget: number;
  status: CampaignStatus;
  totalRaised: Option<number>;
  numContributors: Option<number>;
  isSuccessful: boolean;
  fundsWithdrawn: boolean;
  balanceTrackerId: Option<SecretVarId>;
}

export enum CampaignStatusD {
  Active = 0,
  Computing = 1,
  Completed = 2,
}
export type CampaignStatus =
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

export interface SecretVarId {
  rawId: number;
}

export function initialize(title: string, description: string, tokenAddress: BlockchainAddress, fundingTarget: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("ffffffff0f", "hex"));
    _out.writeString(title);
    _out.writeString(description);
    _out.writeAddress(tokenAddress);
    _out.writeU32(fundingTarget);
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

export function contributeTokens(amount: number): Buffer {
  return AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeU8(0x09);
    _out.writeBytes(Buffer.from("07", "hex"));
    _out.writeU32(amount);
  });
}

export function addContribution(): SecretInputBuilder<number> {
  const _publicRpc: Buffer = AbiByteOutput.serializeBigEndian((_out) => {
    _out.writeBytes(Buffer.from("40", "hex"));
  });
  const _secretInput = (secret_input_lambda: number): CompactBitArray => AbiBitOutput.serialize((_out) => {
    _out.writeU32(secret_input_lambda);
  });
  return new SecretInputBuilder(_publicRpc, _secretInput);
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
    return new CrowdfundGenerated(client, address).deserializeContractState(input);
  } else {
    const input = AbiByteInput.createLittleEndian(state.bytes);
    return new CrowdfundGenerated(
      state.client,
      state.address
    ).deserializeContractState(input);
  }
}

export type Action =
  | EndCampaignAction
  | WithdrawFundsAction
  | ContributeTokensAction;

export interface EndCampaignAction {
  discriminant: "end_campaign";
}
export interface WithdrawFundsAction {
  discriminant: "withdraw_funds";
}
export interface ContributeTokensAction {
  discriminant: "contribute_tokens";
  amount: number;
}
export function deserializeAction(bytes: Buffer): Action {
  const input = AbiByteInput.createBigEndian(bytes);
  input.readU8();
  const shortname = input.readShortnameString();
  const contract = new CrowdfundGenerated(undefined, undefined);
  if (shortname === "01") {
    return contract.deserializeEndCampaignAction(input);
  } else if (shortname === "04") {
    return contract.deserializeWithdrawFundsAction(input);
  } else if (shortname === "07") {
    return contract.deserializeContributeTokensAction(input);
  }
  throw new Error("Illegal shortname: " + shortname);
}

export type Callback =
  | ContributeCallbackCallback;

export interface ContributeCallbackCallback {
  discriminant: "contribute_callback";
  Amount: number;
}
export function deserializeCallback(bytes: Buffer): Callback {
  const input = AbiByteInput.createBigEndian(bytes);
  const shortname = input.readShortnameString();
  const contract = new CrowdfundGenerated(undefined, undefined);
  if (shortname === "31") {
    return contract.deserializeContributeCallbackCallback(input);
  }
  throw new Error("Illegal shortname: " + shortname);
}

export type Init =
  | InitializeInit;

export interface InitializeInit {
  discriminant: "initialize";
  title: string;
  description: string;
  tokenAddress: BlockchainAddress;
  fundingTarget: number;
}
export function deserializeInit(bytes: Buffer): Init {
  const input = AbiByteInput.createBigEndian(bytes);
  const shortname = input.readShortnameString();
  const contract = new CrowdfundGenerated(undefined, undefined);
  if (shortname === "ffffffff0f") {
    return contract.deserializeInitializeInit(input);
  }
  throw new Error("Illegal shortname: " + shortname);
}

