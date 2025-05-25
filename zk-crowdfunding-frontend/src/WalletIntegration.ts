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
import { connectMpcWallet } from "./shared/MpcWalletSignatureProvider";
import { connectMetaMask } from "./shared/MetaMaskSignatureProvider";

/**
 * Set wallet connection status only (don't use for general messages)
 */
const setWalletConnectionStatus = (status: string) => {
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
    console.log("Variables is not an array:", variables);
    return 0;
  }
  
  try {
    return Array.from(variables).filter(
      (v) => {
        try {
          if (v && v.value && v.value.information && v.value.information.data) {
            return Buffer.from(v.value.information.data, "base64").readUInt8() === 0;
          }
          return false;
        } catch (error) {
          console.error("Error filtering variable:", error, v);
          return false;
        }
      }
    ).length;
  } catch (error) {
    console.error("Error counting contributions:", error);
    return 0;
  }
};

/**
 * Connect to the blockchain using a private key.
 */
export const connectPrivateKeyWalletClick = (privateKeyValue?: string) => {
  const privateKeyInput = privateKeyValue || 
    (<HTMLInputElement>document.querySelector("#private-key-value"))?.value;
  
  if (!privateKeyInput) {
    console.error("No private key provided");
    setWalletConnectionStatus("Error: No private key provided");
    return;
  }
  
  try {
    const keyPair = CryptoUtils.privateKeyToKeypair(privateKeyInput);
    const sender = CryptoUtils.keyPairToAccountAddress(keyPair);
    handleWalletConnect(connectPrivateKey(sender, keyPair), 'privateKey');
  } catch (error) {
    console.error("Error connecting with private key:", error);
    setWalletConnectionStatus(`Error connecting wallet: ${error.message || error}`);
  }
};

/**
 * Connect to the blockchain using MPC wallet browser extension.
 */
export const connectMpcWalletClick = () => {
  console.log("Attempting to connect MPC wallet");
  setWalletConnectionStatus("Connecting to MPC wallet...");
  
  try {
    handleWalletConnect(connectMpcWallet(), 'mpc');
  } catch (error) {
    console.error("Error connecting MPC wallet:", error);
    setWalletConnectionStatus(`Error connecting MPC wallet: ${error.message || error}`);
  }
};

/**
 * Connect to the blockchain using MetaMask snap.
 */
export const connectMetaMaskWalletClick = () => {
  console.log("Attempting to connect MetaMask");
  setWalletConnectionStatus("Connecting to MetaMask...");
  
  try {
    handleWalletConnect(connectMetaMask(), 'metamask');
  } catch (error) {
    console.error("Error connecting MetaMask:", error);
    setWalletConnectionStatus(`Error connecting MetaMask: ${error.message || error}`);
  }
};

/**
 * Common code for handling a generic wallet connection.
 */
const handleWalletConnect = (connect: Promise<SenderAuthentication>, walletType: 'privateKey' | 'mpc' | 'metamask') => {
  resetAccount();
  setWalletConnectionStatus("Connecting...");
  connect
    .then((userAccount) => {
      setAccount(userAccount, walletType);

      // Fix UI - set the connection status and keep it
      const address = userAccount.getAddress();
      setWalletConnectionStatus(`Connected: ${address}`);
      
      // Update UI based on wallet type
      updateWalletConnectionUI(true, walletType);
      updateInteractionVisibility();
      
      // Update state if contract address is set
      if (getContractAddress()) {
        updateContractState();
      }
    })
    .catch((error) => {
      console.error("Wallet connection error:", error);
      if (error && typeof error === 'object' && 'message' in error) {
        setWalletConnectionStatus(error.message as string);
      } else {
        setWalletConnectionStatus("An error occurred trying to connect wallet: " + error);
      }
    });
};

/**
 * Update wallet connection UI elements
 */
const updateWalletConnectionUI = (connected: boolean, walletType?: 'privateKey' | 'mpc' | 'metamask') => {
  const walletConnectOptions = document.querySelector("#wallet-connect-options");
  const walletDisconnect = document.querySelector("#wallet-disconnect");
  
  if (connected) {
    // Hide all connection options and show disconnect
    if (walletConnectOptions) walletConnectOptions.classList.add("hidden");
    if (walletDisconnect) walletDisconnect.classList.remove("hidden");
    
    // Update wallet type indicator if needed
    const walletTypeIndicator = document.querySelector("#wallet-type");
    if (walletTypeIndicator && walletType) {
      const typeLabels = {
        'privateKey': 'Private Key',
        'mpc': 'MPC Wallet',
        'metamask': 'MetaMask'
      };
      walletTypeIndicator.textContent = typeLabels[walletType];
    }
  } else {
    // Show connection options and hide disconnect
    if (walletConnectOptions) walletConnectOptions.classList.remove("hidden");
    if (walletDisconnect) walletDisconnect.classList.add("hidden");
  }
};

/**
 * Reset state to disconnect current user.
 */
export const disconnectWalletClick = () => {
  resetAccount();
  setWalletConnectionStatus("Currently not logged in.");
  updateWalletConnectionUI(false);
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

  console.log("Updating contract state for address:", address);

  const refreshLoader = <HTMLInputElement>document.querySelector("#refresh-loader");
  if (refreshLoader) {
    refreshLoader.classList.remove("hidden");
  }

  // Clear any previous error messages
  const errorContainers = document.querySelectorAll(".error-message");
  errorContainers.forEach(container => container.remove());

  CLIENT.getContractData<RawZkContractData>(address)
    .then((contract) => {
      console.log("Contract data received:", contract);
      
      if (contract != null && contract.serializedContract?.openState?.openState?.data) {
        try {
          console.log("Raw contract state data:", contract.serializedContract.openState.openState.data);
          
          // Reads the state of the contract
          const stateBuffer = Buffer.from(
            contract.serializedContract.openState.openState.data,
            "base64"
          );
          
          console.log("State buffer created, about to deserialize...");
          
          // Deserialize state
          const state = deserializeState(stateBuffer);
          console.log("Deserialized state:", state);
          
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
        console.error("Contract data is null or missing expected structure");
        showErrorMessage("Could not find data for contract. Make sure the contract is deployed correctly.");
      }
    })
    .catch(err => {
      console.error("Error fetching contract data:", err);
      showErrorMessage(`Error fetching contract data: ${err.message || String(err)}`);
    })
    .finally(() => {
      if (refreshLoader) {
        refreshLoader.classList.add("hidden");
      }
    });
};

/**
 * Update UI elements with contract state
 * Adding null checking and error handling
 */
function updateUIWithContractState(state, variables) {
  console.log("Updating UI with state:", state);
  
  try {
    // Count the number of contributions
    const contributionCount = countContributions(variables);
    
    // Update owner
    const ownerValue = <HTMLElement>document.querySelector("#owner-value");
    if (ownerValue && state.owner) {
      try {
        ownerValue.innerHTML = `${state.owner.asString()}`;
      } catch (error) {
        console.error("Error displaying owner address:", error);
        ownerValue.innerHTML = `Unknown`;
      }
    }
    
    // Update title
    const titleValue = <HTMLElement>document.querySelector("#title-value");
    if (titleValue) {
      titleValue.innerHTML = `<h4>${state.title || "Untitled Project"}</h4>`;
    }
    
    // Update description
    const descriptionValue = <HTMLElement>document.querySelector("#description-value");
    if (descriptionValue) {
      descriptionValue.innerHTML = `<p>${state.description || "No description available"}</p>`;
    }
    
    // Update status
    const statusValue = <HTMLElement>document.querySelector("#status-value");
    if (statusValue && typeof state.status !== 'undefined') {
      const statusText = CampaignStatus[state.status] || "Unknown";
      statusValue.innerHTML = `<span class="badge badge-${statusText.toLowerCase()}">${statusText}</span>`;
    }
    
    // Update funding target
    const fundingTargetValue = <HTMLElement>document.querySelector("#funding-target-value");
    if (fundingTargetValue) {
      fundingTargetValue.innerHTML = `${state.fundingTarget || "Not set"}`;
    }
    
    // Update deadline if present
    const deadlineValue = <HTMLElement>document.querySelector("#deadline-value");
    if (deadlineValue && typeof state.deadline !== 'undefined') {
      if (state.deadline === 0) {
        deadlineValue.innerHTML = `No deadline set`;
      } else {
        try {
          const deadlineDate = new Date(state.deadline);
          deadlineValue.innerHTML = `${deadlineDate.toLocaleString()}`;
        } catch (error) {
          console.error("Error formatting deadline:", error);
          deadlineValue.innerHTML = `${state.deadline}`;
        }
      }
    }
    
    // Update contributors
    const numContributors = <HTMLElement>document.querySelector("#num-contributors");
    if (numContributors) {
      numContributors.innerHTML = `${state.numContributors ?? contributionCount}`;
    }
    
    // Update total raised
    const totalRaised = <HTMLElement>document.querySelector("#total-raised");
    if (totalRaised) {
      const totalRaisedText = state.totalRaised !== undefined && state.totalRaised !== null
        ? state.totalRaised.toString()
        : "Not yet revealed";
      totalRaised.innerHTML = `${totalRaisedText}`;
    }
    
    // Update campaign result
    const campaignResult = <HTMLElement>document.querySelector("#campaign-result");
    if (campaignResult) {
      if (state.status === CampaignStatus.Completed) {
        const resultClass = state.isSuccessful ? "result-success" : "result-failure";
        campaignResult.innerHTML = `<span class="result-indicator ${resultClass}">${state.isSuccessful ? "Successful" : "Failed"}</span>`;
        
        // Show the campaign result container when completed
        const campaignResultContainer = <HTMLElement>document.querySelector("#campaign-result-container");
        if (campaignResultContainer) {
          campaignResultContainer.classList.remove("hidden");
          
          // Update result box styling
          const resultBox = <HTMLElement>document.querySelector("#result-box");
          if (resultBox) {
            resultBox.className = state.isSuccessful ? "result-box success" : "result-box failure";
          }
        }
      } else {
        campaignResult.innerHTML = "Not yet determined";
      }
    }
  } catch (error) {
    console.error("Error updating UI with contract state:", error);
    showErrorMessage(`Error updating UI: ${error.message}`);
  }
}

/**
 * Update action visibility based on contract state
 */
function updateActionVisibility(state) {
  try {
    const addContributionSection = <HTMLElement>document.querySelector("#add-contribution-section");
    const endCampaignSection = <HTMLElement>document.querySelector("#end-campaign-section");
    const withdrawFundsSection = <HTMLElement>document.querySelector("#withdraw-funds-section");
    const verificationSection = <HTMLElement>document.querySelector("#verification-section");

    // Reset all to hidden
    if (addContributionSection) addContributionSection.classList.add("hidden");
    if (endCampaignSection) endCampaignSection.classList.add("hidden");
    if (withdrawFundsSection) withdrawFundsSection.classList.add("hidden");
    if (verificationSection) verificationSection.classList.add("hidden");

    // Only show actions if user is connected
    if (!isConnected()) {
      return;
    }

    console.log("Updating action visibility for state:", state);

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
    } else if (state.status === CampaignStatus.Completed) {
      // Show verification for completed campaigns
      if (verificationSection) {
        verificationSection.classList.remove("hidden");
      }
      
      // Only show withdraw if campaign was successful
      if (state.isSuccessful && withdrawFundsSection) {
        withdrawFundsSection.classList.remove("hidden");
      }
    }
  } catch (error) {
    console.error("Error updating action visibility:", error);
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