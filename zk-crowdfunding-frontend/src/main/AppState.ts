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

import { Client, RealZkClient } from "@partisiablockchain/zk-client";
import { ShardedClient } from "./client/ShardedClient";
import { CrowdfundingApi } from "./contract/CrowdfundingApi";
import {
  BlockchainTransactionClient,
  SenderAuthentication,
} from "@partisiablockchain/blockchain-api-transaction-client";
import config from "./config";

export const TESTNET_URL = config.blockchain.rpcNodeUrl || "https://node1.testnet.partisiablockchain.com";

export const CLIENT = new ShardedClient(TESTNET_URL, ["Shard0", "Shard1", "Shard2"]);

let contractAddress: string | undefined;
let currentAccount: SenderAuthentication | undefined;
let crowdfundingApi: CrowdfundingApi | undefined;

export const setAccount = (account: SenderAuthentication | undefined) => {
  currentAccount = account;
  setCrowdfundingApi();
};

export const resetAccount = () => {
  currentAccount = undefined;
  crowdfundingApi = undefined;
};

export const isConnected = () => {
  return currentAccount != null;
};

export const setCrowdfundingApi = () => {
  let transactionClient = undefined;
  let zkClient = undefined;
  if (currentAccount != undefined && contractAddress != null) {
    transactionClient = BlockchainTransactionClient.create(
      TESTNET_URL,
      currentAccount
    );
    zkClient = RealZkClient.create(contractAddress, new Client(TESTNET_URL));
    crowdfundingApi = new CrowdfundingApi(transactionClient, zkClient, currentAccount.getAddress());
  }
};

export const getCrowdfundingApi = () => {
  return crowdfundingApi;
};

export const getContractAddress = () => {
  return contractAddress;
};

export const setContractAddress = (address: string) => {
  contractAddress = address;
  localStorage.setItem('contractAddress', address); // Save to localStorage for persistence
  setCrowdfundingApi();
};

// Initialize contract address from saved value if available
if (typeof window !== 'undefined' && window.localStorage) {
  const savedAddress = localStorage.getItem('contractAddress');
  if (savedAddress) {
    contractAddress = savedAddress;
  } else if (config.contractAddress) {
    contractAddress = config.contractAddress;
  }
}