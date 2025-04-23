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
import { getContractAddress } from "../AppState";

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

/**
 * API for the crowdfunding contract.
 * This implementation allows for adding contributions, starting/ending campaigns,
 * and withdrawing funds if the campaign was successful.
 */
export class CrowdfundingApi {
  private readonly transactionClient: BlockchainTransactionClient | undefined;
  private readonly zkClient: RealZkClient;
  readonly sender: BlockchainAddress;

  constructor(
    transactionClient: BlockchainTransactionClient | undefined,
    zkClient: RealZkClient,
    sender: BlockchainAddress
  ) {
    this.transactionClient = transactionClient;
    this.zkClient = zkClient;
    this.sender = sender;
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