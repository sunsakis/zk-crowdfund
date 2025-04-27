/*
 * Copyright (C) 2022 - 2023 Partisia Blockchain Foundation
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
import {
  BlockchainAddress,
  BlockchainTransactionClient,
} from "@partisiablockchain/blockchain-api-transaction-client";

import { RealZkClient } from "@partisiablockchain/zk-client";
import { addContribution, startCampaign, endCampaign, withdrawFunds } from "./CrowdfundingGenerated";
import { getContractAddress, getFactoryAddress, CLIENT } from "../AppState";
import { AbiByteOutput, AbiByteInput } from "@partisiablockchain/abi-client";
import { Buffer } from "buffer";

export enum CampaignStatus {
  SETUP = 0,
  ACTIVE = 1, 
  COMPUTING = 2,
  COMPLETED = 3,
}

export interface CrowdfundingBasicState {
  owner: BlockchainAddress;
  title: string;
  description: string;
  fundingTarget: number;
  deadline: number;
  status: CampaignStatus;
  totalRaised: number | undefined;
  numContributors: number | undefined;
  isSuccessful: boolean;
}

export interface CampaignInfo {
  address: string;
  owner: string;
  title: string;
  description: string;
  creation_time: number;
  target: number;
  deadline: number;
}

/**
 * API for the crowdfunding contract and registry.
 * This implementation uses real blockchain calls.
 */
export class CrowdfundingApi {
  private readonly transactionClient: BlockchainTransactionClient | undefined;
  private readonly zkClient: RealZkClient;
  readonly sender: BlockchainAddress;
  private readonly factoryAddress: string | undefined;

  constructor(
    transactionClient: BlockchainTransactionClient | undefined,
    zkClient: RealZkClient,
    sender: BlockchainAddress,
    factoryAddress?: string
  ) {
    this.transactionClient = transactionClient;
    this.zkClient = zkClient;
    this.sender = sender;
    this.factoryAddress = factoryAddress;
  }

  /**
   * Register a manually deployed campaign with the factory/registry
   */
  readonly registerCampaign = async (campaignAddress: string) => {
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    if (this.factoryAddress === undefined) {
      throw new Error("Factory/registry address not set");
    }

    // Build the register campaign RPC using proper ABI encoding
    // Based on the factory contract, register_campaign takes:
    // - campaign_address: Address
    // - owner: Address
    // - index: u32 (which we'll set to 0 for auto-increment behavior)
    const rpc = AbiByteOutput.serializeBigEndian((_out) => {
      // register_campaign action
      _out.writeBytes(Buffer.from([0x09])); // Action selector for actions
      _out.writeU8(0x00); // Discriminant for register_campaign
      _out.writeBytes(Buffer.from(campaignAddress, "hex")); // Campaign address
      _out.writeBytes(this.sender.toBuffer()); // Owner address
      _out.writeU32(0); // Index (0 for auto-increment)
    });
    
    // Send transaction to the factory/registry contract
    return this.transactionClient.signAndSend({ address: this.factoryAddress, rpc }, 100_000);
  };

  /**
   * Get all campaigns from the factory/registry
   */
  readonly getAllCampaigns = async (): Promise<CampaignInfo[]> => {
    if (this.factoryAddress === undefined) {
      throw new Error("Factory/registry address not set");
    }

    try {
      // Get the factory contract state
      const contractData = await CLIENT.getContractData(this.factoryAddress);
      
      if (contractData && contractData.serializedContract) {
        const stateBuffer = Buffer.from(
          contractData.serializedContract.openState.openState.data,
          "base64"
        );
        
        // Parse the factory contract state
        const input = AbiByteInput.createLittleEndian(stateBuffer);
        
        // The factory contract state contains:
        // - admin: Address
        // - campaigns: Vec<CampaignInfo>
        
        // Read admin address
        input.readAddress();
        
        // Read campaigns vector
        const campaignsLength = input.readU32();
        const campaigns: CampaignInfo[] = [];
        
        for (let i = 0; i < campaignsLength; i++) {
          campaigns.push(this.parseCampaignInfo(input));
        }
        
        return campaigns;
      }
      
      return [];
    } catch (error) {
      console.error("Error getting all campaigns:", error);
      return [];
    }
  };

  /**
   * Get campaigns owned by the current user from the factory/registry
   */
  readonly getMyCampaigns = async (): Promise<CampaignInfo[]> => {
    const allCampaigns = await this.getAllCampaigns();
    return allCampaigns.filter(campaign => campaign.owner === this.sender.asString());
  };

  /**
   * Parse CampaignInfo from AbiInput
   */
  private parseCampaignInfo(input: AbiByteInput): CampaignInfo {
    return {
      address: input.readAddress().asString(),
      owner: input.readAddress().asString(),
      title: input.readString(),
      description: input.readString(),
      creation_time: input.readU64().toNumber(),
      target: input.readU32(),
      deadline: input.readU64().toNumber()
    };
  }

  /**
   * Build and send add contribution secret input transaction.
   * @param amount the contribution amount to input
   */
  readonly addContribution = async (amount: number) => {
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }

    const addContributionSecretInputBuilder = addContribution();
    const secretInput = addContributionSecretInputBuilder.secretInput(amount);
    const transaction = await this.zkClient.buildOnChainInputTransaction(
      this.sender,
      secretInput.secretInput,
      secretInput.publicRpc
    );

    return this.transactionClient.signAndSend(transaction, 100_000);
  };

  /**
   * Build and send start campaign transaction
   */
  readonly startCampaign = () => {
    const address = getContractAddress();
    if (address === undefined) {
      throw new Error("No address provided");
    }
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    const rpc = startCampaign();
    return this.transactionClient.signAndSend({ address, rpc }, 20_000);
  };

  /**
   * Build and send end campaign transaction
   */
  readonly endCampaign = () => {
    const address = getContractAddress();
    if (address === undefined) {
      throw new Error("No address provided");
    }
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    const rpc = endCampaign();
    return this.transactionClient.signAndSend({ address, rpc }, 20_000);
  };

  /**
   * Build and send withdraw funds transaction (only available if campaign was successful)
   */
  readonly withdrawFunds = () => {
    const address = getContractAddress();
    if (address === undefined) {
      throw new Error("No address provided");
    }
    if (this.transactionClient === undefined) {
      throw new Error("No account logged in");
    }
    const rpc = withdrawFunds();
    return this.transactionClient.signAndSend({ address, rpc }, 20_000);
  };
}