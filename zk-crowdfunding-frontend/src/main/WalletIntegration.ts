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
  getFactoryAddress,
  isConnected,
  getCrowdfundingApi
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
 * Connect to the blockchain using a private key.
 * @param privateKeyValue The private key string value
 */
export const connectPrivateKeyWalletClick = (privateKeyValue?: string) => {
  const privateKeyInput = privateKeyValue || 
    (<HTMLInputElement>document.querySelector("#private-key-value"))?.value;
  
  if (!privateKeyInput) {
    console.error("No private key provided");
    return;
  }
  
  try {
    const keyPair = CryptoUtils.privateKeyToKeypair(privateKeyInput);
    const sender = CryptoUtils.keyPairToAccountAddress(keyPair);
    handleWalletConnect(connectPrivateKey(sender, keyPair));
  } catch (error) {
    console.error("Error connecting with private key:", error);
    setConnectionStatus(`Error connecting wallet: ${error.message || error}`);
  }
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
      
      // Update state if contract address is set
      if (getContractAddress()) {
        updateContractState();
      }
      
      // Show campaign creation section if connected
      const campaignCreationSection = document.querySelector("#campaign-creation-section");
      if (campaignCreationSection && getFactoryAddress()) {
        campaignCreationSection.classList.remove("hidden");
      }
      
      // Load user's campaigns
      loadMyCampaigns();
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
  
  // Hide campaign creation section
  const campaignCreationSection = document.querySelector("#campaign-creation-section");
  if (campaignCreationSection) {
    campaignCreationSection.classList.add("hidden");
  }
  
  // Hide my campaigns section
  const myCampaignsSection = document.querySelector("#my-campaigns-section");
  if (myCampaignsSection) {
    myCampaignsSection.classList.add("hidden");
  }
};

/**
 * Load user's campaigns from the factory
 */
const loadMyCampaigns = async () => {
  if (!isConnected() || !getFactoryAddress()) {
    return;
  }
  
  const api = getCrowdfundingApi();
  if (!api) return;
  
  try {
    // This would normally call the factory contract to get user's campaigns
    // For now, we'll simulate it with mock data
    const campaigns = [
      {
        address: "0xabc...def",
        title: "My Test Campaign",
        description: "This is a test campaign",
        funding_target: 1000,
        deadline: Date.now() + 86400000 * 7 // 7 days from now
      }
    ];
    
    // Update the UI with campaigns
    const myCampaignsSection = document.querySelector("#my-campaigns-section");
    const myCampaignsList = document.querySelector("#my-campaigns-list");
    
    if (myCampaignsSection && myCampaignsList) {
      if (campaigns.length > 0) {
        myCampaignsSection.classList.remove("hidden");
        myCampaignsList.innerHTML = campaigns.map(campaign => `
          <div class="campaign-item" style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 5px; cursor: pointer;"
               onclick="window.selectCampaign('${campaign.address}')">
            <h4>${campaign.title}</h4>
            <p>${campaign.description}</p>
            <p><strong>Target:</strong> ${campaign.funding_target}</p>
            <p><strong>Deadline:</strong> ${new Date(campaign.deadline).toLocaleString()}</p>
            <p><strong>Address:</strong> ${campaign.address}</p>
          </div>
        `).join('');
      } else {
        myCampaignsList.innerHTML = "<p>No campaigns found</p>";
      }
    }
  } catch (error) {
    console.error("Error loading campaigns:", error);
  }
};

// Add global function to select a campaign
window.selectCampaign = (address: string) => {
  const addressInput = document.querySelector("#address-value") as HTMLInputElement;
  const addressBtn = document.querySelector("#address-btn") as HTMLButtonElement;
  
  if (addressInput && addressBtn) {
    addressInput.value = address;
    addressBtn.click();
  }
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
 * Update contract state and UI
 */
export const updateContractState = () => {
  const address = getContractAddress();
  if (address === undefined) {
    console.error("No address provided");
    return;
  }

  const refreshLoader = <HTMLInputElement>document.querySelector("#refresh-loader");
  if (refreshLoader) {
    refreshLoader.classList.remove("hidden");
  }

  CLIENT.getContractData<RawZkContractData>(address)
    .then((contract) => {
      if (contract != null && contract.serializedContract?.openState?.openState?.data) {
        try {
          // Reads the state of the contract
          const stateBuffer = Buffer.from(
            contract.serializedContract.openState.openState.data,
            "base64"
          );
          
          const state = deserializeState(stateBuffer);

          // Update the UI with contract state
          updateUIWithContractState(state);
          
          // Update action visibility based on state
          updateActionVisibility(state);

          const contractState = <HTMLElement>document.querySelector("#contract-state");
          if (contractState) {
            contractState.classList.remove("hidden");
          }
        } catch (err) {
          console.error("Error processing contract state:", err);
          showErrorMessage(`Error processing contract state: ${err.message}`);
        }
      } else {
        showErrorMessage("Could not find data for contract. Make sure the contract is deployed correctly.");
      }
    })
    .catch(err => {
      console.error("Error fetching contract data:", err);
      showErrorMessage(`Error fetching contract data: ${err.message}`);
    })
    .finally(() => {
      if (refreshLoader) {
        refreshLoader.classList.add("hidden");
      }
    });
};

/**
 * Update UI elements with contract state
 */
function updateUIWithContractState(state) {
  // Update owner
  const ownerValue = <HTMLElement>document.querySelector("#owner-value");
  if (ownerValue) {
    ownerValue.innerHTML = `Project Owner: ${state.owner.asString()}`;
  }
  
  // Update title
  const titleValue = <HTMLElement>document.querySelector("#title-value");
  if (titleValue) {
    titleValue.innerHTML = `<h4>${state.title}</h4>`;
  }
  
  // Update description
  const descriptionValue = <HTMLElement>document.querySelector("#description-value");
  if (descriptionValue) {
    descriptionValue.innerHTML = `<p>${state.description}</p>`;
  }
  
  // Update status
  const statusValue = <HTMLElement>document.querySelector("#status-value");
  if (statusValue) {
    const statusText = CampaignStatus[state.status];
    statusValue.innerHTML = `Status: <span class="badge badge-${statusText.toLowerCase()}">${statusText}</span>`;
  }
  
  // Update funding target
  const fundingTargetValue = <HTMLElement>document.querySelector("#funding-target-value");
  if (fundingTargetValue) {
    fundingTargetValue.innerHTML = `Funding Target: ${state.fundingTarget}`;
  }
  
  // Update deadline
  const deadlineValue = <HTMLElement>document.querySelector("#deadline-value");
  if (deadlineValue) {
    const deadlineDate = new Date(state.deadline);
    deadlineValue.innerHTML = `Deadline: ${deadlineDate.toLocaleString()}`;
  }
  
  // Update contributors
  const numContributors = <HTMLElement>document.querySelector("#num-contributors");
  if (numContributors) {
    numContributors.innerHTML = `Number of Contributors: ${state.numContributors ?? "None"}`;
  }
  
  // Update total raised
  const totalRaised = <HTMLElement>document.querySelector("#total-raised");
  if (totalRaised) {
    totalRaised.innerHTML = `Total Raised: ${state.totalRaised ?? "Not yet revealed"}`;
  }
  
  // Update campaign result
  const campaignResult = <HTMLElement>document.querySelector("#campaign-result");
  if (campaignResult) {
    if (state.status === CampaignStatus.Completed) {
      const resultClass = state.isSuccessful ? "result-success" : "result-failure";
      campaignResult.innerHTML = `Campaign Result: <span class="result-indicator ${resultClass}">${state.isSuccessful ? "Successful" : "Failed"}</span>`;
    } else {
      campaignResult.innerHTML = "Campaign Result: Not yet determined";
    }
  }
}

/**
 * Update action visibility based on contract state
 */
function updateActionVisibility(state) {
  const startCampaignSection = <HTMLElement>document.querySelector("#start-campaign-section");
  const addContributionSection = <HTMLElement>document.querySelector("#add-contribution-section");
  const endCampaignSection = <HTMLElement>document.querySelector("#end-campaign-section");
  const withdrawFundsSection = <HTMLElement>document.querySelector("#withdraw-funds-section");

  // Reset all to hidden
  if (startCampaignSection) startCampaignSection.classList.add("hidden");
  if (addContributionSection) addContributionSection.classList.add("hidden");
  if (endCampaignSection) endCampaignSection.classList.add("hidden");
  if (withdrawFundsSection) withdrawFundsSection.classList.add("hidden");

  // Only show actions if user is connected
  if (!isConnected()) {
    return;
  }

  // Show appropriate sections based on state
  if (state.status === CampaignStatus.Setup) {
    if (startCampaignSection) {
      startCampaignSection.classList.remove("hidden");
    }
  } else if (state.status === CampaignStatus.Active) {
    if (addContributionSection) {
      addContributionSection.classList.remove("hidden");
    }
    if (endCampaignSection) {
      endCampaignSection.classList.remove("hidden");
    }
  } else if (state.status === CampaignStatus.Completed && state.isSuccessful) {
    if (withdrawFundsSection) {
      withdrawFundsSection.classList.remove("hidden");
    }
  }
}

/**
 * Show error message in UI
 */
function showErrorMessage(message) {
  console.error(message);
  
  const errorElement = document.createElement("div");
  errorElement.className = "error-message";
  errorElement.style.color = "red";
  errorElement.style.padding = "10px";
  errorElement.style.marginTop = "10px";
  errorElement.style.border = "1px solid red";
  errorElement.style.borderRadius = "5px";
  errorElement.textContent = message;
  
  const contractState = document.querySelector("#contract-state");
  if (contractState) {
    contractState.appendChild(errorElement);
  } else {
    const mainContent = document.querySelector(".pure-u-1-1");
    if (mainContent) {
      mainContent.appendChild(errorElement);
    }
  }
}

/**
 * Update connection status in UI
 */
const setConnectionStatus = (status: string) => {
  const statusText = document.querySelector("#connection-status p");
  if (statusText != null) {
    statusText.innerHTML = status;
  }
};

/**
 * Toggle element visibility
 */
const toggleVisibility = (selector: string) => {
  const element = document.querySelector(selector);
  if (element != null) {
    element.classList.toggle("hidden");
  }
};

/**
 * Update contract interaction visibility
 */
export const updateInteractionVisibility = () => {
  const contractInteraction = <HTMLElement>document.querySelector("#contract-interaction");
  if (isConnected() && getContractAddress() !== undefined) {
    if (contractInteraction) {
      contractInteraction.classList.remove("hidden");
    }
  } else {
    if (contractInteraction) {
      contractInteraction.classList.add("hidden");
    }
  }
};