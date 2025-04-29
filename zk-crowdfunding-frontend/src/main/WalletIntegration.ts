// zk-crowdfunding-frontend/src/main/WalletIntegration.ts
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
import { connectPrivateKey } from "./shared/PrivateKeySignatureProvider";


// Add this to the WalletIntegration.ts file at the appropriate locations

/**
 * Set connection status
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

/**
 * Count contributions (variables with type 0)
 */
const countContributions = (variables: Array<{ key: number; value: ZkVariable }>) => {
  if (!Array.isArray(variables)) {
    return 0;
  }
  
  return Array.from(variables).filter(
    (v) => {
      try {
        if (v.value && v.value.information && v.value.information.data) {
          return Buffer.from(v.value.information.data, "base64").readUInt8() === 0;
        }
        return false;
      } catch (error) {
        console.error("Error filtering variables:", error);
        return false;
      }
    }
  ).length;
};

/**
 * Connect to the blockchain using a private key.
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
 */
const handleWalletConnect = (connect: Promise<SenderAuthentication>) => {
  resetAccount();
  setConnectionStatus("Connecting...");
  connect
    .then((userAccount) => {
      setAccount(userAccount);

      // Fix UI
      setConnectionStatus(`Logged in: ${userAccount.getAddress()}`);
      toggleVisibility("#private-key-connect");
      toggleVisibility("#wallet-disconnect");
      updateInteractionVisibility();
      
      // Update state if contract address is set
      if (getContractAddress()) {
        updateContractState();
      }
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

  // Clear any previous error messages
  const errorContainers = document.querySelectorAll(".error-message");
  errorContainers.forEach(container => container.remove());

  CLIENT.getContractData<RawZkContractData>(address)
    .then((contract) => {
      if (contract != null && contract.serializedContract?.openState?.openState?.data) {
        try {
          // Reads the state of the contract
          const stateBuffer = Buffer.from(
            contract.serializedContract.openState.openState.data,
            "base64"
          );
          
          // Deserialize state
          const state = deserializeState(stateBuffer);
          
          // Update the UI with contract state
          updateUIWithContractState(state, contract.serializedContract.variables);
          
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
function updateUIWithContractState(state, variables) {
  // Count the number of contributions
  const contributionCount = countContributions(variables);
  
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
    if (state.deadline === 0) {
      deadlineValue.innerHTML = `Deadline: No deadline set`;
    } else {
      deadlineValue.innerHTML = `Deadline: ${deadlineDate.toLocaleString()}`;
    }
  }
  
  // Update contributors
  const numContributors = <HTMLElement>document.querySelector("#num-contributors");
  if (numContributors) {
    numContributors.innerHTML = `Number of Contributors: ${state.numContributors ?? contributionCount}`;
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
  const addContributionSection = <HTMLElement>document.querySelector("#add-contribution-section");
  const endCampaignSection = <HTMLElement>document.querySelector("#end-campaign-section");
  const withdrawFundsSection = <HTMLElement>document.querySelector("#withdraw-funds-section");

  // Reset all to hidden
  if (addContributionSection) addContributionSection.classList.add("hidden");
  if (endCampaignSection) endCampaignSection.classList.add("hidden");
  if (withdrawFundsSection) withdrawFundsSection.classList.add("hidden");

  // Only show actions if user is connected
  if (!isConnected()) {
    return;
  }

  // Show appropriate sections based on state
  if (state.status === CampaignStatus.Active) {
    // Anyone can contribute when campaign is active
    if (addContributionSection) {
      addContributionSection.classList.remove("hidden");
    }
    // Anyone can end campaign (owner or anyone after deadline)
    if (endCampaignSection) {
      endCampaignSection.classList.remove("hidden");
    }
  } else if (state.status === CampaignStatus.Completed && state.isSuccessful) {
    // Only project owner can withdraw funds
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
    // If contract state section doesn't exist yet, add to the main content
    const mainContent = document.querySelector(".pure-u-1-1");
    if (mainContent) {
      mainContent.appendChild(errorElement);
    }
  }
}