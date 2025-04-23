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

import { Buffer } from "buffer";
import {
  CLIENT,
  resetAccount,
  setAccount,
  getContractAddress,
  isConnected
} from "./AppState";
import { CryptoUtils } from "@partisiablockchain/zk-client";
import { SenderAuthentication } from "@partisiablockchain/blockchain-api-transaction-client";
import { deserializeState, CampaignStatus } from "./contract/CrowdfundingGenerated";
import { connectMpcWallet } from "./shared/MpcWalletSignatureProvider";
import { connectMetaMask } from "./shared/MetaMaskSignatureProvider";
import { connectPrivateKey } from "./shared/PrivateKeySignatureProvider";

/**
 * Function for connecting to the MetaMask wallet and setting the connected wallet in the app state.
 */
export const connectMetaMaskWalletClick = () => {
  handleWalletConnect(connectMetaMask());
};

/**
 * Function for connecting to the MPC wallet and setting the connected wallet in the app state.
 */
export const connectMpcWalletClick = () => {
  // Call Partisia SDK to initiate connection
  handleWalletConnect(connectMpcWallet());
};
/**
 * Connect to the blockchain using a private key. Reads the private key from the form.
 */
export const connectPrivateKeyWalletClick = () => {
  const privateKey = <HTMLInputElement>document.querySelector("#private-key-value");
  const keyPair = CryptoUtils.privateKeyToKeypair(privateKey.value);
  const sender = CryptoUtils.keyPairToAccountAddress(keyPair);
  handleWalletConnect(connectPrivateKey(sender, keyPair));
};

/**
 * Common code for handling a generic wallet connection.
 * @param connect the wallet connection. Can be Mpc Wallet, Metamask, or using a private key.
 */
const handleWalletConnect = (connect: Promise<SenderAuthentication>) => {
  // Clean up state
  resetAccount();
  setConnectionStatus("Connecting...");
  connect
    .then((userAccount) => {
      setAccount(userAccount);

      // Fix UI
      setConnectionStatus(`Logged in: ${userAccount.getAddress()}`);
      toggleVisibility("#wallet-connect");
      toggleVisibility("#metamask-connect");
      toggleVisibility("#private-key-connect");
      toggleVisibility("#wallet-disconnect");
      updateInteractionVisibility();
    })
    .catch((error) => {
      if ("message" in error) {
        setConnectionStatus(error.message);
      } else {
        setConnectionStatus("An error occurred trying to connect wallet: " + error);
      }
    });
};

/**
 * Reset state to disconnect current user.
 */
export const disconnectWalletClick = () => {
  resetAccount();
  setConnectionStatus("Disconnected account");
  toggleVisibility("#wallet-connect");
  toggleVisibility("#metamask-connect");
  toggleVisibility("#private-key-connect");
  toggleVisibility("#wallet-disconnect");
  updateInteractionVisibility();
};

/**
 * Structure of the raw data from a ZK WASM contract.
 */
interface RawZkContractData {
  engines: { engines: Engine[] };
  openState: { openState: { data: string } };
  variables: Array<{ key: number; value: ZkVariable }>;
}

/** dto of an engine in the zk contract object. */
interface Engine {
  /** Address of the engine. */
  identity: string;
  /** Public key of the engine encoded in base64. */
  publicKey: string;
  /** Rest interface of the engine. */
  restInterface: string;
}

/** A subset of a Zk variable on chain. */
interface ZkVariable {
  id: number;
  information: { data: string };
  owner: string;
  transaction: string;
}

/**
 * Write some of the state to the UI.
 */
export const updateContractState = () => {
  const address = getContractAddress();
  if (address === undefined) {
    throw new Error("No address provided");
  }

  const refreshLoader = <HTMLInputElement>document.querySelector("#refresh-loader");
  refreshLoader.classList.remove("hidden");

  CLIENT.getContractData<RawZkContractData>(address).then((contract) => {
    if (contract != null) {
      // Reads the state of the contract
      const stateBuffer = Buffer.from(
        contract.serializedContract.openState.openState.data,
        "base64"
      );

      const state = deserializeState(stateBuffer);

      // Update the UI with contract state
      const ownerValue = <HTMLElement>document.querySelector("#owner-value");
      ownerValue.innerHTML = `Project Owner: ${state.owner.asString()}`;

      const titleValue = <HTMLElement>document.querySelector("#title-value");
      titleValue.innerHTML = `<h4>${state.title}</h4>`;

      const descriptionValue = <HTMLElement>document.querySelector("#description-value");
      descriptionValue.innerHTML = `<p>${state.description}</p>`;

      const statusValue = <HTMLElement>document.querySelector("#status-value");
      const statusBadgeClass = getStatusBadgeClass(state.status);
      statusValue.innerHTML = `Status: <span class="badge ${statusBadgeClass}">${CampaignStatus[state.status]}</span>`;

      const fundingTargetValue = <HTMLElement>document.querySelector("#funding-target-value");
      fundingTargetValue.innerHTML = `Funding Target: ${state.fundingTarget}`;

      const deadlineValue = <HTMLElement>document.querySelector("#deadline-value");
      const deadlineDate = new Date(state.deadline);
      deadlineValue.innerHTML = `Deadline: ${deadlineDate.toLocaleString()}`;

      const numContributors = <HTMLElement>document.querySelector("#num-contributors");
      numContributors.innerHTML = `Number of Contributors: ${state.numContributors ?? "None"}`;

      const totalRaised = <HTMLElement>document.querySelector("#total-raised");
      totalRaised.innerHTML = `Total Raised: ${state.totalRaised ?? "Not yet revealed"}`;

      const campaignResult = <HTMLElement>document.querySelector("#campaign-result");
      if (state.status === CampaignStatus.Completed) {
        const resultClass = state.isSuccessful ? "result-success" : "result-failure";
        campaignResult.innerHTML = `Campaign Result: <span class="result-indicator ${resultClass}">${state.isSuccessful ? "Successful" : "Failed"}</span>`;
      } else {
        campaignResult.innerHTML = "Campaign Result: Not yet determined";
      }

      // Update action visibility based on state
      const startCampaignSection = <HTMLElement>document.querySelector("#start-campaign-section");
      const addContributionSection = <HTMLElement>document.querySelector("#add-contribution-section");
      const endCampaignSection = <HTMLElement>document.querySelector("#end-campaign-section");
      const withdrawFundsSection = <HTMLElement>document.querySelector("#withdraw-funds-section");

      // Reset all to hidden
      startCampaignSection.classList.add("hidden");
      addContributionSection.classList.add("hidden");
      endCampaignSection.classList.add("hidden");
      withdrawFundsSection.classList.add("hidden");

      // Show appropriate sections based on state
      if (state.status === CampaignStatus.Setup) {
        // Only project owner can start campaign
        if (isConnected()) {
          startCampaignSection.classList.remove("hidden");
        }
      } else if (state.status === CampaignStatus.Active) {
        // Anyone can contribute
        if (isConnected()) {
          addContributionSection.classList.remove("hidden");
          endCampaignSection.classList.remove("hidden");
        }
      } else if (state.status === CampaignStatus.Completed && state.isSuccessful) {
        // Only project owner can withdraw funds
        if (isConnected()) {
          withdrawFundsSection.classList.remove("hidden");
        }
      }

      const contractState = <HTMLElement>document.querySelector("#contract-state");
      contractState.classList.remove("hidden");
      refreshLoader.classList.add("hidden");
    } else {
      throw new Error("Could not find data for contract");
    }
  });
};

// Helper function to get the CSS class for status badges
const getStatusBadgeClass = (status: CampaignStatus): string => {
  switch (status) {
    case CampaignStatus.Setup:
      return "badge-setup";
    case CampaignStatus.Active:
      return "badge-active";
    case CampaignStatus.Computing:
      return "badge-computing";
    case CampaignStatus.Completed:
      return "badge-completed";
    default:
      return "badge-setup";
  }
};

// Count contributions (variables with type 0)
const countContributions = (variables: Array<{ key: number; value: ZkVariable }>) => {
  return Array.from(variables.values()).filter(
    (v) => Buffer.from(v.value.information.data, "base64").readUInt8() == 0
  ).length;
};

const setConnectionStatus = (status: string) => {
  const statusText = document.querySelector("#connection-status p");
  if (statusText != null) {
    statusText.innerHTML = status;
  }
};

const toggleVisibility = (selector: string) => {
  const element = document.querySelector(selector);
  if (element != null) {
    element.classList.toggle("hidden");
  }
};

export const updateInteractionVisibility = () => {
  const contractInteraction = <HTMLElement>document.querySelector("#contract-interaction");
  if (isConnected() && getContractAddress() !== undefined) {
    contractInteraction.classList.remove("hidden");
  } else {
    contractInteraction.classList.add("hidden");
  }
};